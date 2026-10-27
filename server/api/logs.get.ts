import { and, desc, eq, inArray, like } from "drizzle-orm";
import { getDb } from "../db";
import { logs, services } from "../db/schema";
import { ensureProject } from "../utils/project";
import { normalizeSeverity } from "../utils/otlp";

export default defineEventHandler(async (event) => {
  const projectId = await ensureProject();
  const query = getQuery(event);
  const conditions = [eq(logs.projectId, projectId)];
  if (typeof query.severity === "string" && query.severity.trim()) {
    const severity = normalizeSeverity(query.severity);
    const aliases =
      severity === "INFO"
        ? ["INFO", "INFORMATION"]
        : severity === "WARN"
          ? ["WARN", "WARNING"]
          : severity === "FATAL"
            ? ["FATAL", "CRITICAL"]
            : severity === "DEBUG"
              ? ["DEBUG", "TRACE"]
              : [severity];
    conditions.push(inArray(logs.severity, aliases));
  }
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
    return { ...record, serviceName, severity: normalizeSeverity(record.severity) };
  });
  const requestedService = typeof query.service === "string" ? query.service.trim() : "";
  return requestedService
    ? normalized.filter((record) => record.serviceName === requestedService)
    : normalized;
});
