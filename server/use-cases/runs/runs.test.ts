import { describe, expect, it, vi } from "vite-plus/test";
import { RunNotFoundError } from "../../repositories/runs/errors";
import { createGetRunFlowUseCase } from "./get-run-flow";
import { createGetRunUseCase } from "./get-run";

describe("run endpoint use cases", () => {
  it("returns run details and reports missing runs", async () => {
    const now = new Date("2026-10-30T12:00:00.000Z");
    const findRun = vi.fn().mockResolvedValue({
      id: "run-1",
      projectId: "project-1",
      mockApiId: "mock-1",
      traceId: "trace-1",
      status: "completed",
      responseStatus: 200,
      responseHeaders: {},
      responseBody: "ok",
      error: null,
      startedAt: now.toISOString(),
      finishedAt: now.toISOString(),
      lastTelemetryAt: null,
    });
    const useCase = createGetRunUseCase({
      ensureProject: vi.fn().mockResolvedValue("project-1"),
      findRun,
    });
    await expect(useCase("run-1")).resolves.toMatchObject({
      id: "run-1",
      startedAt: now.toISOString(),
    });
    expect(findRun).toHaveBeenCalledWith("project-1", "run-1");
    await expect(
      createGetRunUseCase({
        ensureProject: vi.fn().mockResolvedValue("project-1"),
        findRun: vi.fn().mockResolvedValue(undefined),
      })("missing"),
    ).rejects.toBeInstanceOf(RunNotFoundError);
  });

  it("assembles trace edges, canonical service names, failures, and timeout status", async () => {
    const now = 10_000;
    const run = {
      id: "run-1",
      projectId: "project-1",
      mockApiId: "mock-1",
      traceId: "trace-1",
      status: "failed" as const,
      responseStatus: 500,
      responseHeaders: null,
      responseBody: null,
      error: "failed",
      startedAt: new Date(now - 6_000),
      finishedAt: new Date(now - 4_000),
      lastTelemetryAt: new Date(now - 2_000),
    };
    const spans = [
      {
        id: 1,
        projectId: "project-1",
        traceId: "trace-1",
        spanId: "span-parent",
        parentSpanId: null,
        serviceName: "order-service",
        operationName: "POST /orders",
        startTime: new Date(now - 5_000),
        endTime: new Date(now - 4_000),
        statusCode: "UNSET",
        attributes: {},
        receivedAt: new Date(now - 3_000),
      },
      {
        id: 2,
        projectId: "project-1",
        traceId: "trace-1",
        spanId: "span-child",
        parentSpanId: "span-parent",
        serviceName: "inventory-service",
        operationName: "GET /inventory",
        startTime: new Date(now - 4_000),
        endTime: new Date(now - 3_000),
        statusCode: "ERROR",
        attributes: { "http.response.status_code": 500 },
        receivedAt: new Date(now - 2_000),
      },
    ];
    const getRunFlowData = vi.fn().mockResolvedValue({
      run,
      spans,
      registeredServices: [
        { id: "orders", name: "Order Service" },
        { id: "inventory", name: "Inventory Service" },
      ],
      destinations: [],
      messageConnections: [],
      endpoints: [],
      failedTargetService: "Inventory Service",
    });
    const useCase = createGetRunFlowUseCase({
      ensureProject: vi.fn().mockResolvedValue("project-1"),
      getRunFlowData,
      telemetryQuietMs: () => 1_000,
      telemetryMaxWaitMs: () => 5_000,
      now: () => now,
    });
    await expect(useCase("run-1")).resolves.toMatchObject({
      status: "complete",
      incomplete: false,
      edges: [
        {
          sourceService: "Order Service",
          targetService: "Inventory Service",
          sourceSpanId: "span-parent",
          targetSpanId: "span-child",
        },
      ],
      errorServices: ["Inventory Service"],
    });
    expect(getRunFlowData).toHaveBeenCalledWith("project-1", "run-1");
  });

  it("marks active telemetry as pending and missing runs as not found", async () => {
    const now = 10_000;
    const getRunFlowData = vi.fn().mockResolvedValue({
      run: {
        id: "run-1",
        projectId: "project-1",
        mockApiId: null,
        traceId: "trace-1",
        status: "running",
        responseStatus: null,
        responseHeaders: null,
        responseBody: null,
        error: null,
        startedAt: new Date(now - 100),
        finishedAt: null,
        lastTelemetryAt: new Date(now - 50),
      },
      spans: [],
      registeredServices: [],
      destinations: [],
      messageConnections: [],
      endpoints: [],
      failedTargetService: undefined,
    });
    const useCase = createGetRunFlowUseCase({
      ensureProject: vi.fn().mockResolvedValue("project-1"),
      getRunFlowData,
      telemetryQuietMs: () => 1_000,
      telemetryMaxWaitMs: () => 5_000,
      now: () => now,
    });
    await expect(useCase("run-1")).resolves.toMatchObject({ status: "pending", incomplete: false });
    await expect(
      createGetRunFlowUseCase({
        ensureProject: vi.fn().mockResolvedValue("project-1"),
        getRunFlowData: vi.fn().mockResolvedValue(undefined),
        telemetryQuietMs: () => 1,
        telemetryMaxWaitMs: () => 1,
      })("missing"),
    ).rejects.toBeInstanceOf(RunNotFoundError);
  });

  it("observes only trace-matched message connections and keeps downstream spans", async () => {
    const now = 10_000;
    const run = {
      id: "run-message",
      projectId: "project-1",
      mockApiId: null,
      traceId: "shared-trace",
      status: "completed" as const,
      responseStatus: 200,
      responseHeaders: null,
      responseBody: null,
      error: null,
      startedAt: new Date(now - 1000),
      finishedAt: new Date(now - 500),
      lastTelemetryAt: new Date(now - 100),
    };
    const span = (
      id: string,
      serviceName: string,
      attributes: Record<string, unknown>,
      parentSpanId: string | null = null,
      traceId = "shared-trace",
    ) => ({
      id: id.length,
      projectId: "project-1",
      traceId,
      spanId: id,
      parentSpanId,
      serviceName,
      operationName: "message",
      startTime: new Date(now - 900),
      endTime: new Date(now - 800),
      statusCode: "OK",
      attributes,
      receivedAt: new Date(now - 700),
    });
    const getRunFlowData = vi.fn().mockResolvedValue({
      run,
      spans: [
        span("producer-span", "producer-service", {
          "messaging.system": "kafka",
          "messaging.destination.name": "orders",
          "messaging.operation": "send",
        }),
        span(
          "consumer-span",
          "consumer-service",
          {
            "messaging.system": "kafka",
            "messaging.source.name": "orders",
            "messaging.operation": "process",
          },
          "producer-span",
        ),
        span("downstream-span", "Billing", {}, "consumer-span"),
        span(
          "unlinked-span",
          "consumer-service",
          {
            "messaging.system": "kafka",
            "messaging.source.name": "orders",
            "messaging.operation": "process",
          },
          null,
          "other-trace",
        ),
      ],
      registeredServices: [
        { id: "producer", name: "Producer Service" },
        { id: "consumer", name: "Consumer Service" },
        { id: "billing", name: "Billing" },
      ],
      destinations: [{ id: "destination", broker: "kafka", name: "orders" }],
      endpoints: [{ id: "producer-endpoint", serviceId: "producer" }],
      messageConnections: [
        {
          id: "publish-link",
          type: "publish",
          destinationId: "destination",
          endpointId: "producer-endpoint",
          serviceId: null,
        },
        {
          id: "subscribe-link",
          type: "subscribe",
          destinationId: "destination",
          endpointId: null,
          serviceId: "consumer",
        },
      ],
      failedTargetService: undefined,
    });
    const flow = await createGetRunFlowUseCase({
      ensureProject: vi.fn().mockResolvedValue("project-1"),
      getRunFlowData,
      telemetryQuietMs: () => 50,
      telemetryMaxWaitMs: () => 5000,
      now: () => now,
    })("run-message");
    expect(flow.observedMessageConnectionIds).toEqual(["publish-link", "subscribe-link"]);
    expect(flow.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceService: "Consumer Service", targetService: "Billing" }),
      ]),
    );
    expect(flow.spans.map(({ traceId }) => traceId)).toContain("shared-trace");
  });

  it("maps pluralized subgraph labels to singular OpenTelemetry service names", async () => {
    const now = 10_000;
    const getRunFlowData = vi.fn().mockResolvedValue({
      run: {
        id: "run-1",
        projectId: "project-1",
        mockApiId: "mock-1",
        traceId: "trace-1",
        status: "completed",
        responseStatus: 200,
        responseHeaders: null,
        responseBody: null,
        error: null,
        startedAt: new Date(now - 1_000),
        finishedAt: new Date(now - 900),
        lastTelemetryAt: new Date(now - 2_000),
      },
      spans: [
        {
          id: 1,
          projectId: "project-1",
          traceId: "trace-1",
          spanId: "router-span",
          parentSpanId: null,
          serviceName: "apollo-router",
          operationName: "query GetCart",
          startTime: new Date(now - 800),
          endTime: new Date(now - 700),
          statusCode: "OK",
          attributes: {},
          receivedAt: new Date(now - 600),
        },
        {
          id: 2,
          projectId: "project-1",
          traceId: "trace-1",
          spanId: "subgraph-span",
          parentSpanId: "router-span",
          serviceName: "cart-subgraph",
          operationName: "POST /graphql",
          startTime: new Date(now - 700),
          endTime: new Date(now - 600),
          statusCode: "OK",
          attributes: {},
          receivedAt: new Date(now - 500),
        },
      ],
      registeredServices: [{ name: "Apollo Router" }, { name: "Carts subgraph" }],
      destinations: [],
      messageConnections: [],
      endpoints: [],
      failedTargetService: undefined,
    });
    const getFlow = createGetRunFlowUseCase({
      ensureProject: vi.fn().mockResolvedValue("project-1"),
      getRunFlowData,
      telemetryQuietMs: () => 1_000,
      telemetryMaxWaitMs: () => 5_000,
      now: () => now,
    });

    await expect(getFlow("run-1")).resolves.toMatchObject({
      edges: [
        {
          sourceService: "Apollo Router",
          targetService: "Carts subgraph",
          sourceSpanId: "router-span",
          targetSpanId: "subgraph-span",
        },
      ],
    });
  });
});
