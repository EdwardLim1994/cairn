import { asc, and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { ServiceCreateRequest, ServiceUpdateRequest } from "#shared/api/services";
import { getDb } from "../../db";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "../../db/schema";
import { serviceEndpoints, services } from "../../db/schema";
import { ServiceEndpointOwnershipError } from "./errors";
import { deactivateInvalidMockApis } from "../mock-apis/reconcile-readiness";

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
  await db.transaction(async (tx) => {
    await tx.insert(services).values({
      id,
      projectId,
      name: input.name,
      framework: input.framework,
      baseUrl: input.baseUrl,
      active: input.active,
      positionX: input.positionX ?? 0,
      positionY: input.positionY ?? 0,
    });
    if (input.endpoints.length)
      await tx.insert(serviceEndpoints).values(
        input.endpoints.map(({ id: _id, ...endpoint }) => ({
          ...endpoint,
          id: randomUUID(),
          projectId,
          serviceId: id,
        })),
      );
  });
}

export async function updateService(
  projectId: string,
  id: string,
  input: ServiceUpdateRequest,
  db: Database = getDb(),
) {
  const [existing] = await db
    .select({ id: services.id })
    .from(services)
    .where(and(eq(services.id, id), eq(services.projectId, projectId)));
  if (!existing) return "not-found" as const;

  await db.transaction(async (tx) => {
    await tx
      .update(services)
      .set({
        name: input.name,
        framework: input.framework,
        baseUrl: input.baseUrl,
        active: input.active,
      })
      .where(eq(services.id, id));
    const oldEndpoints = await tx
      .select({ id: serviceEndpoints.id })
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
    for (const endpoint of input.endpoints) {
      const values = {
        projectId,
        serviceId: id,
        name: endpoint.name,
        apiType: endpoint.apiType,
        method: endpoint.method,
        url: endpoint.url,
      };
      if (endpoint.id)
        await tx
          .update(serviceEndpoints)
          .set(values)
          .where(and(eq(serviceEndpoints.id, endpoint.id), eq(serviceEndpoints.serviceId, id)));
      else await tx.insert(serviceEndpoints).values({ id: randomUUID(), ...values });
    }
    await deactivateInvalidMockApis(tx, projectId);
  });
  return "updated" as const;
}

export async function deleteService(
  projectId: string,
  id: string,
  db: Database = getDb(),
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const result = await tx
      .delete(services)
      .where(and(eq(services.id, id), eq(services.projectId, projectId)));
    if (result[0]?.affectedRows) await deactivateInvalidMockApis(tx, projectId);
    return Boolean(result[0]?.affectedRows);
  });
}

export function listHealthTargets(projectId: string) {
  return getDb()
    .select({ id: services.id, framework: services.framework, baseUrl: services.baseUrl })
    .from(services)
    .where(eq(services.projectId, projectId));
}
