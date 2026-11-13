import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { spawnSync } from "node:child_process";

const env = { ...process.env, CAIRN_RUN_INTEGRATION: "1", AUTH_ENABLED: "false" };
const command = process.platform === "win32" ? "vp.exe" : "vp";

function findIntegrationTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findIntegrationTests(path);
    return entry.isFile() && entry.name.endsWith(".integration.test.ts") ? [path] : [];
  });
}

function run(args) {
  const result = spawnSync(command, args, {
    env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const integrationTests = findIntegrationTests("server").map((path) =>
  relative(process.cwd(), path).split(sep).join("/"),
);
if (integrationTests.length === 0) {
  console.error("No *.integration.test.ts files were found under server/.");
  process.exit(1);
}
run(["test", "run", "--no-file-parallelism", ...integrationTests]);
