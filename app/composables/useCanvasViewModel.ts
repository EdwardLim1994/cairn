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
type ConnectionSource = { serviceId?: string; endpointId?: string; subscriptionId?: string };

function messageSourceKey(connection: {
  subscriptionId?: string | null;
  endpointId?: string | null;
  serviceId?: string | null;
}) {
  if (connection.subscriptionId) return `subscription:${connection.subscriptionId}`;
  if (connection.endpointId) return `endpoint:${connection.endpointId}`;
  return `service:${connection.serviceId ?? ""}`;
}

function queueIdForNode(nodeId: string) {
  if (nodeId === "message-queue") return "legacy-queue";
  if (nodeId.startsWith("message-queue:")) return nodeId.slice("message-queue:".length);
  return undefined;
}

export function useCanvasViewModel(options: {
  apiClient: ApiClient;
  graphStore: GraphStore;
  mockApiStore: MockApiStore;
  graphViewModel: GraphViewModel;
  graphCanvas: Ref<GraphCanvas | null>;
  loading: Ref<boolean>;
  errorMessage: Ref<string>;
  onServiceHealthCompleted?: (serviceIds: string[], checkedAt: string) => void;
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
    } finally {
      options.onServiceHealthCompleted?.(
        options.graphStore.services.map(({ id }) => id),
        new Date().toISOString(),
      );
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
      const exists = options.graphStore.messageConnections.some((current) => {
        if (current.type !== message.type || current.destinationId !== message.destinationId)
          return false;
        if (current.type === "subscribe" && message.type === "subscribe")
          return current.serviceId === message.serviceId;
        return (
          current.type === "publish" &&
          message.type === "publish" &&
          messageSourceKey(current) === messageSourceKey(message)
        );
      });
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

  function sourceFromCallId(callId: string): ConnectionSource | undefined {
    const edge = options.graphStore.serviceEdges.find(({ id }) => id === callId);
    if (edge)
      return {
        serviceId: edge.sourceServiceId,
        endpointId: edge.sourceEndpointId ?? undefined,
        subscriptionId: edge.sourceSubscriptionId ?? undefined,
      };
    const publish = options.graphStore.messageConnections.find(
      (item) => item.id === callId && item.type === "publish",
    );
    if (publish?.type !== "publish") return undefined;
    return {
      serviceId: publish.serviceId,
      endpointId: publish.endpointId,
      subscriptionId: publish.subscriptionId,
    };
  }

  function sourceFromHandle(
    sourceId: string,
    handle: string | null | undefined,
  ): ConnectionSource | undefined {
    if (handle?.startsWith("outbound-call:"))
      return sourceFromCallId(handle.slice("outbound-call:".length));
    const endpointId = handle?.startsWith("out:") ? handle.slice(4) : undefined;
    const subscriptionId = handle?.startsWith("consumer-out:")
      ? handle.slice("consumer-out:".length)
      : undefined;
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
    const targetQueueId = queueIdForNode(connection.target);
    const targetHandle = connection.targetHandle;
    if (targetQueueId && targetHandle?.startsWith("publish-in:"))
      return publishMessageConnection(
        connection,
        targetQueueId,
        targetHandle.slice("publish-in:".length),
      );
    const sourceQueueId = queueIdForNode(connection.source);
    const sourceHandle = connection.sourceHandle;
    if (
      sourceQueueId &&
      sourceHandle?.startsWith("subscribe-out:") &&
      targetHandle?.startsWith("subscriber-in:")
    )
      return subscribeMessageConnection(
        connection,
        sourceQueueId,
        sourceHandle.slice("subscribe-out:".length),
      );
    return undefined;
  }

  function publishMessageConnection(
    connection: Connection,
    queueId: string,
    destinationId: string,
  ) {
    const source = sourceFromHandle(connection.source, connection.sourceHandle);
    if (source?.serviceId !== connection.source) return undefined;
    const destination = options.graphStore.messageDestinations.find(
      (item) => item.id === destinationId,
    );
    if (!destination) return undefined;
    let routingKey: string | undefined;
    if (destination.broker === "rabbitmq") {
      routingKey = promptConnectionValue("RabbitMQ routing key", "events")?.trim();
      if (!routingKey) return undefined;
    }
    return {
      type: "publish" as const,
      destinationId,
      serviceId: source.serviceId,
      ...(source.endpointId ? { endpointId: source.endpointId } : {}),
      ...(source.subscriptionId ? { subscriptionId: source.subscriptionId } : {}),
      ...(routingKey ? { routingKey } : {}),
    };
  }

  function subscribeMessageConnection(
    connection: Connection,
    queueId: string,
    destinationId: string,
  ) {
    if (!options.graphStore.services.some((service) => service.id === connection.target))
      return undefined;
    const destination = options.graphStore.messageDestinations.find(
      (item) => item.id === destinationId,
    );
    if (!destination) return undefined;
    const isKafka = destination.broker === "kafka";
    const connectionValue = isKafka
      ? promptConnectionValue("Kafka consumer group", "cairn-consumers")?.trim()
      : promptConnectionValue("RabbitMQ binding key", "#")?.trim();
    if (!connectionValue) return undefined;
    if (isKafka)
      return {
        type: "subscribe" as const,
        destinationId,
        serviceId: connection.target,
        consumerGroup: connectionValue,
      };
    return {
      type: "subscribe" as const,
      destinationId,
      serviceId: connection.target,
      bindingKey: connectionValue,
    };
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

  function addOutboundTarget(
    sourceId: string,
    subscription: GraphStore["messageConnections"][number] | undefined,
    sourceServiceId: string,
    targetType: string | undefined,
    targetId: string | undefined,
    edges: GraphStore["serviceEdges"],
    messages: GraphStore["messageConnections"],
  ) {
    if (targetType === "endpoint")
      return addEndpointTarget(sourceId, subscription, sourceServiceId, targetId, edges);
    if (targetType === "destination")
      return addDestinationTarget(sourceId, subscription, sourceServiceId, targetId, messages);
    return false;
  }

  function addEndpointTarget(
    sourceId: string,
    subscription: GraphStore["messageConnections"][number] | undefined,
    sourceServiceId: string,
    targetId: string | undefined,
    edges: GraphStore["serviceEdges"],
  ) {
    const targetServiceId = options.graphViewModel.endpointTarget(targetId ?? "");
    if (!targetId || !targetServiceId || sourceServiceId === targetServiceId) return false;
    edges.push({
      id: crypto.randomUUID(),
      sourceServiceId,
      sourceEndpointId: subscription ? null : sourceId,
      ...(subscription ? { sourceSubscriptionId: subscription.id } : {}),
      targetEndpointId: targetId,
    });
    return true;
  }

  function addDestinationTarget(
    sourceId: string,
    subscription: GraphStore["messageConnections"][number] | undefined,
    sourceServiceId: string,
    targetId: string | undefined,
    messages: GraphStore["messageConnections"],
  ) {
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
    if (
      !addOutboundTarget(
        sourceId,
        subscription,
        sourceServiceId,
        targetType,
        targetId,
        edges,
        messages,
      )
    )
      return false;

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
