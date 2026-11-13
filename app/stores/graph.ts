import { computed, ref } from "vue";
import { defineStore } from "pinia";
import type { Edge, Node } from "@vue-flow/core";
import type { CanvasGetResponse } from "#shared/api/canvas";
import type { GraphViewport, ObservedServiceEdge } from "../models/graph";
import { useServiceStore } from "../entities/service";
import { useMessageDestinationStore } from "../entities/message-destination";

export const useGraphStore = defineStore("graph", () => {
  const serviceStore = useServiceStore();
  const messageDestinationStore = useMessageDestinationStore();
  const nodes = ref<Node[]>([]);
  const edges = ref<Edge[]>([]);
  const services = computed({
    get: () => serviceStore.services,
    set: serviceStore.setServices,
  });
  const serviceEdges = ref<CanvasGetResponse["edges"]>([]);
  const messageDestinations = computed({
    get: () => messageDestinationStore.messageDestinations,
    set: messageDestinationStore.setMessageDestinations,
  });
  const messageConnections = ref<CanvasGetResponse["messageConnections"]>([]);
  const collapsedServiceEndpoints = ref<Record<string, boolean>>({});
  const serviceHealth = ref<Record<string, boolean | null>>({});
  const viewport = ref<GraphViewport>({ x: 0, y: 0, zoom: 1 });
  const nodesLocked = ref(false);
  const observedErrorServices = ref<string[]>([]);
  const observedServices = ref<string[]>([]);
  const observedEdges = ref<ObservedServiceEdge[]>([]);
  const observedMessageConnectionIds = ref<string[]>([]);
  const selectedNodeId = ref<string | null>(null);
  const allNodesCollapsed = computed(() => {
    const servicesWithEndpoints = services.value.filter((service) => service.endpoints.length);
    return (
      servicesWithEndpoints.length > 0 &&
      servicesWithEndpoints.every((service) => collapsedServiceEndpoints.value[service.id])
    );
  });

  function applyCanvas(canvas: CanvasGetResponse, options: { preserveViewState?: boolean } = {}) {
    serviceStore.setServices(canvas.services);
    serviceEdges.value = canvas.edges;
    messageDestinationStore.setMessageDestinations(canvas.messageDestinations ?? []);
    messageConnections.value = canvas.messageConnections ?? [];
    if (!options.preserveViewState) viewport.value = canvas.viewport;
    nodesLocked.value = canvas.nodesLocked;
    if (!options.preserveViewState) selectedNodeId.value = null;
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
  function setNodesLocked(value: boolean) {
    nodesLocked.value = value;
  }
  function setServiceEdges(value: CanvasGetResponse["edges"]) {
    serviceEdges.value = value;
  }
  function setMessageConnections(value: CanvasGetResponse["messageConnections"]) {
    messageConnections.value = value;
  }
  function setMessageDestinations(value: CanvasGetResponse["messageDestinations"]) {
    messageDestinationStore.setMessageDestinations(value);
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
  }
  function setObservations(value: {
    services: string[];
    errorServices: string[];
    edges: ObservedServiceEdge[];
    messageConnectionIds?: string[];
  }) {
    observedServices.value = value.services;
    observedErrorServices.value = value.errorServices;
    observedEdges.value = value.edges;
    observedMessageConnectionIds.value = value.messageConnectionIds ?? [];
  }
  function setSelection(nodeId: string | null) {
    selectedNodeId.value = nodeId;
  }
  function syncSavedPositions() {
    for (const node of nodes.value) {
      const service = services.value.find((item) => item.id === node.id);
      if (service) {
        service.positionX = node.position.x;
        service.positionY = node.position.y;
      }
      if (node.id.startsWith("message-queue:")) {
        const destinationId = node.id.slice("message-queue:".length);
        const destination = messageDestinations.value.find(({ id }) => id === destinationId);
        if (destination) {
          destination.x = node.position.x;
          destination.y = node.position.y;
        }
      }
    }
  }

  return {
    nodes,
    edges,
    services,
    serviceEdges,
    messageDestinations,
    messageConnections,
    collapsedServiceEndpoints,
    serviceHealth,
    viewport,
    nodesLocked,
    observedErrorServices,
    observedServices,
    observedEdges,
    observedMessageConnectionIds,
    selectedNodeId,
    allNodesCollapsed,
    applyCanvas,
    setNodes,
    setEdges,
    setServiceHealth,
    setViewport,
    setNodesLocked,
    setServiceEdges,
    setMessageConnections,
    setMessageDestinations,
    toggleServiceEndpoints,
    setAllNodesCollapsed,
    setObservations,
    setSelection,
    syncSavedPositions,
  };
});
