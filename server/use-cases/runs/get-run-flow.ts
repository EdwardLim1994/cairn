import type { RunFlowResponse } from "#shared/api/observability";
import { RunNotFoundError } from "../../repositories/runs/errors";

type RunFlowData = NonNullable<
  Awaited<ReturnType<typeof import("../../repositories/runs").getRunFlowData>>
>;

function normalizeServiceName(name: string, registeredServices: Array<{ name: string }>) {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return (
    registeredServices.find(
      (service) => service.name.toLowerCase().replace(/[^a-z0-9]/g, "") === normalized,
    )?.name ?? name
  );
}

export function createGetRunFlowUseCase(dependencies: {
  ensureProject: () => Promise<string>;
  getRunFlowData: (projectId: string, id: string) => Promise<RunFlowData | undefined>;
  telemetryQuietMs: () => number;
  telemetryMaxWaitMs: () => number;
  now?: () => number;
}) {
  return async (id: string): Promise<RunFlowResponse> => {
    const data = await dependencies.getRunFlowData(await dependencies.ensureProject(), id);
    if (!data) throw new RunNotFoundError("Run not found");
    const { run, spans, registeredServices, failedTargetService } = data;
    const now = (dependencies.now ?? Date.now)();
    const age = now - run.startedAt.getTime();
    const quiet = run.lastTelemetryAt
      ? now - run.lastTelemetryAt.getTime() >= dependencies.telemetryQuietMs()
      : false;
    const timedOut = age >= dependencies.telemetryMaxWaitMs();
    const bySpanId = new Map(spans.map((span) => [span.spanId, span]));
    const edges = new Map<
      string,
      { sourceService: string; targetService: string; sourceSpanId: string; targetSpanId: string }
    >();
    for (const span of spans) {
      const parent = span.parentSpanId ? bySpanId.get(span.parentSpanId) : undefined;
      if (parent && parent.serviceName !== span.serviceName) {
        edges.set(`${parent.serviceName}\0${span.serviceName}`, {
          sourceService: normalizeServiceName(parent.serviceName, registeredServices),
          targetService: normalizeServiceName(span.serviceName, registeredServices),
          sourceSpanId: parent.spanId,
          targetSpanId: span.spanId,
        });
      }
    }
    const errorServices = new Set<string>();
    for (const span of spans) {
      const status = Number(
        span.attributes["http.response.status_code"] ?? span.attributes["http.status_code"],
      );
      if (span.statusCode === "ERROR" || status >= 400)
        errorServices.add(normalizeServiceName(span.serviceName, registeredServices));
    }
    if (failedTargetService) errorServices.add(failedTargetService);
    return {
      runId: run.id,
      traceId: run.traceId,
      runStatus: run.status,
      status: !quiet && !timedOut ? "pending" : "complete",
      incomplete: timedOut && !quiet,
      spans: spans.map((span) => ({
        ...span,
        startTime: span.startTime.toISOString(),
        endTime: span.endTime.toISOString(),
        receivedAt: span.receivedAt.toISOString(),
      })),
      edges: [...edges.values()],
      errorServices: [...errorServices],
    };
  };
}
