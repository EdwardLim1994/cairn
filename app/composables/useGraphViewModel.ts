import type { Edge, Node } from "@vue-flow/core";
import type { GraphMockApi, GraphRunResult, GraphService } from "../models/graph";
import type { useGraphStore } from "../stores/graph";

type Store = ReturnType<typeof useGraphStore>;
type ViewModelOptions = {
  store: Store;
  mockApis: () => GraphMockApi[];
  runResults: () => Record<string, GraphRunResult>;
  runningMockId: () => string | null;
};

function frameworkLabel(framework: string) {
  return framework.toLowerCase().includes(".net") ? ".NET" : framework;
}

function mockEdgeClass(entryId: string, runningId: string | null, observedId: string | null) {
  if (entryId === runningId) return "app__flow-edge app__flow-edge--running";
  if (entryId === observedId) return "app__flow-edge app__flow-edge--observed";
  return "";
}

export function useGraphViewModel({
  store,
  mockApis,
  runResults,
  runningMockId,
}: ViewModelOptions) {
  function endpointTarget(endpointId: string) {
    for (const service of store.services) {
      if (service.endpoints.some((endpoint) => endpoint.id === endpointId)) return service.id;
    }
    return undefined;
  }

  function mockEndpoint(entry: GraphMockApi) {
    return store.services
      .flatMap((service) => service.endpoints)
      .find((endpoint) => endpoint.id === entry.targetEndpointId);
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

  function mockNode(): Node {
    return {
      id: "mock-apis",
      type: "mockApis",
      position: store.mockNodePosition,
      data: {
        entries: mockApis().map((entry) => ({
          ...entry,
          endpoint: mockEndpoint(entry),
          status: runResults()[entry.id]?.status,
          running: runningMockId() === entry.id,
        })),
        collapsed: store.mockConnectionsCollapsed,
        runningMockId: runningMockId(),
      },
      class: [
        "app__flow-node",
        store.observedMockApiId ? "app__flow-node--mock-observed" : "",
        store.selectedNodeId === "mock-apis" ? "selected" : "",
      ]
        .filter(Boolean)
        .join(" "),
    };
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
      return [
        {
          id: `mock-${entry.id}`,
          source: "mock-apis",
          sourceHandle: store.mockConnectionsCollapsed
            ? mockApis().find((item) => item.id)?.id
            : entry.id,
          target,
          targetHandle: endpointHandle(entry.targetEndpointId ?? ""),
          type: "default",
          class: mockEdgeClass(entry.id, runningMockId(), store.observedMockApiId),
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
    const nodes = [...store.services.map(serviceNode), mockNode()];
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
      .filter((node) => node.id !== "mock-apis")
      .map((node) => ({ id: node.id, x: node.position.x, y: node.position.y }));
    const mock = graphNodes.find((node) => node.id === "mock-apis");
    return {
      viewport: store.viewport,
      mockNode: mock ? mock.position : store.mockNodePosition,
      services: servicePositions,
      edges: store.serviceEdges,
    };
  }

  return {
    endpointTarget,
    mockEndpoint,
    endpointHandle,
    frameworkLabel,
    serviceEndpointOptions,
    serviceNode,
    mockNode,
    buildEdges,
    syncNodes,
    canvasPayload,
    syncSavedPositions: () => store.syncSavedPositions(),
  };
}
