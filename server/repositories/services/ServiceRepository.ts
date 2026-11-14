import { asc, and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { ServiceCreateRequest, ServiceUpdateRequest } from "#shared/api/services";
import { getDb } from "../../db";
import { changedRows } from "../../db/changes";
import { serviceEndpoints, services } from "../../db/schema";
import { ServiceEndpointOwnershipError, ServiceHeaderTemplateOwnershipError } from "./errors";
import {
  deactivateInvalidMockApis,
  getEnvironmentVariableValues,
  isHeaderTemplateOwned,
  listHeaderTemplates,
} from "../../modules/mock-apis";
import { putProtoFile, removeProtoFile } from "../../utils/proto-storage";
import { GraphPositionRepository } from "../../modules/graph-canvas";

type Database = ReturnType<typeof getDb>;

export class ServiceRepository {
  constructor(private readonly db: Database) {}
  listServiceNames(projectId: string) {
    return this.db
      .select({ name: services.name })
      .from(services)
      .where(eq(services.projectId, projectId));
  }
  listServiceSummaries(projectId: string) {
    return this.db
      .select({ id: services.id, name: services.name })
      .from(services)
      .where(eq(services.projectId, projectId));
  }
  listEndpointOwners(projectId: string) {
    return this.db
      .select({ id: serviceEndpoints.id, serviceId: serviceEndpoints.serviceId })
      .from(serviceEndpoints)
      .where(eq(serviceEndpoints.projectId, projectId));
  }
  async listServices(projectId: string) {
    const db = this.db;
    const rows = await db
      .select()
      .from(services)
      .where(eq(services.projectId, projectId))
      .orderBy(asc(services.createdAt));
    const endpoints = await db
      .select()
      .from(serviceEndpoints)
      .where(eq(serviceEndpoints.projectId, projectId));
    return rows.map((service) => ({
      ...service,
      createdAt: service.createdAt.toISOString(),
      endpoints: endpoints
        .filter((endpoint) => endpoint.serviceId === service.id)
        .map((endpoint) => ({ ...endpoint, createdAt: endpoint.createdAt.toISOString() })),
    }));
  }

  async createService(projectId: string, id: string, input: ServiceCreateRequest) {
    const db = this.db;
    const protoStorageKey =
      input.apiType === "GRPC" && input.protoContent
        ? `services/${id}/${randomUUID()}.proto`
        : null;
    if (protoStorageKey) await putProtoFile(protoStorageKey, input.protoContent!);
    try {
      await db.transaction(async (tx) => {
        if (input.healthCheckHeaderTemplateId) {
          if (!(await isHeaderTemplateOwned(tx, projectId, input.healthCheckHeaderTemplateId)))
            throw new ServiceHeaderTemplateOwnershipError(
              "Selected health-check header template is not in this project",
            );
        }
        await tx.insert(services).values({
          id,
          projectId,
          name: input.name,
          apiType: input.apiType,
          framework: input.framework,
          baseUrl: input.baseUrl,
          grpcTls: input.grpcTls,
          protoStorageKey,
          protoFileName: protoStorageKey ? (input.protoFileName ?? null) : null,
          healthCheckUrl: input.healthCheckUrl,
          healthCheckHeaderTemplateId: input.healthCheckHeaderTemplateId,
          healthCheckCustomHeaders: input.healthCheckCustomHeaders,
          active: input.active,
        });
        await new GraphPositionRepository(tx).createServicePosition(
          projectId,
          id,
          input.positionX ?? 0,
          input.positionY ?? 0,
        );
        if (input.endpoints.length)
          await tx.insert(serviceEndpoints).values(
            input.endpoints.map(({ id: _id, ...endpoint }) => ({
              ...endpoint,
              method: endpoint.method ?? null,
              url: endpoint.url ?? null,
              rpcMethod: endpoint.rpcMethod ?? null,
              id: randomUUID(),
              projectId,
              serviceId: id,
            })),
          );
      });
    } catch (error) {
      if (protoStorageKey) await removeProtoFile(protoStorageKey).catch(() => {});
      throw error;
    }
  }

  async updateService(projectId: string, id: string, input: ServiceUpdateRequest) {
    const db = this.db;
    const [existing] = await db
      .select({
        id: services.id,
        protoStorageKey: services.protoStorageKey,
        protoFileName: services.protoFileName,
      })
      .from(services)
      .where(and(eq(services.id, id), eq(services.projectId, projectId)));
    if (!existing) return "not-found" as const;

    const newProtoStorageKey =
      input.apiType === "GRPC" && input.protoContent
        ? `services/${id}/${randomUUID()}.proto`
        : null;
    const clearProto = input.apiType !== "GRPC" || input.clearProto;
    let protoFileName = existing.protoFileName;
    if (clearProto) protoFileName = null;
    else if (newProtoStorageKey) protoFileName = input.protoFileName ?? null;
    if (newProtoStorageKey) await putProtoFile(newProtoStorageKey, input.protoContent!);

    try {
      await db.transaction(async (tx) => {
        if (input.healthCheckHeaderTemplateId) {
          if (!(await isHeaderTemplateOwned(tx, projectId, input.healthCheckHeaderTemplateId)))
            throw new ServiceHeaderTemplateOwnershipError(
              "Selected health-check header template is not in this project",
            );
        }
        await tx
          .update(services)
          .set({
            name: input.name,
            apiType: input.apiType,
            framework: input.framework,
            baseUrl: input.baseUrl,
            grpcTls: input.grpcTls,
            protoStorageKey: clearProto ? null : (newProtoStorageKey ?? existing.protoStorageKey),
            protoFileName,
            healthCheckUrl: input.healthCheckUrl,
            healthCheckHeaderTemplateId: input.healthCheckHeaderTemplateId,
            healthCheckCustomHeaders: input.healthCheckCustomHeaders,
            active: input.active,
          })
          .where(eq(services.id, id));
        const oldEndpoints = await tx
          .select({ id: serviceEndpoints.id })
          .from(serviceEndpoints)
          .where(eq(serviceEndpoints.serviceId, id));
        const retainedIds = input.endpoints.flatMap((endpoint) =>
          endpoint.id ? [endpoint.id] : [],
        );
        const validRetained = new Set(oldEndpoints.map((endpoint) => endpoint.id));
        if (retainedIds.some((endpointId) => !validRetained.has(endpointId)))
          throw new ServiceEndpointOwnershipError("Endpoint id does not belong to this service");
        const removedIds = oldEndpoints
          .map(({ id: endpointId }) => endpointId)
          .filter((endpointId) => !retainedIds.includes(endpointId));
        if (removedIds.length)
          await tx.delete(serviceEndpoints).where(inArray(serviceEndpoints.id, removedIds));
        await Promise.all(
          input.endpoints.map(async (endpoint) => {
            const values = {
              projectId,
              serviceId: id,
              name: endpoint.name,
              method: endpoint.method ?? null,
              url: endpoint.url ?? null,
              rpcMethod: endpoint.rpcMethod ?? null,
            };
            if (endpoint.id)
              await tx
                .update(serviceEndpoints)
                .set(values)
                .where(
                  and(eq(serviceEndpoints.id, endpoint.id), eq(serviceEndpoints.serviceId, id)),
                );
            else await tx.insert(serviceEndpoints).values({ id: randomUUID(), ...values });
          }),
        );
        await deactivateInvalidMockApis(tx, projectId);
      });
    } catch (error) {
      if (newProtoStorageKey) await removeProtoFile(newProtoStorageKey).catch(() => {});
      throw error;
    }
    if (existing.protoStorageKey && (clearProto || newProtoStorageKey))
      await removeProtoFile(existing.protoStorageKey);
    return "updated" as const;
  }

  async deleteService(projectId: string, id: string): Promise<boolean> {
    const db = this.db;
    const result = await db.transaction(async (tx) => {
      const [service] = await tx
        .select({ protoStorageKey: services.protoStorageKey })
        .from(services)
        .where(and(eq(services.id, id), eq(services.projectId, projectId)));
      if (!service) return { deleted: false, protoStorageKey: null };
      await new GraphPositionRepository(tx).deleteServicePosition(projectId, id);
      const result = await tx
        .delete(services)
        .where(and(eq(services.id, id), eq(services.projectId, projectId)));
      if (changedRows(result)) await deactivateInvalidMockApis(tx, projectId);
      return { deleted: changedRows(result) > 0, protoStorageKey: service.protoStorageKey };
    });
    if (result.deleted && result.protoStorageKey) await removeProtoFile(result.protoStorageKey);
    return result.deleted;
  }

  listHealthTargets(projectId: string) {
    const db = this.db;
    return Promise.all([
      db
        .select({
          id: services.id,
          framework: services.framework,
          baseUrl: services.baseUrl,
          healthCheckUrl: services.healthCheckUrl,
          healthCheckHeaderTemplateId: services.healthCheckHeaderTemplateId,
          healthCheckCustomHeaders: services.healthCheckCustomHeaders,
        })
        .from(services)
        .where(eq(services.projectId, projectId)),
      listHeaderTemplates(projectId),
      getEnvironmentVariableValues(projectId),
    ]).then(([targets, templates, variableRows]) => {
      const variables = new Map(variableRows.map(({ name, value }) => [name, value]));
      const templateHeaders = new Map(templates.map(({ id, headers }) => [id, headers]));
      return targets.map((target) => ({
        ...target,
        headerTemplateHeaders: target.healthCheckHeaderTemplateId
          ? (templateHeaders.get(target.healthCheckHeaderTemplateId) ?? [])
          : [],
        variables,
      }));
    });
  }
}
