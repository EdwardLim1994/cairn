import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vite-plus/test";
import { closeEmbeddedStores, initializeEmbeddedStores, openEmbeddedStores } from "./embedded";
import { getSqliteDb, resetSqliteDb } from "./sqlite";
import * as schema from "./sqlite-schema";

describe("SQLite Drizzle schema", () => {
  it("shares one startup-owned connection with repositories", async () => {
    const directory = await mkdtemp(join(tmpdir(), "cairn-sqlite-owner-"));
    try {
      expect(() => getSqliteDb()).toThrow("have not initialized");
      await initializeEmbeddedStores(directory);
      const db = getSqliteDb();
      expect(getSqliteDb()).toBe(db);
      await db.insert(schema.projects).values({ id: "owned" });
      expect(await db.select().from(schema.projects)).toMatchObject([{ id: "owned" }]);
      const rollback = db.transaction(async (tx) => {
        await tx.insert(schema.projects).values({ id: "rolled-back" });
        await new Promise((resolve) => setTimeout(resolve, 5));
        throw new Error("rollback");
      });
      const concurrent = db.insert(schema.projects).values({ id: "concurrent" });
      await expect(rollback).rejects.toThrow("rollback");
      await concurrent;
      expect(
        (await db.select({ id: schema.projects.id }).from(schema.projects)).toSorted((a, b) =>
          a.id.localeCompare(b.id),
        ),
      ).toEqual([{ id: "concurrent" }, { id: "owned" }]);
    } finally {
      resetSqliteDb();
      closeEmbeddedStores();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("maps dates, booleans, and JSON and enforces project ownership", async () => {
    const directory = await mkdtemp(join(tmpdir(), "cairn-sqlite-schema-"));
    const stores = await openEmbeddedStores(directory);
    try {
      const db = drizzle({ client: stores.sqlite, schema });
      for (const table of Object.values(schema)) {
        const config = getTableConfig(table);
        const actual = stores.sqlite.pragma(`table_info(${config.name})`) as Array<{
          name: string;
        }>;
        expect(config.columns.map((column) => column.name).sort()).toEqual(
          actual.map((column) => column.name).sort(),
        );
      }
      db.insert(schema.projects).values({ id: "a" }).run();
      db.insert(schema.projects).values({ id: "b" }).run();
      const [project] = db.select().from(schema.projects).where(eq(schema.projects.id, "a")).all();
      expect(project).toMatchObject({ nodesLocked: false, viewportZoom: 1 });
      expect(project?.createdAt).toBeInstanceOf(Date);

      db.insert(schema.headerTemplates)
        .values({
          id: "header-a",
          projectId: "a",
          name: "default",
          headers: [{ name: "X-Test", value: "ok" }],
        })
        .run();
      db.insert(schema.services)
        .values({
          id: "service-a",
          projectId: "a",
          name: "Service",
          framework: "Other",
          baseUrl: "http://localhost:8080",
        })
        .run();
      const [service] = db
        .select()
        .from(schema.services)
        .where(eq(schema.services.id, "service-a"))
        .all();
      expect(service).toMatchObject({ active: true, grpcTls: false, healthCheckCustomHeaders: [] });
      expect(service?.createdAt).toBeInstanceOf(Date);
      const [header] = db
        .select()
        .from(schema.headerTemplates)
        .where(eq(schema.headerTemplates.id, "header-a"))
        .all();
      expect(header?.headers).toEqual([{ name: "X-Test", value: "ok" }]);
      expect(() =>
        db
          .insert(schema.headerTemplates)
          .values({ id: "header-duplicate", projectId: "a", name: "default", headers: [] })
          .run(),
      ).toThrow();
      expect(() =>
        db
          .insert(schema.services)
          .values({
            id: "orphan",
            projectId: "missing",
            name: "Orphan",
            framework: "Other",
            baseUrl: "http://localhost",
          })
          .run(),
      ).toThrow();
      expect(
        db.select().from(schema.services).where(eq(schema.services.projectId, "b")).all(),
      ).toEqual([]);
    } finally {
      stores.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rolls back run and call history together and enforces cascade and uniqueness", async () => {
    const directory = await mkdtemp(join(tmpdir(), "cairn-sqlite-runs-"));
    try {
      await initializeEmbeddedStores(directory);
      const db = getSqliteDb();
      await db.insert(schema.projects).values({ id: "run-project" });
      const run = { id: "run-1", projectId: "run-project", traceId: "a".repeat(32) };
      const history = {
        id: "call-1",
        projectId: "run-project",
        runId: "run-1",
        mockApiId: "api-1",
        mockApiName: "API",
        method: "GET",
        url: "/",
        traceId: run.traceId,
      };
      await expect(
        db.transaction(async (tx) => {
          await tx.insert(schema.runs).values(run);
          await tx.insert(schema.mockApiCallHistory).values(history);
          throw new Error("abort run");
        }),
      ).rejects.toThrow("abort run");
      expect(await db.select().from(schema.runs)).toEqual([]);
      expect(await db.select().from(schema.mockApiCallHistory)).toEqual([]);

      await db.insert(schema.runs).values(run);
      await db.insert(schema.mockApiCallHistory).values(history);
      await expect(
        db.insert(schema.mockApiCallHistory).values({ ...history, id: "call-2" }),
      ).rejects.toThrow();
      await db.delete(schema.projects).where(eq(schema.projects.id, "run-project"));
      expect(await db.select().from(schema.runs)).toEqual([]);
      expect(await db.select().from(schema.mockApiCallHistory)).toEqual([]);
    } finally {
      resetSqliteDb();
      closeEmbeddedStores();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
