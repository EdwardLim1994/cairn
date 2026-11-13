import { closeEmbeddedStores } from "./embedded";
import { getSqliteDb, resetSqliteDb } from "./sqlite";
import { stopTelemetryWrites } from "./telemetry";

export const getDb = getSqliteDb;

export async function closeDb() {
  await stopTelemetryWrites();
  resetSqliteDb();
  closeEmbeddedStores();
}
