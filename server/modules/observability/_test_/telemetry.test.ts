import { describe, expect, it, vi } from "vite-plus/test";
import { createListLogsUseCase } from "../../../use-cases/telemetry/list-logs";
import { createIngestOtlpLogsUseCase } from "../../../use-cases/telemetry/ingest-otlp-logs";
import { createIngestOtlpTracesUseCase } from "../../../use-cases/telemetry/ingest-otlp-traces";

const resourceAttribute = (key: string, stringValue: string) => ({ key, value: { stringValue } });

describe("telemetry endpoint use cases", () => {
  it("filters and normalizes logs using service and severity aliases", async () => {
    const date = new Date("2026-10-30T00:00:00.000Z");
    const queryLogs = vi.fn().mockResolvedValue({
      registeredServices: [{ name: "Order Service" }],
      records: [
        {
          id: 1,
          projectId: "project-1",
          traceId: null,
          serviceName: "order-service",
          severity: "INFORMATION",
          timestamp: date,
          message: "order created",
          attributes: {},
          receivedAt: date,
        },
      ],
    });
    const useCase = createListLogsUseCase({
      ensureProject: vi.fn().mockResolvedValue("project-1"),
      queryLogs,
    });
    await expect(
      useCase({ service: "Order Service", severity: "info", search: " order " }),
    ).resolves.toMatchObject([
      { serviceName: "Order Service", severity: "INFO", message: "order created" },
    ]);
    expect(queryLogs).toHaveBeenCalledWith("project-1", {
      severities: ["INFO", "INFORMATION"],
      search: "order",
    });
  });

  it("normalizes OTLP logs and skips records from a different project", async () => {
    const insertLogs = vi.fn().mockResolvedValue(undefined);
    const events: string[] = [];
    const useCase = createIngestOtlpLogsUseCase({
      ensureProject: vi.fn(async () => {
        events.push("ensure-project");
        return "project-1";
      }),
      configuredProjectId: () => "project-1",
      listServiceNames: vi.fn(async () => {
        events.push("list-services");
        return [{ name: "Order Service" }];
      }),
      insertLogs: vi.fn(async (...args) => {
        events.push("insert-logs");
        await insertLogs(...args);
      }),
    });
    const result = await useCase({
      resourceLogs: [
        {
          resource: { attributes: [resourceAttribute("service.name", "order-service")] },
          scopeLogs: [
            {
              logRecords: [
                {
                  traceId: "a".repeat(32),
                  severityText: "INFORMATION",
                  timeUnixNano: "1000000",
                  body: { stringValue: "created" },
                  attributes: [],
                },
              ],
            },
          ],
        },
        {
          resource: { attributes: [resourceAttribute("project.id", "other")] },
          scopeLogs: [
            { logRecords: [{ timeUnixNano: "1000000", body: { stringValue: "ignore" } }] },
          ],
        },
      ],
    });
    expect(result).toEqual({ accepted: 1 });
    expect(insertLogs).toHaveBeenCalledWith([
      expect.objectContaining({
        projectId: "project-1",
        serviceName: "Order Service",
        severity: "INFO",
        message: "created",
      }),
    ]);
    expect(events).toEqual(["ensure-project", "list-services", "insert-logs"]);
  });

  it("normalizes OTLP spans, status, and attributes before persistence", async () => {
    const insertSpans = vi.fn().mockResolvedValue(undefined);
    const events: string[] = [];
    const useCase = createIngestOtlpTracesUseCase({
      ensureProject: vi.fn(async () => {
        events.push("ensure-project");
        return "project-1";
      }),
      configuredProjectId: () => "project-1",
      insertSpans: vi.fn(async (...args) => {
        events.push("insert-spans");
        await insertSpans(...args);
      }),
    });
    const result = await useCase({
      resourceSpans: [
        {
          resource: { attributes: [resourceAttribute("service.name", "inventory-service")] },
          scopeSpans: [
            {
              spans: [
                {
                  traceId: "a".repeat(32),
                  spanId: "b".repeat(16),
                  parentSpanId: "c".repeat(16),
                  name: "GET /inventory",
                  kind: 3,
                  startTimeUnixNano: "1000000",
                  endTimeUnixNano: "2000000",
                  status: { code: 2 },
                  attributes: [
                    { key: "http.status_code", value: { intValue: "500" } },
                    { key: "messaging.system", value: { stringValue: "kafka" } },
                    { key: "messaging.destination.name", value: { stringValue: "orders" } },
                    { key: "messaging.operation.type", value: { stringValue: "publish" } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(result).toEqual({ accepted: 1 });
    expect(insertSpans).toHaveBeenCalledWith([
      expect.objectContaining({
        projectId: "project-1",
        traceId: "a".repeat(32),
        serviceName: "inventory-service",
        statusCode: "ERROR",
        attributes: {
          "http.status_code": 500,
          "messaging.system": "kafka",
          "messaging.destination.name": "orders",
          "messaging.operation.type": "publish",
          "span.kind": "CLIENT",
        },
      }),
    ]);
    expect(events).toEqual(["ensure-project", "insert-spans"]);
  });

  it("normalizes server span kinds and leaves missing kinds absent", async () => {
    const insertSpans = vi.fn().mockResolvedValue(undefined);
    const useCase = createIngestOtlpTracesUseCase({
      ensureProject: vi.fn().mockResolvedValue("project-1"),
      configuredProjectId: () => "project-1",
      insertSpans,
    });
    const span = (spanId: string, kind?: string) => ({
      traceId: "a".repeat(32),
      spanId: spanId.repeat(16),
      name: "request",
      startTimeUnixNano: "1000000",
      endTimeUnixNano: "2000000",
      status: { code: 1 },
      ...(kind ? { kind } : {}),
      attributes: [],
    });

    await useCase({
      resourceSpans: [
        {
          resource: { attributes: [resourceAttribute("service.name", "inventory-service")] },
          scopeSpans: [{ spans: [span("b", "SERVER"), span("c")] }],
        },
      ],
    });

    expect(insertSpans.mock.calls[0]?.[0]).toMatchObject([
      { attributes: { "span.kind": "SERVER" } },
      { attributes: {} },
    ]);
  });
});
