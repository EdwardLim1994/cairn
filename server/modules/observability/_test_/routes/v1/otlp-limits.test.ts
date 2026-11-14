import { Readable } from "node:stream";
import { gzipSync } from "node:zlib";
import { createEvent } from "h3";
import type { IncomingMessage, ServerResponse } from "node:http";
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";

vi.mock("../../../../../utils/otel-access-token-auth", () => ({
  requireOtelAccessToken: async () => {},
}));

function event(chunks: Buffer[], encoding?: string) {
  const request = Readable.from(chunks) as IncomingMessage;
  request.method = "POST";
  request.headers = encoding ? { "content-encoding": encoding } : {};
  return createEvent(request, {} as ServerResponse);
}

let tracesRoute: (requestEvent: ReturnType<typeof event>) => Promise<unknown>;
let logsRoute: (requestEvent: ReturnType<typeof event>) => Promise<unknown>;

beforeAll(async () => {
  (globalThis as unknown as { defineEventHandler: <T>(handler: T) => T }).defineEventHandler = (
    handler,
  ) => handler;
  tracesRoute = (await import("../../../../../routes/v1/traces.post"))
    .default as typeof tracesRoute;
  logsRoute = (await import("../../../../../routes/v1/logs.post")).default as typeof logsRoute;
});
afterEach(() => vi.unstubAllEnvs());

describe("OTLP route body limits", () => {
  it("rejects a compressed request over its configured limit", async () => {
    vi.stubEnv("OTLP_MAX_COMPRESSED_BYTES", "128");
    await expect(tracesRoute(event([Buffer.alloc(100), Buffer.alloc(29)]))).rejects.toMatchObject({
      statusCode: 413,
    });
  });

  it("rejects a high-expansion gzip payload at the inflated limit", async () => {
    vi.stubEnv("OTLP_MAX_COMPRESSED_BYTES", "128");
    vi.stubEnv("OTLP_MAX_DECOMPRESSED_BYTES", "256");
    const compressed = gzipSync(JSON.stringify({ resourceLogs: [{ body: "x".repeat(1000) }] }));
    expect(compressed.length).toBeLessThan(128);
    await expect(logsRoute(event([compressed], "gzip"))).rejects.toMatchObject({ statusCode: 413 });
  });
});
