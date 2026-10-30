import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { getAppConfig } from "./config";

afterEach(() => vi.unstubAllEnvs());

describe("application configuration", () => {
  it("requires database, collector, and project settings and applies numeric defaults", () => {
    vi.stubEnv("DATABASE_URL", "mysql://db/cairn");
    vi.stubEnv("OTEL_COLLECTOR_URL", "http://collector:4318");
    vi.stubEnv("PROJECT_ID", "project-1");
    vi.stubEnv("PORT", "3001");
    vi.stubEnv("OUTBOUND_REQUEST_TIMEOUT_MS", "10000");
    vi.stubEnv("TELEMETRY_QUIET_MS", "1500");
    vi.stubEnv("TELEMETRY_MAX_WAIT_MS", "10000");
    expect(getAppConfig()).toMatchObject({
      databaseUrl: "mysql://db/cairn",
      otelCollectorUrl: "http://collector:4318/",
      projectId: "project-1",
      port: 3001,
      outboundRequestTimeoutMs: 10000,
      telemetryQuietMs: 1500,
      telemetryMaxWaitMs: 10000,
    });
  });

  it("rejects missing values, non-HTTP collectors, and invalid ports", () => {
    vi.stubEnv("DATABASE_URL", "");
    expect(() => getAppConfig()).toThrow(
      "Missing required environment variable: OTEL_COLLECTOR_URL",
    );
    vi.stubEnv("OTEL_COLLECTOR_URL", "ftp://collector");
    vi.stubEnv("DATABASE_URL", "mysql://db/cairn");
    vi.stubEnv("PROJECT_ID", "project-1");
    expect(() => getAppConfig()).toThrow("must use HTTP or HTTPS");
    vi.stubEnv("OTEL_COLLECTOR_URL", "http://collector");
    vi.stubEnv("PORT", "0");
    expect(() => getAppConfig()).toThrow("PORT must be a positive integer");
  });
});
