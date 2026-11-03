import { ref } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import type { MockApiCallHistoryEntry } from "#shared/api/mock-api-call-history";
import { createApiClient, type ApiTransportOptions } from "../models/api-client";
import { useGraphStore } from "../stores/graph";
import { useMockApiStore } from "../stores/mockApis";
import { useGraphViewModel } from "./useGraphViewModel";
import { useMockApiRunViewModel } from "./useMockApiRunViewModel";

const services = [
  {
    id: "orders",
    codeKey: "orders",
    projectId: "p",
    name: "Orders",
    framework: "Spring Boot",
    baseUrl: "http://orders",
    healthCheckUrl: null,
    healthCheckHeaderTemplateId: null,
    healthCheckCustomHeaders: [],
    active: true,
    positionX: 0,
    positionY: 0,
    createdAt: "2025-01-01T00:00:00.000Z",
    endpoints: [
      {
        id: "orders-endpoint",
        codeKey: "create-order",
        projectId: "p",
        serviceId: "orders",
        name: "Create order",
        apiType: "REST",
        method: "POST",
        url: "/orders",
        createdAt: "2025-01-01T00:00:00.000Z",
      },
    ],
  },
  {
    id: "inventory",
    codeKey: "inventory",
    projectId: "p",
    name: "Inventory",
    framework: ".NET",
    baseUrl: "http://inventory",
    healthCheckUrl: null,
    healthCheckHeaderTemplateId: null,
    healthCheckCustomHeaders: [],
    active: true,
    positionX: 200,
    positionY: 0,
    createdAt: "2025-01-01T00:00:00.000Z",
    endpoints: [
      {
        id: "inventory-endpoint",
        codeKey: "reserve",
        projectId: "p",
        serviceId: "inventory",
        name: "Reserve",
        apiType: "REST",
        method: "POST",
        url: "/reserve",
        createdAt: "2025-01-01T00:00:00.000Z",
      },
    ],
  },
];
const mock = {
  id: "mock-1",
  projectId: "p",
  name: "Create order",
  targetEndpointId: "orders-endpoint",
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
  createdAt: "2025-01-01T00:00:00.000Z",
};

describe("mock API run view model", () => {
  beforeEach(() => setActivePinia(createPinia()));

  function setup(status: "completed" | "failed") {
    const graphStore = useGraphStore();
    const mockApiStore = useMockApiStore();
    graphStore.applyCanvas({
      nodesLocked: false,
      services,
      edges: [],
      mockApis: [mock],
      headerTemplates: [],
      authorizationTemplates: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    });
    mockApiStore.setMockApis([mock]);
    mockApiStore.setMockDraft([mock]);
    const flow = {
      runId: "run-1",
      traceId: "trace-1",
      runStatus: status,
      status: "complete",
      incomplete: false,
      spans: [],
      edges: [
        {
          sourceService: "Orders",
          targetService: "Inventory",
          sourceSpanId: "span-1",
          targetSpanId: "span-2",
        },
      ],
      errorServices: status === "failed" ? ["Inventory"] : [],
    };
    const apiCalls: string[] = [];
    const apiClient = createApiClient(async (url, _options: ApiTransportOptions) => {
      apiCalls.push(url);
      if (url.endsWith("/runs"))
        return {
          id: "run-1",
          traceId: "trace-1",
          status,
          responseStatus: status === "failed" ? 500 : 201,
          responseHeaders: {},
          responseBody: "{}",
          error: null,
        };
      if (url.endsWith("/flow")) return flow;
      throw new Error(`Unexpected request ${url}`);
    });
    const graphViewModel = useGraphViewModel({
      store: graphStore,
      mockApis: () => [mock],
      runningMockId: () => mockApiStore.runningMockId,
    });
    const logService = ref<string[]>([]);
    const logSeverity = ref<string[]>([]);
    const logsOpen = ref(false);
    const calls = { saveCanvas: 0, loadLogs: 0 };
    const viewModel = useMockApiRunViewModel({
      apiClient,
      graphStore,
      mockApiStore,
      graphViewModel,
      services: () => services,
      logService,
      logSeverity,
      logsOpen,
      saveCanvas: async () => void calls.saveCanvas++,
      loadLogs: async () => void calls.loadLogs++,
      wait: async () => {},
    });
    return {
      graphStore,
      mockApiStore,
      logService,
      logSeverity,
      logsOpen,
      calls,
      apiCalls,
      viewModel,
    };
  }

  it("records a successful run and highlights the full downstream flow", async () => {
    const context = setup("completed");
    await context.viewModel.runMock(mock);
    expect(context.mockApiStore.runResults["mock-1"]?.status).toBe("completed");
    expect(context.mockApiStore.runningMockId).toBeNull();
    expect(context.graphStore.observedServices).toEqual(["Orders", "Inventory"]);
    const edges = context.graphStore.edges as unknown as { id: string; animated?: boolean }[];
    expect(edges.some((edge) => edge.id === "observed-0")).toBe(true);
    expect(edges.find((edge) => edge.id === "observed-0")?.animated).toBe(true);
    const nodes = context.graphStore.nodes as unknown as { id: string; class?: string }[];
    expect(nodes.find((node) => node.id === "orders")?.class).toContain("service-observed");
    expect(context.logsOpen.value).toBe(false);
    expect(context.calls.saveCanvas).toBe(2);
  });

  it("filters logs to the failing downstream service and highlights its node", async () => {
    const context = setup("failed");
    await context.viewModel.runMock(mock);
    expect(context.graphStore.observedErrorServices).toEqual(["Inventory"]);
    const nodes = context.graphStore.nodes as unknown as { id: string; class?: string }[];
    expect(nodes.find((node) => node.id === "inventory")?.class).toContain("service-error");
    expect(context.graphStore.observedEdges).toEqual([
      { sourceService: "Orders", targetService: "Inventory" },
    ]);
    expect(context.logService.value).toEqual(["Inventory"]);
    expect(context.logSeverity.value).toEqual([]);
    expect(context.logsOpen.value).toBe(true);
    expect(context.calls.loadLogs).toBe(2);
  });

  it("replays a saved trace without triggering a mock API request", async () => {
    const context = setup("failed");
    const historyEntry: MockApiCallHistoryEntry = {
      id: "history-1",
      projectId: "p",
      runId: "run-1",
      mockApiId: "deleted-mock-api",
      mockApiName: "Create order from old config",
      method: "POST",
      url: "http://orders/orders",
      requestBody: { old: true },
      traceId: "trace-1",
      status: "failed",
      triggeredAt: "2026-11-02T08:00:00.000Z",
      responseStatus: 500,
      responseHeaders: {},
      responseBody: "{}",
      error: null,
    };

    await context.viewModel.replayHistoryEntry(historyEntry);

    expect(context.apiCalls).toEqual(["/api/runs/run-1/flow"]);
    expect(context.graphStore.observedServices).toEqual(["Orders", "Inventory"]);
    expect(context.graphStore.observedEdges).toEqual([
      { sourceService: "Orders", targetService: "Inventory" },
    ]);
    const edges = context.graphStore.edges as unknown as { id: string; animated?: boolean }[];
    expect(edges.find((edge) => edge.id === "observed-0")?.animated).toBe(true);
    const nodes = context.graphStore.nodes as unknown as { id: string; class?: string }[];
    expect(nodes.find((node) => node.id === "inventory")?.class).toContain("service-observed");
    expect(nodes.find((node) => node.id === "inventory")?.class).toContain("service-error");
    expect(context.mockApiStore.runResults["deleted-mock-api"]).toMatchObject({
      id: "run-1",
      status: "failed",
      responseStatus: 500,
      traceId: "trace-1",
    });
    expect(context.calls.saveCanvas).toBe(0);
  });

  it("does not apply a trace after replay has been stopped", async () => {
    const context = setup("completed");
    const historyEntry: MockApiCallHistoryEntry = {
      id: "history-1",
      projectId: "p",
      runId: "run-1",
      mockApiId: "mock-1",
      mockApiName: "Create order",
      method: "POST",
      url: "http://orders/orders",
      requestBody: {},
      traceId: "trace-1",
      status: "completed",
      triggeredAt: "2026-11-02T08:00:00.000Z",
      responseStatus: 201,
      responseHeaders: {},
      responseBody: "{}",
      error: null,
    };
    const pendingReplay = context.viewModel.replayHistoryEntry(historyEntry);
    context.viewModel.stopReplay();
    await pendingReplay;

    expect(context.mockApiStore.runResults["mock-1"]).toBeUndefined();
  });
});
