import type { OtlpLogsRequest } from "#shared/api/observability";
import {
  normalizeSeverity,
  otlpArray,
  otlpAttributes,
  otlpObject,
  otlpTimestamp,
  resourceAttributes,
  validHex,
} from "../../utils/otlp";

function matchesProject(attributes: Record<string, unknown>, projectId: string) {
  return attributes["project.id"] === undefined || attributes["project.id"] === projectId;
}

function normalizeServiceName(
  attributes: Record<string, unknown>,
  registeredServices: { name: string }[],
) {
  const telemetryName =
    typeof attributes["service.name"] === "string" ? attributes["service.name"] : "unknown";
  const normalizedName = telemetryName.toLowerCase().replace(/[^a-z0-9]/g, "");
  return (
    registeredServices.find(
      (service) => service.name.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedName,
    )?.name ?? telemetryName
  );
}

function normalizeLogRecords(
  body: OtlpLogsRequest,
  projectId: string,
  configuredProjectId: string,
  registeredServices: { name: string }[],
) {
  const records = [];
  for (const resourceLogValue of otlpArray(body.resourceLogs, "resourceLogs")) {
    const resourceLog = otlpObject(resourceLogValue, "Resource log");
    const resource = resourceAttributes(resourceLog.resource);
    if (!matchesProject(resource, configuredProjectId)) continue;
    const serviceName = normalizeServiceName(resource, registeredServices);
    for (const scopeValue of otlpArray(resourceLog.scopeLogs, "scopeLogs")) {
      const scope = otlpObject(scopeValue, "Scope log");
      for (const logValue of otlpArray(scope.logRecords, "logRecords")) {
        const item = otlpObject(logValue, "Log record");
        const bodyValue = otlpObject(item.body, "Log body");
        const messageValue =
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
          severity: normalizeSeverity(item.severityText),
          timestamp: otlpTimestamp(item.timeUnixNano || item.observedTimeUnixNano, "Log timestamp"),
          message: typeof messageValue === "string" ? messageValue : JSON.stringify(messageValue),
          attributes: otlpAttributes(item.attributes),
        });
      }
    }
  }
  return records;
}

export function createIngestOtlpLogsUseCase(dependencies: {
  ensureProject: () => Promise<string>;
  configuredProjectId: () => string;
  listServiceNames: (projectId: string) => Promise<Array<{ name: string }>>;
  insertLogs: (
    records: Array<{
      projectId: string;
      traceId: string | null;
      serviceName: string;
      severity: string;
      timestamp: Date;
      message: string;
      attributes: Record<string, unknown>;
    }>,
  ) => Promise<void>;
}) {
  return async (body: OtlpLogsRequest) => {
    const projectId = await dependencies.ensureProject();
    const registeredServices = await dependencies.listServiceNames(projectId);
    const records = normalizeLogRecords(
      body,
      projectId,
      dependencies.configuredProjectId(),
      registeredServices,
    );
    await dependencies.insertLogs(records);
    return { accepted: records.length };
  };
}
