import { and, desc, eq, inArray, like } from "drizzle-orm";
import { getDb } from "../db";
import { logs, services } from "../db/schema";
import { ensureProject } from "../utils/project";
import { normalizeSeverity } from "../utils/otlp";

export default defineEventHandler(async (event) => {
  const projectId = await ensureProject();
  const query = getQuery(event);
  const conditions = [eq(logs.projectId, projectId)];
  const requestedSeverities = (Array.isArray(query.severity) ? query.severity : [query.severity])
    .filter((severity): severity is string => typeof severity === "string")
    .map((severity) => normalizeSeverity(severity.trim()))
    .filter(Boolean);
  if (requestedSeverities.length) {
    const aliases = requestedSeverities.flatMap((severity) =>
      severity === "INFO"
        ? ["INFO", "INFORMATION"]
        : severity === "WARN"
          ? ["WARN", "WARNING"]
          : severity === "FATAL"
            ? ["FATAL", "CRITICAL"]
            : severity === "DEBUG"
              ? ["DEBUG", "TRACE"]
              : [severity],
    );
    conditions.push(inArray(logs.severity, [...new Set(aliases)]));
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
  const requestedServices = (Array.isArray(query.service) ? query.service : [query.service])
    .filter((service): service is string => typeof service === "string")
    .map((service) => service.trim())
    .filter(Boolean);
  return requestedServices.length
    ? normalized.filter((record) => requestedServices.includes(record.serviceName))
    : normalized;
});
