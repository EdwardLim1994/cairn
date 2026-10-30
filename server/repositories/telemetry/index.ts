import { and, desc, eq, inArray, like } from "drizzle-orm";
import { getDb } from "../../db";
import { logs, runs, services, spans } from "../../db/schema";

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
  await getDb()
    .insert(logs)
    .values({
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
    });
}

export async function queryLogs(
  projectId: string,
  filters: { severities?: string[]; search?: string },
) {
  const conditions = [eq(logs.projectId, projectId)];
  if (filters.severities?.length) conditions.push(inArray(logs.severity, filters.severities));
  if (filters.search) conditions.push(like(logs.message, `%${filters.search}%`));
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
  return { records, registeredServices };
}

export async function listTelemetryServiceNames(projectId: string) {
  return getDb()
    .select({ name: services.name })
    .from(services)
    .where(eq(services.projectId, projectId));
}

export async function insertOtlpLogs(records: (typeof logs.$inferInsert)[]) {
  if (records.length) await getDb().insert(logs).values(records);
}

export async function insertOtlpSpans(records: (typeof spans.$inferInsert)[]) {
  if (!records.length) return;
  const db = getDb();
  await db.transaction(async (tx) => {
    for (const span of records)
      await tx
        .insert(spans)
        .values(span)
        .onDuplicateKeyUpdate({
          set: {
            serviceName: span.serviceName,
            operationName: span.operationName,
            endTime: span.endTime,
            statusCode: span.statusCode,
            attributes: span.attributes,
          },
        });
  });
  const traceIds = [...new Set(records.map((span) => span.traceId))];
  await db
    .update(runs)
    .set({ lastTelemetryAt: new Date() })
    .where(and(eq(runs.projectId, records[0]!.projectId), inArray(runs.traceId, traceIds)));
}
