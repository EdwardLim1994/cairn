import { computed, ref } from "vue";
import { defineStore } from "pinia";
import type { Edge, Node } from "@vue-flow/core";
import type { CanvasGetResponse } from "#shared/api/canvas";
import type { GraphPosition, GraphViewport } from "../models/graph";

export const useGraphStore = defineStore("graph", () => {
  const nodes = ref<Node[]>([]);
  const edges = ref<Edge[]>([]);
  const services = ref<CanvasGetResponse["services"]>([]);
  const serviceEdges = ref<CanvasGetResponse["edges"]>([]);
  const collapsedServiceEndpoints = ref<Record<string, boolean>>({});
  const serviceHealth = ref<Record<string, boolean | null>>({});
  const viewport = ref<GraphViewport>({ x: 0, y: 0, zoom: 1 });
  const mockNodePosition = ref<GraphPosition>({ x: 560, y: 160 });
  const observedErrorServices = ref<string[]>([]);
  const observedServices = ref<string[]>([]);
  const observedEdges = ref<{ sourceService: string; targetService: string }[]>([]);
  const observedMockApiId = ref<string | null>(null);
  const mockConnectionsCollapsed = ref(false);
  const selectedNodeId = ref<string | null>(null);
  const allNodesCollapsed = computed(
    () =>
      mockConnectionsCollapsed.value &&
      services.value
        .filter((service) => service.endpoints.length)
        .every((service) => collapsedServiceEndpoints.value[service.id]),
  );

  function applyCanvas(canvas: CanvasGetResponse) {
    services.value = canvas.services;
    serviceEdges.value = canvas.edges;
    viewport.value = canvas.viewport;
    mockNodePosition.value = canvas.mockNode;
    selectedNodeId.value = null;
  }
  function setNodes(value: Node[]) {
    nodes.value = value;
  }
  function setEdges(value: Edge[]) {
    edges.value = value;
  }
  function setServiceHealth(value: Record<string, boolean | null>) {
    serviceHealth.value = value;
  }
  function setViewport(value: GraphViewport) {
    viewport.value = value;
  }
  function setServiceEdges(value: CanvasGetResponse["edges"]) {
    serviceEdges.value = value;
  }
  function toggleServiceEndpoints(serviceId: string) {
    collapsedServiceEndpoints.value = {
      ...collapsedServiceEndpoints.value,
      [serviceId]: !collapsedServiceEndpoints.value[serviceId],
    };
  }
  function setAllNodesCollapsed(value: boolean) {
    collapsedServiceEndpoints.value = Object.fromEntries(
      services.value.map((service) => [service.id, value]),
    );
    mockConnectionsCollapsed.value = value;
  }
  function toggleMockConnections() {
    mockConnectionsCollapsed.value = !mockConnectionsCollapsed.value;
  }
  function setObservations(value: {
    mockApiId: string | null;
    services: string[];
    errorServices: string[];
    edges: { sourceService: string; targetService: string }[];
  }) {
    observedMockApiId.value = value.mockApiId;
    observedServices.value = value.services;
    observedErrorServices.value = value.errorServices;
    observedEdges.value = value.edges;
  }
  function setSelection(nodeId: string | null) {
    selectedNodeId.value = nodeId;
  }
  function syncSavedPositions() {
    for (const node of nodes.value) {
      if (node.id === "mock-apis") mockNodePosition.value = { ...node.position };
      else {
        const service = services.value.find((item) => item.id === node.id);
        if (service) {
          service.positionX = node.position.x;
          service.positionY = node.position.y;
        }
      }
    }
  }

  return {
    nodes,
    edges,
    services,
    serviceEdges,
    collapsedServiceEndpoints,
    serviceHealth,
    viewport,
    mockNodePosition,
    observedErrorServices,
    observedServices,
    observedEdges,
    observedMockApiId,
    mockConnectionsCollapsed,
    selectedNodeId,
    allNodesCollapsed,
    applyCanvas,
    setNodes,
    setEdges,
    setServiceHealth,
    setViewport,
    setServiceEdges,
    toggleServiceEndpoints,
    setAllNodesCollapsed,
    toggleMockConnections,
    setObservations,
    setSelection,
    syncSavedPositions,
  };
});
