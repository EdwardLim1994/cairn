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
  function relationshipDistances() {
    const selectedServiceId = store.selectedNodeId;
    if (!selectedServiceId || !store.services.some(({ id }) => id === selectedServiceId))
      return null;

    const adjacency = new Map<string, Set<string>>();
    const connectServices = (left: string | undefined, right: string | undefined) => {
      if (!left || !right) return;
      adjacency.set(left, (adjacency.get(left) ?? new Set()).add(right));
      adjacency.set(right, (adjacency.get(right) ?? new Set()).add(left));
    };

    for (const edge of store.serviceEdges) {
      const target = endpointTarget(edge.targetEndpointId);
      const sourceService = store.services.find(({ id }) => id === edge.sourceServiceId);
      const subscription = edge.sourceSubscriptionId
        ? store.messageConnections.find(
            (connection) =>
              connection.id === edge.sourceSubscriptionId && connection.type === "subscribe",
          )
        : undefined;
      const sourceEndpointId =
        edge.sourceEndpointId ?? sourceService?.endpoints.find((endpoint) => endpoint.id)?.id;
      const validSource = subscription
        ? subscription.serviceId === edge.sourceServiceId
        : Boolean(sourceEndpointId && endpointTarget(sourceEndpointId) === edge.sourceServiceId);
      if (target && sourceService && validSource) connectServices(edge.sourceServiceId, target);
    }

    const queueServices = new Map<string, Set<string>>();
    for (const connection of store.messageConnections) {
      if (!store.messageDestinations.some(({ id }) => id === connection.destinationId)) continue;
      const services = queueServices.get(connection.destinationId) ?? new Set<string>();
      if (connection.type === "publish") {
        const source = connection.endpointId
          ? endpointTarget(connection.endpointId)
          : connection.serviceId;
        if (source && store.services.some(({ id }) => id === source)) services.add(source);
      } else if (store.services.some(({ id }) => id === connection.serviceId)) {
        services.add(connection.serviceId);
      }
      queueServices.set(connection.destinationId, services);
    }
    for (const services of queueServices.values()) {
      const participants = [...services];
      for (let left = 0; left < participants.length; left += 1) {
        for (let right = left + 1; right < participants.length; right += 1)
          connectServices(participants[left], participants[right]);
      }
    }

    const distances = new Map<string, number>([[selectedServiceId, 1]]);
    const queue = [selectedServiceId];
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index]!;
      const level = distances.get(current)!;
      if (level >= 3) continue;
      for (const neighbor of adjacency.get(current) ?? []) {
        if (distances.has(neighbor)) continue;
        distances.set(neighbor, level + 1);
        queue.push(neighbor);
      }
    }

    for (const [destinationId, services] of queueServices) {
      const levels = [...services]
        .map((serviceId) => distances.get(serviceId))
        .filter((level): level is number => level !== undefined);
      if (levels.length) distances.set(messageQueueNodeId(destinationId), Math.max(...levels));
    }
    for (const entry of mockApis()) {
      if (!entry.id) continue;
      const targetLevel = distances.get(endpointTarget(entry.targetEndpointId ?? "") ?? "");
      if (targetLevel !== undefined) distances.set(`mock-api-${entry.id}`, targetLevel);
    }
    return distances;
  }

  function relationshipNodeClass(nodeId: string, distances: Map<string, number> | null) {
    if (!distances) return "";
    const distance = distances.get(nodeId);
    if (distance === 1) return "app__flow-node--relationship-1";
    if (distance === undefined) return "app__flow-node--relationship-dimmed";
    return "app__flow-node--relationship-2";
  }

  function relationshipEdgeClass(
    source: string,
    target: string,
    distances: Map<string, number> | null,
    showSameLevel = false,
  ) {
    if (!distances) return "";
    const sourceDistance = distances.get(source);
    const targetDistance = distances.get(target);
    if (sourceDistance === undefined || targetDistance === undefined)
      return "app__flow-edge--relationship-dimmed";
    if (sourceDistance === targetDistance && sourceDistance > 1 && !showSameLevel)
      return "app__flow-edge--relationship-dimmed";
    const distance = Math.max(sourceDistance, targetDistance);
    return `app__flow-edge--relationship-${distance}`;
  }

  function relationshipGradient(
    source: string,
    target: string,
    distances: Map<string, number> | null,
  ): { from: "source" | "target"; toLevel: number } | undefined {
    if (!distances) return undefined;
    const sourceDistance = distances.get(source);
    const targetDistance = distances.get(target);
    if (sourceDistance === undefined || targetDistance === undefined) return undefined;
    if (Math.abs(sourceDistance - targetDistance) !== 1) return undefined;
    return {
      from: sourceDistance < targetDistance ? "source" : "target",
      toLevel: Math.max(sourceDistance, targetDistance),
    };
  }

  function endpointTarget(endpointId: string) {
    for (const service of store.services) {
      if (service.endpoints.some((endpoint) => endpoint.id === endpointId)) return service.id;
    }
    return undefined;
  }

  function serviceEndpointOptions() {
    return store.services.flatMap((service) => {
      let apiType = "HTTP";
      if (service.apiType === "WEBSOCKET") apiType = "WEBSOCKET";
      else if (service.apiType === "GRPC") apiType = "GRPC";
      return service.endpoints.map((endpoint) => {
        let methodLabel = endpoint.method;
        if (apiType === "WEBSOCKET") methodLabel = "WebSocket";
        else if (apiType === "GRPC") methodLabel = "gRPC";
        return {
          id: endpoint.id!,
          serviceId: service.id,
          apiType,
          method: endpoint.method,
          label: `${service.name}  |  ${endpoint.name} (${methodLabel})`,
        };
      });
    });
  }

  function serviceNode(
    service: GraphService,
    distances: Map<string, number> | null = relationshipDistances(),
  ): Node {
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
      let methodTag = targetEndpoint?.method ?? "API";
      let endpointLabel = [targetEndpoint?.method, targetEndpoint?.url ?? targetEndpoint?.name]
        .filter(Boolean)
        .join(" ");
      if (targetService?.apiType === "GRPC") {
        methodTag = "gRPC";
        endpointLabel = targetEndpoint?.rpcMethod ?? targetEndpoint?.name ?? "";
      } else if (targetService?.apiType === "WEBSOCKET") {
        methodTag = "WS";
        endpointLabel = targetEndpoint?.url ?? targetEndpoint?.name ?? "";
      }
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
          outboundCalls.map((call) => {
            if (call.targetServiceId) return `service:${call.targetServiceId}`;
            if (call.destinationId) return `destination:${call.destinationId}`;
            return `call:${call.id}`;
          }),
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
        relationshipNodeClass(service.id, distances),
      ]
        .filter(Boolean)
        .join(" "),
    };
  }

  function mockApiNodes(distances: Map<string, number> | null = relationshipDistances()): Node[] {
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
        class: [
          "app__flow-node app__flow-node--mock-trigger",
          relationshipNodeClass(`mock-api-${entry.id}`, distances),
        ]
          .filter(Boolean)
          .join(" "),
        selectable: false,
      }));
    });
  }

  function messageQueueNodes(
    distances: Map<string, number> | null = relationshipDistances(),
  ): Node[] {
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
          relationshipNodeClass(nodeId, distances),
        ]
          .filter(Boolean)
          .join(" "),
      };
    });
  }

  function buildEdges() {
    const distances = relationshipDistances();
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
      const gradient = relationshipGradient(edge.sourceServiceId, target, distances);
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
          data: {
            ...(timing
              ? {
                  timing: {
                    title: `${sourceName} → ${targetName}`,
                    available: timing.available,
                    callDurationsMs: timing.callDurationsMs,
                    unavailableReason: timing.available ? undefined : timing.tooltip,
                  },
                }
              : {}),
            ...(gradient ? { relationshipGradient: gradient } : {}),
          },
          ...(timing
            ? {
                label: timing.label,
                ariaLabel: `Observed call from ${sourceName} to ${targetName}: ${timing.tooltip}`,
                domAttributes: { title: timing.tooltip },
              }
            : {}),
          class: [
            isObserved ? "app__flow-edge app__flow-edge--observed" : "app__flow-edge",
            relationshipEdgeClass(edge.sourceServiceId, target, distances),
          ]
            .filter(Boolean)
            .join(" "),
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
      const gradient = relationshipGradient(`mock-api-${entry.id}`, target, distances);
      return [
        {
          id: `mock-${entry.id}`,
          source: `mock-api-${entry.id}`,
          sourceHandle: "trigger-out",
          target,
          targetHandle: endpointHandle(entry.targetEndpointId ?? ""),
          type: "default",
          data: gradient ? { relationshipGradient: gradient } : {},
          class: [
            edgeClass(running, completed),
            relationshipEdgeClass(`mock-api-${entry.id}`, target, distances, true),
          ]
            .filter(Boolean)
            .join(" "),
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
        const queueId = messageQueueNodeId(destination.id);
        const gradient = relationshipGradient(source, queueId, distances);
        return [
          {
            id: `message-${connection.id}`,
            source,
            sourceHandle: `outbound-call:${connection.id}`,
            target: queueId,
            targetHandle: `publish-in:${destination.id}`,
            data: {
              messageConnectionId: connection.id,
              ...(gradient ? { relationshipGradient: gradient } : {}),
            },
            type: "default",
            deletable: true,
            updatable: false,
            class: [
              store.observedMessageConnectionIds.includes(connection.id)
                ? "app__flow-edge app__flow-edge--message app__flow-edge--observed"
                : "app__flow-edge app__flow-edge--message",
              relationshipEdgeClass(source, messageQueueNodeId(destination.id), distances, true),
            ]
              .filter(Boolean)
              .join(" "),
            animated: store.observedMessageConnectionIds.includes(connection.id),
          },
        ];
      }
      const queueId = messageQueueNodeId(destination.id);
      const gradient = relationshipGradient(queueId, connection.serviceId, distances);
      return [
        {
          id: `message-${connection.id}`,
          source: queueId,
          sourceHandle: `subscribe-out:${destination.id}`,
          target: connection.serviceId,
          targetHandle: `subscriber-in:${connection.id}`,
          data: {
            messageConnectionId: connection.id,
            ...(gradient ? { relationshipGradient: gradient } : {}),
          },
          type: "default",
          deletable: true,
          updatable: false,
          class: [
            store.observedMessageConnectionIds.includes(connection.id)
              ? "app__flow-edge app__flow-edge--message app__flow-edge--observed"
              : "app__flow-edge app__flow-edge--message",
            relationshipEdgeClass(
              messageQueueNodeId(destination.id),
              connection.serviceId,
              distances,
              true,
            ),
          ]
            .filter(Boolean)
            .join(" "),
          animated: store.observedMessageConnectionIds.includes(connection.id),
        },
      ];
    });
    const edges = [...declared, ...mock, ...messages, ...observed];
    store.setEdges(edges);
    return edges;
  }

  function syncNodes() {
    const distances = relationshipDistances();
    const nodes = [
      ...store.services.map((service) => serviceNode(service, distances)),
      ...messageQueueNodes(distances),
      ...mockApiNodes(distances),
    ];
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
