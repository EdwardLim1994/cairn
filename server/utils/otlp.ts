import { timingSafeEqual } from "node:crypto";
import { createError, type H3Event } from "h3";
import { getAppConfig } from "./config";
import { record } from "./graph-validation";

export function requireIngestToken(event: H3Event) {
  const expected = Buffer.from(getAppConfig().otelIngestToken);
  const actual = Buffer.from(getHeader(event, "authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw createError({ statusCode: 401, statusMessage: "Invalid telemetry ingestion token" });
  }
}

export function otlpArray(value: unknown, label: string): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value))
    throw createError({ statusCode: 400, statusMessage: `${label} must be an array` });
  return value;
}

export function otlpObject(value: unknown, label: string) {
  return record(value ?? {}, label);
}

export function otlpAttributes(value: unknown): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const item of otlpArray(value, "Attributes")) {
    const entry = record(item, "Attribute");
    if (typeof entry.key !== "string") continue;
    const wrapped = record(entry.value ?? {}, "Attribute value");
    if ("stringValue" in wrapped) output[entry.key] = wrapped.stringValue;
    else if ("intValue" in wrapped) output[entry.key] = Number(wrapped.intValue);
    else if ("doubleValue" in wrapped) output[entry.key] = Number(wrapped.doubleValue);
    else if ("boolValue" in wrapped) output[entry.key] = Boolean(wrapped.boolValue);
    else if ("bytesValue" in wrapped) output[entry.key] = wrapped.bytesValue;
    else if ("arrayValue" in wrapped) output[entry.key] = wrapped.arrayValue;
    else if ("kvlistValue" in wrapped) output[entry.key] = wrapped.kvlistValue;
  }
  return output;
}

export function otlpTimestamp(value: unknown, label: string): Date {
  if (typeof value !== "string" && typeof value !== "number")
    throw createError({ statusCode: 400, statusMessage: `${label} is required` });
  const millis = Number(BigInt(value) / BigInt(1_000_000));
  const date = new Date(millis);
  if (!Number.isFinite(date.getTime()))
    throw createError({ statusCode: 400, statusMessage: `${label} is invalid` });
  return date;
}

export function resourceAttributes(resource: unknown) {
  const row = otlpObject(resource, "Resource");
  return otlpAttributes(row.attributes);
}

export function validHex(value: unknown, length: number, label: string): string {
  if (typeof value !== "string" || !new RegExp(`^[a-fA-F0-9]{${length}}$`).test(value)) {
    throw createError({
      statusCode: 400,
      statusMessage: `${label} must be ${length} hexadecimal characters`,
    });
  }
  return value.toLowerCase();
}
