import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { mockApis, runs, serviceEndpoints, services, spans } from "../../../db/schema";
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
  const registeredServices = await db
    .select({ name: services.name })
    .from(services)
    .where(eq(services.projectId, projectId));
  let failedTargetService: string | undefined;
  if (run.status === "failed" && run.mockApiId) {
    const [target] = await db
      .select({ name: services.name })
      .from(mockApis)
      .innerJoin(serviceEndpoints, eq(mockApis.targetEndpointId, serviceEndpoints.id))
      .innerJoin(services, eq(serviceEndpoints.serviceId, services.id))
      .where(and(eq(mockApis.id, run.mockApiId), eq(mockApis.projectId, projectId)));
    failedTargetService = target?.name;
  }
  const registeredName = (name: string) => {
    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    return (
      registeredServices.find(
        (service) => service.name.toLowerCase().replace(/[^a-z0-9]/g, "") === normalized,
      )?.name ?? name
    );
  };
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
        sourceService: registeredName(parent.serviceName),
        targetService: registeredName(span.serviceName),
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
    incomplete: timedOut && !quiet,
    spans: records,
    edges: [...edgeMap.values()],
    errorServices: [
      ...new Set([
        ...records
          .filter((span) => {
            const httpStatus = Number(
              span.attributes["http.response.status_code"] ?? span.attributes["http.status_code"],
            );
            return span.statusCode === "ERROR" || httpStatus >= 400;
          })
          .map((span) => registeredName(span.serviceName)),
        ...(failedTargetService ? [failedTargetService] : []),
      ]),
    ],
  };
});
