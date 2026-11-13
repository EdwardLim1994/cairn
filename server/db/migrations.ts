import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type Database from "better-sqlite3";
import type { DuckDBConnection } from "@duckdb/node-api";

const duckdbMigrations = ["0001_initial.sql"];

async function sqliteMigrationFiles() {
  const journal = JSON.parse(
    await readFile(join(process.cwd(), "drizzle-sqlite", "meta", "_journal.json"), "utf8"),
  ) as {
    entries: Array<{ idx: number; tag: string }>;
  };
  return journal.entries.toSorted((a, b) => a.idx - b.idx).map((entry) => `${entry.tag}.sql`);
}

async function migrationSql(engine: "sqlite" | "duckdb", file: string) {
  return readFile(
    engine === "sqlite"
      ? join(process.cwd(), "drizzle-sqlite", file)
      : join(process.cwd(), "server", "db", "migrations", engine, file),
    "utf8",
  );
}

export async function migrateSqlite(sqlite: Database.Database) {
  const sqliteMigrations = await sqliteMigrationFiles();
  const version = sqlite.pragma("user_version", { simple: true }) as number;
  if (version > sqliteMigrations.length) {
    throw new Error(`SQLite schema version ${version} is newer than this app`);
  }
  for (let index = version; index < sqliteMigrations.length; index++) {
    const sql = await migrationSql("sqlite", sqliteMigrations[index]!);
    sqlite.transaction(() => {
      sqlite.exec(sql);
      sqlite.pragma(`user_version = ${index + 1}`);
    })();
  }
}

export async function migrateDuckdb(telemetry: DuckDBConnection) {
  await telemetry.run("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY)");
  const result = await telemetry.run("SELECT max(version) FROM schema_migrations");
  const rows = await result.getRows();
  const version = Number(rows[0]?.[0] ?? 0);
  if (version > duckdbMigrations.length) {
    throw new Error(`DuckDB schema version ${version} is newer than this app`);
  }
  for (let index = version; index < duckdbMigrations.length; index++) {
    const sql = await migrationSql("duckdb", duckdbMigrations[index]!);
    await telemetry.run("BEGIN TRANSACTION");
    try {
      await telemetry.run(sql);
      await telemetry.run("INSERT INTO schema_migrations VALUES ($version)", {
        version: index + 1,
      });
      await telemetry.run("COMMIT");
    } catch (error) {
      await telemetry.run("ROLLBACK");
      throw error;
    }
  }
}
