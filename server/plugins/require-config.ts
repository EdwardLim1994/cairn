import { getAppConfig } from "../utils/config";
import { closeEmbeddedStores, initializeEmbeddedStores } from "../db/embedded";
import { resetSqliteDb } from "../db/sqlite";
import { cleanupTelemetry, startTelemetryWrites, stopTelemetryWrites } from "../db/telemetry";

export default defineNitroPlugin(async (nitroApp) => {
  const config = getAppConfig();
  await initializeEmbeddedStores(config.dataDir);
  startTelemetryWrites();
  await cleanupTelemetry(config.telemetryRetentionDays);
  const retentionTimer = setInterval(
    () => {
      void cleanupTelemetry(config.telemetryRetentionDays).catch((error: unknown) => {
        console.error("Telemetry retention cleanup failed", error);
      });
    },
    24 * 60 * 60 * 1000,
  );
  retentionTimer.unref();
  nitroApp.hooks.hook("close", async () => {
    clearInterval(retentionTimer);
    await stopTelemetryWrites();
    resetSqliteDb();
    closeEmbeddedStores();
  });
});
