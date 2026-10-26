import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { mockApis, projects, serviceEdges, serviceEndpoints, services } from "../db/schema";
import { ensureProject } from "../utils/project";

export default defineEventHandler(async () => {
  const projectId = await ensureProject();
  const db = getDb();
  const [[project], serviceRows, endpoints, edges, mockApiRows] = await Promise.all([
    db.select().from(projects).where(eq(projects.id, projectId)),
    db.select().from(services).where(eq(services.projectId, projectId)),
    db.select().from(serviceEndpoints).where(eq(serviceEndpoints.projectId, projectId)),
    db.select().from(serviceEdges).where(eq(serviceEdges.projectId, projectId)),
    db.select().from(mockApis).where(eq(mockApis.projectId, projectId)),
  ]);
  if (!project)
    throw createError({
      statusCode: 500,
      statusMessage: "Project canvas could not be initialized",
    });
  return {
    viewport: { x: project.viewportX, y: project.viewportY, zoom: project.viewportZoom },
    mockNode: { x: project.mockNodeX, y: project.mockNodeY },
    services: serviceRows.map((service) => ({
      ...service,
      endpoints: endpoints.filter((endpoint) => endpoint.serviceId === service.id),
    })),
    edges: edges.map(({ id, sourceServiceId, targetEndpointId }) => ({
      id,
      sourceServiceId,
      targetEndpointId,
    })),
    mockApis: mockApiRows,
  };
});
