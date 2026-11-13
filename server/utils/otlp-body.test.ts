import { Readable } from "node:stream";
import { gzipSync } from "node:zlib";
import type { H3Event } from "h3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { readOtlpBody } from "./otlp";

function event(chunks: Buffer[], encoding?: string): H3Event {
  const request = Readable.from(chunks) as Readable & { headers: Record<string, string> };
  request.headers = encoding ? { "content-encoding": encoding } : {};
  return { node: { req: request } } as H3Event;
}

beforeEach(() => {
  vi.stubEnv("AUTH_ENABLED", "false");
  vi.stubEnv("OTEL_COLLECTOR_URL", "http://localhost:4318");
  vi.stubEnv("PROJECT_ID", "test-project");
  vi.stubEnv("OTLP_MAX_COMPRESSED_BYTES", "128");
  vi.stubEnv("OTLP_MAX_DECOMPRESSED_BYTES", "256");
});
afterEach(() => vi.unstubAllEnvs());

describe("OTLP body limits", () => {
  it("rejects compressed input as its byte limit is crossed", async () => {
    await expect(
      readOtlpBody(event([Buffer.alloc(100), Buffer.alloc(29)]), "Trace payload"),
    ).rejects.toMatchObject({ statusCode: 413 });
  });

  it("rejects a high-expansion gzip body before inflation exceeds its limit", async () => {
    const compressed = gzipSync(JSON.stringify({ resourceLogs: [{ message: "x".repeat(1000) }] }));
    expect(compressed.length).toBeLessThan(128);
    await expect(readOtlpBody(event([compressed], "gzip"), "Log payload")).rejects.toMatchObject({
      statusCode: 413,
    });
  });

  it("accepts a small gzip body", async () => {
    const compressed = gzipSync(JSON.stringify({ resourceSpans: [] }));
    await expect(readOtlpBody(event([compressed], "gzip"), "Trace payload")).resolves.toEqual({
      resourceSpans: [],
    });
  });
});
