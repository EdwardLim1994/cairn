import { spawnSync } from "node:child_process";
import { expect, it } from "vite-plus/test";

it("exits unsuccessfully when the migration database is not configured", () => {
  const result = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
    env: { ...process.env, DATABASE_URL: "" },
    encoding: "utf8",
  });

  expect(result.status).toBe(1);
  expect(result.stderr).toContain("Missing required environment variable: DATABASE_URL");
});
