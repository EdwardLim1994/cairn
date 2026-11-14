import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { useGraphViewModel } from "../useGraphViewModel";
import { useGraphStore } from "../../stores/graph";
import type { CanvasGetResponse } from "#shared/api/canvas";

const service = {
  id: "service-1",
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
  endpoints: [
    {
      id: "endpoint-1",
      projectId: "project-1",
      serviceId: "service-1",
      name: "List orders",
      apiType: "REST",
      method: "GET",
      url: "/orders",
      rpcMethod: null,
      createdAt: "2025-01-01T00:00:00.000Z",
    },
  ],
};
const mockApi: CanvasGetResponse["mockApis"][number] = {
  id: "mock-1",
  projectId: "project-1",
  name: "Fetch orders",
  apiType: "HTTP",
  targetEndpointId: "endpoint-1",
  headerTemplateId: null,
  customHeaders: [],
  active: true,
  status: "ready",
  readinessReasons: [],
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
      messageDestinations: [],
      messageConnections: [],
      headerTemplates: [],
      authorizationTemplates: [],
      viewport: { x: 0, y: 0, zoom: 1 },
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
        apiType: "HTTP",
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

  it("traverses configured calls, message queues, and mock targets without following observed-only edges", () => {
    const { store } = createModel([]);
    const services = [
      service,
      ...[2, 3, 4, 5, 6, 7].map((index) => ({
        ...service,
        id: `service-${index}`,
        name: `Service ${index}`,
        positionX: index * 100,
        endpoints: [
          {
            ...service.endpoints[0],
            id: `endpoint-${index}`,
            serviceId: `service-${index}`,
          },
        ],
      })),
      {
        ...service,
        id: "isolated",
        name: "Isolated",
        endpoints: [
          {
            ...service.endpoints[0],
            id: "endpoint-isolated",
            serviceId: "isolated",
          },
        ],
      },
    ];
    store.services = services as CanvasGetResponse["services"];
    store.setServiceEdges([
      {
        id: "call-1",
        sourceServiceId: "service-1",
        sourceEndpointId: "endpoint-1",
        targetEndpointId: "endpoint-2",
      },
      {
        id: "call-2",
        sourceServiceId: "service-2",
        sourceEndpointId: "endpoint-2",
        targetEndpointId: "endpoint-3",
      },
      {
        id: "call-3",
        sourceServiceId: "service-3",
        sourceEndpointId: "endpoint-3",
        targetEndpointId: "endpoint-4",
      },
      {
        id: "cycle-1",
        sourceServiceId: "service-2",
        sourceEndpointId: "endpoint-2",
        targetEndpointId: "endpoint-6",
      },
      {
        id: "cycle-2",
        sourceServiceId: "service-6",
        sourceEndpointId: "endpoint-6",
        targetEndpointId: "endpoint-7",
      },
      {
        id: "cycle-3",
        sourceServiceId: "service-7",
        sourceEndpointId: "endpoint-7",
        targetEndpointId: "endpoint-2",
      },
      {
        id: "isolated-call",
        sourceServiceId: "isolated",
        sourceEndpointId: "endpoint-isolated",
        targetEndpointId: "endpoint-isolated",
      },
    ]);
    store.setMessageDestinations([
      {
        id: "queue-1",
        projectId: "project-1",
        broker: "kafka",
        name: "events",
        connection: { brokers: "localhost:9092", securityProtocol: "PLAINTEXT" },
        x: 600,
        y: 100,
      },
    ]);
    store.setMessageConnections([
      {
        id: "publish-1",
        type: "publish",
        destinationId: "queue-1",
        endpointId: "endpoint-2",
      },
      {
        id: "subscribe-1",
        type: "subscribe",
        destinationId: "queue-1",
        serviceId: "service-5",
        consumerGroup: "events",
      },
    ]);
    const trigger = { ...mockApi, id: "trigger-1", targetEndpointId: "endpoint-1" };
    const triggers = [trigger] as unknown as CanvasGetResponse["mockApis"];
    const modelWithTrigger = useGraphViewModel({
      store,
      mockApis: () => triggers,
      runningMockId: () => null,
    });
    store.setObservations({
      services: ["Orders", "Service 2"],
      errorServices: [],
      edges: [
        { sourceService: "Orders", targetService: "Service 2" },
        { sourceService: "Orders", targetService: "Isolated" },
      ],
      messageConnectionIds: ["publish-1"],
    });
    store.setSelection("service-1");
    modelWithTrigger.syncNodes();

    const nodes = store.nodes as unknown as {
      id: string;
      class: string;
      data?: { observedOutboundCallIds?: string[] };
    }[];
    const edges = store.edges as unknown as {
      id: string;
      class: string;
      animated?: boolean;
    }[];
    const nodeClass = (id: string) => nodes.find((node) => node.id === id)?.class;
    const edgeClass = (id: string) => edges.find((edge) => edge.id === id)?.class;

    expect(nodeClass("service-1")).toContain("relationship-1");
    expect(nodeClass("service-2")).toContain("relationship-2");
    expect(nodeClass("service-3")).toContain("relationship-2");
    expect(nodeClass("service-4")).toContain("relationship-dimmed");
    expect(nodeClass("message-queue:queue-1")).toContain("relationship-2");
    expect(nodeClass("service-5")).toContain("relationship-2");
    expect(nodeClass("mock-api-trigger-1")).toContain("relationship-1");
    expect(nodeClass("service-6")).toContain("relationship-2");
    expect(nodeClass("service-7")).toContain("relationship-2");
    expect(nodeClass("isolated")).toContain("relationship-dimmed");
    expect(edgeClass("call-1")).toContain("relationship-2");
    expect(edgeClass("call-1")).toContain("app__flow-edge--observed");
    expect(edgeClass("call-2")).toContain("relationship-3");
    expect(edgeClass("call-3")).toContain("relationship-dimmed");
    expect(edgeClass("message-publish-1")).toContain("relationship-3");
    expect(edgeClass("message-publish-1")).toContain("app__flow-edge--observed");
    expect(edgeClass("message-subscribe-1")).toContain("relationship-3");
    expect(edgeClass("mock-trigger-1")).toContain("relationship-1");
    expect(edgeClass("isolated-call")).toContain("relationship-dimmed");
    const observedOnlyEdge = edges.find(({ id }) => id.startsWith("observed-"));
    expect(observedOnlyEdge?.class).not.toContain("relationship");
    expect(edges.find(({ id }) => id === "call-1")?.animated).toBe(true);
    expect(edges.find(({ id }) => id === "message-publish-1")?.animated).toBe(true);
    expect(nodes.find(({ id }) => id === "service-1")?.data?.observedOutboundCallIds).toContain(
      "call-1",
    );

    store.setSelection("service-2");
    modelWithTrigger.syncNodes();
    const updatedEdges = store.edges as unknown as {
      id: string;
      class?: string;
      data?: { relationshipGradient?: { from: string; toLevel: number } };
    }[];
    const updatedNodes = store.nodes as unknown as { id: string; class: string }[];
    const incomingCall = updatedEdges.find(({ id }) => id === "call-1");
    const outgoingCall = updatedEdges.find(({ id }) => id === "call-2");
    const queue = updatedNodes.find(({ id }) => id === "message-queue:queue-1");
    const subscriber = updatedNodes.find(({ id }) => id === "service-5");
    const subscriberEdge = updatedEdges.find(({ id }) => id === "message-subscribe-1");
    expect(queue?.class).toContain("relationship-2");
    expect(subscriber?.class).toContain("relationship-2");
    expect(incomingCall?.data).toMatchObject({
      relationshipGradient: { from: "target", toLevel: 2 },
    });
    expect(outgoingCall?.data).toMatchObject({
      relationshipGradient: { from: "source", toLevel: 2 },
    });
    expect(subscriberEdge?.class).toContain("relationship-2");
    expect(updatedEdges.find(({ id }) => id === "message-publish-1")?.data).toMatchObject({
      relationshipGradient: { from: "source", toLevel: 2 },
    });
    const levelThreeCall = updatedEdges.find(({ id }) => id === "call-3");
    expect(levelThreeCall?.data).toMatchObject({
      relationshipGradient: { from: "source", toLevel: 3 },
    });

    store.setSelection(null);
    modelWithTrigger.syncNodes();
    const clearedEdges = store.edges as unknown as {
      id: string;
      class?: string;
      data?: { relationshipGradient?: unknown };
    }[];
    const clearedCall = clearedEdges.find(({ id }) => id === "call-1");
    expect(clearedCall?.class).not.toContain("relationship");
    expect(clearedCall?.data?.relationshipGradient).toBeUndefined();
    expect(clearedEdges.find(({ id }) => id === "call-2")?.data).toEqual({});
  });

  it("keeps relationship distances off when a non-service node is selected", () => {
    const { store, model } = createModel();
    store.setSelection("mock-api-mock-1");
    model.syncNodes();

    expect(
      (store.nodes as unknown as { class?: string }[]).every(
        (node) => !node.class?.includes("relationship"),
      ),
    ).toBe(true);
    expect(
      (store.edges as unknown as { class?: string }[]).every(
        (edge) => !edge.class?.includes("relationship"),
      ),
    ).toBe(true);
  });

  it("keeps response visibility exclusive while preserving per-endpoint session status", () => {
    const first = { ...mockApi, id: "ws-1", apiType: "WEBSOCKET" as const };
    const second = { ...mockApi, id: "ws-2", apiType: "WEBSOCKET" as const };
    const apis = [first, second] as unknown as CanvasGetResponse["mockApis"];
    const { model } = createModel(apis);
    const nodes = model.mockApiNodes();
    expect(nodes).toHaveLength(2);
    const data = nodes.map(
      (node) => node.data as { id: string; websocketState: string; responseOpen: boolean },
    );
    expect(data.map(({ websocketState }) => websocketState)).toEqual([
      "disconnected",
      "disconnected",
    ]);

    const isolatedModel = useGraphViewModel({
      store: useGraphStore(),
      mockApis: () => apis,
      runningMockId: () => null,
      websocketState: (id) => (id === "ws-1" ? "connected" : "disconnected"),
      responsePanelOpenId: () => "ws-2",
    });
    const isolatedData = isolatedModel
      .mockApiNodes()
      .map((node) => node.data as (typeof data)[number]);
    expect(isolatedData.map(({ websocketState }) => websocketState)).toEqual([
      "connected",
      "disconnected",
    ]);
    expect(isolatedData.map(({ responseOpen }) => responseOpen)).toEqual([false, true]);
  });

  it("provides each trigger node with its own latest run response", () => {
    const { store } = createModel();
    const model = useGraphViewModel({
      store,
      mockApis: () => [mockApi],
      runningMockId: () => null,
      runResults: () => ({
        "mock-1": {
          status: "completed",
          responseStatus: 200,
          responseBody: '{"orders":[]}',
          error: null,
          traceId: "trace-1",
        },
      }),
    });
    const node = model.mockApiNodes()[0]!;
    expect(
      (node.data as { latestResponse: { responseBody: string } }).latestResponse.responseBody,
    ).toBe('{"orders":[]}');
  });

  it("builds declared, per-API target, and observed service edges", () => {
    const { store, model } = createModel();
    store.setObservations({
      services: ["Orders"],
      errorServices: [],
      edges: [{ sourceService: "Orders", targetService: "Orders" }],
    });
    const edges = model.buildEdges();
    expect(edges.map(({ id }) => id)).toEqual(["edge-1", "mock-mock-1"]);
    expect(edges[0]).toMatchObject({
      sourceHandle: "outbound-call:edge-1",
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
    expect(edges[0]?.animated).toBe(true);
    expect(edges[0]).toMatchObject({ type: "default", label: "No timing" });
    expect(edges[0]?.domAttributes).toMatchObject({
      title: "Timing unavailable: outbound client-span telemetry was not found.",
    });
    store.toggleServiceEndpoints("service-1");
    expect(model.buildEdges()[0]).toMatchObject({
      sourceHandle: "outbound-call:edge-1",
      targetHandle: "in:endpoint-1",
      updatable: false,
      deletable: false,
    });
  });

  it("labels observed service calls with cumulative duration and per-call tooltip details", () => {
    const { store, model } = createModel();
    store.services.push({ ...service, id: "inventory", name: "Inventory", endpoints: [] });
    store.setObservations({
      services: ["Orders", "Inventory"],
      errorServices: [],
      edges: [
        {
          sourceService: "Orders",
          targetService: "Inventory",
          timing: { totalDurationMs: 1_275, callDurationsMs: [275, 1_000] },
        },
      ],
    });

    const edge = model.buildEdges().find(({ id }) => id === "observed-0");

    expect(edge).toMatchObject({
      type: "default",
      label: "1.28 s",
      ariaLabel:
        "Observed call from Orders to Inventory: Cumulative call time: 1.28 s\nCalls (2): 275 ms, 1 s",
      domAttributes: {
        title: "Cumulative call time: 1.28 s\nCalls (2): 275 ms, 1 s",
      },
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
      sourceHandle: "outbound-call:assigned-edge",
      target: "service-1",
      targetHandle: "in:endpoint-1",
    });
    store.setAllNodesCollapsed(true);
    expect(model.buildEdges()[0]).toMatchObject({
      id: "assigned-edge",
      sourceHandle: "outbound-call:assigned-edge",
      targetHandle: "in:endpoint-1",
      updatable: false,
      deletable: false,
    });
    store.setAllNodesCollapsed(false);
    expect(model.buildEdges()[0]).toMatchObject({
      id: "assigned-edge",
      sourceHandle: "outbound-call:assigned-edge",
      targetHandle: "in:endpoint-1",
      updatable: true,
      deletable: true,
    });
  });

  it("anchors legacy service-level publishes on the service's first endpoint", () => {
    const { store, model } = createModel();
    store.setMessageDestinations([
      {
        id: "orders-topic",
        projectId: "project-1",
        broker: "kafka",
        name: "Orders",
        connection: { brokers: "localhost:9092", securityProtocol: "PLAINTEXT" },
        x: 500,
        y: 100,
      },
    ]);
    store.setMessageConnections([
      {
        id: "publish-1",
        type: "publish",
        serviceId: "service-1",
        destinationId: "orders-topic",
      },
    ]);

    const node = model.serviceNode(store.services[0]!);
    expect(node.data).toMatchObject({
      hasMessagePublisher: false,
    });
    expect(
      (
        node.data as {
          outboundCalls: { id: string; kind?: string; sourceEndpointId?: string }[];
        }
      ).outboundCalls,
    ).toContainEqual(
      expect.objectContaining({
        id: "publish-1",
        kind: "message",
        methodTag: "PUB",
        label: "Orders",
        sourceEndpointId: "endpoint-1",
        sourceSubscriptionId: undefined,
      }),
    );
    expect(model.buildEdges().find((edge) => edge.id === "message-publish-1")).toMatchObject({
      source: "service-1",
      sourceHandle: "outbound-call:publish-1",
      targetHandle: "publish-in:orders-topic",
    });
  });

  it("includes endpoint-owned publishes even when the connection has no serviceId", () => {
    const { store, model } = createModel();
    store.setMessageDestinations([
      {
        id: "review-topic",
        projectId: "project-1",
        broker: "kafka",
        name: "Review added",
        connection: { brokers: "localhost:9092", securityProtocol: "PLAINTEXT" },
        x: 500,
        y: 100,
      },
    ]);
    store.setMessageConnections([
      {
        id: "review-publish",
        type: "publish",
        endpointId: "endpoint-1",
        destinationId: "review-topic",
      },
    ]);

    const node = model.serviceNode(store.services[0]!);
    expect(
      (
        node.data as {
          outboundCalls: { id: string; kind?: string; sourceEndpointId?: string }[];
        }
      ).outboundCalls,
    ).toContainEqual(
      expect.objectContaining({
        id: "review-publish",
        kind: "message",
        methodTag: "PUB",
        label: "Review added",
        sourceEndpointId: "endpoint-1",
        sourceSubscriptionId: undefined,
      }),
    );
    expect(model.buildEdges().find((edge) => edge.id === "message-review-publish")).toMatchObject({
      source: "service-1",
      sourceHandle: "outbound-call:review-publish",
    });
  });

  it("renders independent message queue nodes and attaches each edge to its queue", () => {
    const { store, model } = createModel();
    store.services.push({ ...service, id: "service-2", name: "Inventory", endpoints: [] });
    store.setMessageDestinations([
      {
        id: "orders-topic",
        queueId: "shared-broker",
        projectId: "project-1",
        broker: "kafka",
        name: "Orders",
        connection: { brokers: "kafka-orders:9092", securityProtocol: "PLAINTEXT" },
        x: 100,
        y: 100,
      },
      {
        id: "payments-topic",
        queueId: "shared-broker",
        projectId: "project-1",
        broker: "rabbitmq",
        name: "Payments",
        connection: { host: "rabbit-payments", port: 5672, virtualHost: "/", tls: false },
        x: 800,
        y: 100,
      },
    ]);
    store.setMessageConnections([
      {
        id: "publish-orders",
        type: "publish",
        destinationId: "orders-topic",
        endpointId: "endpoint-1",
        serviceId: "service-1",
      },
      {
        id: "consume-payments",
        type: "subscribe",
        destinationId: "payments-topic",
        serviceId: "service-2",
        bindingKey: "payment.*",
      },
    ]);

    const nodes = model.syncNodes();
    expect(nodes.filter((node) => node.type === "messageQueue").map(({ id }) => id)).toEqual([
      "message-queue:orders-topic",
      "message-queue:payments-topic",
    ]);
    const queueNodes = nodes.filter((node) => node.type === "messageQueue") as unknown as {
      data: { destinations: { id: string }[] };
    }[];
    expect(queueNodes.map(({ data }) => data.destinations.map(({ id }) => id))).toEqual([
      ["orders-topic"],
      ["payments-topic"],
    ]);
    expect(model.buildEdges()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "message-publish-orders",
          target: "message-queue:orders-topic",
        }),
        expect.objectContaining({
          id: "message-consume-payments",
          source: "message-queue:payments-topic",
        }),
      ]),
    );
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
      services: [{ id: "service-1", x: 30, y: 40 }],
      mockApiPositions: [{ id: "mock-1", x: -190, y: 40 }],
      messageDestinations: [],
      messageConnections: [],
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
    expect(store.edges).toHaveLength(2);
    expect(store.allNodesCollapsed).toBe(true);
    expect(payload.edges).toEqual(store.serviceEdges);
  });

  it("highlights only message links matched by the run trace", () => {
    const { store, model } = createModel();
    store.setMessageDestinations([
      {
        id: "destination-1",
        projectId: "project-1",
        broker: "kafka",
        name: "orders",
        connection: { brokers: "localhost:9092", securityProtocol: "PLAINTEXT" },
        x: 500,
        y: 100,
      },
    ]);
    store.setMessageConnections([
      {
        id: "publish-link",
        type: "publish",
        destinationId: "destination-1",
        endpointId: "endpoint-1",
      },
      {
        id: "subscribe-link",
        type: "subscribe",
        destinationId: "destination-1",
        serviceId: "service-2",
        consumerGroup: "orders",
      },
    ]);
    store.services.push({ ...service, id: "service-2", name: "Consumer", endpoints: [] });
    store.services.push({ ...service, id: "service-3", name: "Billing", endpoints: [] });
    store.setObservations({
      services: ["Orders", "Consumer"],
      errorServices: [],
      edges: [],
      messageConnectionIds: ["publish-link"],
    });

    model.syncNodes();
    const renderedEdges = store.edges as unknown as {
      id: string;
      animated?: boolean;
      targetHandle?: string;
      label?: string;
    }[];
    const publish = renderedEdges.find((edge) => edge.id === "message-publish-link");
    const subscribe = renderedEdges.find((edge) => edge.id === "message-subscribe-link");
    const renderedNodes = store.nodes as unknown as { id: string; class?: string }[];
    const destination = renderedNodes.find((node) => node.id === "message-queue:destination-1");
    const consumer = (store.nodes as unknown as { id: string; data: unknown }[]).find(
      (node) => node.id === "service-2",
    ) as {
      data: { subscriptions: { id: string; destinationName: string; consumerGroup?: string }[] };
    };
    expect(publish?.animated).toBe(true);
    expect(subscribe?.animated).toBe(false);
    expect(publish?.label).toBeUndefined();
    expect(subscribe?.label).toBeUndefined();
    expect(subscribe?.targetHandle).toBe("subscriber-in:subscribe-link");
    expect(consumer.data.subscriptions).toMatchObject([
      { id: "subscribe-link", destinationName: "orders", consumerGroup: "orders" },
    ]);
    expect(destination?.class).toContain("app__flow-node--service-observed");
    const queueCollapsed = () =>
      (store.nodes as unknown as { id: string; data: { topicsCollapsed: boolean } }[]).find(
        (node) => node.id === "message-queue:destination-1",
      )?.data.topicsCollapsed;
    store.setAllNodesCollapsed(true);
    model.syncNodes();
    expect(queueCollapsed()).toBe(true);
    store.setAllNodesCollapsed(false);
    model.syncNodes();
    expect(queueCollapsed()).toBe(false);
    store.setObservations({
      services: ["Orders", "Consumer"],
      errorServices: [],
      edges: [{ sourceService: "Consumer", targetService: "Billing" }],
      messageConnectionIds: ["publish-link", "subscribe-link"],
    });
    model.syncNodes();
    expect(
      (store.edges as unknown as { id: string; animated?: boolean }[]).find(
        (edge) => edge.id === "message-subscribe-link",
      )?.animated,
    ).toBe(true);
    expect(
      (store.edges as unknown as { id: string; animated?: boolean }[]).find(
        (edge) => edge.id === "observed-0",
      )?.animated,
    ).toBe(true);
  });
});
