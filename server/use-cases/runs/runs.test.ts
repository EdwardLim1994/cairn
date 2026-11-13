import { describe, expect, it, vi } from "vite-plus/test";
import { RunNotFoundError } from "../../repositories/runs/errors";
import { createGetRunFlowUseCase } from "./get-run-flow";
import { createGetRunUseCase } from "./get-run";

describe("run endpoint use cases", () => {
  it("distinguishes expired, partial, and never-observed telemetry in saved runs", async () => {
    const now = Date.parse("2026-11-13T00:00:00.000Z");
    const run = {
      id: "old-run",
      projectId: "project-1",
      mockApiId: null,
      traceId: "trace-1",
      status: "completed" as const,
      responseStatus: 200,
      grpcStatus: null,
      grpcStatusName: null,
      responseHeaders: null,
      responseBody: "saved response",
      error: null,
      startedAt: new Date(now - 400 * 86_400_000),
      finishedAt: new Date(now - 400 * 86_400_000),
      firstTelemetryAt: new Date(now - 400 * 86_400_000),
      lastTelemetryAt: new Date(now - 400 * 86_400_000),
    };
    const data = {
      run,
      spans: [],
      registeredServices: [],
      destinations: [],
      messageConnections: [],
      endpoints: [],
      failedTargetService: undefined,
    };
    const getRunFlowData = vi.fn().mockResolvedValue(data);
    const useCase = createGetRunFlowUseCase({
      ensureProject: async () => "project-1",
      getRunFlowData,
      telemetryQuietMs: () => 1000,
      telemetryMaxWaitMs: () => 1000,
      telemetryRetentionDays: () => 365,
      now: () => now,
    });
    expect((await useCase("old-run")).telemetryState).toBe("expired");
    getRunFlowData.mockResolvedValue({
      ...data,
      run: { ...run, firstTelemetryAt: null, lastTelemetryAt: null },
    });
    expect((await useCase("old-run")).telemetryState).toBe("unavailable");
    getRunFlowData.mockResolvedValue({
      ...data,
      spans: [
        {
          id: "span",
          projectId: "project-1",
          traceId: "trace-1",
          spanId: "span",
          parentSpanId: null,
          serviceName: "orders",
          operationName: "GET /orders",
          startTime: new Date(now - 1000),
          endTime: new Date(now),
          statusCode: "OK",
          attributes: {},
          receivedAt: new Date(now),
        },
      ],
    });
    expect((await useCase("old-run")).telemetryState).toBe("partial");
  });
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

  it("aggregates distinct client span durations by service pair, including parallel and failed calls", async () => {
    const now = 10_000;
    const run = {
      id: "run-timing",
      projectId: "project-1",
      mockApiId: "mock-1",
      traceId: "trace-timing",
      status: "completed" as const,
      responseStatus: 200,
      responseHeaders: null,
      responseBody: null,
      error: null,
      startedAt: new Date(now - 5_000),
      finishedAt: new Date(now - 4_000),
      lastTelemetryAt: new Date(now - 3_000),
    };
    const span = (
      spanId: string,
      serviceName: string,
      parentSpanId: string | null,
      start: number,
      end: number,
      kind: "CLIENT" | "SERVER",
      statusCode: string = "OK",
    ) => ({
      id: spanId.length,
      projectId: "project-1",
      traceId: "trace-timing",
      spanId,
      parentSpanId,
      serviceName,
      operationName: spanId,
      startTime: new Date(start),
      endTime: new Date(end),
      statusCode,
      attributes: { "span.kind": kind },
      receivedAt: new Date(end),
    });
    const getRunFlowData = vi.fn().mockResolvedValue({
      run,
      spans: [
        span("root", "orders", null, 0, 2_000, "SERVER"),
        span("client-1", "orders", "root", 100, 400, "CLIENT"),
        span("server-1", "inventory", "client-1", 110, 390, "SERVER"),
        span("client-2", "orders", "root", 200, 700, "CLIENT"),
        span("server-2", "inventory", "client-2", 210, 690, "SERVER"),
        span("client-failed", "orders", "root", 1_000, 1_150, "CLIENT", "ERROR"),
        span("server-failed", "inventory", "client-failed", 1_010, 1_140, "SERVER", "ERROR"),
      ],
      registeredServices: [
        { id: "orders", name: "Orders" },
        { id: "inventory", name: "Inventory" },
      ],
      destinations: [],
      messageConnections: [],
      endpoints: [],
      failedTargetService: undefined,
    });
    const flow = await createGetRunFlowUseCase({
      ensureProject: vi.fn().mockResolvedValue("project-1"),
      getRunFlowData,
      telemetryQuietMs: () => 100,
      telemetryMaxWaitMs: () => 5_000,
      now: () => now,
    })("run-timing");

    expect(flow.edges).toHaveLength(1);
    expect(flow.edges[0]?.timing).toEqual({
      totalDurationMs: 950,
      callDurationsMs: [300, 500, 150],
    });
    expect(flow.errorServices).toEqual(["Orders", "Inventory"]);
  });

  it("marks observed service pairs unavailable when no client span matches", async () => {
    const now = 10_000;
    const getRunFlowData = vi.fn().mockResolvedValue({
      run: {
        id: "run-missing-client",
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
        lastTelemetryAt: new Date(now - 800),
      },
      spans: [
        {
          id: 1,
          projectId: "project-1",
          traceId: "trace-1",
          spanId: "caller",
          parentSpanId: null,
          serviceName: "Orders",
          operationName: "request",
          startTime: new Date(now - 700),
          endTime: new Date(now - 600),
          statusCode: "OK",
          attributes: { "span.kind": "SERVER" },
          receivedAt: new Date(now - 500),
        },
        {
          id: 2,
          projectId: "project-1",
          traceId: "trace-1",
          spanId: "downstream",
          parentSpanId: "caller",
          serviceName: "Inventory",
          operationName: "request",
          startTime: new Date(now - 650),
          endTime: new Date(now - 620),
          statusCode: "OK",
          attributes: { "span.kind": "SERVER" },
          receivedAt: new Date(now - 500),
        },
      ],
      registeredServices: [
        { id: "orders", name: "Orders" },
        { id: "inventory", name: "Inventory" },
      ],
      destinations: [],
      messageConnections: [],
      endpoints: [],
      failedTargetService: undefined,
    });
    const flow = await createGetRunFlowUseCase({
      ensureProject: vi.fn().mockResolvedValue("project-1"),
      getRunFlowData,
      telemetryQuietMs: () => 100,
      telemetryMaxWaitMs: () => 5_000,
      now: () => now,
    })("run-missing-client");

    expect(flow.edges[0]?.timing).toEqual({ totalDurationMs: null, callDurationsMs: [] });
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
