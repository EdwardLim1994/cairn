import type { RunFlowResponse } from "#shared/api/observability";
import { RunNotFoundError } from "../../repositories/runs/errors";

type RunFlowData = NonNullable<
  Awaited<ReturnType<typeof import("../../repositories/runs").getRunFlowData>>
>;

function normalizeServiceName(name: string, registeredServices: Array<{ name: string }>) {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/ssubgraph$/, "subgraph");
  return (
    registeredServices.find(
      (service) =>
        service.name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .replace(/ssubgraph$/, "subgraph") === normalized,
    )?.name ?? name
  );
}

function spanEdges(spans: RunFlowData["spans"], services: RunFlowData["registeredServices"]) {
  const bySpanId = new Map(spans.map((span) => [span.spanId, span]));
  const edges = new Map<
    string,
    {
      sourceService: string;
      targetService: string;
      sourceSpanId: string;
      targetSpanId: string;
      timing: { totalDurationMs: number | null; callDurationsMs: number[] };
      clientSpanIds: Set<string>;
    }
  >();
  for (const span of spans) {
    const parent = span.parentSpanId ? bySpanId.get(span.parentSpanId) : undefined;
    if (!parent || parent.serviceName === span.serviceName) continue;
    const sourceService = normalizeServiceName(parent.serviceName, services);
    const targetService = normalizeServiceName(span.serviceName, services);
    const key = `${sourceService}\0${targetService}`;
    let edge = edges.get(key);
    if (!edge) {
      edge = {
        sourceService,
        targetService,
        sourceSpanId: parent.spanId,
        targetSpanId: span.spanId,
        timing: { totalDurationMs: null, callDurationsMs: [] },
        clientSpanIds: new Set(),
      };
      edges.set(key, edge);
    }
    if (parent.attributes["span.kind"] === "CLIENT" && !edge.clientSpanIds.has(parent.spanId)) {
      edge.clientSpanIds.add(parent.spanId);
      const durationMs = Math.max(0, parent.endTime.getTime() - parent.startTime.getTime());
      edge.timing.callDurationsMs.push(durationMs);
      edge.timing.totalDurationMs = (edge.timing.totalDurationMs ?? 0) + durationMs;
    }
  }
  return [...edges.values()].map(({ clientSpanIds: _clientSpanIds, ...edge }) => edge);
}

function spanErrors(spans: RunFlowData["spans"], services: RunFlowData["registeredServices"]) {
  const errors = new Set<string>();
  for (const span of spans) {
    const status = Number(
      span.attributes["http.response.status_code"] ?? span.attributes["http.status_code"],
    );
    if (span.statusCode === "ERROR" || status >= 400)
      errors.add(normalizeServiceName(span.serviceName, services));
  }
  return errors;
}

function messageConnectionObserved(
  connection: RunFlowData["messageConnections"][number],
  destination: RunFlowData["destinations"][number],
  spans: RunFlowData["spans"],
  traceId: string,
  services: RunFlowData["registeredServices"],
  endpoints: RunFlowData["endpoints"],
) {
  const serviceId =
    connection.type === "publish"
      ? (connection.serviceId ??
        endpoints.find(({ id }) => id === connection.endpointId)?.serviceId)
      : connection.serviceId;
  const serviceName = services.find((service) => service.id === serviceId)?.name;
  if (!serviceName) return false;
  const system = destination.broker === "rabbitmq" ? "rabbitmq" : "kafka";
  const textAttribute = (value: unknown) => (typeof value === "string" ? value : "");
  return spans.some((span) => {
    if (span.traceId !== traceId) return false;
    const attrs = span.attributes;
    const spanSystem = textAttribute(attrs["messaging.system"] ?? attrs["messaging.system.name"])
      .trim()
      .toLowerCase();
    const destinationName = [
      attrs["messaging.destination.name"],
      attrs["messaging.destination"],
      attrs["messaging.source.name"],
      attrs["messaging.kafka.topic"],
      attrs["messaging.kafka.destination"],
    ].find((value): value is string => typeof value === "string" && value.trim().length > 0);
    const operation = textAttribute(
      attrs["messaging.operation.type"] ?? attrs["messaging.operation"] ?? span.operationName,
    )
      .trim()
      .toLowerCase();
    if (
      normalizeServiceName(span.serviceName, services) !== serviceName ||
      destinationName?.trim() !== destination.name
    )
      return false;
    if (spanSystem && spanSystem !== system) return false;
    const operationMatches =
      connection.type === "publish"
        ? /publish|send|produce/.test(operation)
        : /receive|process|consume|poll/.test(operation);
    return operationMatches;
  });
}

function observedMessageConnections(
  data: RunFlowData,
  destinations: Map<string, RunFlowData["destinations"][number]>,
) {
  const observed = new Set<string>();
  for (const connection of data.messageConnections) {
    const destination = destinations.get(connection.destinationId);
    if (
      destination &&
      messageConnectionObserved(
        connection,
        destination,
        data.spans,
        data.run.traceId,
        data.registeredServices,
        data.endpoints,
      )
    )
      observed.add(connection.id);
  }
  return observed;
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
    const { run, spans, registeredServices, destinations, failedTargetService } = data;
    const now = (dependencies.now ?? Date.now)();
    const age = now - run.startedAt.getTime();
    const quiet = run.lastTelemetryAt
      ? now - run.lastTelemetryAt.getTime() >= dependencies.telemetryQuietMs()
      : false;
    const timedOut = age >= dependencies.telemetryMaxWaitMs();
    const edges = spanEdges(spans, registeredServices);
    const errorServices = spanErrors(spans, registeredServices);
    if (failedTargetService) errorServices.add(failedTargetService);
    const destinationById = new Map(
      destinations.map((destination) => [destination.id, destination]),
    );
    const observedMessageConnectionIds = observedMessageConnections(data, destinationById);
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
      edges,
      observedMessageConnectionIds: [...observedMessageConnectionIds],
      errorServices: [...errorServices],
    };
  };
}
