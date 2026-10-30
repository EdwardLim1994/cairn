import { eq } from "drizzle-orm";
import { createError } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import { closeDb, getDb } from "../db";
import { projects, serviceEndpoints, services } from "../db/schema";

const connectionString = process.env.CAIRN_TEST_DATABASE_URL;
const integration = describe.skipIf(!connectionString);

integration("mock API REST controllers with MySQL", () => {
  const projectId = "mock-api-route-integration-project";
  let listRoute: (event: never) => Promise<unknown>;
  let createRoute: (event: never) => Promise<unknown>;
  let updateRoute: (event: never) => Promise<unknown>;
  let deleteRoute: (event: never) => Promise<unknown>;

  beforeAll(async () => {
    process.env.DATABASE_URL = connectionString;
    process.env.PROJECT_ID = projectId;
    process.env.OTEL_COLLECTOR_URL = "http://localhost:4318";
    const runtime = globalThis as unknown as {
      defineEventHandler: <T>(handler: T) => T;
      readBody: (event: { context: { body?: unknown } }) => Promise<unknown>;
      getRouterParam: (
        event: { context: { params?: Record<string, string> } },
        name: string,
      ) => string | undefined;
      createError: typeof createError;
    };
    runtime.defineEventHandler = (handler) => handler;
    runtime.readBody = async (event) => event.context.body;
    runtime.getRouterParam = (event, name) => event.context.params?.[name];
    runtime.createError = createError;
    listRoute = (await import("./mock-apis/index.get")).default as typeof listRoute;
    createRoute = (await import("./mock-apis/index.post")).default as typeof createRoute;
    updateRoute = (await import("./mock-apis/[id].put")).default as typeof updateRoute;
    deleteRoute = (await import("./mock-apis/[id].delete")).default as typeof deleteRoute;
  });

  beforeEach(async () => {
    await getDb().delete(projects).where(eq(projects.id, projectId));
  });

  afterAll(async () => {
    await getDb().delete(projects).where(eq(projects.id, projectId));
    await closeDb();
  });

  async function registerEndpoint() {
    await getDb().insert(projects).values({ id: projectId });
    await getDb().insert(services).values({
      id: "mock-api-service",
      projectId,
      name: "Orders",
      framework: "Spring Boot",
      baseUrl: "http://localhost:8081",
    });
    await getDb().insert(serviceEndpoints).values({
      id: "mock-api-endpoint",
      projectId,
      serviceId: "mock-api-service",
      name: "Get order",
      apiType: "REST",
      method: "GET",
      url: "/orders/{orderId}",
    });
  }

  const input = {
    name: "Get order 10",
    targetEndpointId: "mock-api-endpoint",
    pathParameters: { orderId: "10" },
    requestJson: { includeItems: true },
    description: "Read an order",
  };

  it("lists no mock APIs for a new project", async () => {
    await expect(listRoute({} as never)).resolves.toEqual([]);
  });

  it("creates, lists, updates, and deletes a mock API", async () => {
    await registerEndpoint();
    const created = (await createRoute({ context: { body: input } } as never)) as { id: string };
    const createdList = (await listRoute({} as never)) as Array<{ id: string; name: string }>;
    expect(createdList).toMatchObject([{ id: created.id, name: input.name }]);

    await expect(
      updateRoute({
        context: { params: { id: created.id }, body: { ...input, name: "Updated order" } },
      } as never),
    ).resolves.toEqual({ id: created.id });
    await expect(
      deleteRoute({ context: { params: { id: created.id } } } as never),
    ).resolves.toEqual({ id: created.id });
    await expect(listRoute({} as never)).resolves.toEqual([]);
  });

  it("rejects endpoint ownership and path parameter mismatches", async () => {
    await registerEndpoint();
    await expect(
      createRoute({
        context: { body: { ...input, targetEndpointId: "foreign-endpoint" } },
      } as never),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      createRoute({
        context: { body: { ...input, pathParameters: { otherId: "10" } } },
      } as never),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("returns 404 when updating or deleting a missing mock API", async () => {
    await registerEndpoint();
    await expect(
      updateRoute({ context: { params: { id: "missing" }, body: input } } as never),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      deleteRoute({ context: { params: { id: "missing" } } } as never),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
