import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { useGraphViewModel } from "./useGraphViewModel";
import { useGraphStore } from "../stores/graph";
import type { CanvasGetResponse } from "#shared/api/canvas";

const service = {
  id: "service-1",
  projectId: "project-1",
  name: "Orders",
  framework: "Spring Boot",
  baseUrl: "http://localhost:8080",
  healthCheckUrl: null,
  healthCheckHeaderTemplateId: null,
  healthCheckCustomHeaders: [],
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
const mockApi: CanvasGetResponse["mockApis"][number] = {
  id: "mock-1",
  projectId: "project-1",
  name: "Fetch orders",
  targetEndpointId: "endpoint-1",
  headerTemplateId: null,
  customHeaders: [],
  active: true,
  status: "ready",
  readinessReasons: [],
  importMethod: null,
  importUrl: null,
  matchUrl: null,
  pathParameters: {},
  requestJson: {},
  description: "",
  createdAt: "2025-01-01T00:00:00.000Z",
};

describe("graph view model", () => {
  beforeEach(() => setActivePinia(createPinia()));

  function createModel(
    apis: CanvasGetResponse["mockApis"] = [mockApi],
    runningMockId: string | null = null,
  ) {
    const store = useGraphStore();
    store.applyCanvas({
      nodesLocked: true,
      services: [service],
      edges: [
        {
          id: "edge-1",
          sourceServiceId: "service-1",
          sourceEndpointId: null,
          targetEndpointId: "endpoint-1",
        },
      ],
      mockApis: apis,
      headerTemplates: [],
      authorizationTemplates: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      mockNode: { x: 560, y: 160 },
    });
    const model = useGraphViewModel({
      store,
      mockApis: () => apis,
      runningMockId: () => runningMockId,
    });
    return { store, model };
  }

  it("resolves endpoint targets, handles, and framework labels", () => {
    const { store, model } = createModel();
    expect(model.endpointTarget("endpoint-1")).toBe("service-1");
    expect(model.endpointTarget("missing")).toBeUndefined();
    expect(model.endpointHandle("endpoint-1")).toBe("in:endpoint-1");
    expect(model.frameworkLabel("Microsoft .NET")).toBe(".NET");
    expect(model.frameworkLabel("Spring Boot")).toBe("Spring Boot");
    expect(model.serviceEndpointOptions()).toEqual([
      {
        id: "endpoint-1",
        serviceId: "service-1",
        method: "GET",
        label: "Orders  |  List orders (GET)",
      },
    ]);
    store.toggleServiceEndpoints("service-1");
    expect(model.endpointHandle("endpoint-1")).toBe("in:endpoint-1");
  });

  it("projects service observations and mock API triggers into graph nodes", () => {
    const { store, model } = createModel();
    store.setServiceHealth({ "service-1": false });
    store.setObservations({
      services: ["Orders"],
      errorServices: ["Orders"],
      edges: [],
    });
    store.setSelection("service-1");

    const serviceNode = model.serviceNode(store.services[0]!);
    const triggerNode = model.mockApiNodes()[0]!;
    expect(serviceNode.class).toContain("app__flow-node--service-error");
    expect(serviceNode.class).toContain("selected");
    expect(serviceNode.data).toMatchObject({ online: false, hasError: true });
    expect(triggerNode).toMatchObject({
      id: "mock-api-mock-1",
      type: "mockApiTrigger",
      data: { id: "mock-1", name: "Fetch orders", active: true, ready: true, busy: false },
    });
  });

  it("builds declared, per-API target, and observed service edges", () => {
    const { store, model } = createModel();
    store.setObservations({
      services: ["Orders"],
      errorServices: [],
      edges: [{ sourceService: "Orders", targetService: "Orders" }],
    });
    const edges = model.buildEdges();
    expect(edges.map(({ id }) => id)).toEqual(["edge-1", "mock-mock-1", "observed-0"]);
    expect(edges[0]).toMatchObject({
      sourceHandle: "service-out",
      targetHandle: "in:endpoint-1",
      updatable: true,
      deletable: true,
    });
    expect(edges[1]).toMatchObject({
      source: "mock-api-mock-1",
      sourceHandle: "trigger-out",
      target: "service-1",
      targetHandle: "in:endpoint-1",
    });
    expect(edges[2]?.animated).toBe(true);
    store.toggleServiceEndpoints("service-1");
    expect(model.buildEdges()[0]).toMatchObject({
      sourceHandle: "service-out",
      targetHandle: "in:endpoint-1",
      updatable: false,
      deletable: false,
    });
  });

  it("omits mock APIs without a valid endpoint target", () => {
    const invalidTarget = {
      ...mockApi,
      id: "mock-invalid",
      targetEndpointId: "missing-endpoint",
    };
    const draft = {
      ...mockApi,
      id: "mock-draft",
      targetEndpointId: null,
      active: false,
      status: "draft" as const,
    };
    const { model } = createModel([mockApi, invalidTarget, draft]);

    expect(model.mockApiNodes().map(({ id }) => id)).toEqual(["mock-api-mock-1"]);
    expect(model.buildEdges().map(({ id }) => id)).toEqual(["edge-1", "mock-mock-1"]);
  });

  it("renders assigned calls from endpoint handles and keeps endpoint identity when collapsed", () => {
    const { store, model } = createModel();
    const payments = {
      ...service,
      id: "service-2",
      name: "Payments",
      endpoints: service.endpoints.map((endpoint) => ({
        ...endpoint,
        id: "endpoint-2",
        serviceId: "service-2",
      })),
    };
    store.services.push(payments);
    store.setServiceEdges([
      {
        id: "assigned-edge",
        sourceServiceId: "service-2",
        sourceEndpointId: "endpoint-2",
        targetEndpointId: "endpoint-1",
      },
    ]);

    expect(model.buildEdges()[0]).toMatchObject({
      id: "assigned-edge",
      source: "service-2",
      sourceHandle: "out:endpoint-2",
      target: "service-1",
      targetHandle: "in:endpoint-1",
    });
    store.setAllNodesCollapsed(true);
    expect(model.buildEdges()[0]).toMatchObject({
      id: "assigned-edge",
      sourceHandle: "out:endpoint-2",
      targetHandle: "in:endpoint-1",
      updatable: false,
      deletable: false,
    });
    store.setAllNodesCollapsed(false);
    expect(model.buildEdges()[0]).toMatchObject({
      id: "assigned-edge",
      sourceHandle: "out:endpoint-2",
      targetHandle: "in:endpoint-1",
      updatable: true,
      deletable: true,
    });
  });

  it("stacks triggers in stable order and follows the target service position", () => {
    const secondApi = { ...mockApi, id: "mock-2", name: "Create order" };
    const { store, model } = createModel([secondApi, mockApi]);

    expect(model.mockApiNodes().map(({ id, position }) => ({ id, position }))).toEqual([
      { id: "mock-api-mock-1", position: { x: -120, y: 166 } },
      { id: "mock-api-mock-2", position: { x: -120, y: 234 } },
    ]);

    store.setNodes([{ id: "service-1", position: { x: 500, y: 300 } }]);
    model.syncSavedPositions();

    expect(store.services[0]).toMatchObject({ positionX: 500, positionY: 300 });
    const nodes = store.nodes as unknown as { position: { x: number; y: number } }[];
    expect(nodes.slice(1).map(({ position }) => position)).toEqual([
      { x: 280, y: 266 },
      { x: 280, y: 334 },
    ]);
  });

  it("syncs service positions while keeping the legacy mock coordinate contract", () => {
    const { store, model } = createModel();
    expect(model.syncNodes().map(({ id }) => id)).toEqual(["service-1", "mock-api-mock-1"]);
    store.setNodes([
      { id: "service-1", position: { x: 30, y: 40 } },
      { id: "mock-api-mock-1", position: { x: -190, y: 40 } },
    ]);
    store.setViewport({ x: 4, y: 5, zoom: 1.5 });
    expect(model.canvasPayload()).toEqual({
      nodesLocked: true,
      viewport: { x: 4, y: 5, zoom: 1.5 },
      mockNode: { x: 560, y: 160 },
      services: [{ id: "service-1", x: 30, y: 40 }],
      mockApiPositions: [{ id: "mock-1", x: -190, y: 40 }],
      edges: store.serviceEdges,
    });
    model.syncSavedPositions();
    expect(store.services[0]?.positionX).toBe(30);
    expect(store.services[0]?.positionY).toBe(40);
    expect(store.nodes[1]?.position).toEqual({ x: -190, y: 40 });
  });

  it("keeps service selection and observed trace highlighting", () => {
    const { store, model } = createModel();
    store.setServiceEdges([
      {
        id: "edge-2",
        sourceServiceId: "service-1",
        sourceEndpointId: null,
        targetEndpointId: "endpoint-1",
      },
    ]);
    store.setSelection("service-1");
    store.setObservations({
      services: ["Orders"],
      errorServices: ["Orders"],
      edges: [{ sourceService: "Orders", targetService: "Orders" }],
    });
    store.setAllNodesCollapsed(true);
    model.syncNodes();
    const payload = model.canvasPayload();

    expect(store.nodes[0]?.class).toContain("service-error");
    expect(store.edges.some((edge) => edge.id === "observed-0" && edge.animated)).toBe(true);
    expect(store.allNodesCollapsed).toBe(true);
    expect(payload.edges).toEqual(store.serviceEdges);
  });
});
