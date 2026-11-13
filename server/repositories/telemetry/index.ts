import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../../db";
import {
  readLogs,
  writeLogs,
  writeSpans,
  type LogRecord,
  type SpanRecord,
} from "../../db/telemetry";
import { runs, services } from "../../db/schema";

export async function addMockRunFailureLog(input: {
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

export async function queryLogs(
  projectId: string,
  filters: { severities?: string[]; search?: string },
) {
  const [records, registeredServices] = await Promise.all([
    readLogs(projectId, filters),
    getDb().select({ name: services.name }).from(services).where(eq(services.projectId, projectId)),
  ]);
  return { records, registeredServices };
}

export function listTelemetryServiceNames(projectId: string) {
  return getDb()
    .select({ name: services.name })
    .from(services)
    .where(eq(services.projectId, projectId));
}

export async function insertOtlpLogs(records: LogRecord[]) {
  await writeLogs(records);
}

export async function insertOtlpSpans(records: SpanRecord[]) {
  if (!records.length) return;
  await writeSpans(records);
  const traceIds = [...new Set(records.map((span) => span.traceId))];
  const acceptedAt = new Date();
  await getDb()
    .update(runs)
    .set({
      lastTelemetryAt: acceptedAt,
      firstTelemetryAt: sql`coalesce(${runs.firstTelemetryAt}, ${acceptedAt.getTime()})`,
    })
    .where(and(eq(runs.projectId, records[0]!.projectId), inArray(runs.traceId, traceIds)));
}
