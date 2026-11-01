import { eq } from "drizzle-orm";
import { createError } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { closeDb, getDb } from "../db";
import { environmentVariables, headerTemplates, projects } from "../db/schema";

const connectionString = process.env.CAIRN_TEST_DATABASE_URL;
const integration = describe.skipIf(!connectionString);

integration("service REST controllers with MySQL", () => {
  const projectId = "service-route-integration-project";
  const fetchStub = vi.fn().mockResolvedValue({ ok: true });
  let listRoute: (event: never) => Promise<unknown>;
  let createRoute: (event: never) => Promise<unknown>;
  let updateRoute: (event: never) => Promise<unknown>;
  let deleteRoute: (event: never) => Promise<unknown>;
  let healthRoute: (event: never) => Promise<unknown>;

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
    globalThis.fetch = fetchStub as typeof fetch;
    listRoute = (await import("./services/index.get")).default as typeof listRoute;
    createRoute = (await import("./services/index.post")).default as typeof createRoute;
    updateRoute = (await import("./services/[id].put")).default as typeof updateRoute;
    deleteRoute = (await import("./services/[id].delete")).default as typeof deleteRoute;
    healthRoute = (await import("./services/health.get")).default as typeof healthRoute;
  });

  beforeEach(async () => {
    fetchStub.mockClear();
    await getDb().delete(projects).where(eq(projects.id, projectId));
  });

  afterAll(async () => {
    await getDb().delete(projects).where(eq(projects.id, projectId));
    await closeDb();
  });

  it("lists an empty service collection", async () => {
    await expect(listRoute({} as never)).resolves.toEqual([]);
  });

  it("creates and updates a service with its endpoints", async () => {
    const created = (await createRoute({
      context: {
        body: {
          name: "Orders",
          framework: "Spring Boot",
          baseUrl: "http://localhost:8081",
          positionX: 12,
          positionY: 13,
          endpoints: [{ name: "List orders", apiType: "REST", method: "GET", url: "/orders" }],
        },
      },
    } as never)) as { id: string };
    const initial = (await listRoute({} as never)) as Array<{
      id: string;
      positionX: number;
      endpoints: Array<{ id: string; name: string }>;
    }>;
    const endpointId = initial[0]?.endpoints[0]?.id;
    expect(created.id).toBeTruthy();
    expect(initial[0]).toMatchObject({ id: created.id, positionX: 12 });
    expect(endpointId).toBeTruthy();

    await expect(
      updateRoute({
        context: {
          params: { id: created.id },
          body: {
            name: "Orders updated",
            framework: "Spring Boot",
            baseUrl: "http://localhost:8081",
            endpoints: [
              {
                id: endpointId,
                name: "List all orders",
                apiType: "REST",
                method: "GET",
                url: "/orders",
              },
            ],
          },
        },
      } as never),
    ).resolves.toEqual({ id: created.id });
    const updated = (await listRoute({} as never)) as Array<{
      name: string;
      endpoints: Array<{ name: string }>;
    }>;
    expect(updated[0]).toMatchObject({
      name: "Orders updated",
      endpoints: [{ name: "List all orders" }],
    });
  });

  it("rejects endpoint ids owned by a different service", async () => {
    const created = (await createRoute({
      context: {
        body: {
          name: "Orders",
          framework: "Spring Boot",
          baseUrl: "http://localhost:8081",
          endpoints: [],
        },
      },
    } as never)) as { id: string };
    await expect(
      updateRoute({
        context: {
          params: { id: created.id },
          body: {
            name: "Orders",
            framework: "Spring Boot",
            baseUrl: "http://localhost:8081",
            endpoints: [
              {
                id: "belongs-elsewhere",
                name: "Foreign",
                apiType: "REST",
                method: "GET",
                url: "/",
              },
            ],
          },
        },
      } as never),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("deletes services and returns 404 for missing ids", async () => {
    const created = (await createRoute({
      context: {
        body: {
          name: "Orders",
          framework: "Spring Boot",
          baseUrl: "http://localhost:8081",
          endpoints: [],
        },
      },
    } as never)) as { id: string };
    await expect(
      deleteRoute({ context: { params: { id: created.id } } } as never),
    ).resolves.toEqual({ id: created.id });
    await expect(
      deleteRoute({ context: { params: { id: created.id } } } as never),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("checks health using the framework-specific endpoint", async () => {
    await createRoute({
      context: {
        body: {
          name: "Orders",
          framework: "Spring Boot",
          baseUrl: "http://localhost:8081",
          endpoints: [],
        },
      },
    } as never);
    const result = await healthRoute({} as never);
    expect(result).toEqual([{ id: expect.any(String), online: true }]);
    expect(fetchStub).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/actuator/health" }),
      expect.any(Object),
    );
  });

  it("checks Other services with scoped templates and shared variables", async () => {
    await getDb().insert(projects).values({ id: projectId });
    await getDb()
      .insert(headerTemplates)
      .values({
        id: "service-health-template",
        projectId,
        name: "Health auth",
        headers: [{ name: "X-Health", value: "ready" }],
      });
    await getDb().insert(environmentVariables).values({
      id: "service-health-variable",
      projectId,
      name: "apiKey",
      value: "secret",
    });
    await createRoute({
      context: {
        body: {
          name: "Custom",
          framework: "Other",
          baseUrl: "http://localhost:8082",
          healthCheckUrl: "https://health.example/status",
          healthCheckHeaderTemplateId: "service-health-template",
          healthCheckCustomHeaders: [{ name: "X-API-Key", value: "{{apiKey}}" }],
          endpoints: [],
        },
      },
    } as never);
    const health = await healthRoute({} as never);
    expect(health).toHaveLength(1);
    expect(fetchStub).toHaveBeenCalledWith(
      "https://health.example/status",
      expect.objectContaining({
        method: "GET",
        headers: { "X-Health": "ready", "X-API-Key": "secret" },
      }),
    );
  });
});
