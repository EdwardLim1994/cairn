import type { Edge, Node } from "@vue-flow/core";
import type { GraphMockApi, GraphService } from "../models/graph";
import type { useGraphStore } from "../stores/graph";

type Store = ReturnType<typeof useGraphStore>;
type ViewModelOptions = {
  store: Store;
  mockApis: () => GraphMockApi[];
  runningMockId: () => string | null;
  runResults?: () => Record<string, { status: string }>;
};

function frameworkLabel(framework: string) {
  return framework.toLowerCase().includes(".net") ? ".NET" : framework;
}

export function useGraphViewModel({
  store,
  mockApis,
  runningMockId,
  runResults,
}: ViewModelOptions) {
  function endpointTarget(endpointId: string) {
    for (const service of store.services) {
      if (service.endpoints.some((endpoint) => endpoint.id === endpointId)) return service.id;
    }
    return undefined;
  }

  function endpointHandle(endpointId: string) {
    const service = store.services.find((item) =>
      item.endpoints.some((endpoint) => endpoint.id === endpointId),
    );
    return service && store.collapsedServiceEndpoints[service.id]
      ? service.endpoints[0]?.id
      : endpointId;
  }

  function serviceEndpointOptions() {
    return store.services.flatMap((service) =>
      service.endpoints.map((endpoint) => ({
        id: endpoint.id!,
        label: `${service.name}  |  ${endpoint.name} (${endpoint.method})`,
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
        framework: frameworkLabel(service.framework),
        online: store.serviceHealth[service.id] ?? null,
        endpoints: service.endpoints,
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
          entry,
        },
        class: "app__flow-node app__flow-node--mock-trigger",
        draggable: true,
        selectable: false,
      }));
    });
  }

  function buildEdges() {
    const declared: Edge[] = store.serviceEdges.flatMap((edge) => {
      const target = endpointTarget(edge.targetEndpointId);
      if (!target) return [];
      const sourceName = store.services.find(
        (service) => service.id === edge.sourceServiceId,
      )?.name;
      const targetName = store.services.find((service) => service.id === target)?.name;
      return [
        {
          id: edge.id,
          source: edge.sourceServiceId,
          sourceHandle: "service-out",
          target,
          targetHandle: endpointHandle(edge.targetEndpointId),
          type: "default",
          class: store.observedEdges.some(
            (item) => item.sourceService === sourceName && item.targetService === targetName,
          )
            ? "app__flow-edge app__flow-edge--observed"
            : "",
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
          class: running
            ? "app__flow-edge app__flow-edge--running"
            : completed
              ? "app__flow-edge app__flow-edge--observed"
              : "",
          animated: completed,
        },
      ];
    });
    const observed: Edge[] = store.observedEdges.flatMap((edge, index) => {
      const source = store.services.find((service) => service.name === edge.sourceService)?.id;
      const target = store.services.find((service) => service.name === edge.targetService)?.id;
      if (!source || !target) return [];
      return [
        {
          id: `observed-${index}`,
          source,
          sourceHandle: "service-out",
          target,
          targetHandle: store.services.find((service) => service.id === target)?.endpoints[0]?.id,
          type: "default",
          class: "app__flow-edge app__flow-edge--observed",
          animated: true,
        },
      ];
    });
    const edges = [...declared, ...mock, ...observed];
    store.setEdges(edges);
    return edges;
  }

  function syncNodes() {
    const nodes = [...store.services.map(serviceNode), ...mockApiNodes()];
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
    return {
      viewport: store.viewport,
      mockNode: store.mockNodePosition,
      services: servicePositions,
      mockApiPositions,
      edges: store.serviceEdges,
    };
  }

  return {
    endpointTarget,
    endpointHandle,
    frameworkLabel,
    serviceEndpointOptions,
    serviceNode,
    mockApiNodes,
    buildEdges,
    syncNodes,
    canvasPayload,
    syncSavedPositions: () => {
      store.syncSavedPositions();
      const positions = new Map(
        (store.nodes as unknown as { id: string; position: { x: number; y: number } }[])
          .filter((node) => node.id.startsWith("mock-api-"))
          .map((node) => [node.id.slice("mock-api-".length), node.position]),
      );
      for (const entry of mockApis()) {
        const position = positions.get(entry.id);
        if (position) {
          entry.positionX = position.x;
          entry.positionY = position.y;
        }
      }
      syncNodes();
    },
  };
}
