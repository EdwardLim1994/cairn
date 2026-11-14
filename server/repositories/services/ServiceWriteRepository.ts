import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { ServiceCreateRequest, ServiceUpdateRequest } from "#shared/api/services";
import type { SqliteTransaction } from "../../db";
import { changedRows } from "../../db/changes";
import { serviceEndpoints, services } from "../../db/schema";
import { isHeaderTemplateOwned } from "../../modules/mock-apis";
import { ServiceEndpointOwnershipError, ServiceHeaderTemplateOwnershipError } from "./errors";

/** Writes only service-registry rows using the caller's SQLite transaction. */
export class ServiceWriteRepository {
  constructor(private readonly db: SqliteTransaction) {}

  async detachHealthHeaderTemplate(projectId: string, templateId: string) {
    await this.db
      .update(services)
      .set({ healthCheckHeaderTemplateId: null })
      .where(
        and(
          eq(services.projectId, projectId),
          eq(services.healthCheckHeaderTemplateId, templateId),
        ),
      );
  }

  async detachHealthHeaderTemplates(projectId: string, templateIds: string[]) {
    if (!templateIds.length) return;
    await this.db
      .update(services)
      .set({ healthCheckHeaderTemplateId: null })
      .where(
        and(
          eq(services.projectId, projectId),
          inArray(services.healthCheckHeaderTemplateId, templateIds),
        ),
      );
  }

  async findProto(projectId: string, id: string) {
    const [row] = await this.db
      .select({ protoStorageKey: services.protoStorageKey, protoFileName: services.protoFileName })
      .from(services)
      .where(and(eq(services.id, id), eq(services.projectId, projectId)));
    return row ?? null;
  }

  private async assertHeaderTemplate(projectId: string, templateId: string | null | undefined) {
    if (!templateId) return;
    if (!(await isHeaderTemplateOwned(this.db, projectId, templateId)))
      throw new ServiceHeaderTemplateOwnershipError(
        "Selected health-check header template is not in this project",
      );
  }

  async create(
    projectId: string,
    id: string,
    input: ServiceCreateRequest,
    protoStorageKey: string | null,
  ) {
    await this.assertHeaderTemplate(projectId, input.healthCheckHeaderTemplateId);
    await this.db.insert(services).values({
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
    if (input.endpoints.length)
      await this.db.insert(serviceEndpoints).values(
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
  }

  async update(
    projectId: string,
    id: string,
    input: ServiceUpdateRequest,
    protoStorageKey: string | null,
    protoFileName: string | null,
  ) {
    await this.assertHeaderTemplate(projectId, input.healthCheckHeaderTemplateId);
    await this.db
      .update(services)
      .set({
        name: input.name,
        apiType: input.apiType,
        framework: input.framework,
        baseUrl: input.baseUrl,
        grpcTls: input.grpcTls,
        protoStorageKey,
        protoFileName,
        healthCheckUrl: input.healthCheckUrl,
        healthCheckHeaderTemplateId: input.healthCheckHeaderTemplateId,
        healthCheckCustomHeaders: input.healthCheckCustomHeaders,
        active: input.active,
      })
      .where(and(eq(services.id, id), eq(services.projectId, projectId)));
    const oldEndpoints = await this.db
      .select({ id: serviceEndpoints.id })
      .from(serviceEndpoints)
      .where(and(eq(serviceEndpoints.serviceId, id), eq(serviceEndpoints.projectId, projectId)));
    const retainedIds = input.endpoints.flatMap((endpoint) => (endpoint.id ? [endpoint.id] : []));
    const validRetained = new Set(oldEndpoints.map((endpoint) => endpoint.id));
    if (retainedIds.some((endpointId) => !validRetained.has(endpointId)))
      throw new ServiceEndpointOwnershipError("Endpoint id does not belong to this service");
    const removedIds = oldEndpoints
      .map(({ id: endpointId }) => endpointId)
      .filter((endpointId) => !retainedIds.includes(endpointId));
    if (removedIds.length)
      await this.db.delete(serviceEndpoints).where(inArray(serviceEndpoints.id, removedIds));
    for (const endpoint of input.endpoints) {
      const values = {
        projectId,
        serviceId: id,
        name: endpoint.name,
        method: endpoint.method ?? null,
        url: endpoint.url ?? null,
        rpcMethod: endpoint.rpcMethod ?? null,
      };
      if (endpoint.id)
        await this.db
          .update(serviceEndpoints)
          .set(values)
          .where(and(eq(serviceEndpoints.id, endpoint.id), eq(serviceEndpoints.serviceId, id)));
      else await this.db.insert(serviceEndpoints).values({ id: randomUUID(), ...values });
    }
  }

  async delete(projectId: string, id: string) {
    const existing = await this.findProto(projectId, id);
    if (!existing) return null;
    const result = await this.db
      .delete(services)
      .where(and(eq(services.id, id), eq(services.projectId, projectId)));
    return changedRows(result) ? existing : null;
  }
}
