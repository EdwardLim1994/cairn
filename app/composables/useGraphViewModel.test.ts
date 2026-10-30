import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { useGraphViewModel } from "./useGraphViewModel";
import { useGraphStore } from "../stores/graph";

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
  endpoints: [
    {
      id: "endpoint-1",
      projectId: "project-1",
      serviceId: "service-1",
      name: "List orders",
      apiType: "REST",
      method: "GET",
      url: "/orders",
      createdAt: "2025-01-01T00:00:00.000Z",
    },
  ],
};
const mockApi = {
  id: "mock-1",
  projectId: "project-1",
  name: "Fetch orders",
  targetEndpointId: "endpoint-1",
  pathParameters: {},
  requestJson: {},
  description: "",
  createdAt: "2025-01-01T00:00:00.000Z",
};

describe("graph view model", () => {
  beforeEach(() => setActivePinia(createPinia()));

  function createModel() {
    const store = useGraphStore();
    store.applyCanvas({
      services: [service],
      edges: [{ id: "edge-1", sourceServiceId: "service-1", targetEndpointId: "endpoint-1" }],
      mockApis: [mockApi],
      viewport: { x: 0, y: 0, zoom: 1 },
      mockNode: { x: 560, y: 160 },
    });
    const model = useGraphViewModel({
      store,
      mockApis: () => [mockApi],
      runResults: () => ({ "mock-1": { status: "failed" } }),
      runningMockId: () => null,
    });
    return { store, model };
  }

  it("resolves endpoint targets, mock endpoints, handles, and framework labels", () => {
    const { store, model } = createModel();
    expect(model.endpointTarget("endpoint-1")).toBe("service-1");
    expect(model.endpointTarget("missing")).toBeUndefined();
    expect(model.mockEndpoint(mockApi)?.name).toBe("List orders");
    expect(model.endpointHandle("endpoint-1")).toBe("endpoint-1");
    expect(model.frameworkLabel("Microsoft .NET")).toBe(".NET");
    expect(model.frameworkLabel("Spring Boot")).toBe("Spring Boot");
    expect(model.serviceEndpointOptions()).toEqual([
      { id: "endpoint-1", label: "Orders  |  List orders (GET)" },
    ]);
    store.toggleServiceEndpoints("service-1");
    expect(model.endpointHandle("endpoint-1")).toBe("endpoint-1");
  });

  it("projects service and mock API state into Vue Flow nodes", () => {
    const { store, model } = createModel();
    store.setServiceHealth({ "service-1": false });
    store.setObservations({
      mockApiId: "mock-1",
      services: ["Orders"],
      errorServices: ["Orders"],
      edges: [],
    });
    store.setSelection("service-1");

    const serviceNode = model.serviceNode(store.services[0]!);
    const mockNode = model.mockNode();
    expect(serviceNode.class).toContain("app__flow-node--service-error");
    expect(serviceNode.class).toContain("selected");
    expect(serviceNode.data).toMatchObject({ online: false, hasError: true });
    expect(mockNode.data).toMatchObject({ collapsed: false, runningMockId: null });
    expect((mockNode.data as { entries: { status: string }[] }).entries[0]?.status).toBe("failed");
  });

  it("builds declared, mock, and observed edges with collapse and run highlighting", () => {
    const { store, model } = createModel();
    store.setObservations({
      mockApiId: "mock-1",
      services: ["Orders"],
      errorServices: [],
      edges: [{ sourceService: "Orders", targetService: "Orders" }],
    });
    const edges = model.buildEdges();
    expect(edges.map(({ id }) => id)).toEqual(["edge-1", "mock-mock-1", "observed-0"]);
    expect(edges[1]?.class).toContain("observed");
    expect(edges[2]?.animated).toBe(true);
    store.toggleMockConnections();
    expect(model.buildEdges()[1]?.sourceHandle).toBe("mock-1");
    expect(store.edges).toHaveLength(3);
  });

  it("syncs graph nodes and creates a canvas payload from current positions", () => {
    const { store, model } = createModel();
    expect(model.syncNodes().map(({ id }) => id)).toEqual(["service-1", "mock-apis"]);
    store.setNodes([
      { id: "service-1", position: { x: 30, y: 40 } },
      { id: "mock-apis", position: { x: 500, y: 600 } },
    ]);
    store.setViewport({ x: 4, y: 5, zoom: 1.5 });
    expect(model.canvasPayload()).toEqual({
      viewport: { x: 4, y: 5, zoom: 1.5 },
      mockNode: { x: 500, y: 600 },
      services: [{ id: "service-1", x: 30, y: 40 }],
      edges: store.serviceEdges,
    });
    model.syncSavedPositions();
    expect(store.services[0]?.positionX).toBe(30);
    expect(store.mockNodePosition).toEqual({ x: 500, y: 600 });
  });

  it("integrates graph editing, selection, collapse, persistence, and run highlighting", () => {
    const { store, model } = createModel();
    store.setServiceEdges([
      { id: "edge-2", sourceServiceId: "service-1", targetEndpointId: "endpoint-1" },
    ]);
    store.setSelection("mock-apis");
    store.setObservations({
      mockApiId: "mock-1",
      services: ["Orders"],
      errorServices: ["Orders"],
      edges: [{ sourceService: "Orders", targetService: "Orders" }],
    });
    store.setAllNodesCollapsed(true);
    model.syncNodes();
    const payload = model.canvasPayload();

    expect(store.nodes[1]?.class).toContain("selected");
    expect(store.nodes[0]?.class).toContain("service-error");
    expect(store.edges.some((edge) => edge.id === "observed-0")).toBe(true);
    expect(store.allNodesCollapsed).toBe(true);
    expect(payload.edges).toEqual(store.serviceEdges);
  });
});
