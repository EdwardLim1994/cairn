import { asc, eq } from "drizzle-orm";
import { serviceEndpoints, services } from "../../db/schema";
import { getDb } from "../../db";
import { ensureProject } from "../../utils/project";

export default defineEventHandler(async () => {
  const projectId = await ensureProject();
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
    endpoints: endpoints.filter((endpoint) => endpoint.serviceId === service.id),
  }));
});
