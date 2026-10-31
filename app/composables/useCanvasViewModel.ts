import type { Connection } from "@vue-flow/core";
import type { Ref } from "vue";
import { nextTick } from "vue";
import type { createApiClient } from "../models/api-client";
import type { useGraphStore } from "../stores/graph";
import type { useMockApiStore } from "../stores/mockApis";
import type { useGraphViewModel } from "./useGraphViewModel";

type ApiClient = ReturnType<typeof createApiClient>;
type GraphStore = ReturnType<typeof useGraphStore>;
type MockApiStore = ReturnType<typeof useMockApiStore>;
type GraphViewModel = ReturnType<typeof useGraphViewModel>;
type GraphCanvas = {
  setViewport: (viewport: { x: number; y: number; zoom: number }) => Promise<void> | void;
  updateNodeInternals: (nodeIds: string[]) => void;
};

export function useCanvasViewModel(options: {
  apiClient: ApiClient;
  graphStore: GraphStore;
  mockApiStore: MockApiStore;
  graphViewModel: GraphViewModel;
  graphCanvas: Ref<GraphCanvas | null>;
  loading: Ref<boolean>;
  errorMessage: Ref<string>;
  onError?: (message: string) => void;
}) {
  const reportError = (message: string) => {
    options.errorMessage.value = message;
    options.onError?.(message);
  };

  function syncNodes() {
    return options.graphViewModel.syncNodes();
  }

  function buildEdges() {
    return options.graphViewModel.buildEdges();
  }

  async function toggleMockConnections() {
    options.graphStore.toggleMockConnections();
    await nextTick();
    options.graphCanvas.value?.updateNodeInternals(["mock-apis"]);
    await nextTick();
    buildEdges();
  }

  async function toggleServiceEndpoints(serviceId: string) {
    options.graphStore.toggleServiceEndpoints(serviceId);
    syncNodes();
    await nextTick();
    options.graphCanvas.value?.updateNodeInternals([serviceId]);
    await nextTick();
    buildEdges();
  }

  async function toggleAllNodes() {
    const collapsed = !options.graphStore.allNodesCollapsed;
    options.graphStore.setAllNodesCollapsed(collapsed);
    syncNodes();
    await nextTick();
    options.graphCanvas.value?.updateNodeInternals([
      ...options.graphStore.services.map((service) => service.id),
      "mock-apis",
    ]);
    await nextTick();
    buildEdges();
  }

  async function loadServiceHealth() {
    try {
      const results = await options.apiClient.checkServiceHealth();
      options.graphStore.setServiceHealth(
        Object.fromEntries(results.map(({ id, online }) => [id, online])),
      );
      syncNodes();
    } catch {
      // Keep the last known health state visible.
    }
  }

  async function loadCanvas() {
    options.loading.value = true;
    try {
      const canvas = await options.apiClient.getCanvas();
      options.graphStore.applyCanvas(canvas);
      options.mockApiStore.setMockApis(canvas.mockApis);
      options.mockApiStore.setHeaderTemplates(canvas.headerTemplates);
      syncNodes();
      if (
        options.graphStore.viewport.zoom !== 1 ||
        options.graphStore.viewport.x ||
        options.graphStore.viewport.y
      )
        await options.graphCanvas.value?.setViewport(options.graphStore.viewport);
      await loadServiceHealth();
    } catch (cause) {
      reportError(cause instanceof Error ? cause.message : "Could not load the graph");
    } finally {
      options.loading.value = false;
    }
  }

  function canvasPayload() {
    return options.graphViewModel.canvasPayload();
  }

  async function saveCanvas() {
    try {
      await options.apiClient.saveCanvas(canvasPayload());
      options.graphViewModel.syncSavedPositions();
      options.errorMessage.value = "";
    } catch (cause) {
      reportError(cause instanceof Error ? cause.message : "Could not save the graph");
    }
  }

  function onMoveEnd(viewport: { x: number; y: number; zoom: number }) {
    options.graphStore.setViewport(viewport);
    void saveCanvas();
  }

  async function onConnect(connection: Connection) {
    if (!connection.source || !connection.target || !connection.targetHandle) return;
    if (connection.source === "mock-apis") {
      const entry = options.mockApiStore.mockApis.find(
        (item) => item.id === connection.sourceHandle,
      );
      if (!entry?.id) return;
      try {
        await saveCanvas();
        await options.apiClient.updateMockApi(entry.id, {
          ...entry,
          targetEndpointId: connection.targetHandle,
        });
        options.mockApiStore.setMockApis(await options.apiClient.listMockApis());
        syncNodes();
        await saveCanvas();
      } catch (cause) {
        reportError(cause instanceof Error ? cause.message : "Could not connect mock API");
      }
      return;
    }
    if (connection.source === connection.target) return;
    options.graphStore.setServiceEdges([
      ...options.graphStore.serviceEdges.filter(
        (edge) =>
          !(
            edge.sourceServiceId === connection.source &&
            edge.targetEndpointId === connection.targetHandle
          ),
      ),
      {
        id: crypto.randomUUID(),
        sourceServiceId: connection.source,
        targetEndpointId: connection.targetHandle,
      },
    ]);
    buildEdges();
    await saveCanvas();
  }

  return {
    buildEdges,
    syncNodes,
    toggleMockConnections,
    toggleServiceEndpoints,
    toggleAllNodes,
    loadCanvas,
    loadServiceHealth,
    canvasPayload,
    saveCanvas,
    onMoveEnd,
    onConnect,
  };
}
