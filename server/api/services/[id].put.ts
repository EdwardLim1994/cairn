import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { serviceEndpoints, services } from "../../db/schema";
import { serviceInput } from "../../utils/graph-validation";
import { ensureProject } from "../../utils/project";

export default defineEventHandler(async (event) => {
  const input = serviceInput(await readBody(event));
  const projectId = await ensureProject();
  const id = getRouterParam(event, "id")!;
  const db = getDb();
  const [existing] = await db
    .select({ id: services.id })
    .from(services)
    .where(and(eq(services.id, id), eq(services.projectId, projectId)));
  if (!existing) throw createError({ statusCode: 404, statusMessage: "Service not found" });

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
      throw createError({
        statusCode: 400,
        statusMessage: "Endpoint id does not belong to this service",
      });
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
  });
  return { id };
});
