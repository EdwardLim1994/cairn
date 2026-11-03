import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { getAppConfig } from "./config";

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "mysql://db/cairn");
  vi.stubEnv("OTEL_COLLECTOR_URL", "http://collector:4318");
  vi.stubEnv("PROJECT_ID", "project-1");
  vi.stubEnv("AUTH_USERNAME", "operator");
  vi.stubEnv("AUTH_PASSWORD", "secret-password");
  vi.stubEnv("AUTH_SESSION_SECRET", "a-session-secret-that-is-at-least-32-characters");
});

afterEach(() => vi.unstubAllEnvs());

describe("application configuration", () => {
  it("requires database, collector, and project settings and applies numeric defaults", () => {
    vi.stubEnv("AUTH_ENABLED", undefined);
    vi.stubEnv("DATABASE_URL", "mysql://db/cairn");
    vi.stubEnv("OTEL_COLLECTOR_URL", "http://collector:4318");
    vi.stubEnv("PROJECT_ID", "project-1");
    vi.stubEnv("PORT", "3003");
    vi.stubEnv("OUTBOUND_REQUEST_TIMEOUT_MS", "10000");
    vi.stubEnv("TELEMETRY_QUIET_MS", "1500");
    vi.stubEnv("TELEMETRY_MAX_WAIT_MS", "10000");
    vi.stubEnv("AUTH_USERNAME", "operator");
    vi.stubEnv("AUTH_PASSWORD", "secret-password");
    vi.stubEnv("AUTH_SESSION_SECRET", "a-session-secret-that-is-at-least-32-characters");
    expect(getAppConfig()).toMatchObject({
      databaseUrl: "mysql://db/cairn",
      otelCollectorUrl: "http://collector:4318/",
      projectId: "project-1",
      port: 3003,
      outboundRequestTimeoutMs: 10000,
      telemetryQuietMs: 1500,
      telemetryMaxWaitMs: 10000,
      authEnabled: true,
      authUsername: "operator",
      authPassword: "secret-password",
    });
  });

  it("requires valid authentication settings by default and allows explicit disablement", () => {
    vi.stubEnv("AUTH_ENABLED", undefined);
    vi.stubEnv("AUTH_USERNAME", "");
    expect(() => getAppConfig()).toThrow("Missing required environment variable: AUTH_USERNAME");

    vi.stubEnv("AUTH_ENABLED", "false");
    expect(getAppConfig()).toMatchObject({
      authEnabled: false,
      authUsername: undefined,
      authPassword: undefined,
      authSessionSecret: undefined,
    });
  });

  it("rejects short session secrets without exposing configured values", () => {
    vi.stubEnv("AUTH_USERNAME", "operator");
    vi.stubEnv("AUTH_PASSWORD", "secret-password");
    vi.stubEnv("AUTH_SESSION_SECRET", "too-short");
    expect(() => getAppConfig()).toThrow("AUTH_SESSION_SECRET must be at least 32 characters");
  });

  it("rejects missing values, non-HTTP collectors, and invalid ports", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("OTEL_COLLECTOR_URL", "");
    expect(() => getAppConfig()).toThrow(
      "Missing required environment variable: OTEL_COLLECTOR_URL",
    );
    vi.stubEnv("OTEL_COLLECTOR_URL", "http://collector:4318");
    vi.stubEnv("OTEL_COLLECTOR_URL", "ftp://collector");
    vi.stubEnv("DATABASE_URL", "mysql://db/cairn");
    vi.stubEnv("PROJECT_ID", "project-1");
    expect(() => getAppConfig()).toThrow("must use HTTP or HTTPS");
    vi.stubEnv("OTEL_COLLECTOR_URL", "http://collector");
    vi.stubEnv("PORT", "0");
    expect(() => getAppConfig()).toThrow("PORT must be a positive integer");
  });
});
