import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { CanvasGetResponse } from "#shared/api/canvas";
import type { CanvasPutRequest } from "#shared/api/canvas";
import { getDb } from "../../db";
import { mockApis, projects, serviceEdges, serviceEndpoints, services } from "../../db/schema";
import { CanvasConstraintError } from "./errors";

/** Canvas-specific persistence; multi-table writes stay within this domain module. */
type Database = ReturnType<typeof getDb>;

export async function getCanvas(
  projectId: string,
  db: Database = getDb(),
): Promise<CanvasGetResponse> {
  const [[project], serviceRows, endpoints, edges, mockApiRows] = await Promise.all([
    db.select().from(projects).where(eq(projects.id, projectId)),
    db.select().from(services).where(eq(services.projectId, projectId)),
    db.select().from(serviceEndpoints).where(eq(serviceEndpoints.projectId, projectId)),
    db.select().from(serviceEdges).where(eq(serviceEdges.projectId, projectId)),
    db.select().from(mockApis).where(eq(mockApis.projectId, projectId)),
  ]);
  if (!project) throw new Error("Project canvas could not be initialized");
  return {
    viewport: { x: project.viewportX, y: project.viewportY, zoom: project.viewportZoom },
    mockNode: { x: project.mockNodeX, y: project.mockNodeY },
    services: serviceRows.map((service) => ({
      ...service,
      createdAt: service.createdAt.toISOString(),
      endpoints: endpoints
        .filter((endpoint) => endpoint.serviceId === service.id)
        .map((endpoint) => ({ ...endpoint, createdAt: endpoint.createdAt.toISOString() })),
    })),
    edges: edges.map(({ id, sourceServiceId, targetEndpointId }) => ({
      id,
      sourceServiceId,
      targetEndpointId,
    })),
    mockApis: mockApiRows.map((mockApi) => ({
      ...mockApi,
      createdAt: mockApi.createdAt.toISOString(),
    })),
  };
}

export async function saveCanvas(
  projectId: string,
  canvas: CanvasPutRequest,
  db: Database = getDb(),
): Promise<void> {
  await db.transaction(async (tx) => {
    const serviceIds = canvas.services.map(({ id }) => id);
    if (serviceIds.length) {
      const owned = await tx
        .select({ id: services.id })
        .from(services)
        .where(and(eq(services.projectId, projectId), inArray(services.id, serviceIds)));
      if (owned.length !== new Set(serviceIds).size)
        throw new CanvasConstraintError("Canvas contains an unknown or duplicate service");
      for (const position of canvas.services)
        await tx
          .update(services)
          .set({ positionX: position.x, positionY: position.y })
          .where(eq(services.id, position.id));
    }
    if (canvas.edges.length) {
      const sourceIds = [...new Set(canvas.edges.map(({ sourceServiceId }) => sourceServiceId))];
      const endpointIds = [
        ...new Set(canvas.edges.map(({ targetEndpointId }) => targetEndpointId)),
      ];
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
        throw new CanvasConstraintError(
          "Connection references a service or endpoint outside this project",
        );
      const endpointOwners = new Map(
        ownedEndpoints.map((endpoint) => [endpoint.id, endpoint.serviceId]),
      );
      if (
        canvas.edges.some(
          (edge) => endpointOwners.get(edge.targetEndpointId) === edge.sourceServiceId,
        )
      )
        throw new CanvasConstraintError("A service cannot connect to its own endpoint");
    }
    await tx
      .update(projects)
      .set({
        viewportX: canvas.viewport.x,
        viewportY: canvas.viewport.y,
        viewportZoom: canvas.viewport.zoom,
        mockNodeX: canvas.mockNode.x,
        mockNodeY: canvas.mockNode.y,
      })
      .where(eq(projects.id, projectId));
    await tx.delete(serviceEdges).where(eq(serviceEdges.projectId, projectId));
    if (canvas.edges.length)
      await tx
        .insert(serviceEdges)
        .values(canvas.edges.map((edge) => ({ id: randomUUID(), projectId, ...edge })));
  });
}
