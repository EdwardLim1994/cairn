import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { openEmbeddedStores } from "../embedded";

describe("embedded database files", () => {
  it("opens both stores in a writable directory", async () => {
    const directory = await mkdtemp(join(tmpdir(), "cairn-stores-"));
    let stores: Awaited<ReturnType<typeof openEmbeddedStores>> | undefined;
    let reopened: Awaited<ReturnType<typeof openEmbeddedStores>> | undefined;
    try {
      stores = await openEmbeddedStores(directory);
      expect(stores.sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
      expect(stores.sqlite.pragma("journal_mode", { simple: true })).toBe("wal");
      expect(stores.sqlite.pragma("user_version", { simple: true })).toBe(1);
      const appTables = stores.sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
        .all() as Array<{ name: string }>;
      expect(appTables).toHaveLength(14);
      for (const table of ["services", "service_endpoints", "message_destinations"]) {
        const columns = stores.sqlite.pragma(`table_info(${table})`) as Array<{ name: string }>;
        expect(columns.map((column) => column.name)).not.toContain("code_key");
      }
      const mockApiColumns = stores.sqlite.pragma("table_info(mock_apis)") as Array<{
        name: string;
      }>;
      for (const column of ["import_method", "import_url", "match_url"]) {
        expect(mockApiColumns.map((entry) => entry.name)).not.toContain(column);
      }
      stores.sqlite.prepare("INSERT INTO projects (id) VALUES (?)").run("test-project");
      await stores.telemetry.run(
        "INSERT INTO spans (project_id, trace_id, span_id, service_name, operation_name, start_time, end_time, attributes) VALUES ('test-project', 'trace', 'span', 'service', 'call', now(), now(), '{}')",
      );
      await stores.telemetry.run(
        "INSERT INTO logs (id, project_id, service_name, severity, timestamp, message, attributes) VALUES ('log-1', 'test-project', 'service', 'INFO', now(), 'message', '{}')",
      );
      stores.close();
      stores = undefined;
      expect(await readdir(directory)).toEqual(
        expect.arrayContaining(["cairn.sqlite", "telemetry.duckdb"]),
      );
      reopened = await openEmbeddedStores(directory);
      expect(reopened.sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
      expect(reopened.sqlite.pragma("user_version", { simple: true })).toBe(1);
      expect(reopened.sqlite.prepare("SELECT id FROM projects").all()).toEqual([
        { id: "test-project" },
      ]);
      const spans = await reopened.telemetry.run("SELECT span_id FROM spans");
      expect(await spans.getRows()).toEqual([["span"]]);
      const logs = await reopened.telemetry.run("SELECT id FROM logs");
      expect(await logs.getRows()).toEqual([["log-1"]]);
      const migrations = await reopened.telemetry.run("SELECT version FROM schema_migrations");
      expect(await migrations.getRows()).toEqual([[1]]);
      reopened.close();
      reopened = undefined;
    } finally {
      reopened?.close();
      stores?.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
