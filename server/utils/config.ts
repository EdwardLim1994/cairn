import { join, resolve } from "node:path";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function positiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

export function getTelemetryWriterLimits() {
  return {
    records: positiveInteger("TELEMETRY_MAX_PENDING_RECORDS", 10000),
    bytes: positiveInteger("TELEMETRY_MAX_PENDING_BYTES", 32 * 1024 * 1024),
    batchSize: positiveInteger("TELEMETRY_BATCH_SIZE", 100),
  };
}

export function getOtlpBodyLimits() {
  return {
    compressed: positiveInteger("OTLP_MAX_COMPRESSED_BYTES", 4 * 1024 * 1024),
    decompressed: positiveInteger("OTLP_MAX_DECOMPRESSED_BYTES", 16 * 1024 * 1024),
  };
}

export function getAppConfig() {
  const collectorUrl = new URL(required("OTEL_COLLECTOR_URL"));
  if (!new Set(["http:", "https:"]).has(collectorUrl.protocol)) {
    throw new Error("OTEL_COLLECTOR_URL must use HTTP or HTTPS");
  }

  const authEnabled = process.env.AUTH_ENABLED !== "false";
  const authUsername = authEnabled ? required("AUTH_USERNAME") : undefined;
  const authPassword = authEnabled ? required("AUTH_PASSWORD") : undefined;
  const authSessionSecret = authEnabled ? required("AUTH_SESSION_SECRET") : undefined;
  if (authSessionSecret && authSessionSecret.length < 32) {
    throw new Error("AUTH_SESSION_SECRET must be at least 32 characters");
  }

  const dataDir = resolve(process.env.CAIRN_DATA_DIR?.trim() || "data");
  return {
    dataDir,
    sqlitePath: join(dataDir, "cairn.sqlite"),
    duckDbPath: join(dataDir, "telemetry.duckdb"),
    otelCollectorUrl: collectorUrl.toString(),
    projectId: required("PROJECT_ID"),
    port: positiveInteger("PORT", 3003),
    outboundRequestTimeoutMs: positiveInteger("OUTBOUND_REQUEST_TIMEOUT_MS", 10000),
    telemetryQuietMs: positiveInteger("TELEMETRY_QUIET_MS", 5000),
    telemetryMaxWaitMs: positiveInteger("TELEMETRY_MAX_WAIT_MS", 15000),
    otlpBodyLimits: getOtlpBodyLimits(),
    telemetryWriterLimits: getTelemetryWriterLimits(),
    telemetryRetentionDays: positiveInteger("TELEMETRY_RETENTION_DAYS", 365),
    authEnabled,
    authUsername,
    authPassword,
    authSessionSecret,
  };
}
