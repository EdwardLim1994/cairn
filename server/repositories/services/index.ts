import { asc, and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { ServiceCreateRequest, ServiceUpdateRequest } from "#shared/api/services";
import { getDb } from "../../db";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "../../db/schema";
import {
  environmentVariables,
  graphNodePositions,
  headerTemplates,
  serviceEndpoints,
  services,
} from "../../db/schema";
import { ServiceEndpointOwnershipError, ServiceHeaderTemplateOwnershipError } from "./errors";
import { deactivateInvalidMockApis } from "../mock-apis/reconcile-readiness";
import { putProtoFile, removeProtoFile } from "../../utils/proto-storage";

type Database = MySql2Database<typeof schema>;

export async function listServices(projectId: string) {
  const db = getDb();
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

export async function createService(projectId: string, id: string, input: ServiceCreateRequest) {
  const db = getDb();
  const protoStorageKey =
    input.apiType === "GRPC" && input.protoContent ? `services/${id}/${randomUUID()}.proto` : null;
  if (protoStorageKey) await putProtoFile(protoStorageKey, input.protoContent!);
  try {
    await db.transaction(async (tx) => {
      if (input.healthCheckHeaderTemplateId) {
        const [template] = await tx
          .select({ id: headerTemplates.id })
          .from(headerTemplates)
          .where(
            and(
              eq(headerTemplates.id, input.healthCheckHeaderTemplateId),
              eq(headerTemplates.projectId, projectId),
            ),
          );
        if (!template)
          throw new ServiceHeaderTemplateOwnershipError(
            "Selected health-check header template is not in this project",
          );
      }
      await tx.insert(services).values({
        id,
        projectId,
        codeKey: input.codeKey ?? randomUUID(),
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
      await tx.insert(graphNodePositions).values({
        id: randomUUID(),
        projectId,
        nodeType: "service",
        entityId: id,
        positionX: input.positionX ?? 0,
        positionY: input.positionY ?? 0,
      });
      if (input.endpoints.length)
        await tx.insert(serviceEndpoints).values(
          input.endpoints.map(({ id: _id, ...endpoint }) => ({
            ...endpoint,
            method: endpoint.method ?? null,
            url: endpoint.url ?? null,
            rpcMethod: endpoint.rpcMethod ?? null,
            codeKey: endpoint.codeKey ?? randomUUID(),
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

export async function updateService(
  projectId: string,
  id: string,
  input: ServiceUpdateRequest,
  db: Database = getDb(),
) {
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
    input.apiType === "GRPC" && input.protoContent ? `services/${id}/${randomUUID()}.proto` : null;
  const clearProto = input.apiType === "REST" || input.clearProto;
  if (newProtoStorageKey) await putProtoFile(newProtoStorageKey, input.protoContent!);

  try {
    await db.transaction(async (tx) => {
      if (input.healthCheckHeaderTemplateId) {
        const [template] = await tx
          .select({ id: headerTemplates.id })
          .from(headerTemplates)
          .where(
            and(
              eq(headerTemplates.id, input.healthCheckHeaderTemplateId),
              eq(headerTemplates.projectId, projectId),
            ),
          );
        if (!template)
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
          protoFileName: clearProto
            ? null
            : newProtoStorageKey
              ? (input.protoFileName ?? null)
              : existing.protoFileName,
          healthCheckUrl: input.healthCheckUrl,
          healthCheckHeaderTemplateId: input.healthCheckHeaderTemplateId,
          healthCheckCustomHeaders: input.healthCheckCustomHeaders,
          active: input.active,
        })
        .where(eq(services.id, id));
      const oldEndpoints = await tx
        .select({ id: serviceEndpoints.id, codeKey: serviceEndpoints.codeKey })
        .from(serviceEndpoints)
        .where(eq(serviceEndpoints.serviceId, id));
      const retainedIds = input.endpoints.flatMap((endpoint) => (endpoint.id ? [endpoint.id] : []));
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
            codeKey: oldEndpoints.find((old) => old.id === endpoint.id)?.codeKey ?? randomUUID(),
            name: endpoint.name,
            method: endpoint.method ?? null,
            url: endpoint.url ?? null,
            rpcMethod: endpoint.rpcMethod ?? null,
          };
          if (endpoint.id)
            await tx
              .update(serviceEndpoints)
              .set(values)
              .where(and(eq(serviceEndpoints.id, endpoint.id), eq(serviceEndpoints.serviceId, id)));
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

export async function deleteService(
  projectId: string,
  id: string,
  db: Database = getDb(),
): Promise<boolean> {
  const result = await db.transaction(async (tx) => {
    const [service] = await tx
      .select({ protoStorageKey: services.protoStorageKey })
      .from(services)
      .where(and(eq(services.id, id), eq(services.projectId, projectId)));
    if (!service) return { deleted: false, protoStorageKey: null };
    await tx
      .delete(graphNodePositions)
      .where(
        and(
          eq(graphNodePositions.projectId, projectId),
          eq(graphNodePositions.nodeType, "service"),
          eq(graphNodePositions.entityId, id),
        ),
      );
    const result = await tx
      .delete(services)
      .where(and(eq(services.id, id), eq(services.projectId, projectId)));
    if (result[0]?.affectedRows) await deactivateInvalidMockApis(tx, projectId);
    return { deleted: Boolean(result[0]?.affectedRows), protoStorageKey: service.protoStorageKey };
  });
  if (result.deleted && result.protoStorageKey) await removeProtoFile(result.protoStorageKey);
  return result.deleted;
}

export function listHealthTargets(projectId: string) {
  const db = getDb();
  return Promise.all([
    db
      .select({
        id: services.id,
        framework: services.framework,
        baseUrl: services.baseUrl,
        healthCheckUrl: services.healthCheckUrl,
        healthCheckHeaderTemplateId: services.healthCheckHeaderTemplateId,
        healthCheckCustomHeaders: services.healthCheckCustomHeaders,
        headerTemplateId: headerTemplates.id,
        headerTemplateHeaders: headerTemplates.headers,
      })
      .from(services)
      .leftJoin(
        headerTemplates,
        and(
          eq(services.healthCheckHeaderTemplateId, headerTemplates.id),
          eq(headerTemplates.projectId, projectId),
        ),
      )
      .where(eq(services.projectId, projectId)),
    db
      .select({ name: environmentVariables.name, value: environmentVariables.value })
      .from(environmentVariables)
      .where(eq(environmentVariables.projectId, projectId)),
  ]).then(([targets, variableRows]) => {
    const variables = new Map(variableRows.map(({ name, value }) => [name, value]));
    return targets.map(({ headerTemplateId, headerTemplateHeaders, ...target }) => ({
      ...target,
      headerTemplateHeaders: headerTemplateId ? (headerTemplateHeaders ?? []) : [],
      variables,
    }));
  });
}
