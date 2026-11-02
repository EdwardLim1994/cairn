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
  viewport: { x: 4, y: 5, zoom: 1.5 },
  mockNode: { x: 30, y: 40 },
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
      setViewportCalls: [] as unknown[],
      updateCalls: [] as string[][],
      setViewport(value: unknown) {
        this.setViewportCalls.push(value);
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
    await context.model.onConnect({
      source: "service-1",
      target: "service-2",
      sourceHandle: null,
      targetHandle: "endpoint-2",
    });
    expect(context.graphStore.serviceEdges).toHaveLength(1);
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
