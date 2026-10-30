import { eq } from "drizzle-orm";
import { createError } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { closeDb, getDb } from "../../db";
import { logs, projects, runs, services, spans } from "../../db/schema";

vi.mock("../../utils/otlp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../utils/otlp")>()),
  readOtlpBody: async (event: { context: { body?: unknown } }) => event.context.body,
}));

const connectionString = process.env.CAIRN_TEST_DATABASE_URL;
const integration = describe.skipIf(!connectionString);

integration("log query and OTLP controllers with MySQL", () => {
  const projectId = "telemetry-route-integration-project";
  let logsRoute: (event: never) => Promise<unknown>;
  let ingestLogsRoute: (event: never) => Promise<unknown>;
  let ingestTracesRoute: (event: never) => Promise<unknown>;

  beforeAll(async () => {
    process.env.DATABASE_URL = connectionString;
    process.env.PROJECT_ID = projectId;
    process.env.OTEL_COLLECTOR_URL = "http://localhost:4318";
    const runtime = globalThis as unknown as {
      defineEventHandler: <T>(handler: T) => T;
      getQuery: (event: {
        context: { query?: Record<string, unknown> };
      }) => Record<string, unknown>;
      createError: typeof createError;
    };
    runtime.defineEventHandler = (handler) => handler;
    runtime.getQuery = (event) => event.context.query ?? {};
    runtime.createError = createError;
    logsRoute = (await import("../../api/logs.get")).default as typeof logsRoute;
    ingestLogsRoute = (await import("./logs.post")).default as typeof ingestLogsRoute;
    ingestTracesRoute = (await import("./traces.post")).default as typeof ingestTracesRoute;
  });

  beforeEach(async () => {
    await getDb().delete(projects).where(eq(projects.id, projectId));
    const db = getDb();
    await db.insert(projects).values({ id: projectId });
    await db.insert(services).values({
      id: "telemetry-order-service",
      projectId,
      name: "Order Service",
      framework: "Spring Boot",
      baseUrl: "http://localhost:8081",
    });
  });

  afterAll(async () => {
    await getDb().delete(projects).where(eq(projects.id, projectId));
    await closeDb();
  });

  it("filters logs by severity, service, and search", async () => {
    const db = getDb();
    await db.insert(logs).values([
      {
        projectId,
        traceId: null,
        serviceName: "order-service",
        severity: "INFORMATION",
        timestamp: new Date(),
        message: "order ready",
        attributes: {},
      },
      {
        projectId,
        traceId: null,
        serviceName: "other",
        severity: "ERROR",
        timestamp: new Date(),
        message: "order failed",
        attributes: {},
      },
    ]);
    const result = await logsRoute({
      context: { query: { service: "Order Service", severity: "info", search: "ready" } },
    } as never);
    expect(result).toMatchObject([
      { serviceName: "Order Service", severity: "INFO", message: "order ready" },
    ]);
  });

  it("normalizes and stores OTLP logs", async () => {
    const body = {
      resourceLogs: [
        {
          resource: {
            attributes: [
              { key: "service.name", value: { stringValue: "order-service" } },
              { key: "project.id", value: { stringValue: projectId } },
            ],
          },
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
      ],
    };
    await expect(ingestLogsRoute({ context: { body } } as never)).resolves.toEqual({ accepted: 1 });
    await expect(
      getDb().select().from(logs).where(eq(logs.projectId, projectId)),
    ).resolves.toMatchObject([
      {
        serviceName: "Order Service",
        severity: "INFO",
        message: "created",
        traceId: "a".repeat(32),
      },
    ]);
  });

  it("stores OTLP spans idempotently and correlates run telemetry", async () => {
    const traceId = "b".repeat(32);
    const now = new Date();
    await getDb().insert(runs).values({
      id: "telemetry-run",
      projectId,
      traceId,
      status: "running",
      startedAt: now,
    });
    const body = {
      resourceSpans: [
        {
          resource: {
            attributes: [
              { key: "service.name", value: { stringValue: "order-service" } },
              { key: "project.id", value: { stringValue: projectId } },
            ],
          },
          scopeSpans: [
            {
              spans: [
                {
                  traceId,
                  spanId: "c".repeat(16),
                  name: "GET /orders",
                  startTimeUnixNano: "1000000",
                  endTimeUnixNano: "2000000",
                  status: { code: 1 },
                  attributes: [],
                },
              ],
            },
          ],
        },
      ],
    };
    await expect(ingestTracesRoute({ context: { body } } as never)).resolves.toEqual({
      accepted: 1,
    });
    await expect(ingestTracesRoute({ context: { body } } as never)).resolves.toEqual({
      accepted: 1,
    });
    await expect(
      getDb().select().from(spans).where(eq(spans.projectId, projectId)),
    ).resolves.toHaveLength(1);
    await expect(
      getDb().select().from(runs).where(eq(runs.projectId, projectId)),
    ).resolves.toMatchObject([{ id: "telemetry-run", lastTelemetryAt: expect.any(Date) }]);
  });

  it("rejects malformed OTLP contracts", async () => {
    await expect(
      ingestLogsRoute({ context: { body: { resourceLogs: "invalid" } } } as never),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
