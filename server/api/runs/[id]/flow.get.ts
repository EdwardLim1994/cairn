import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { runs, spans } from "../../../db/schema";
import { getAppConfig } from "../../../utils/config";
import { ensureProject } from "../../../utils/project";

export default defineEventHandler(async (event) => {
  const projectId = await ensureProject();
  const id = getRouterParam(event, "id")!;
  const db = getDb();
  const [run] = await db
    .select()
    .from(runs)
    .where(and(eq(runs.id, id), eq(runs.projectId, projectId)));
  if (!run) throw createError({ statusCode: 404, statusMessage: "Run not found" });
  const records = await db
    .select()
    .from(spans)
    .where(and(eq(spans.projectId, projectId), eq(spans.traceId, run.traceId)))
    .orderBy(asc(spans.startTime));
  const config = getAppConfig();
  const age = Date.now() - run.startedAt.getTime();
  const quiet = run.lastTelemetryAt
    ? Date.now() - run.lastTelemetryAt.getTime() >= config.telemetryQuietMs
    : false;
  const timedOut = age >= config.telemetryMaxWaitMs;
  const pending = !quiet && !timedOut;

  const bySpanId = new Map(records.map((span) => [span.spanId, span]));
  const edgeMap = new Map<
    string,
    { sourceService: string; targetService: string; sourceSpanId: string; targetSpanId: string }
  >();
  for (const span of records) {
    const parent = span.parentSpanId ? bySpanId.get(span.parentSpanId) : undefined;
    if (parent && parent.serviceName !== span.serviceName) {
      const key = `${parent.serviceName}\0${span.serviceName}`;
      edgeMap.set(key, {
        sourceService: parent.serviceName,
        targetService: span.serviceName,
        sourceSpanId: parent.spanId,
        targetSpanId: span.spanId,
      });
    }
  }
  return {
    runId: run.id,
    traceId: run.traceId,
    runStatus: run.status,
    status: pending ? "pending" : "complete",
    incomplete: timedOut,
    spans: records,
    edges: [...edgeMap.values()],
    errorServices: [
      ...new Set(
        records.filter((span) => span.statusCode === "ERROR").map((span) => span.serviceName),
      ),
    ],
  };
});
