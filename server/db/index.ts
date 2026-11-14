import { closeEmbeddedStores } from "./embedded";
import { getSqliteDb, resetSqliteDb } from "./sqlite";
import { stopTelemetryWrites } from "./telemetry";

export const getDb = getSqliteDb;
export type SqliteTransaction = Parameters<
  Parameters<ReturnType<typeof getDb>["transaction"]>[0]
>[0];

export async function closeDb() {
  await stopTelemetryWrites();
  resetSqliteDb();
  closeEmbeddedStores();
}
