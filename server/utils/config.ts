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

export function getAppConfig() {
  const collectorUrl = new URL(required("OTEL_COLLECTOR_URL"));
  if (!new Set(["http:", "https:"]).has(collectorUrl.protocol)) {
    throw new Error("OTEL_COLLECTOR_URL must use HTTP or HTTPS");
  }

  return {
    databaseUrl: required("DATABASE_URL"),
    otelCollectorUrl: collectorUrl.toString(),
    projectId: required("PROJECT_ID"),
    otelIngestToken: required("OTEL_INGEST_TOKEN"),
    port: positiveInteger("PORT", 3000),
    outboundRequestTimeoutMs: positiveInteger("OUTBOUND_REQUEST_TIMEOUT_MS", 10000),
    telemetryQuietMs: positiveInteger("TELEMETRY_QUIET_MS", 1500),
    telemetryMaxWaitMs: positiveInteger("TELEMETRY_MAX_WAIT_MS", 10000),
  };
}
