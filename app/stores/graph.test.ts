import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import type { CanvasGetResponse } from "#shared/api/canvas";
import { useGraphStore } from "./graph";

const endpoint: CanvasGetResponse["services"][number]["endpoints"][number] = {
  id: "endpoint-1",
  codeKey: "list-orders",
  projectId: "project-1",
  serviceId: "service-1",
  name: "List orders",
  method: "GET",
  url: "/orders",
  rpcMethod: null,
  createdAt: "2025-01-01T00:00:00.000Z",
};
const service: CanvasGetResponse["services"][number] = {
  id: "service-1",
  codeKey: "orders",
  projectId: "project-1",
  name: "Orders",
  apiType: "REST" as const,
  framework: "Spring Boot",
  baseUrl: "http://localhost:8080",
  grpcTls: false,
  protoFileName: null,
  healthCheckUrl: null,
  healthCheckHeaderTemplateId: null,
  healthCheckCustomHeaders: [],
  active: true,
  positionX: 100,
  positionY: 200,
  createdAt: "2025-01-01T00:00:00.000Z",
  endpoints: [endpoint],
};

describe("graph store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("loads canvas data and preserves the legacy mock node coordinate", () => {
    const store = useGraphStore();
    const canvas = {
      nodesLocked: true,
      services: [service],
      messageDestinations: [],
      messageConnections: [],
      edges: [
        {
          id: "edge-1",
          sourceServiceId: "service-1",
          sourceEndpointId: null,
          targetEndpointId: "endpoint-1",
        },
      ],
      mockApis: [],
      headerTemplates: [],
      authorizationTemplates: [],
      viewport: { x: 10, y: 20, zoom: 1.2 },
    };

    store.applyCanvas(canvas);
    store.setNodes([{ id: "service-1", position: { x: 10, y: 20 } }]);
    store.setEdges([{ id: "edge-2", source: "service-1", target: "service-1" }]);
    store.setServiceHealth({ "service-1": true });
    store.setViewport({ x: 1, y: 2, zoom: 2 });
    store.setServiceEdges([]);

    expect(store.services).toEqual([service]);
    expect(store.nodes).toHaveLength(1);
    expect(store.edges[0]?.id).toBe("edge-2");
    expect(store.serviceEdges).toEqual([]);
    expect(store.serviceHealth["service-1"]).toBe(true);
    expect(store.viewport).toEqual({ x: 1, y: 2, zoom: 2 });
    expect(store.nodesLocked).toBe(true);
  });

  it("tracks selection, collapse state, observations, and saved positions", () => {
    const store = useGraphStore();
    store.applyCanvas({
      nodesLocked: false,
      services: [service],
      messageDestinations: [],
      messageConnections: [],
      edges: [],
      mockApis: [],
      headerTemplates: [],
      authorizationTemplates: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    });
    store.toggleServiceEndpoints("service-1");
    expect(store.collapsedServiceEndpoints["service-1"]).toBe(true);
    store.setAllNodesCollapsed(true);
    expect(store.allNodesCollapsed).toBe(true);
    store.setObservations({
      services: ["Orders"],
      errorServices: ["Orders"],
      edges: [
        {
          sourceService: "Orders",
          targetService: "Payments",
          timing: { totalDurationMs: 120, callDurationsMs: [120] },
        },
      ],
    });
    store.setNodes([
      { id: "service-1", position: { x: 12, y: 34 } },
      { id: "mock-api-mock-1", position: { x: 56, y: 78 } },
    ]);
    store.setSelection("service-1");
    store.syncSavedPositions();

    expect(store.selectedNodeId).toBe("service-1");
    expect(store.observedServices).toEqual(["Orders"]);
    expect(store.observedErrorServices).toEqual(["Orders"]);
    expect(store.observedEdges).toEqual([
      {
        sourceService: "Orders",
        targetService: "Payments",
        timing: { totalDurationMs: 120, callDurationsMs: [120] },
      },
    ]);
    store.setObservations({ services: [], errorServices: [], edges: [] });
    expect(store.observedEdges).toEqual([]);
    expect(store.services[0]?.positionX).toBe(12);
    expect(store.services[0]?.positionY).toBe(34);
    store.setSelection(null);
    expect(store.selectedNodeId).toBeNull();
  });
});
