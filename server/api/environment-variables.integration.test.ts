import { eq } from "drizzle-orm";
import { createError } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import { closeDb, getDb } from "../db";
import { projects } from "../db/schema";

const connectionString = process.env.CAIRN_TEST_DATABASE_URL;
const integration = describe.skipIf(!connectionString);

integration("environment variable REST controllers with MySQL", () => {
  const projectId = "environment-variable-route-integration-project";
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
    listRoute = (await import("./environment-variables/index.get")).default as typeof listRoute;
    createRoute = (await import("./environment-variables/index.post"))
      .default as typeof createRoute;
    updateRoute = (await import("./environment-variables/[id].put")).default as typeof updateRoute;
    deleteRoute = (await import("./environment-variables/[id].delete"))
      .default as typeof deleteRoute;
  });

  beforeEach(async () => {
    await getDb().delete(projects).where(eq(projects.id, projectId));
  });

  afterAll(async () => {
    await getDb().delete(projects).where(eq(projects.id, projectId));
    await closeDb();
  });

  it("creates, lists, updates, and deletes shared variables", async () => {
    const created = (await createRoute({
      context: { body: { name: "API_TOKEN", value: "first" } },
    } as never)) as { id: string };
    await expect(listRoute({} as never)).resolves.toMatchObject([
      { id: created.id, projectId, name: "API_TOKEN", value: "first" },
    ]);
    await expect(
      updateRoute({
        context: { params: { id: created.id }, body: { name: "API_TOKEN", value: "second" } },
      } as never),
    ).resolves.toEqual({ id: created.id });
    await expect(listRoute({} as never)).resolves.toMatchObject([{ value: "second" }]);
    await expect(
      deleteRoute({ context: { params: { id: created.id } } } as never),
    ).resolves.toEqual({ id: created.id });
    await expect(listRoute({} as never)).resolves.toEqual([]);
  });

  it("rejects duplicate names and missing update targets", async () => {
    const created = (await createRoute({
      context: { body: { name: "TOKEN", value: "one" } },
    } as never)) as { id: string };
    await expect(
      createRoute({ context: { body: { name: "TOKEN", value: "two" } } } as never),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      updateRoute({
        context: { params: { id: "missing" }, body: { name: "OTHER", value: "two" } },
      } as never),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      updateRoute({
        context: { params: { id: created.id }, body: { name: "INVALID NAME", value: "two" } },
      } as never),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
