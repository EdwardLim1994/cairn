import {
  readLogs,
  readSpans,
  writeLogs,
  writeSpans,
  type LogRecord,
  type SpanRecord,
} from "../../db/telemetry";
import { listServiceNames } from "../../modules/service-registry";
import { recordTelemetryArrival } from "../../modules/runs";

/** Owns DuckDB telemetry reads and writes; run metadata follows a durable span write. */
export class TelemetryRepository {
  readSpans(projectId: string, traceId: string) {
    return readSpans(projectId, traceId);
  }

  async addMockRunFailureLog(input: {
    projectId: string;
    traceId: string;
    serviceName: string;
    mockApiName: string;
    mockApiId: string;
    runId: string;
    method: string;
    url: string;
    responseStatus: number | null;
    message: string;
  }) {
    await writeLogs([
      {
        projectId: input.projectId,
        traceId: input.traceId,
        serviceName: input.serviceName,
        severity: "ERROR",
        timestamp: new Date(),
        message: `Mock API ${input.mockApiName} failed: ${input.message}`,
        attributes: {
          mockApiId: input.mockApiId,
          runId: input.runId,
          method: input.method,
          url: input.url,
          responseStatus: input.responseStatus,
        },
      },
    ]);
  }

  async queryLogs(projectId: string, filters: { severities?: string[]; search?: string }) {
    const [records, registeredServices] = await Promise.all([
      readLogs(projectId, filters),
      listServiceNames(projectId),
    ]);
    return { records, registeredServices };
  }

  listTelemetryServiceNames(projectId: string) {
    return listServiceNames(projectId);
  }

  async insertOtlpLogs(records: LogRecord[]) {
    await writeLogs(records);
  }

  async insertOtlpSpans(records: SpanRecord[]) {
    if (!records.length) return;
    await writeSpans(records);
    const traceIds = [...new Set(records.map((span) => span.traceId))];
    await recordTelemetryArrival(records[0]!.projectId, traceIds, new Date());
  }
}
