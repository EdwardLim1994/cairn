import { and, desc, eq, like } from "drizzle-orm";
import { getDb } from "../db";
import { logs, services } from "../db/schema";
import { ensureProject } from "../utils/project";

export default defineEventHandler(async (event) => {
  const projectId = await ensureProject();
  const query = getQuery(event);
  const conditions = [eq(logs.projectId, projectId)];
  if (typeof query.severity === "string" && query.severity.trim())
    conditions.push(eq(logs.severity, query.severity.trim().toUpperCase()));
  if (typeof query.search === "string" && query.search.trim()) {
    const escaped = query.search.trim().replace(/[\\%_]/g, "\\$&");
    conditions.push(like(logs.message, `%${escaped}%`));
  }
  const db = getDb();
  const [records, registeredServices] = await Promise.all([
    db
      .select()
      .from(logs)
      .where(and(...conditions))
      .orderBy(desc(logs.timestamp), desc(logs.id))
      .limit(500),
    db.select({ name: services.name }).from(services).where(eq(services.projectId, projectId)),
  ]);
  const normalized = records.map((record) => {
    const key = record.serviceName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const serviceName =
      registeredServices.find(
        (service) => service.name.toLowerCase().replace(/[^a-z0-9]/g, "") === key,
      )?.name ?? record.serviceName;
    return { ...record, serviceName };
  });
  const requestedService = typeof query.service === "string" ? query.service.trim() : "";
  return requestedService
    ? normalized.filter((record) => record.serviceName === requestedService)
    : normalized;
});
