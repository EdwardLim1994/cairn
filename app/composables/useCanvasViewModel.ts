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
  fitView: (options?: { padding?: number; duration?: number }) => Promise<void> | void;
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
    options.graphCanvas.value?.updateNodeInternals(
      options.graphStore.services.map((service) => service.id),
    );
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
      options.mockApiStore.setAuthorizationTemplates(canvas.authorizationTemplates);
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

  async function persistCanvas() {
    try {
      await options.apiClient.saveCanvas(canvasPayload());
      options.graphViewModel.syncSavedPositions();
      options.errorMessage.value = "";
      return true;
    } catch (cause) {
      reportError(cause instanceof Error ? cause.message : "Could not save the graph");
      return false;
    }
  }

  async function saveCanvas() {
    await persistCanvas();
  }

  async function toggleNodesLocked() {
    const previous = options.graphStore.nodesLocked;
    options.graphStore.setNodesLocked(!previous);
    if (!(await persistCanvas())) options.graphStore.setNodesLocked(previous);
  }

  async function autoArrange() {
    options.graphViewModel.arrangeNodes();
    await persistCanvas();
    await nextTick();
    await options.graphCanvas.value?.fitView({ padding: 0.2, duration: 300 });
  }

  function onMoveEnd(viewport: { x: number; y: number; zoom: number }) {
    options.graphStore.setViewport(viewport);
    void saveCanvas();
  }

  async function onConnect(connection: Connection) {
    if (!connection.source || !connection.target || !connection.targetHandle) return;
    if (!options.graphStore.services.some((service) => service.id === connection.source)) return;
    if (!options.graphStore.services.some((service) => service.id === connection.target)) return;
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

  async function onEdgeDoubleClick({ edge }: { edge: { id: string } }) {
    const edges = options.graphStore.serviceEdges.filter((item) => item.id !== edge.id);
    if (edges.length === options.graphStore.serviceEdges.length) return;
    options.graphStore.setServiceEdges(edges);
    buildEdges();
    await saveCanvas();
  }

  return {
    buildEdges,
    syncNodes,
    toggleServiceEndpoints,
    toggleAllNodes,
    loadCanvas,
    loadServiceHealth,
    canvasPayload,
    saveCanvas,
    toggleNodesLocked,
    autoArrange,
    onMoveEnd,
    onConnect,
    onEdgeDoubleClick,
  };
}
