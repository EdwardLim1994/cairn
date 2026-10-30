import { gzipSync } from "node:zlib";
import { createEvent, getHeader } from "h3";
import type { IncomingMessage, ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  normalizeSeverity,
  otlpArray,
  otlpAttributes,
  otlpObject,
  otlpTimestamp,
  readOtlpBody,
  resourceAttributes,
  validHex,
} from "./otlp";

function eventFor(body: Buffer, encoding?: string) {
  const request = {
    method: "POST",
    headers: encoding ? { "content-encoding": encoding } : {},
    rawBody: body,
  } as unknown as IncomingMessage;
  return createEvent(request, {} as ServerResponse);
}

afterEach(() => {
  delete (globalThis as typeof globalThis & { getHeader?: unknown }).getHeader;
});

describe("OTLP normalization utilities", () => {
  it("reads JSON and gzip-compressed JSON request bodies", async () => {
    (globalThis as typeof globalThis & { getHeader?: typeof getHeader }).getHeader = getHeader;
    const payload = Buffer.from('{"resourceLogs":[]}');
    await expect(readOtlpBody(eventFor(payload), "Log payload")).resolves.toEqual({
      resourceLogs: [],
    });
    await expect(readOtlpBody(eventFor(gzipSync(payload), "gzip"), "Log payload")).resolves.toEqual(
      { resourceLogs: [] },
    );
    await expect(readOtlpBody(eventFor(Buffer.alloc(0)), "Log payload")).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("validates OTLP arrays and objects", () => {
    expect(otlpArray(undefined, "items")).toEqual([]);
    expect(otlpArray([1], "items")).toEqual([1]);
    expect(() => otlpArray("items", "items")).toThrow("items must be an array");
    expect(otlpObject(undefined, "record")).toEqual({});
    expect(() => otlpObject([], "record")).toThrow("record must be an object");
  });

  it("normalizes OTLP attribute scalar values and resource attributes", () => {
    const attributes = [
      { key: "text", value: { stringValue: "value" } },
      { key: "count", value: { intValue: "2" } },
      { key: "ratio", value: { doubleValue: "2.5" } },
      { key: "enabled", value: { boolValue: 1 } },
    ];
    expect(otlpAttributes(attributes)).toEqual({
      text: "value",
      count: 2,
      ratio: 2.5,
      enabled: true,
    });
    expect(
      resourceAttributes({
        attributes: [{ key: "service.name", value: { stringValue: "orders" } }],
      }),
    ).toEqual({ "service.name": "orders" });
  });

  it("converts nanosecond timestamps and rejects invalid values", () => {
    expect(otlpTimestamp("1000000", "timestamp").getTime()).toBe(1);
    expect(() => otlpTimestamp(undefined, "timestamp")).toThrow("timestamp is required");
  });

  it("normalizes severity aliases and validates hexadecimal identifiers", () => {
    expect(normalizeSeverity("information")).toBe("INFO");
    expect(normalizeSeverity("warning")).toBe("WARN");
    expect(normalizeSeverity(undefined)).toBe("UNSPECIFIED");
    expect(validHex("A".repeat(32), 32, "Trace id")).toBe("a".repeat(32));
    expect(() => validHex("bad", 32, "Trace id")).toThrow(
      "Trace id must be 32 hexadecimal characters",
    );
  });
});
