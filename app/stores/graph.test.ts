import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { useGraphStore } from "./graph";

const endpoint = {
  id: "endpoint-1",
  projectId: "project-1",
  serviceId: "service-1",
  name: "List orders",
  apiType: "REST",
  method: "GET",
  url: "/orders",
  createdAt: "2025-01-01T00:00:00.000Z",
};
const service = {
  id: "service-1",
  projectId: "project-1",
  name: "Orders",
  framework: "Spring Boot",
  baseUrl: "http://localhost:8080",
  active: true,
  positionX: 100,
  positionY: 200,
  createdAt: "2025-01-01T00:00:00.000Z",
  endpoints: [endpoint],
};

describe("graph store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("loads canvas data and updates graph nodes, edges, health, and viewport", () => {
    const store = useGraphStore();
    const canvas = {
      services: [service],
      edges: [{ id: "edge-1", sourceServiceId: "service-1", targetEndpointId: "endpoint-1" }],
      mockApis: [],
      headerTemplates: [],
      viewport: { x: 10, y: 20, zoom: 1.2 },
      mockNode: { x: 300, y: 400 },
    };

    store.applyCanvas(canvas);
    store.setNodes([{ id: "service-1", position: { x: 10, y: 20 } }]);
    store.setEdges([{ id: "edge-2", source: "service-1", target: "mock-apis" }]);
    store.setServiceHealth({ "service-1": true });
    store.setViewport({ x: 1, y: 2, zoom: 2 });
    store.setServiceEdges([]);

    expect(store.services).toEqual([service]);
    expect(store.nodes).toHaveLength(1);
    expect(store.edges[0]?.id).toBe("edge-2");
    expect(store.serviceEdges).toEqual([]);
    expect(store.serviceHealth["service-1"]).toBe(true);
    expect(store.viewport).toEqual({ x: 1, y: 2, zoom: 2 });
    expect(store.mockNodePosition).toEqual({ x: 300, y: 400 });
  });

  it("tracks selection, collapse state, observations, and saved positions", () => {
    const store = useGraphStore();
    store.applyCanvas({
      services: [service],
      edges: [],
      mockApis: [],
      headerTemplates: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      mockNode: { x: 560, y: 160 },
    });
    store.toggleServiceEndpoints("service-1");
    expect(store.collapsedServiceEndpoints["service-1"]).toBe(true);
    store.setAllNodesCollapsed(true);
    expect(store.allNodesCollapsed).toBe(true);
    store.toggleMockConnections();
    expect(store.mockConnectionsCollapsed).toBe(false);
    store.setAllNodesCollapsed(true);
    store.setObservations({
      mockApiId: "mock-1",
      services: ["Orders"],
      errorServices: ["Orders"],
      edges: [{ sourceService: "Orders", targetService: "Payments" }],
    });
    store.setNodes([
      { id: "service-1", position: { x: 12, y: 34 } },
      { id: "mock-apis", position: { x: 56, y: 78 } },
    ]);
    store.setSelection("service-1");
    store.syncSavedPositions();

    expect(store.selectedNodeId).toBe("service-1");
    expect(store.observedMockApiId).toBe("mock-1");
    expect(store.observedServices).toEqual(["Orders"]);
    expect(store.observedErrorServices).toEqual(["Orders"]);
    expect(store.observedEdges).toEqual([{ sourceService: "Orders", targetService: "Payments" }]);
    expect(store.services[0]?.positionX).toBe(12);
    expect(store.services[0]?.positionY).toBe(34);
    expect(store.mockNodePosition).toEqual({ x: 56, y: 78 });
    store.setSelection(null);
    expect(store.selectedNodeId).toBeNull();
  });
});
