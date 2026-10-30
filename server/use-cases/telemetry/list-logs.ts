import type { LogListRequest, LogListResponse } from "#shared/api/observability";
import { normalizeSeverity } from "../../utils/otlp";

const severityAliases: Record<string, string[]> = {
  INFO: ["INFO", "INFORMATION"],
  WARN: ["WARN", "WARNING"],
  FATAL: ["FATAL", "CRITICAL"],
  DEBUG: ["DEBUG", "TRACE"],
};

export function createListLogsUseCase(dependencies: {
  ensureProject: () => Promise<string>;
  queryLogs: (
    projectId: string,
    filters: { severities?: string[]; search?: string },
  ) => Promise<{
    records: Array<{
      id: number;
      projectId: string;
      traceId: string | null;
      serviceName: string;
      severity: string;
      timestamp: Date;
      message: string;
      attributes: Record<string, unknown>;
      receivedAt: Date;
    }>;
    registeredServices: Array<{ name: string }>;
  }>;
}) {
  return async (query: LogListRequest): Promise<LogListResponse> => {
    const requestedSeverities = (Array.isArray(query.severity) ? query.severity : [query.severity])
      .filter((value): value is string => typeof value === "string")
      .map((value) => normalizeSeverity(value.trim()))
      .filter(Boolean);
    const severities = [
      ...new Set(requestedSeverities.flatMap((value) => severityAliases[value] ?? [value])),
    ];
    const rawSearch = query.search?.trim();
    const search = rawSearch?.replace(/[\\%_]/g, "\\$&");
    const { records, registeredServices } = await dependencies.queryLogs(
      await dependencies.ensureProject(),
      { ...(severities.length ? { severities } : {}), ...(search ? { search } : {}) },
    );
    const requestedServices = (Array.isArray(query.service) ? query.service : [query.service])
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean);
    const normalized = records.map((record) => {
      const normalizedName = record.serviceName.toLowerCase().replace(/[^a-z0-9]/g, "");
      const serviceName =
        registeredServices.find(
          (service) => service.name.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedName,
        )?.name ?? record.serviceName;
      return {
        ...record,
        serviceName,
        severity: normalizeSeverity(record.severity),
        timestamp: record.timestamp.toISOString(),
        receivedAt: record.receivedAt.toISOString(),
      };
    });
    return requestedServices.length
      ? normalized.filter((record) => requestedServices.includes(record.serviceName))
      : normalized;
  };
}
