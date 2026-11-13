import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vite-plus/test";
import { closeDb } from ".";
import { initializeEmbeddedStores } from "./embedded";
import { startTelemetryWrites } from "./telemetry";

if (process.env.CAIRN_RUN_INTEGRATION) {
  const directory = await mkdtemp(join(tmpdir(), "cairn-integration-"));
  await initializeEmbeddedStores(directory);
  startTelemetryWrites();
  afterAll(async () => {
    await closeDb();
    await rm(directory, { recursive: true, force: true });
  });
}
