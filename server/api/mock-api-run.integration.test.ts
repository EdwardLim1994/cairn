import { eq } from "drizzle-orm";
import { createError } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { closeDb, getDb } from "../db";
import {
  environmentVariables,
  logs,
  mockApis,
  projects,
  runs,
  serviceEndpoints,
  services,
} from "../db/schema";

const connectionString = process.env.CAIRN_TEST_DATABASE_URL;
const integration = describe.skipIf(!connectionString);

integration("mock API run controller with MySQL and deterministic service stubs", () => {
  const projectId = "mock-run-route-integration-project";
  const fetchStub = vi.fn<typeof fetch>();
  let runRoute: (event: never) => Promise<unknown>;

  beforeAll(async () => {
    process.env.DATABASE_URL = connectionString;
    process.env.PROJECT_ID = projectId;
    process.env.OTEL_COLLECTOR_URL = "http://localhost:4318";
    process.env.OUTBOUND_REQUEST_TIMEOUT_MS = "8";
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
    globalThis.fetch = fetchStub;
    runRoute = (await import("./mock-apis/[id]/runs.post")).default as typeof runRoute;
  });

  beforeEach(async () => {
    fetchStub.mockReset();
    await getDb().delete(projects).where(eq(projects.id, projectId));
    const db = getDb();
    await db.insert(projects).values({ id: projectId });
    await db.insert(services).values({
      id: "mock-run-service",
      projectId,
      name: "order-service",
      framework: "Spring Boot",
      baseUrl: "http://localhost:8081",
    });
    await db.insert(serviceEndpoints).values({
      id: "mock-run-endpoint",
      projectId,
      serviceId: "mock-run-service",
      name: "Create order",
      apiType: "REST",
      method: "POST",
      url: "/orders",
    });
    await db.insert(mockApis).values({
      id: "mock-run-api",
      projectId,
      name: "Create order",
      targetEndpointId: "mock-run-endpoint",
      pathParameters: {},
      requestJson: { token: "{{API_TOKEN}}" },
      description: "",
    });
    await db.insert(environmentVariables).values({
      id: "mock-run-variable",
      projectId,
      name: "API_TOKEN",
      value: "test-token",
    });
  });

  afterAll(async () => {
    await getDb().delete(projects).where(eq(projects.id, projectId));
    await closeDb();
  });

  it("persists a successful outbound request and its response", async () => {
    fetchStub.mockResolvedValue(new Response("created", { status: 201 }));
    const result = (await runRoute({ context: { params: { id: "mock-run-api" } } } as never)) as {
      id: string;
      status: string;
      responseBody: string;
    };
    expect(result).toMatchObject({
      status: "completed",
      responseBody: "created",
      responseStatus: 201,
    });
    expect(fetchStub).toHaveBeenCalledWith(
      "http://localhost:8081/orders",
      expect.objectContaining({ body: JSON.stringify({ token: "test-token" }) }),
    );
    await expect(
      getDb().select().from(runs).where(eq(runs.projectId, projectId)),
    ).resolves.toMatchObject([
      { id: result.id, status: "completed", responseStatus: 201, responseBody: "created" },
    ]);
    await expect(getDb().select().from(logs).where(eq(logs.projectId, projectId))).resolves.toEqual(
      [],
    );
  });

  it("returns and logs full HTTP failure details", async () => {
    fetchStub.mockResolvedValue(new Response('{"error":"bad order"}', { status: 400 }));
    const result = (await runRoute({ context: { params: { id: "mock-run-api" } } } as never)) as {
      id: string;
      traceId: string;
      status: string;
      error: string;
    };
    expect(result).toMatchObject({
      status: "failed",
      error: 'Target returned HTTP 400: {"error":"bad order"}',
    });
    await expect(
      getDb().select().from(logs).where(eq(logs.projectId, projectId)),
    ).resolves.toMatchObject([
      {
        traceId: result.traceId,
        serviceName: "order-service",
        severity: "ERROR",
        message: expect.stringContaining('Target returned HTTP 400: {"error":"bad order"}'),
      },
    ]);
  });

  it("marks and logs outbound timeouts", async () => {
    fetchStub.mockImplementation(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const result = (await runRoute({ context: { params: { id: "mock-run-api" } } } as never)) as {
      id: string;
      status: string;
      error: string;
    };
    expect(result).toMatchObject({
      status: "failed",
      error: "Target request timed out after 8 ms",
    });
    await expect(
      getDb().select().from(runs).where(eq(runs.projectId, projectId)),
    ).resolves.toMatchObject([{ id: result.id, status: "failed", error: result.error }]);
    await expect(
      getDb().select().from(logs).where(eq(logs.projectId, projectId)),
    ).resolves.toMatchObject([
      { severity: "ERROR", message: expect.stringContaining("Target request timed out") },
    ]);
  });
});
