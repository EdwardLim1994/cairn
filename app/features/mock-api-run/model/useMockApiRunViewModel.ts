import type { Ref } from "vue";
import type { MockApiCallHistoryEntry } from "#shared/api/mock-api-call-history";
import type { RunFlowResponse } from "#shared/api/observability";
import type { createApiClient } from "../../../shared/api";
import type { GraphService } from "../../../models/graph";
import type { MockApiDraft } from "../../../entities/mock-api";
import type { useGraphStore } from "../../../stores/graph";
import type { useMockApiStore } from "../../../entities/mock-api";
import type { useGraphViewModel } from "../../../composables/useGraphViewModel";

type GraphStore = ReturnType<typeof useGraphStore>;
type MockStore = ReturnType<typeof useMockApiStore>;
type GraphViewModel = ReturnType<typeof useGraphViewModel>;

function traceDurationMs(flow: {
  traceId: string;
  spans: Array<{ traceId: string; startTime: string; endTime: string }>;
  telemetryState?: "available" | "unavailable" | "expired" | "partial";
}) {
  if (flow.telemetryState === "partial" || flow.telemetryState === "expired") return null;
  const traceSpans = flow.spans.filter(({ traceId }) => traceId === flow.traceId);
  if (!traceSpans.length) return null;
  const spanStarts = traceSpans.map(({ startTime }) => Date.parse(startTime));
  const spanEnds = traceSpans.map(({ endTime }) => Date.parse(endTime));
  const earliestStart = Math.min(...spanStarts);
  const latestEnd = Math.max(...spanEnds);
  return Number.isFinite(earliestStart) && Number.isFinite(latestEnd)
    ? Math.max(0, latestEnd - earliestStart)
    : null;
}

export function useMockApiRunViewModel(options: {
  apiClient: ReturnType<typeof createApiClient>;
  graphStore: GraphStore;
  mockApiStore: MockStore;
  graphViewModel: GraphViewModel;
  services: () => GraphService[];
  logService: Ref<string[]>;
  logSeverity: Ref<string[]>;
  logsOpen: Ref<boolean>;
  openResponsePanel?: (id: string) => void;
  focusResponsePanel?: (id: string) => Promise<unknown>;
  saveCanvas: () => Promise<void>;
  loadLogs: () => Promise<void>;
  wait?: (milliseconds: number) => Promise<void>;
  now?: () => number;
  onFlowCollected?: (details: {
    flow: RunFlowResponse;
    apiName: string;
    status: "completed" | "failed";
    totalDurationMs: number | null;
  }) => void;
}) {
  const wait =
    options.wait ??
    ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const now = options.now ?? Date.now;
  let replayGeneration = 0;

  function setInitialObservations(entry: MockApiDraft) {
    options.mockApiStore.clearRunResults();
    options.graphStore.setObservations({
      services: [],
      errorServices: [],
      edges: [],
      messageConnectionIds: [],
    });
    options.mockApiStore.setRunResult(entry.id!, {
      id: "",
      traceId: "",
      status: "running",
      responseStatus: null,
      responseBody: null,
      error: null,
    });
    options.graphViewModel.syncNodes();
  }

  function tracedServices(flow: Awaited<ReturnType<typeof options.apiClient.getRunFlow>>) {
    const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
    return [
      ...new Set(
        flow.spans
          .filter(({ traceId }) => traceId === flow.traceId)
          .map(({ serviceName }) => {
            const key = normalize(serviceName);
            return (
              options.services().find((service) => normalize(service.name) === key)?.name ??
              serviceName
            );
          }),
      ),
    ];
  }

  async function showServiceLogs(service?: GraphService) {
    options.logService.value = service ? [service.name] : [];
    options.logSeverity.value = [];
    options.logsOpen.value = true;
    await options.loadLogs();
  }

  async function waitForFlow(runId: string, shouldContinue = () => true) {
    const deadline = now() + 20_000;
    async function poll(): Promise<Awaited<ReturnType<typeof options.apiClient.getRunFlow>>> {
      const flow = await options.apiClient.getRunFlow(runId);
      if ((flow.status === "complete" && !flow.incomplete) || !shouldContinue()) return flow;
      await wait(350);
      return shouldContinue() && now() < deadline ? poll() : flow;
    }
    return poll();
  }

  function applyFlow(
    entry: MockApiDraft,
    result: Awaited<ReturnType<typeof options.apiClient.runMockApi>>,
    flow: Awaited<ReturnType<typeof options.apiClient.getRunFlow>>,
  ) {
    options.graphStore.setObservations({
      errorServices: flow.errorServices,
      edges: flow.edges.map(({ sourceService, targetService, timing }) => ({
        sourceService,
        targetService,
        ...(flow.telemetryState === "partial" ? {} : timing ? { timing } : {}),
      })),
      messageConnectionIds: flow.observedMessageConnectionIds,
      services: tracedServices(flow),
    });
    options.mockApiStore.setRunResult(entry.id!, {
      ...result,
      flow,
      telemetryState: flow.telemetryState,
      totalDurationMs: traceDurationMs(flow),
    });
    options.graphViewModel.syncNodes();
    if (flow.status === "complete" && !flow.incomplete && flow.spans.length > 0) {
      options.onFlowCollected?.({
        flow,
        apiName: entry.name,
        status: result.status,
        totalDurationMs: traceDurationMs(flow),
      });
    }
    if (result.status === "failed" && flow.errorServices.length)
      options.logService.value = flow.errorServices;
  }

  async function runMock(entry: MockApiDraft) {
    if (!entry.id) return;
    await options.saveCanvas();
    const targetService = options
      .services()
      .find((service) =>
        service.endpoints.some((endpoint) => endpoint.id === entry.targetEndpointId),
      );
    options.mockApiStore.setRunningMockId(entry.id);
    setInitialObservations(entry);

    try {
      const result = await options.apiClient.runMockApi(entry.id);
      options.mockApiStore.setRunResult(entry.id, result);
      options.graphViewModel.buildEdges();
      if (result.status === "failed") await showServiceLogs(targetService);
      const flow = await waitForFlow(result.id);
      applyFlow(entry, result, flow);
      if (result.status === "failed" || options.logsOpen.value) await options.loadLogs();
    } catch (cause) {
      options.mockApiStore.setRunResult(entry.id, {
        id: "",
        traceId: "",
        status: "failed",
        responseStatus: null,
        responseBody: null,
        error: cause instanceof Error ? cause.message : "Call failed",
      });
      options.graphViewModel.syncNodes();
      await showServiceLogs(targetService);
    } finally {
      options.mockApiStore.setRunningMockId(null);
      options.openResponsePanel?.(entry.id);
      options.graphViewModel.syncNodes();
      await options.focusResponsePanel?.(entry.id);
      await options.saveCanvas();
    }
  }

  async function replayHistoryEntry(entry: MockApiCallHistoryEntry) {
    const generation = ++replayGeneration;
    const flow = await waitForFlow(entry.runId, () => generation === replayGeneration);
    if (generation !== replayGeneration) return;
    options.graphStore.setObservations({
      errorServices: flow.errorServices,
      edges: flow.edges.map(({ sourceService, targetService, timing }) => ({
        sourceService,
        targetService,
        ...(flow.telemetryState === "partial" ? {} : timing ? { timing } : {}),
      })),
      messageConnectionIds: flow.observedMessageConnectionIds,
      services: tracedServices(flow),
    });
    options.mockApiStore.setRunResult(entry.mockApiId, {
      id: entry.runId,
      traceId: entry.traceId,
      status: entry.status,
      responseStatus: entry.responseStatus,
      responseBody: entry.responseBody,
      error: entry.error,
      flow,
      telemetryState: flow.telemetryState,
      totalDurationMs: traceDurationMs(flow),
    });
    options.graphViewModel.syncNodes();
    if (flow.status === "complete" && !flow.incomplete && flow.spans.length > 0) {
      options.onFlowCollected?.({
        flow,
        apiName:
          options.mockApiStore.mockApis.find(({ id }) => id === entry.mockApiId)?.name ??
          "Mock API",
        status: entry.status === "failed" ? "failed" : "completed",
        totalDurationMs: traceDurationMs(flow),
      });
    }
    return flow;
  }

  function stopReplay() {
    replayGeneration++;
  }

  return { runMock, replayHistoryEntry, stopReplay };
}
