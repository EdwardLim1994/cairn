import type { Edge, Node } from "@vue-flow/core";
import type {
  GraphMockApi,
  GraphService,
  GraphServiceEdge,
  ObservedServiceEdge,
} from "../models/graph";
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
      totalDurationMs?: number | null;
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

function formatDuration(durationMs: number) {
  if (durationMs < 1_000) return `${Math.round(durationMs)} ms`;
  const seconds = durationMs / 1_000;
  const precision = seconds < 10 ? 2 : 1;
  const scale = 10 ** precision;
  return `${Math.round(durationMs / (1_000 / scale)) / scale} s`;
}

function timingLabel(edge: ObservedServiceEdge) {
  const totalDurationMs = edge.timing?.totalDurationMs ?? null;
  const callDurationsMs = edge.timing?.callDurationsMs ?? [];
  if (totalDurationMs === null) {
    return {
      label: "No timing",
      available: false,
      callDurationsMs,
      tooltip: "Timing unavailable: outbound client-span telemetry was not found.",
    };
  }
  return {
    label: formatDuration(totalDurationMs),
    available: true,
    callDurationsMs,
    tooltip: `Cumulative call time: ${formatDuration(totalDurationMs)}\nCalls (${callDurationsMs.length}): ${callDurationsMs.map(formatDuration).join(", ")}`,
  };
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
    const isObservedApiEdge = (edge: GraphServiceEdge) => {
      const targetId = endpointTarget(edge.targetEndpointId);
      const sourceName = store.services.find((item) => item.id === edge.sourceServiceId)?.name;
      const targetName = store.services.find((item) => item.id === targetId)?.name;
      return store.observedEdges.some(
        (observed) =>
          observed.sourceService === sourceName && observed.targetService === targetName,
      );
    };
    const outboundApiCallDetails = (edge: GraphServiceEdge) => {
      const targetService = store.services.find((item) =>
        item.endpoints.some((endpoint) => endpoint.id === edge.targetEndpointId),
      );
      const targetEndpoint = targetService?.endpoints.find(
        (endpoint) => endpoint.id === edge.targetEndpointId,
      );
      const methodTag =
        targetService?.apiType === "GRPC"
          ? "gRPC"
          : targetService?.apiType === "WEBSOCKET"
            ? "WS"
            : (targetEndpoint?.method ?? "API");
      const endpointLabel =
        targetService?.apiType === "GRPC"
          ? (targetEndpoint?.rpcMethod ?? targetEndpoint?.name)
          : targetService?.apiType === "WEBSOCKET"
            ? (targetEndpoint?.url ?? targetEndpoint?.name)
            : [targetEndpoint?.method, targetEndpoint?.url ?? targetEndpoint?.name]
                .filter(Boolean)
                .join(" ");
      return {
        targetServiceId: targetService?.id,
        targetServiceName: targetService?.name,
        targetEndpointLabel: endpointLabel,
        sourceEndpointName: service.endpoints.find(
          (endpoint) => endpoint.id === edge.sourceEndpointId,
        )?.name,
        methodTag,
        label: targetService
          ? `${targetService.name} · ${endpointLabel || "Outbound API call"}`
          : (endpointLabel ?? "Outbound API call"),
      };
    };
    const outboundCalls = [
      ...store.serviceEdges
        .filter((edge) => edge.sourceServiceId === service.id)
        .map((edge) => ({
          id: edge.id,
          kind: "api" as const,
          destinationId: undefined,
          sourceEndpointId:
            edge.sourceEndpointId ??
            (edge.sourceSubscriptionId ? undefined : service.endpoints[0]?.id),
          sourceSubscriptionId: edge.sourceSubscriptionId,
          ...outboundApiCallDetails(edge),
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
          targetServiceId: undefined,
          destinationId: connection.destinationId,
          methodTag: "PUB",
          label:
            store.messageDestinations.find((item) => item.id === connection.destinationId)?.name ??
            "Message destination",
          sourceEndpointId:
            ("endpointId" in connection ? connection.endpointId : undefined) ??
            ("subscriptionId" in connection && connection.subscriptionId
              ? undefined
              : service.endpoints[0]?.id),
          sourceSubscriptionId:
            "subscriptionId" in connection ? connection.subscriptionId : undefined,
        })),
    ];
    const observedInboundEndpointIds = [
      ...store.serviceEdges
        .filter(
          (edge) => endpointTarget(edge.targetEndpointId) === service.id && isObservedApiEdge(edge),
        )
        .map((edge) => edge.targetEndpointId),
      ...mockApis().flatMap((entry) => {
        const endpointId = entry.targetEndpointId;
        if (!entry.id || !endpointId || endpointTarget(endpointId) !== service.id) return [];
        const status = runResults?.()[entry.id]?.status;
        const running = runningMockId() === entry.id && status === "running";
        return status === "completed" || status === "failed" || running ? [endpointId] : [];
      }),
    ];
    const observedOutboundCallIds = outboundCalls.flatMap((call) => {
      if (call.kind === "message")
        return store.observedMessageConnectionIds.includes(call.id) ? [call.id] : [];
      const edge = store.serviceEdges.find((item) => item.id === call.id);
      return edge && isObservedApiEdge(edge) ? [call.id] : [];
    });
    const observedSubscriptionIds = store.messageConnections.flatMap((connection) =>
      connection.type === "subscribe" &&
      connection.serviceId === service.id &&
      store.observedMessageConnectionIds.includes(connection.id)
        ? [connection.id]
        : [],
    );
    return {
      id: service.id,
      type: "service",
      position: { x: service.positionX, y: service.positionY },
      data: {
        serviceId: service.id,
        name: service.name,
        apiType: service.apiType,
        framework: frameworkLabel(service.framework),
        inboundCount:
          service.endpoints.length +
          store.messageConnections.filter(
            (connection) => connection.type === "subscribe" && connection.serviceId === service.id,
          ).length,
        outboundCount: new Set(
          outboundCalls.map((call) =>
            call.targetServiceId
              ? `service:${call.targetServiceId}`
              : call.destinationId
                ? `destination:${call.destinationId}`
                : `call:${call.id}`,
          ),
        ).size,
        hasMessagePublisher:
          !service.endpoints.length &&
          store.messageConnections.some(
            (connection) =>
              connection.type === "publish" &&
              connection.serviceId === service.id &&
              !connection.endpointId &&
              !connection.subscriptionId,
          ),
        outboundCalls,
        observedInboundEndpointIds,
        observedOutboundCallIds,
        observedSubscriptionIds,
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
          endpoint: service.endpoints.find(({ id }) => id === entry.targetEndpointId),
          serviceName: service.name,
          entry,
        },
        class: "app__flow-node app__flow-node--mock-trigger",
        selectable: false,
      }));
    });
  }

  function messageQueueNodes(): Node[] {
    return store.messageDestinations.map((destination) => {
      const nodeId = messageQueueNodeId(destination.id);
      const observed = store.messageConnections.some(
        (connection) =>
          store.observedMessageConnectionIds.includes(connection.id) &&
          connection.destinationId === destination.id,
      );
      const online = onlineStatus([destination]);
      return {
        id: nodeId,
        type: "messageQueue",
        position: { x: destination.x, y: destination.y },
        data: {
          destinationId: destination.id,
          name: destination.queueName ?? "Message Queue",
          destinations: [destination],
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
    const labeledServicePairs = new Set<string>();
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
      const observedEdge = store.observedEdges.find(
        (item) => item.sourceService === sourceName && item.targetService === targetName,
      );
      const isObserved = Boolean(observedEdge);
      const servicePair = `${edge.sourceServiceId}:${target}`;
      const showTiming = Boolean(observedEdge && !labeledServicePairs.has(servicePair));
      if (observedEdge) labeledServicePairs.add(servicePair);
      const timing = showTiming && observedEdge ? timingLabel(observedEdge) : undefined;
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
          ...(timing
            ? {
                label: timing.label,
                ariaLabel: `Observed call from ${sourceName} to ${targetName}: ${timing.tooltip}`,
                domAttributes: { title: timing.tooltip },
                data: {
                  timing: {
                    title: `${sourceName} → ${targetName}`,
                    available: timing.available,
                    callDurationsMs: timing.callDurationsMs,
                    unavailableReason: timing.available ? undefined : timing.tooltip,
                  },
                },
              }
            : {}),
          class: isObserved ? "app__flow-edge app__flow-edge--observed" : "",
          animated: isObserved,
        } as Edge,
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
      const timing = timingLabel(edge);
      return [
        {
          id: `observed-${index}`,
          source,
          sourceHandle: "service-out",
          target,
          targetHandle: targetEndpointId ? endpointHandle(targetEndpointId) : undefined,
          type: "default",
          label: timing.label,
          ariaLabel: `Observed call from ${edge.sourceService} to ${edge.targetService}: ${timing.tooltip}`,
          domAttributes: { title: timing.tooltip },
          class: "app__flow-edge app__flow-edge--observed",
          animated: true,
        } as Edge,
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
            target: messageQueueNodeId(destination.id),
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
          source: messageQueueNodeId(destination.id),
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
    const destinationPositions = new Map(
      graphNodes
        .filter((node) => node.id.startsWith("message-queue:"))
        .map((node) => [
          node.id.slice("message-queue:".length),
          node.position as { x: number; y: number },
        ]),
    );
    const messageDestinations = store.messageDestinations.map((destination) => {
      const destinationPosition = destinationPositions.get(destination.id);
      return {
        ...destination,
        x: destinationPosition?.x ?? destination.x,
        y: destinationPosition?.y ?? destination.y,
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
