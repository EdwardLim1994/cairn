import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "../db";
import { projects, serviceEdges, serviceEndpoints, services } from "../db/schema";
import { ensureProject } from "../utils/project";
import { finiteNumber, record } from "../utils/graph-validation";

export default defineEventHandler(async (event) => {
  const body = record(await readBody(event), "Canvas");
  const viewport = record(body.viewport, "Viewport");
  const mockNode = record(body.mockNode, "Mock API node");
  const positions = Array.isArray(body.services)
    ? body.services.map((value) => {
        const item = record(value, "Service position");
        if (typeof item.id !== "string" || !item.id)
          throw createError({ statusCode: 400, statusMessage: "Service position id is required" });
        return {
          id: item.id,
          x: finiteNumber(item.x, "Service x", 0),
          y: finiteNumber(item.y, "Service y", 0),
        };
      })
    : [];
  if (!Array.isArray(body.services) || !Array.isArray(body.edges))
    throw createError({ statusCode: 400, statusMessage: "Services and edges must be arrays" });
  const edges = body.edges.map((value) => {
    const item = record(value, "Service connection");
    if (typeof item.sourceServiceId !== "string" || typeof item.targetEndpointId !== "string")
      throw createError({
        statusCode: 400,
        statusMessage: "Connection source and endpoint are required",
      });
    return { sourceServiceId: item.sourceServiceId, targetEndpointId: item.targetEndpointId };
  });
  const edgeKeys = edges.map(
    ({ sourceServiceId, targetEndpointId }) => `${sourceServiceId}:${targetEndpointId}`,
  );
  if (new Set(edgeKeys).size !== edgeKeys.length)
    throw createError({ statusCode: 400, statusMessage: "Canvas contains duplicate connections" });
  const projectId = await ensureProject();
  const db = getDb();
  await db.transaction(async (tx) => {
    const serviceIds = positions.map(({ id }) => id);
    if (serviceIds.length) {
      const owned = await tx
        .select({ id: services.id })
        .from(services)
        .where(and(eq(services.projectId, projectId), inArray(services.id, serviceIds)));
      if (owned.length !== new Set(serviceIds).size)
        throw createError({
          statusCode: 400,
          statusMessage: "Canvas contains an unknown or duplicate service",
        });
      for (const position of positions)
        await tx
          .update(services)
          .set({ positionX: position.x, positionY: position.y })
          .where(eq(services.id, position.id));
    }
    if (edges.length) {
      const sourceIds = [...new Set(edges.map(({ sourceServiceId }) => sourceServiceId))];
      const endpointIds = [...new Set(edges.map(({ targetEndpointId }) => targetEndpointId))];
      const [ownedServices, ownedEndpoints] = await Promise.all([
        tx
          .select({ id: services.id })
          .from(services)
          .where(and(eq(services.projectId, projectId), inArray(services.id, sourceIds))),
        tx
          .select({ id: serviceEndpoints.id, serviceId: serviceEndpoints.serviceId })
          .from(serviceEndpoints)
          .where(
            and(
              eq(serviceEndpoints.projectId, projectId),
              inArray(serviceEndpoints.id, endpointIds),
            ),
          ),
      ]);
      if (ownedServices.length !== sourceIds.length || ownedEndpoints.length !== endpointIds.length)
        throw createError({
          statusCode: 400,
          statusMessage: "Connection references a service or endpoint outside this project",
        });
      const endpointOwners = new Map(
        ownedEndpoints.map((endpoint) => [endpoint.id, endpoint.serviceId]),
      );
      if (edges.some((edge) => endpointOwners.get(edge.targetEndpointId) === edge.sourceServiceId))
        throw createError({
          statusCode: 400,
          statusMessage: "A service cannot connect to its own endpoint",
        });
    }
    const zoom = finiteNumber(viewport.zoom, "Viewport zoom", 1);
    if (zoom <= 0)
      throw createError({
        statusCode: 400,
        statusMessage: "Viewport zoom must be greater than zero",
      });
    await tx
      .update(projects)
      .set({
        viewportX: finiteNumber(viewport.x, "Viewport x", 0),
        viewportY: finiteNumber(viewport.y, "Viewport y", 0),
        viewportZoom: zoom,
        mockNodeX: finiteNumber(mockNode.x, "Mock API node x", 120),
        mockNodeY: finiteNumber(mockNode.y, "Mock API node y", 120),
      })
      .where(eq(projects.id, projectId));
    await tx.delete(serviceEdges).where(eq(serviceEdges.projectId, projectId));
    if (edges.length)
      await tx
        .insert(serviceEdges)
        .values(edges.map((edge) => ({ id: randomUUID(), projectId, ...edge })));
  });
  return { saved: true };
});
