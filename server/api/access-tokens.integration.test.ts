import { eq } from "drizzle-orm";
import { createError } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import { closeDb, getDb } from "../db";
import { projects } from "../db/schema";
import { digestAccessToken } from "../use-cases/otel-access-tokens/token";
import { hasValidOtelAccessToken } from "../repositories/otel-access-tokens";

const integrationEnabled = process.env.CAIRN_RUN_INTEGRATION;
const integration = describe.skipIf(!integrationEnabled);

integration("OpenTelemetry access-token APIs with embedded stores", () => {
  const projectId = "access-token-api-integration-project";
  let listRoute: () => Promise<unknown>;
  let createRoute: (event: never) => Promise<{ id: string; token: string }>;
  let deleteRoute: (event: never) => Promise<unknown>;

  beforeAll(async () => {
    process.env.PROJECT_ID = projectId;
    process.env.OTEL_COLLECTOR_URL = "http://localhost:4318";
    const runtime = globalThis as unknown as {
      defineEventHandler: <T>(handler: T) => T;
      readBody: (event: { context: { body: unknown } }) => unknown;
      getRouterParams: (event: {
        context: { params: Record<string, string> };
      }) => Record<string, string>;
      createError: typeof createError;
    };
    runtime.defineEventHandler = (handler) => handler;
    runtime.readBody = (event) => event.context.body;
    runtime.getRouterParams = (event) => event.context.params;
    runtime.createError = createError;
    listRoute = (await import("./access-tokens/index.get")).default as typeof listRoute;
    createRoute = (await import("./access-tokens/index.post")).default as typeof createRoute;
    deleteRoute = (await import("./access-tokens/[id].delete")).default as typeof deleteRoute;
  });

  beforeEach(async () => {
    await getDb().delete(projects).where(eq(projects.id, projectId));
    await getDb().insert(projects).values({ id: projectId });
  });

  afterAll(async () => {
    await getDb().delete(projects).where(eq(projects.id, projectId));
    await closeDb();
  });

  it("creates, lists metadata, and revokes only within configured project", async () => {
    const created = await createRoute({
      context: {
        body: {
          name: "collector",
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        },
      },
    } as never);
    expect(created.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const listed = (await listRoute()) as Array<Record<string, unknown>>;
    expect(listed).toMatchObject([{ id: created.id, name: "collector", expired: false }]);
    expect(JSON.stringify(listed)).not.toContain(created.token);
    expect(JSON.stringify(listed)).not.toContain(digestAccessToken(created.token));
    await expect(
      deleteRoute({ context: { params: { id: created.id } } } as never),
    ).resolves.toEqual({ deleted: true });
    expect(await hasValidOtelAccessToken(projectId, digestAccessToken(created.token))).toBe(false);
  });

  it("rejects invalid details and unknown token IDs", async () => {
    await expect(
      createRoute({ context: { body: { name: "", expiresAt: "invalid" } } } as never),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      deleteRoute({ context: { params: { id: "unknown" } } } as never),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("does not expose or revoke tokens from another project", async () => {
    const created = await createRoute({
      context: {
        body: { name: "scoped", expiresAt: new Date(Date.now() + 86_400_000).toISOString() },
      },
    } as never);
    process.env.PROJECT_ID = "other-access-token-project";
    expect(await listRoute()).toEqual([]);
    await expect(
      deleteRoute({ context: { params: { id: created.id } } } as never),
    ).rejects.toMatchObject({ statusCode: 404 });
    process.env.PROJECT_ID = projectId;
  });
});
