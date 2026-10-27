import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { logs, services } from "../../db/schema";
import { getAppConfig } from "../../utils/config";
import { ensureProject } from "../../utils/project";
import {
  otlpArray,
  otlpAttributes,
  otlpTimestamp,
  readOtlpBody,
  resourceAttributes,
  validHex,
} from "../../utils/otlp";

export default defineEventHandler(async (event) => {
  const body = await readOtlpBody(event, "Log payload");
  const projectId = await ensureProject();
  const registeredServices = await getDb()
    .select({ name: services.name })
    .from(services)
    .where(eq(services.projectId, projectId));
  const records: (typeof logs.$inferInsert)[] = [];
  for (const resourceLogValue of otlpArray(body.resourceLogs, "resourceLogs")) {
    const resourceLog = otlpObject(resourceLogValue, "Resource log");
    const resource = resourceAttributes(resourceLog.resource);
    if (resource["project.id"] !== undefined && resource["project.id"] !== getAppConfig().projectId)
      continue;
    const telemetryServiceName =
      typeof resource["service.name"] === "string" ? resource["service.name"] : "unknown";
    const normalizedName = telemetryServiceName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const serviceName =
      registeredServices.find(
        (service) => service.name.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedName,
      )?.name ?? telemetryServiceName;
    for (const scopeValue of otlpArray(resourceLog.scopeLogs, "scopeLogs")) {
      const scope = otlpObject(scopeValue, "Scope log");
      for (const logValue of otlpArray(scope.logRecords, "logRecords")) {
        const item = otlpObject(logValue, "Log record");
        const bodyValue = otlpObject(item.body, "Log body");
        const rawMessage =
          bodyValue.stringValue ??
          bodyValue.intValue ??
          bodyValue.doubleValue ??
          bodyValue.boolValue ??
          bodyValue.kvlistValue ??
          bodyValue.arrayValue ??
          "";
        records.push({
          projectId,
          traceId: item.traceId ? validHex(item.traceId, 32, "Trace id") : null,
          serviceName,
          severity:
            typeof item.severityText === "string" && item.severityText
              ? item.severityText.slice(0, 20)
              : "UNSPECIFIED",
          timestamp: otlpTimestamp(item.timeUnixNano || item.observedTimeUnixNano, "Log timestamp"),
          message: typeof rawMessage === "string" ? rawMessage : JSON.stringify(rawMessage),
          attributes: otlpAttributes(item.attributes),
        });
      }
    }
  }
  if (records.length) await getDb().insert(logs).values(records);
  return { accepted: records.length };
});
