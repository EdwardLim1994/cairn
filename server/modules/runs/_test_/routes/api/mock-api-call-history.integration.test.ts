import { eq } from "drizzle-orm";
import { createError } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import { closeDb, getDb } from "../../../../../db";
import { readLogs, readSpans, writeLogs, writeSpans } from "../../../../../db/telemetry";
import { mockApiCallHistory, projects, runs } from "../../../../../db/schema";

const integrationEnabled = process.env.CAIRN_RUN_INTEGRATION;
const integration = describe.skipIf(!integrationEnabled);

integration("mock API call history controllers with embedded stores", () => {
  const projectId = "mock-history-route-project";
  const otherProjectId = "mock-history-other-project";
  let listRoute: (event: never) => Promise<unknown>;
  let deleteRoute: (event: never) => Promise<unknown>;
  let clearRoute: (event: never) => Promise<unknown>;

  beforeAll(async () => {
    process.env.PROJECT_ID = projectId;
    process.env.OTEL_COLLECTOR_URL = "http://localhost:4318";
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
    listRoute = (await import("../../../../../api/mock-api-call-history/index.get"))
      .default as typeof listRoute;
    deleteRoute = (await import("../../../../../api/mock-api-call-history/[id].delete"))
      .default as typeof deleteRoute;
    clearRoute = (await import("../../../../../api/mock-api-call-history/index.delete"))
      .default as typeof clearRoute;
  });

  beforeEach(async () => {
    await getDb().delete(projects).where(eq(projects.id, projectId));
    await getDb().delete(projects).where(eq(projects.id, otherProjectId));
    await getDb()
      .insert(projects)
      .values([{ id: projectId }, { id: otherProjectId }]);
  });

  afterAll(async () => {
    await getDb().delete(projects).where(eq(projects.id, projectId));
    await getDb().delete(projects).where(eq(projects.id, otherProjectId));
    await closeDb();
  });

  async function seedCall(input: {
    projectId: string;
    id: string;
    runId: string;
    timestamp: Date;
  }) {
    const traceId = input.runId.padEnd(32, "a");
    await getDb().insert(runs).values({
      id: input.runId,
      projectId: input.projectId,
      traceId,
      status: "completed",
      responseStatus: 200,
      responseBody: input.id,
      startedAt: input.timestamp,
      finishedAt: input.timestamp,
    });
    await getDb()
      .insert(mockApiCallHistory)
      .values({
        id: input.id,
        projectId: input.projectId,
        runId: input.runId,
        mockApiId: "deleted-mock-api",
        mockApiName: input.id,
        method: "POST",
        url: "http://service.test/orders",
        requestBody: { id: input.id },
        traceId,
        status: "completed",
        triggeredAt: input.timestamp,
      });
    await writeSpans([
      {
        projectId: input.projectId,
        traceId,
        spanId: "1".padStart(16, "0"),
        parentSpanId: null,
        serviceName: "orders",
        operationName: "POST /orders",
        startTime: input.timestamp,
        endTime: input.timestamp,
        statusCode: "UNSET",
        attributes: {},
      },
    ]);
    await writeLogs([
      {
        projectId: input.projectId,
        traceId,
        serviceName: "orders",
        severity: "INFO",
        timestamp: input.timestamp,
        message: input.id,
        attributes: {},
      },
    ]);
  }

  it("lists newest first within the current project and deletes history only", async () => {
    const earlier = new Date("2026-01-01T00:00:00.000Z");
    const later = new Date("2026-01-02T00:00:00.000Z");
    await seedCall({ projectId, id: "old-call", runId: "old-run", timestamp: earlier });
    await seedCall({ projectId, id: "new-call", runId: "new-run", timestamp: later });
    await seedCall({
      projectId: otherProjectId,
      id: "foreign-call",
      runId: "foreign-run",
      timestamp: later,
    });

    await expect(listRoute({} as never)).resolves.toMatchObject([
      { id: "new-call", responseBody: "new-call", requestBody: { id: "new-call" } },
      { id: "old-call", responseBody: "old-call", requestBody: { id: "old-call" } },
    ]);
    await expect(
      deleteRoute({ context: { params: { id: "new-call" } } } as never),
    ).resolves.toEqual({ id: "new-call" });

    const db = getDb();
    expect(
      await db.select().from(mockApiCallHistory).where(eq(mockApiCallHistory.id, "new-call")),
    ).toEqual([]);
    expect(await db.select().from(runs).where(eq(runs.id, "new-run"))).toHaveLength(1);
    expect(
      (
        await Promise.all([
          readSpans(projectId, "old-run".padEnd(32, "a")),
          readSpans(projectId, "new-run".padEnd(32, "a")),
        ])
      ).flat(),
    ).toHaveLength(2);
    expect(await readLogs(projectId, {})).toHaveLength(2);

    await expect(clearRoute({} as never)).resolves.toEqual({ deleted: 1 });
    expect(
      await db.select().from(mockApiCallHistory).where(eq(mockApiCallHistory.projectId, projectId)),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(mockApiCallHistory)
        .where(eq(mockApiCallHistory.projectId, otherProjectId)),
    ).toHaveLength(1);
    expect(await db.select().from(runs).where(eq(runs.projectId, projectId))).toHaveLength(2);
  });
});
