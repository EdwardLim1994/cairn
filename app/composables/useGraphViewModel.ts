import type { Edge, Node } from "@vue-flow/core";
import type { GraphMockApi, GraphService } from "../models/graph";
import type { useGraphStore } from "../stores/graph";
import { arrangeGraph, messageQueueNodeId } from "../utils/graph-layout";

type Store = ReturnType<typeof useGraphStore>;
type ViewModelOptions = {
  store: Store;
  mockApis: () => GraphMockApi[];
  runningMockId: () => string | null;
  runResults?: () => Record<
    string,
    {
      status: string;
      responseStatus?: number | null;
      grpcStatusName?: string | null;
      responseBody?: string | null;
      error?: string | null;
      traceId?: string;
    }
  >;
  websocketState?: (id: string) => "connecting" | "connected" | "disconnected";
  responsePanelOpenId?: () => string | null;
  websocketUnread?: (id: string) => boolean;
  websocketMessages?: (id: string) => Array<{ id: number; data: string; receivedAt: string }>;
};

function frameworkLabel(framework: string) {
  return framework.toLowerCase().includes(".net") ? ".NET" : framework;
}

function endpointHandle(endpointId: string) {
  return `in:${endpointId}`;
}

function endpointSourceHandle(endpointId: string) {
  return `out:${endpointId}`;
}

function onlineStatus(destinations: Array<{ health?: boolean | null }>) {
  if (destinations.some((destination) => destination.health === false)) return false;
  if (destinations.every((destination) => destination.health === true)) return true;
  return null;
}

function edgeClass(running: boolean, completed: boolean) {
  if (running) return "app__flow-edge app__flow-edge--running";
  if (completed) return "app__flow-edge app__flow-edge--observed";
  return "";
}

export function useGraphViewModel({
  store,
  mockApis,
  runningMockId,
  runResults,
  websocketState,
  responsePanelOpenId,
  websocketUnread,
  websocketMessages,
}: ViewModelOptions) {
  function endpointTarget(endpointId: string) {
    for (const service of store.services) {
      if (service.endpoints.some((endpoint) => endpoint.id === endpointId)) return service.id;
    }
    return undefined;
  }

  function serviceEndpointOptions() {
    return store.services.flatMap((service) =>
      service.endpoints.map((endpoint) => ({
        id: endpoint.id!,
        serviceId: service.id,
        apiType:
          service.apiType === "WEBSOCKET"
            ? "WEBSOCKET"
            : (service.apiType ?? "REST") === "REST"
              ? "HTTP"
              : "GRPC",
        method: endpoint.method,
        label: `${service.name}  |  ${endpoint.name} (${service.apiType === "WEBSOCKET" ? "WebSocket" : (service.apiType ?? "REST") === "REST" ? endpoint.method : "gRPC"})`,
      })),
    );
  }

  function serviceNode(service: GraphService): Node {
    const hasError = store.observedErrorServices.includes(service.name);
    return {
      id: service.id,
      type: "service",
      position: { x: service.positionX, y: service.positionY },
      data: {
        serviceId: service.id,
        name: service.name,
        apiType: service.apiType,
        framework: frameworkLabel(service.framework),
        hasMessagePublisher:
          !service.endpoints.length &&
          store.messageConnections.some(
            (connection) =>
              connection.type === "publish" &&
              connection.serviceId === service.id &&
              !connection.endpointId &&
              !connection.subscriptionId,
          ),
        outboundCalls: [
          ...store.serviceEdges
            .filter((edge) => edge.sourceServiceId === service.id)
            .map((edge) => ({
              id: edge.id,
              kind: "api" as const,
              sourceEndpointId:
                edge.sourceEndpointId ??
                (edge.sourceSubscriptionId ? undefined : service.endpoints[0]?.id),
              sourceSubscriptionId: edge.sourceSubscriptionId,
            })),
          ...store.messageConnections
            .filter(
              (connection) =>
                connection.type === "publish" &&
                (connection.serviceId === service.id ||
                  ("endpointId" in connection &&
                    service.endpoints.some((endpoint) => endpoint.id === connection.endpointId))),
            )
            .map((connection) => ({
              id: connection.id,
              kind: "message" as const,
              sourceEndpointId:
                ("endpointId" in connection ? connection.endpointId : undefined) ??
                ("subscriptionId" in connection && connection.subscriptionId
                  ? undefined
                  : service.endpoints[0]?.id),
              sourceSubscriptionId:
                "subscriptionId" in connection ? connection.subscriptionId : undefined,
            })),
        ],
        online: store.serviceHealth[service.id] ?? null,
        endpoints: service.endpoints,
        subscriptions: store.messageConnections.flatMap((connection) => {
          if (connection.type !== "subscribe" || connection.serviceId !== service.id) return [];
          const destination = store.messageDestinations.find(
            (item) => item.id === connection.destinationId,
          );
          return destination
            ? [
                {
                  id: connection.id,
                  destinationName: destination.name,
                  consumerGroup: connection.consumerGroup,
                  bindingKey: connection.bindingKey,
                },
              ]
            : [];
        }),
        endpointsCollapsed: store.collapsedServiceEndpoints[service.id] ?? false,
        hasError,
      },
      class: [
        "app__flow-node",
        store.observedServices.includes(service.name) ? "app__flow-node--service-observed" : "",
        hasError ? "app__flow-node--service-error" : "",
        store.selectedNodeId === service.id ? "selected" : "",
      ]
        .filter(Boolean)
        .join(" "),
    };
  }

  function mockApiNodes(): Node[] {
    const entriesByService = new Map<string, GraphMockApi[]>();
    for (const entry of mockApis()) {
      if (!entry.id || !entry.targetEndpointId) continue;
      const serviceId = endpointTarget(entry.targetEndpointId);
      if (!serviceId) continue;
      entriesByService.set(serviceId, [...(entriesByService.get(serviceId) ?? []), entry]);
    }

    return [...entriesByService.entries()].flatMap(([serviceId, entries]) => {
      const service = store.services.find((item) => item.id === serviceId);
      if (!service) return [];
      const ordered = [...entries].sort((left, right) => left.id.localeCompare(right.id));
      return ordered.map((entry, index) => ({
        id: `mock-api-${entry.id}`,
        type: "mockApiTrigger",
        position: {
          x: entry.positionX ?? service.positionX - 220,
          y: entry.positionY ?? service.positionY + (index - (ordered.length - 1) / 2) * 68,
        },
        data: {
          id: entry.id,
          name: entry.name,
          active: entry.active,
          ready: entry.status === "ready",
          running: runningMockId() === entry.id,
          busy: Boolean(runningMockId()),
          websocketState: websocketState?.(entry.id) ?? "disconnected",
          responseOpen: responsePanelOpenId?.() === entry.id,
          unread: websocketUnread?.(entry.id) ?? false,
          messages: websocketMessages?.(entry.id) ?? [],
          latestResponse: runResults?.()[entry.id],
          entry,
        },
        class: "app__flow-node app__flow-node--mock-trigger",
        selectable: false,
      }));
    });
  }

  function messageQueueNodes(): Node[] {
    const queues = new Map<string, typeof store.messageDestinations>();
    for (const destination of store.messageDestinations) {
      const queueId = destination.queueId ?? "legacy-queue";
      queues.set(queueId, [...(queues.get(queueId) ?? []), destination]);
    }
    return [...queues].map(([queueId, destinations]) => {
      const nodeId = messageQueueNodeId(queueId);
      const destinationIds = new Set(destinations.map(({ id }) => id));
      const observed = store.messageConnections.some(
        (connection) =>
          store.observedMessageConnectionIds.includes(connection.id) &&
          destinationIds.has(connection.destinationId),
      );
      const online = onlineStatus(destinations);
      return {
        id: nodeId,
        type: "messageQueue",
        position: {
          x:
            destinations.reduce((total, destination) => total + destination.x, 0) /
            destinations.length,
          y:
            destinations.reduce((total, destination) => total + destination.y, 0) /
            destinations.length,
        },
        data: {
          queueId,
          name: destinations[0]?.queueName ?? "Message Queue",
          destinations,
          online,
          topicsCollapsed: store.allNodesCollapsed,
        },
        class: [
          "app__flow-node app__flow-node--message-queue",
          observed ? "app__flow-node--service-observed" : "",
          store.selectedNodeId === nodeId ? "selected" : "",
        ]
          .filter(Boolean)
          .join(" "),
      };
    });
  }

  function buildEdges() {
    const declared: Edge[] = store.serviceEdges.flatMap((edge) => {
      const target = endpointTarget(edge.targetEndpointId);
      if (!target) return [];
      const sourceService = store.services.find((service) => service.id === edge.sourceServiceId);
      const sourceEndpointId =
        edge.sourceEndpointId ?? sourceService?.endpoints.find((endpoint) => endpoint.id)?.id;
      const subscription = edge.sourceSubscriptionId
        ? store.messageConnections.find(
            (connection) =>
              connection.id === edge.sourceSubscriptionId && connection.type === "subscribe",
          )
        : undefined;
      if (
        (!subscription &&
          (!sourceEndpointId || endpointTarget(sourceEndpointId) !== edge.sourceServiceId)) ||
        (subscription && subscription.serviceId !== edge.sourceServiceId)
      )
        return [];
      const canEdit =
        !(store.collapsedServiceEndpoints[edge.sourceServiceId] ?? false) &&
        !(store.collapsedServiceEndpoints[target] ?? false);
      const sourceName = store.services.find(
        (service) => service.id === edge.sourceServiceId,
      )?.name;
      const targetName = store.services.find((service) => service.id === target)?.name;
      const isObserved = store.observedEdges.some(
        (item) => item.sourceService === sourceName && item.targetService === targetName,
      );
      return [
        {
          id: edge.id,
          source: edge.sourceServiceId,
          sourceHandle: `outbound-call:${edge.id}`,
          target,
          targetHandle: endpointHandle(edge.targetEndpointId),
          updatable: canEdit,
          deletable: canEdit,
          type: "default",
          class: isObserved ? "app__flow-edge app__flow-edge--observed" : "",
          animated: isObserved,
        },
      ];
    });
    const mock: Edge[] = mockApis().flatMap((entry) => {
      const target = endpointTarget(entry.targetEndpointId ?? "");
      if (!entry.id || !target) return [];
      const status = runResults?.()[entry.id]?.status;
      const running = runningMockId() === entry.id && status === "running";
      const completed = status === "completed" || status === "failed";
      return [
        {
          id: `mock-${entry.id}`,
          source: `mock-api-${entry.id}`,
          sourceHandle: "trigger-out",
          target,
          targetHandle: endpointHandle(entry.targetEndpointId ?? ""),
          type: "default",
          class: edgeClass(running, completed),
          animated: running || completed,
        },
      ];
    });
    const observed: Edge[] = store.observedEdges.flatMap((edge, index) => {
      const source = store.services.find((service) => service.name === edge.sourceService)?.id;
      const target = store.services.find((service) => service.name === edge.targetService)?.id;
      if (
        store.serviceEdges.some((item) => {
          const declaredSource = store.services.find(
            (service) => service.id === item.sourceServiceId,
          );
          const declaredTarget = endpointTarget(item.targetEndpointId);
          return declaredSource?.id === source && declaredTarget === target;
        })
      )
        return [];
      const targetEndpointId = store.services.find((service) => service.id === target)?.endpoints[0]
        ?.id;
      if (!source || !target) return [];
      return [
        {
          id: `observed-${index}`,
          source,
          sourceHandle: "service-out",
          target,
          targetHandle: targetEndpointId ? endpointHandle(targetEndpointId) : undefined,
          type: "default",
          class: "app__flow-edge app__flow-edge--observed",
          animated: true,
        },
      ];
    });
    const messages: Edge[] = store.messageConnections.flatMap((connection) => {
      const destination = store.messageDestinations.find(
        (item) => item.id === connection.destinationId,
      );
      if (!destination) return [];
      if (connection.type === "publish") {
        const source = connection.endpointId
          ? endpointTarget(connection.endpointId)
          : connection.serviceId;
        if (!source) return [];
        return [
          {
            id: `message-${connection.id}`,
            source,
            sourceHandle: `outbound-call:${connection.id}`,
            target: messageQueueNodeId(destination.queueId),
            targetHandle: `publish-in:${destination.id}`,
            data: { messageConnectionId: connection.id },
            type: "default",
            deletable: true,
            updatable: false,
            class: store.observedMessageConnectionIds.includes(connection.id)
              ? "app__flow-edge app__flow-edge--message app__flow-edge--observed"
              : "app__flow-edge app__flow-edge--message",
            animated: store.observedMessageConnectionIds.includes(connection.id),
          },
        ];
      }
      return [
        {
          id: `message-${connection.id}`,
          source: messageQueueNodeId(destination.queueId),
          sourceHandle: `subscribe-out:${destination.id}`,
          target: connection.serviceId,
          targetHandle: `subscriber-in:${connection.id}`,
          data: { messageConnectionId: connection.id },
          type: "default",
          deletable: true,
          updatable: false,
          class: store.observedMessageConnectionIds.includes(connection.id)
            ? "app__flow-edge app__flow-edge--message app__flow-edge--observed"
            : "app__flow-edge app__flow-edge--message",
          animated: store.observedMessageConnectionIds.includes(connection.id),
        },
      ];
    });
    const edges = [...declared, ...mock, ...messages, ...observed];
    store.setEdges(edges);
    return edges;
  }

  function syncNodes() {
    const nodes = [...store.services.map(serviceNode), ...messageQueueNodes(), ...mockApiNodes()];
    store.setNodes(nodes);
    buildEdges();
    return nodes;
  }

  function canvasPayload() {
    const graphNodes = store.nodes as unknown as {
      id: string;
      position: { x: number; y: number };
    }[];
    const servicePositions = graphNodes
      .filter((node) => store.services.some((service) => service.id === node.id))
      .map((node) => ({ id: node.id, x: node.position.x, y: node.position.y }));
    const mockApiPositions = graphNodes
      .filter((node) => node.id.startsWith("mock-api-"))
      .map((node) => ({
        id: node.id.slice("mock-api-".length),
        x: node.position.x,
        y: node.position.y,
      }));
    const queuePositions = new Map(
      graphNodes
        .filter((node) => node.id === "message-queue" || node.id.startsWith("message-queue:"))
        .map((node) => [node.id, node.position as { x: number; y: number }]),
    );
    const messageDestinations = store.messageDestinations.map((destination) => {
      const queuePosition = queuePositions.get(messageQueueNodeId(destination.queueId));
      return {
        ...destination,
        x: queuePosition?.x ?? destination.x,
        y: queuePosition?.y ?? destination.y,
      };
    });
    return {
      nodesLocked: store.nodesLocked,
      viewport: store.viewport,
      services: servicePositions,
      mockApiPositions,
      messageDestinations,
      messageConnections: store.messageConnections,
      edges: store.serviceEdges,
    };
  }

  function syncSavedPositions() {
    const derivedPositions = new Map(
      mockApiNodes().map((node) => [
        node.id.slice("mock-api-".length),
        node.position as { x: number; y: number },
      ]),
    );
    store.syncSavedPositions();
    const positions = new Map(
      (store.nodes as unknown as { id: string; position: { x: number; y: number } }[])
        .filter((node) => node.id.startsWith("mock-api-"))
        .map((node) => [node.id.slice("mock-api-".length), node.position]),
    );
    for (const entry of mockApis()) {
      const position = positions.get(entry.id);
      const derived = derivedPositions.get(entry.id);
      if (
        position &&
        (entry.positionX != null ||
          entry.positionY != null ||
          position.x !== derived?.x ||
          position.y !== derived?.y)
      ) {
        entry.positionX = position.x;
        entry.positionY = position.y;
      }
    }
    syncNodes();
  }

  function arrangeNodes() {
    const positions = arrangeGraph(
      store.services,
      store.serviceEdges,
      mockApis(),
      store.messageDestinations,
      store.messageConnections,
    );
    const nodes = store.nodes as unknown as {
      id: string;
      position: { x: number; y: number };
      [key: string]: unknown;
    }[];
    store.setNodes(
      nodes.map((node) => ({
        ...node,
        position: positions.get(node.id) ?? node.position,
      })) as Node[],
    );
    syncSavedPositions();
  }

  return {
    endpointTarget,
    endpointHandle,
    endpointSourceHandle,
    frameworkLabel,
    serviceEndpointOptions,
    serviceNode,
    mockApiNodes,
    buildEdges,
    syncNodes,
    canvasPayload,
    arrangeNodes,
    syncSavedPositions,
  };
}
