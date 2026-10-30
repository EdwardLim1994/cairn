import { eq } from "drizzle-orm";
import { createError } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import { closeDb, getDb } from "../db";
import { projects, serviceEndpoints, services } from "../db/schema";
import { ensureProject } from "../utils/project";

const connectionString = process.env.CAIRN_TEST_DATABASE_URL;
const integration = describe.skipIf(!connectionString);

integration("canvas REST controllers with MySQL", () => {
  const projectId = "canvas-route-integration-project";
  let getCanvasRoute: (event: never) => Promise<unknown>;
  let putCanvasRoute: (event: never) => Promise<unknown>;

  beforeAll(async () => {
    process.env.DATABASE_URL = connectionString;
    process.env.PROJECT_ID = projectId;
    process.env.OTEL_COLLECTOR_URL = "http://localhost:4318";
    const runtime = globalThis as unknown as {
      defineEventHandler: <T>(handler: T) => T;
      readBody: (event: { context: { body?: unknown } }) => Promise<unknown>;
      createError: typeof createError;
    };
    runtime.defineEventHandler = (handler) => handler;
    runtime.readBody = async (event) => event.context.body;
    runtime.createError = createError;
    getCanvasRoute = (await import("./canvas.get")).default as typeof getCanvasRoute;
    putCanvasRoute = (await import("./canvas.put")).default as typeof putCanvasRoute;
  });

  beforeEach(async () => {
    await getDb().delete(projects).where(eq(projects.id, projectId));
  });

  afterAll(async () => {
    await getDb().delete(projects).where(eq(projects.id, projectId));
    await closeDb();
  });

  it("GET initializes and returns an empty persisted canvas", async () => {
    const result = (await getCanvasRoute({} as never)) as {
      viewport: { x: number; y: number; zoom: number };
      services: unknown[];
      edges: unknown[];
    };

    expect(result.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(result.services).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it("PUT persists the canvas and GET returns the saved state", async () => {
    await ensureProject();
    const db = getDb();
    await db.insert(services).values([
      {
        id: "canvas-route-source",
        projectId,
        name: "Source",
        framework: "Spring Boot",
        baseUrl: "http://localhost:8081",
      },
      {
        id: "canvas-route-target",
        projectId,
        name: "Target",
        framework: ".NET",
        baseUrl: "http://localhost:8082",
      },
    ]);
    await db.insert(serviceEndpoints).values({
      id: "canvas-route-endpoint",
      projectId,
      serviceId: "canvas-route-target",
      name: "Target endpoint",
      apiType: "REST",
      method: "POST",
      url: "/target",
    });
    const body = {
      viewport: { x: 3, y: 4, zoom: 1.5 },
      mockNode: { x: 5, y: 6 },
      services: [{ id: "canvas-route-source", x: 7, y: 8 }],
      edges: [
        { sourceServiceId: "canvas-route-source", targetEndpointId: "canvas-route-endpoint" },
      ],
    };

    await expect(putCanvasRoute({ context: { body } } as never)).resolves.toEqual({ saved: true });
    const saved = (await getCanvasRoute({} as never)) as {
      viewport: { x: number; y: number; zoom: number };
      mockNode: { x: number; y: number };
      services: Array<{ id: string; positionX: number; positionY: number }>;
      edges: unknown[];
    };
    expect(saved.viewport).toEqual(body.viewport);
    expect(saved.mockNode).toEqual(body.mockNode);
    expect(saved.services.find(({ id }) => id === "canvas-route-source")).toMatchObject({
      positionX: 7,
      positionY: 8,
    });
    expect(saved.edges).toHaveLength(1);
  });

  it("PUT rejects malformed payloads with HTTP 400 before persistence", async () => {
    await expect(
      putCanvasRoute({ context: { body: { viewport: {}, services: [], edges: [] } } } as never),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
