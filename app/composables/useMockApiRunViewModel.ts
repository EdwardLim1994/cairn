import type { Ref } from "vue";
import type { createApiClient } from "../models/api-client";
import type { GraphService } from "../models/graph";
import type { MockApiDraft } from "../models/mock-api";
import type { useGraphStore } from "../stores/graph";
import type { useMockApiStore } from "../stores/mockApis";
import type { useGraphViewModel } from "./useGraphViewModel";

type GraphStore = ReturnType<typeof useGraphStore>;
type MockStore = ReturnType<typeof useMockApiStore>;
type GraphViewModel = ReturnType<typeof useGraphViewModel>;

export function useMockApiRunViewModel(options: {
  apiClient: ReturnType<typeof createApiClient>;
  graphStore: GraphStore;
  mockApiStore: MockStore;
  graphViewModel: GraphViewModel;
  services: () => GraphService[];
  logService: Ref<string[]>;
  logSeverity: Ref<string[]>;
  logsOpen: Ref<boolean>;
  saveCanvas: () => Promise<void>;
  loadLogs: () => Promise<void>;
  wait?: (milliseconds: number) => Promise<void>;
  now?: () => number;
}) {
  const wait =
    options.wait ??
    ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const now = options.now ?? Date.now;

  function setInitialObservations(entry: MockApiDraft, targetService?: GraphService) {
    options.graphStore.setObservations({
      mockApiId: entry.id!,
      services: targetService ? [targetService.name] : [],
      errorServices: [],
      edges: [],
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

  async function showServiceLogs(service?: GraphService) {
    options.logService.value = service ? [service.name] : [];
    options.logSeverity.value = [];
    options.logsOpen.value = true;
    await options.loadLogs();
  }

  async function waitForFlow(runId: string) {
    const deadline = now() + 11_000;
    let flow: Awaited<ReturnType<typeof options.apiClient.getRunFlow>> | undefined;
    do {
      flow = await options.apiClient.getRunFlow(runId);
      if (flow.status === "complete") break;
      await wait(350);
    } while (now() < deadline);
    return flow;
  }

  function applyFlow(
    entry: MockApiDraft,
    result: Awaited<ReturnType<typeof options.apiClient.runMockApi>>,
    flow: Awaited<ReturnType<typeof options.apiClient.getRunFlow>>,
    targetService?: GraphService,
  ) {
    options.graphStore.setObservations({
      mockApiId: entry.id!,
      errorServices: flow.errorServices,
      edges: flow.edges.map(({ sourceService, targetService }) => ({
        sourceService,
        targetService,
      })),
      services: [
        ...new Set([
          ...flow.edges.flatMap((edge) => [edge.sourceService, edge.targetService]),
          ...(targetService ? [targetService.name] : []),
        ]),
      ],
    });
    options.mockApiStore.setRunResult(entry.id!, { ...result, flow });
    options.graphViewModel.syncNodes();
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
    setInitialObservations(entry, targetService);

    try {
      const result = await options.apiClient.runMockApi(entry.id);
      options.mockApiStore.setRunResult(entry.id, result);
      if (result.status === "failed") await showServiceLogs(targetService);
      const flow = await waitForFlow(result.id);
      applyFlow(entry, result, flow, targetService);
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
      await showServiceLogs(targetService);
    } finally {
      options.mockApiStore.setRunningMockId(null);
      options.graphViewModel.buildEdges();
      await options.saveCanvas();
    }
  }

  return { runMock };
}
