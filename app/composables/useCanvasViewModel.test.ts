import { ref } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { createApiClient, type ApiTransportOptions } from "../models/api-client";
import { useGraphStore } from "../stores/graph";
import { useMockApiStore } from "../stores/mockApis";
import { useGraphViewModel } from "./useGraphViewModel";
import { useCanvasViewModel } from "./useCanvasViewModel";

const service = {
  id: "service-1",
  codeKey: "orders",
  projectId: "project-1",
  name: "Orders",
  framework: "Spring Boot",
  baseUrl: "http://localhost:8081",
  healthCheckUrl: null,
  healthCheckHeaderTemplateId: null,
  healthCheckCustomHeaders: [],
  active: true,
  positionX: 10,
  positionY: 20,
  createdAt: "2026-01-01T00:00:00.000Z",
  endpoints: [
    {
      id: "endpoint-1",
      codeKey: "list-orders",
      projectId: "project-1",
      serviceId: "service-1",
      name: "List orders",
      apiType: "REST",
      method: "GET",
      url: "/orders",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ],
};
const mockApi = {
  id: "mock-1",
  projectId: "project-1",
  name: "Fetch orders",
  targetEndpointId: "endpoint-1",
  headerTemplateId: null,
  customHeaders: [],
  active: true,
  status: "ready" as const,
  readinessReasons: [],
  importMethod: null,
  importUrl: null,
  matchUrl: null,
  pathParameters: {},
  requestJson: {},
  description: "",
  createdAt: "2026-01-01T00:00:00.000Z",
};
const canvas = {
  nodesLocked: false,
  viewport: { x: 4, y: 5, zoom: 1.5 },
  services: [service],
  edges: [],
  mockApis: [mockApi],
  headerTemplates: [],
  authorizationTemplates: [],
};

describe("canvas view model", () => {
  beforeEach(() => setActivePinia(createPinia()));

  function setup(transportOverride?: (url: string, options: ApiTransportOptions) => unknown) {
    const requests: Array<{ url: string; options: ApiTransportOptions }> = [];
    const apiClient = createApiClient(async (url, options) => {
      requests.push({ url, options });
      if (transportOverride) return transportOverride(url, options);
      if (url === "/api/canvas" && options.method === "GET") return canvas;
      if (url === "/api/services/health") return [{ id: "service-1", online: true }];
      if (url === "/api/mock-apis") return [mockApi];
      if (options.method === "PUT" && url.endsWith("/mock-1")) return { id: "mock-1" };
      if (url === "/api/canvas") return { saved: true };
      return { id: "id-1" };
    });
    const graphStore = useGraphStore();
    const mockApiStore = useMockApiStore();
    const graphViewModel = useGraphViewModel({
      store: graphStore,
      mockApis: () => mockApiStore.mockApis,
      runningMockId: () => null,
    });
    const canvasElement = {
      fitViewCalls: [] as unknown[],
      setViewportCalls: [] as unknown[],
      updateCalls: [] as string[][],
      setViewport(value: unknown) {
        this.setViewportCalls.push(value);
      },
      fitView(value: unknown) {
        this.fitViewCalls.push(value);
      },
      updateNodeInternals(ids: string[]) {
        this.updateCalls.push(ids);
      },
    };
    const loading = ref(false);
    const errorMessage = ref("");
    const model = useCanvasViewModel({
      apiClient,
      graphStore,
      mockApiStore,
      graphViewModel,
      graphCanvas: ref(canvasElement),
      loading,
      errorMessage,
    });
    return {
      apiClient,
      graphStore,
      mockApiStore,
      graphViewModel,
      model,
      requests,
      canvasElement,
      loading,
      errorMessage,
    };
  }

  it("loads canvas, projects state, restores viewport, and checks service health", async () => {
    const context = setup();
    await context.model.loadCanvas();
    expect(context.graphStore.services).toHaveLength(1);
    const nodeIds = (context.graphStore as unknown as { nodes: Array<{ id: string }> }).nodes.map(
      (node) => node.id,
    );
    expect(nodeIds).toEqual(["service-1", "mock-api-mock-1"]);
    expect(context.mockApiStore.mockApis).toEqual([mockApi]);
    expect(context.graphStore.nodesLocked).toBe(false);
    expect(context.graphStore.serviceHealth).toEqual({ "service-1": true });
    expect(context.canvasElement.setViewportCalls).toEqual([canvas.viewport]);
    expect(context.loading.value).toBe(false);
  });

  it("preserves health on failure and reports canvas loading errors", async () => {
    const context = setup((url) => {
      if (url === "/api/canvas") throw new Error("offline");
      return [];
    });
    context.graphStore.setServiceHealth({ "service-1": true });
    await context.model.loadCanvas();
    expect(context.errorMessage.value).toBe("offline");
    expect(context.graphStore.serviceHealth).toEqual({ "service-1": true });
    expect(context.loading.value).toBe(false);
  });

  it("saves graph positions and updates viewport after movement", async () => {
    const context = setup();
    context.graphStore.applyCanvas(canvas);
    context.model.syncNodes();
    context.model.onMoveEnd({ x: 8, y: 9, zoom: 2 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(context.graphStore.viewport).toEqual({ x: 8, y: 9, zoom: 2 });
    expect(
      context.requests.some(
        ({ url, options }) => url === "/api/canvas" && options.method === "PUT",
      ),
    ).toBe(true);
  });

  it("arranges and saves service and mock positions before fitting the viewport", async () => {
    const context = setup();
    context.graphStore.applyCanvas(canvas);
    context.graphStore.setNodesLocked(true);
    context.mockApiStore.setMockApis([mockApi]);
    context.model.syncNodes();

    await context.model.autoArrange();

    const request = context.requests.find(
      ({ url, options }) => url === "/api/canvas" && options.method === "PUT",
    );
    expect(request?.options.body).toMatchObject({
      nodesLocked: true,
      services: [{ id: "service-1", x: 0, y: 0 }],
      mockApiPositions: [{ id: "mock-1", x: -326, y: 44.5 }],
    });
    expect(context.canvasElement.fitViewCalls).toEqual([{ padding: 0.2, duration: 300 }]);
  });

  it("persists lock toggles and restores prior state when saving fails", async () => {
    const context = setup();
    context.graphStore.applyCanvas(canvas);
    await context.model.toggleNodesLocked();
    expect(context.graphStore.nodesLocked).toBe(true);
    expect(context.requests.at(-1)?.options.body).toMatchObject({ nodesLocked: true });

    const failing = setup((url, options) => {
      if (url === "/api/canvas" && options.method === "PUT") throw new Error("offline");
      if (url === "/api/canvas") return canvas;
      return [];
    });
    failing.graphStore.applyCanvas(canvas);
    await failing.model.toggleNodesLocked();
    expect(failing.graphStore.nodesLocked).toBe(false);
    expect(failing.errorMessage.value).toBe("offline");
  });

  it("ignores non-service graph connections because targets are selected in the panel", async () => {
    const context = setup();
    context.graphStore.applyCanvas(canvas);
    context.mockApiStore.setMockApis([mockApi]);
    const paymentsService = {
      ...service,
      id: "service-2",
      name: "Payments",
      positionX: 400,
      endpoints: service.endpoints.map((endpoint) => ({
        ...endpoint,
        id: "endpoint-2",
        serviceId: "service-2",
        name: "Create payment",
      })),
    };
    context.graphStore.services = [...context.graphStore.services, paymentsService];
    context.graphStore.services[0]!.endpoints.push({
      ...service.endpoints[0]!,
      id: "endpoint-source",
    });
    await context.model.onConnect({
      source: "service-1",
      target: "service-2",
      sourceHandle: "out:endpoint-source",
      targetHandle: "in:endpoint-2",
    });
    expect(context.graphStore.serviceEdges).toHaveLength(1);
    expect(context.graphStore.serviceEdges[0]).toMatchObject({
      sourceEndpointId: "endpoint-source",
      targetEndpointId: "endpoint-2",
    });
    await context.model.onConnect({
      source: "mock-api-mock-1",
      target: "service-1",
      sourceHandle: "trigger-out",
      targetHandle: "endpoint-1",
    });
    expect(context.graphStore.serviceEdges).toHaveLength(1);
    expect(
      context.requests.some(
        ({ url, options }) => url === "/api/mock-apis/mock-1" && options.method === "PUT",
      ),
    ).toBe(false);
    expect(context.mockApiStore.mockApis).toEqual([mockApi]);
  });

  it("deletes a declared connection when its wire is double-clicked", async () => {
    const context = setup();
    context.graphStore.applyCanvas({
      ...canvas,
      services: [service, { ...service, id: "service-2", name: "Payments" }],
      edges: [
        {
          id: "edge-1",
          sourceServiceId: "service-1",
          sourceEndpointId: null,
          targetEndpointId: "endpoint-1",
        },
      ],
    });

    await context.model.onEdgeDoubleClick({ edge: { id: "edge-1" } });

    expect(context.graphStore.serviceEdges).toEqual([]);
    const request = context.requests.find(
      ({ url, options }) => url === "/api/canvas" && options.method === "PUT",
    );
    expect(request?.options.body).toMatchObject({ edges: [] });
  });
  it("reassigns a legacy wire to a source endpoint and saves the same relationship", async () => {
    const context = setup();
    context.graphStore.applyCanvas(canvas);
    const paymentsService = {
      ...service,
      id: "service-2",
      name: "Payments",
      endpoints: service.endpoints.map((endpoint) => ({
        ...endpoint,
        id: "endpoint-2",
        serviceId: "service-2",
      })),
    };
    context.graphStore.services = [...context.graphStore.services, paymentsService];
    context.graphStore.setServiceEdges([
      {
        id: "legacy-edge",
        sourceServiceId: "service-1",
        sourceEndpointId: null,
        targetEndpointId: "endpoint-2",
      },
    ]);
    expect(context.graphViewModel.buildEdges()[0]).toMatchObject({
      id: "legacy-edge",
      sourceHandle: "service-out",
      targetHandle: "in:endpoint-2",
    });

    await context.model.onEdgeUpdate({
      edge: { id: "legacy-edge" },
      connection: {
        source: "service-1",
        sourceHandle: "out:endpoint-1",
        target: "service-2",
        targetHandle: "in:endpoint-2",
      },
    });

    expect(context.graphStore.serviceEdges[0]).toMatchObject({
      id: "legacy-edge",
      sourceEndpointId: "endpoint-1",
      targetEndpointId: "endpoint-2",
    });
    expect(context.requests.some(({ options }) => options.method === "PUT")).toBe(true);
  });

  it("removes a deleted declared wire from saved canvas relationships", async () => {
    const context = setup();
    context.graphStore.setServiceEdges([
      {
        id: "edge-1",
        sourceServiceId: "service-1",
        sourceEndpointId: null,
        targetEndpointId: "endpoint-1",
      },
    ]);

    await context.model.onEdgesChange([
      {
        type: "remove",
        id: "edge-1",
        source: "service-1",
        target: "service-1",
        sourceHandle: "service-out",
        targetHandle: "in:endpoint-1",
      },
    ]);

    expect(context.graphStore.serviceEdges).toEqual([]);
    expect(context.requests.some(({ options }) => options.method === "PUT")).toBe(true);
  });

  it("keeps endpoint panel calls and graph wires on the same saved edge", async () => {
    const context = setup();
    const paymentsService = {
      ...service,
      id: "service-2",
      name: "Payments",
      endpoints: service.endpoints.map((endpoint) => ({
        ...endpoint,
        id: "endpoint-2",
        serviceId: "service-2",
      })),
    };
    context.graphStore.applyCanvas({ ...canvas, services: [service, paymentsService] });

    await expect(context.model.addServiceCall("endpoint-1", "endpoint-2")).resolves.toBe(true);
    const [edge] = context.graphStore.serviceEdges;
    expect(edge).toMatchObject({
      sourceServiceId: "service-1",
      sourceEndpointId: "endpoint-1",
      targetEndpointId: "endpoint-2",
    });
    const renderedEdge = (
      context.graphStore.edges as unknown as Array<{
        id: string;
        sourceHandle?: string;
        targetHandle?: string;
      }>
    ).find(({ id }) => id === edge?.id);
    expect(renderedEdge).toMatchObject({
      sourceHandle: "out:endpoint-1",
      targetHandle: "in:endpoint-2",
    });

    await expect(context.model.removeServiceCall(edge!.id)).resolves.toBe(true);
    expect(context.graphStore.serviceEdges).toEqual([]);
    expect(
      (context.graphStore.edges as unknown as Array<{ id: string }>).some(
        ({ id }) => id === edge!.id,
      ),
    ).toBe(false);
  });

  it("refreshes node internals and rebuilds edges for collapse actions", async () => {
    const context = setup();
    context.graphStore.applyCanvas(canvas);
    await context.model.toggleAllNodes();
    expect(context.graphStore.allNodesCollapsed).toBe(true);
    await context.model.toggleServiceEndpoints("service-1");
    expect(context.graphStore.allNodesCollapsed).toBe(false);
    expect(context.canvasElement.updateCalls).toEqual([["service-1"], ["service-1"]]);
  });
});
