import type { Connection, EdgeChange } from "@vue-flow/core";
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
  promptConnectionValue?: (message: string, defaultValue: string) => string | null;
  onError?: (message: string) => void;
}) {
  const reportError = (message: string) => {
    options.errorMessage.value = message;
    options.onError?.(message);
  };
  const promptConnectionValue = (message: string, defaultValue: string) =>
    options.promptConnectionValue
      ? options.promptConnectionValue(message, defaultValue)
      : window.prompt(message, defaultValue);

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

  async function loadMessageDestinationHealth() {
    try {
      const results = await options.apiClient.checkMessageDestinationHealth();
      for (const result of results) {
        const destination = options.graphStore.messageDestinations.find(
          (item) => item.id === result.id,
        );
        if (destination) destination.health = result.online;
      }
      syncNodes();
    } catch {
      // Keep the last known broker status visible.
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
      await loadMessageDestinationHealth();
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
    return await persistCanvas();
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
    const message = messageConnection(connection);
    if (message) {
      const exists = options.graphStore.messageConnections.some(
        (current) =>
          current.type === message.type &&
          current.destinationId === message.destinationId &&
          (message.type === "publish"
            ? current.type === "publish" &&
              (current.subscriptionId
                ? `subscription:${current.subscriptionId}`
                : current.endpointId
                  ? `endpoint:${current.endpointId}`
                  : `service:${current.serviceId}`) ===
                (message.subscriptionId
                  ? `subscription:${message.subscriptionId}`
                  : "endpointId" in message && message.endpointId
                    ? `endpoint:${message.endpointId}`
                    : `service:${"serviceId" in message ? message.serviceId : ""}`)
            : current.type === "subscribe" &&
              current.serviceId === message.serviceId &&
              current.destinationId === message.destinationId),
      );
      if (exists) return;
      options.graphStore.setMessageConnections([
        ...options.graphStore.messageConnections,
        { id: crypto.randomUUID(), ...message },
      ]);
      buildEdges();
      await saveCanvas();
      return;
    }
    const edge = edgeConnection(connection);
    if (!edge) return;
    options.graphStore.setServiceEdges([
      ...options.graphStore.serviceEdges.filter(
        (current) =>
          !(
            current.sourceEndpointId === edge.sourceEndpointId &&
            current.sourceSubscriptionId === edge.sourceSubscriptionId &&
            current.targetEndpointId === edge.targetEndpointId
          ),
      ),
      { id: crypto.randomUUID(), ...edge },
    ]);
    buildEdges();
    await saveCanvas();
  }

  function sourceFromHandle(sourceId: string, handle: string | null | undefined) {
    const endpointId = handle?.startsWith("out:") ? handle.slice(4) : undefined;
    const subscriptionId = handle?.startsWith("consumer-out:")
      ? handle.slice("consumer-out:".length)
      : undefined;
    const callId = handle?.startsWith("outbound-call:")
      ? handle.slice("outbound-call:".length)
      : undefined;
    if (callId) {
      const edge = options.graphStore.serviceEdges.find(({ id }) => id === callId);
      const publish = options.graphStore.messageConnections.find(
        (item) => item.id === callId && item.type === "publish",
      );
      return edge
        ? {
            serviceId: edge.sourceServiceId,
            endpointId: edge.sourceEndpointId ?? undefined,
            subscriptionId: edge.sourceSubscriptionId ?? undefined,
          }
        : publish?.type === "publish"
          ? {
              serviceId: publish.serviceId,
              endpointId: publish.endpointId,
              subscriptionId: publish.subscriptionId,
            }
          : undefined;
    }
    if (endpointId) {
      const serviceId = options.graphStore.services.find((service) =>
        service.endpoints.some((endpoint) => endpoint.id === endpointId),
      )?.id;
      return serviceId ? { serviceId, endpointId } : undefined;
    }
    if (subscriptionId) {
      const subscription = options.graphStore.messageConnections.find(
        (item) => item.id === subscriptionId && item.type === "subscribe",
      );
      return subscription ? { serviceId: subscription.serviceId, subscriptionId } : undefined;
    }
    return handle === "service-out" ? { serviceId: sourceId } : undefined;
  }

  function messageConnection(connection: Connection) {
    const queueIdForNode = (nodeId: string) =>
      nodeId === "message-queue"
        ? "legacy-queue"
        : nodeId.startsWith("message-queue:")
          ? nodeId.slice("message-queue:".length)
          : undefined;
    const sourceDestinationId =
      queueIdForNode(connection.source) && connection.sourceHandle?.startsWith("subscribe-out:")
        ? connection.sourceHandle.slice("subscribe-out:".length)
        : undefined;
    const targetDestinationId =
      queueIdForNode(connection.target) && connection.targetHandle?.startsWith("publish-in:")
        ? connection.targetHandle.slice("publish-in:".length)
        : undefined;
    if (targetDestinationId) {
      const source = sourceFromHandle(connection.source, connection.sourceHandle);
      if (!source || source.serviceId !== connection.source) return undefined;
      const destination = options.graphStore.messageDestinations.find(
        (item) =>
          item.id === targetDestinationId &&
          (item.queueId ?? "legacy-queue") === queueIdForNode(connection.target),
      );
      if (!destination) return undefined;
      const routingKey =
        destination.broker === "rabbitmq"
          ? promptConnectionValue("RabbitMQ routing key", "events")?.trim()
          : undefined;
      if (destination.broker === "rabbitmq" && !routingKey) return undefined;
      return {
        type: "publish" as const,
        destinationId: targetDestinationId,
        serviceId: source.serviceId,
        ...(source.endpointId ? { endpointId: source.endpointId } : {}),
        ...(source.subscriptionId ? { subscriptionId: source.subscriptionId } : {}),
        ...(routingKey ? { routingKey } : {}),
      };
    }
    if (sourceDestinationId && connection.targetHandle?.startsWith("subscriber-in:")) {
      if (!options.graphStore.services.some((service) => service.id === connection.target))
        return undefined;
      const destination = options.graphStore.messageDestinations.find(
        (item) =>
          item.id === sourceDestinationId &&
          (item.queueId ?? "legacy-queue") === queueIdForNode(connection.source),
      );
      if (!destination) return undefined;
      const connectionValue = promptConnectionValue(
        destination.broker === "kafka" ? "Kafka consumer group" : "RabbitMQ binding key",
        destination.broker === "kafka" ? "cairn-consumers" : "#",
      )?.trim();
      if (!connectionValue) return undefined;
      const connectionDetails =
        destination.broker === "kafka"
          ? { consumerGroup: connectionValue }
          : { bindingKey: connectionValue };
      return {
        type: "subscribe" as const,
        destinationId: sourceDestinationId,
        serviceId: connection.target,
        ...connectionDetails,
      };
    }
    return undefined;
  }

  function edgeConnection(connection: Connection) {
    const source = sourceFromHandle(connection.source, connection.sourceHandle);
    const targetEndpointId = connection.targetHandle?.startsWith("in:")
      ? connection.targetHandle.slice(3)
      : "";
    const targetService = options.graphStore.services.find((service) =>
      service.endpoints.some((endpoint) => endpoint.id === targetEndpointId),
    );
    if (
      !source ||
      !targetService ||
      source.serviceId !== connection.source ||
      targetService.id !== connection.target ||
      source.serviceId === targetService.id ||
      options.graphStore.collapsedServiceEndpoints[source.serviceId] ||
      options.graphStore.collapsedServiceEndpoints[targetService.id]
    )
      return undefined;
    return {
      sourceServiceId: source.serviceId,
      sourceEndpointId: source.endpointId ?? null,
      ...(source.subscriptionId ? { sourceSubscriptionId: source.subscriptionId } : {}),
      targetEndpointId,
    };
  }

  async function onEdgeUpdate(event: { edge: { id: string }; connection: Connection }) {
    if (!options.graphStore.serviceEdges.some(({ id }) => id === event.edge.id)) return;
    const connection = edgeConnection(event.connection);
    if (!connection) {
      buildEdges();
      return;
    }
    options.graphStore.setServiceEdges(
      options.graphStore.serviceEdges.map((edge) =>
        edge.id === event.edge.id ? { ...edge, ...connection } : edge,
      ),
    );
    buildEdges();
    await saveCanvas();
  }

  async function addServiceCall(sourceEndpointId: string, targetEndpointId: string) {
    const sourceService = options.graphStore.services.find((service) =>
      service.endpoints.some((endpoint) => endpoint.id === sourceEndpointId),
    );
    const sourceSubscription = options.graphStore.messageConnections.find(
      (connection) => connection.id === sourceEndpointId && connection.type === "subscribe",
    );
    const sourceServiceId = sourceService?.id ?? sourceSubscription?.serviceId;
    const targetServiceId = options.graphViewModel.endpointTarget(targetEndpointId);
    if (
      !sourceServiceId ||
      !targetServiceId ||
      sourceServiceId === targetServiceId ||
      options.graphStore.serviceEdges.some(
        (edge) =>
          (sourceSubscription
            ? edge.sourceSubscriptionId === sourceSubscription.id
            : edge.sourceEndpointId === sourceEndpointId) &&
          edge.targetEndpointId === targetEndpointId,
      )
    )
      return false;
    options.graphStore.setServiceEdges([
      ...options.graphStore.serviceEdges,
      {
        id: crypto.randomUUID(),
        sourceServiceId,
        sourceEndpointId: sourceSubscription ? null : sourceEndpointId,
        ...(sourceSubscription ? { sourceSubscriptionId: sourceSubscription.id } : {}),
        targetEndpointId,
      },
    ]);
    buildEdges();
    await saveCanvas();
    return true;
  }

  async function removeServiceCall(edgeId: string) {
    const remaining = options.graphStore.serviceEdges.filter(({ id }) => id !== edgeId);
    const remainingMessages = options.graphStore.messageConnections.filter(
      ({ id }) => id !== edgeId,
    );
    if (
      remaining.length === options.graphStore.serviceEdges.length &&
      remainingMessages.length === options.graphStore.messageConnections.length
    )
      return false;
    options.graphStore.setServiceEdges(remaining);
    options.graphStore.setMessageConnections(remainingMessages);
    buildEdges();
    await saveCanvas();
    return true;
  }

  async function addSubscriptionPublish(subscriptionId: string, destinationId: string) {
    const subscription = options.graphStore.messageConnections.find(
      (connection) => connection.id === subscriptionId && connection.type === "subscribe",
    );
    const destination = options.graphStore.messageDestinations.find(
      ({ id }) => id === destinationId,
    );
    if (!subscription || !destination || subscription.serviceId === undefined) return false;
    const routingKey =
      destination.broker === "rabbitmq"
        ? promptConnectionValue("RabbitMQ routing key", "events")?.trim()
        : undefined;
    if (destination.broker === "rabbitmq" && !routingKey) return false;
    if (
      options.graphStore.messageConnections.some(
        (connection) =>
          connection.type === "publish" &&
          connection.subscriptionId === subscriptionId &&
          connection.destinationId === destinationId,
      )
    )
      return false;
    options.graphStore.setMessageConnections([
      ...options.graphStore.messageConnections,
      {
        id: crypto.randomUUID(),
        type: "publish",
        serviceId: subscription.serviceId,
        subscriptionId,
        destinationId,
        ...(routingKey ? { routingKey } : {}),
      },
    ]);
    buildEdges();
    await saveCanvas();
    return true;
  }

  async function setOutboundCall(
    sourceId: string,
    connectionId: string | undefined,
    target: string,
  ) {
    const endpoint = options.graphStore.services
      .flatMap((service) => service.endpoints.map((item) => ({ ...item, serviceId: service.id })))
      .find((item) => item.id === sourceId);
    const subscription = options.graphStore.messageConnections.find(
      (item) => item.id === sourceId && item.type === "subscribe",
    );
    const sourceServiceId = endpoint?.serviceId ?? subscription?.serviceId;
    if (!sourceServiceId) return false;

    const edges = options.graphStore.serviceEdges.filter(({ id }) => id !== connectionId);
    const messages = options.graphStore.messageConnections.filter(({ id }) => id !== connectionId);
    const [targetType, targetId] = target.split(":", 2);
    if (targetType === "endpoint") {
      const targetServiceId = options.graphViewModel.endpointTarget(targetId ?? "");
      if (!targetId || !targetServiceId || sourceServiceId === targetServiceId) return false;
      edges.push({
        id: crypto.randomUUID(),
        sourceServiceId,
        sourceEndpointId: subscription ? null : sourceId,
        ...(subscription ? { sourceSubscriptionId: subscription.id } : {}),
        targetEndpointId: targetId,
      });
    } else if (targetType === "destination") {
      const destination = options.graphStore.messageDestinations.find(({ id }) => id === targetId);
      if (!destination) return false;
      const routingKey = destination.broker === "rabbitmq" ? "events" : undefined;
      messages.push({
        id: crypto.randomUUID(),
        type: "publish",
        destinationId: destination.id,
        serviceId: sourceServiceId,
        ...(subscription ? { subscriptionId: subscription.id } : { endpointId: sourceId }),
        ...(routingKey ? { routingKey } : {}),
      });
    } else return false;

    options.graphStore.setServiceEdges(edges);
    options.graphStore.setMessageConnections(messages);
    buildEdges();
    await saveCanvas();
    return true;
  }

  async function onEdgesChange(changes: EdgeChange[]) {
    const removed = new Set(
      changes.flatMap((change) => (change.type === "remove" ? [change.id] : [])),
    );
    if (!removed.size) return;
    const remaining = options.graphStore.serviceEdges.filter(({ id }) => !removed.has(id));
    const remainingMessages = options.graphStore.messageConnections.filter(
      ({ id }) => !removed.has(`message-${id}`),
    );
    if (
      remaining.length === options.graphStore.serviceEdges.length &&
      remainingMessages.length === options.graphStore.messageConnections.length
    )
      return;
    options.graphStore.setServiceEdges(remaining);
    options.graphStore.setMessageConnections(remainingMessages);
    await saveCanvas();
  }

  async function onEdgeDoubleClick({ edge }: { edge: { id: string } }) {
    const edges = options.graphStore.serviceEdges.filter((item) => item.id !== edge.id);
    const messageConnections = options.graphStore.messageConnections.filter(
      (item) => `message-${item.id}` !== edge.id,
    );
    if (
      edges.length === options.graphStore.serviceEdges.length &&
      messageConnections.length === options.graphStore.messageConnections.length
    )
      return;
    options.graphStore.setServiceEdges(edges);
    options.graphStore.setMessageConnections(messageConnections);
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
    loadMessageDestinationHealth,
    canvasPayload,
    saveCanvas,
    toggleNodesLocked,
    autoArrange,
    onMoveEnd,
    onConnect,
    onEdgeDoubleClick,
    onEdgeUpdate,
    onEdgesChange,
    addServiceCall,
    addSubscriptionPublish,
    setOutboundCall,
    removeServiceCall,
  };
}
