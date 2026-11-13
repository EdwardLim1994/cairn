import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import Database from "better-sqlite3";
import { DuckDBInstance } from "@duckdb/node-api";
import { migrateDuckdb, migrateSqlite } from "./migrations";

export async function openEmbeddedStores(dataDir: string) {
  await mkdir(dataDir, { recursive: true });
  const sqlite = new Database(join(dataDir, "cairn.sqlite"));
  try {
    sqlite.pragma("foreign_keys = ON");
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("busy_timeout = 5000");
    await migrateSqlite(sqlite);
    const duckdb = await DuckDBInstance.fromCache(join(dataDir, "telemetry.duckdb"));
    const telemetry = await duckdb.connect();
    try {
      await migrateDuckdb(telemetry);
    } catch (error) {
      telemetry.disconnectSync();
      throw error;
    }
    return {
      sqlite,
      telemetry,
      close() {
        telemetry.disconnectSync();
        sqlite.close();
      },
    };
  } catch (error) {
    sqlite.close();
    throw error;
  }
}

type EmbeddedStores = Awaited<ReturnType<typeof openEmbeddedStores>>;
let activeStores: EmbeddedStores | undefined;

export async function initializeEmbeddedStores(dataDir: string) {
  if (activeStores) throw new Error("Embedded stores are already open");
  activeStores = await openEmbeddedStores(dataDir);
  return activeStores;
}

export function getEmbeddedStores() {
  if (!activeStores) throw new Error("Embedded stores have not initialized");
  return activeStores;
}

export function closeEmbeddedStores() {
  activeStores?.close();
  activeStores = undefined;
}
