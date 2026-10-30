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
      registeredServices: [{ name: "Order Service" }, { name: "Inventory Service" }],
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
});
