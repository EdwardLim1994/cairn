import { eq } from "drizzle-orm";
import { createError } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import { closeDb, getDb } from "../db";
import { mockApis, projects, runs, serviceEndpoints, services, spans } from "../db/schema";

const connectionString = process.env.CAIRN_TEST_DATABASE_URL;
const integration = describe.skipIf(!connectionString);

integration("run detail and flow controllers with MySQL", () => {
  const projectId = "run-route-integration-project";
  let getRunRoute: (event: never) => Promise<unknown>;
  let flowRoute: (event: never) => Promise<unknown>;

  beforeAll(async () => {
    process.env.DATABASE_URL = connectionString;
    process.env.PROJECT_ID = projectId;
    process.env.OTEL_COLLECTOR_URL = "http://localhost:4318";
    process.env.TELEMETRY_QUIET_MS = "1000";
    process.env.TELEMETRY_MAX_WAIT_MS = "10000";
    const runtime = globalThis as unknown as {
      defineEventHandler: <T>(handler: T) => T;
      getRouterParam: (
        event: { context: { params?: Record<string, string> } },
        name: string,
      ) => string | undefined;
      createError: typeof createError;
    };
    runtime.defineEventHandler = (handler) => handler;
    runtime.getRouterParam = (event, name) => event.context.params?.[name];
    runtime.createError = createError;
    getRunRoute = (await import("./runs/[id].get")).default as typeof getRunRoute;
    flowRoute = (await import("./runs/[id]/flow.get")).default as typeof flowRoute;
  });

  beforeEach(async () => {
    await getDb().delete(projects).where(eq(projects.id, projectId));
    await getDb().insert(projects).values({ id: projectId });
  });

  afterAll(async () => {
    await getDb().delete(projects).where(eq(projects.id, projectId));
    await closeDb();
  });

  it("returns run details and a trace-correlated service flow", async () => {
    const now = new Date();
    const db = getDb();
    await db.insert(services).values([
      {
        id: "run-service-order",
        projectId,
        name: "Order Service",
        framework: "Spring Boot",
        baseUrl: "http://localhost:8081",
      },
      {
        id: "run-service-inventory",
        projectId,
        name: "Inventory Service",
        framework: ".NET",
        baseUrl: "http://localhost:8082",
      },
    ]);
    await db.insert(serviceEndpoints).values({
      id: "run-endpoint-order",
      projectId,
      serviceId: "run-service-order",
      name: "Create order",
      apiType: "REST",
      method: "POST",
      url: "/orders",
    });
    await db.insert(mockApis).values({
      id: "run-mock-api",
      projectId,
      name: "Create order",
      targetEndpointId: "run-endpoint-order",
      pathParameters: {},
      requestJson: {},
      description: "",
    });
    await db.insert(runs).values({
      id: "run-detail-1",
      projectId,
      mockApiId: "run-mock-api",
      traceId: "a".repeat(32),
      status: "failed",
      responseStatus: 500,
      error: "failed",
      startedAt: new Date(now.getTime() - 3000),
      finishedAt: now,
      lastTelemetryAt: new Date(now.getTime() - 2000),
    });
    await db.insert(spans).values([
      {
        projectId,
        traceId: "a".repeat(32),
        spanId: "1111111111111111",
        parentSpanId: null,
        serviceName: "order-service",
        operationName: "POST /orders",
        startTime: new Date(now.getTime() - 2500),
        endTime: new Date(now.getTime() - 2200),
        statusCode: "UNSET",
        attributes: {},
      },
      {
        projectId,
        traceId: "a".repeat(32),
        spanId: "2222222222222222",
        parentSpanId: "1111111111111111",
        serviceName: "inventory-service",
        operationName: "GET /inventory",
        startTime: new Date(now.getTime() - 2100),
        endTime: new Date(now.getTime() - 1900),
        statusCode: "ERROR",
        attributes: { "http.response.status_code": 500 },
      },
    ]);

    await expect(
      getRunRoute({ context: { params: { id: "run-detail-1" } } } as never),
    ).resolves.toMatchObject({ id: "run-detail-1", status: "failed", traceId: "a".repeat(32) });
    await expect(
      flowRoute({ context: { params: { id: "run-detail-1" } } } as never),
    ).resolves.toMatchObject({
      runId: "run-detail-1",
      status: "complete",
      incomplete: false,
      edges: [{ sourceService: "Order Service", targetService: "Inventory Service" }],
      errorServices: ["Inventory Service", "Order Service"],
    });
  });

  it("returns 404 for missing run detail and flow records", async () => {
    await expect(
      getRunRoute({ context: { params: { id: "missing" } } } as never),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      flowRoute({ context: { params: { id: "missing" } } } as never),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
