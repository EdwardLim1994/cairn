import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { spawnSync } from "node:child_process";

const databaseUrl = process.env.CAIRN_TEST_DATABASE_URL;
if (!databaseUrl) {
  console.error(
    "CAIRN_TEST_DATABASE_URL is required. Start the disposable MySQL service with docker-compose.test.yml first.",
  );
  process.exit(1);
}

const env = { ...process.env, DATABASE_URL: process.env.DATABASE_URL || databaseUrl };
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

run(["run", "db:migrate"]);
const integrationTests = findIntegrationTests("server").map((path) =>
  relative(process.cwd(), path).split(sep).join("/"),
);
if (integrationTests.length === 0) {
  console.error("No *.integration.test.ts files were found under server/.");
  process.exit(1);
}
run(["test", "run", ...integrationTests]);
