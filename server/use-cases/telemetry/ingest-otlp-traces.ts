import type { OtlpTracesRequest } from "#shared/api/observability";
import {
  otlpArray,
  otlpAttributes,
  otlpObject,
  otlpTimestamp,
  resourceAttributes,
  validHex,
} from "../../utils/otlp";

function matchesProject(attributes: Record<string, unknown>, projectId: string) {
  return attributes["project.id"] === undefined || attributes["project.id"] === projectId;
}

function spanStatus(code: unknown) {
  if (code === 2) return "ERROR";
  if (code === 1) return "OK";
  return "UNSET";
}

function spanKind(value: unknown) {
  const kinds = ["UNSPECIFIED", "INTERNAL", "SERVER", "CLIENT", "PRODUCER", "CONSUMER"];
  let kind: string | null = null;
  if (typeof value === "number") kind = kinds[value] ?? null;
  else if (typeof value === "string") kind = value;
  const normalized = kind?.trim().toUpperCase();
  return normalized && kinds.includes(normalized) ? normalized : undefined;
}

function normalizeResourceSpans(
  resourceSpan: Record<string, unknown>,
  projectId: string,
  serviceName: string,
) {
  const records = [];
  for (const scopeValue of otlpArray(resourceSpan.scopeSpans, "scopeSpans")) {
    const scope = otlpObject(scopeValue, "Scope span");
    for (const spanValue of otlpArray(scope.spans, "spans")) {
      const item = otlpObject(spanValue, "Span");
      const status = otlpObject(item.status, "Span status");
      const attributes = otlpAttributes(item.attributes);
      const kind = spanKind(item.kind);
      if (kind) attributes["span.kind"] = kind;
      records.push({
        projectId,
        traceId: validHex(item.traceId, 32, "Trace id"),
        spanId: validHex(item.spanId, 16, "Span id"),
        parentSpanId: item.parentSpanId ? validHex(item.parentSpanId, 16, "Parent span id") : null,
        serviceName,
        operationName: typeof item.name === "string" ? item.name.slice(0, 255) : "unknown",
        startTime: otlpTimestamp(item.startTimeUnixNano, "Span start time"),
        endTime: otlpTimestamp(item.endTimeUnixNano, "Span end time"),
        statusCode: spanStatus(status.code),
        attributes,
      });
    }
  }
  return records;
}

function normalizeSpans(body: OtlpTracesRequest, projectId: string, configuredProjectId: string) {
  const records = [];
  for (const resourceSpanValue of otlpArray(body.resourceSpans, "resourceSpans")) {
    const resourceSpan = otlpObject(resourceSpanValue, "Resource span");
    const attributes = resourceAttributes(resourceSpan.resource);
    if (!matchesProject(attributes, configuredProjectId)) continue;
    const serviceName =
      typeof attributes["service.name"] === "string" ? attributes["service.name"] : "unknown";
    records.push(...normalizeResourceSpans(resourceSpan, projectId, serviceName));
  }
  return records;
}

export function createIngestOtlpTracesUseCase(dependencies: {
  ensureProject: () => Promise<string>;
  configuredProjectId: () => string;
  insertSpans: (
    records: Array<{
      projectId: string;
      traceId: string;
      spanId: string;
      parentSpanId: string | null;
      serviceName: string;
      operationName: string;
      startTime: Date;
      endTime: Date;
      statusCode: string;
      attributes: Record<string, unknown>;
    }>,
  ) => Promise<void>;
}) {
  return async (body: OtlpTracesRequest) => {
    const projectId = await dependencies.ensureProject();
    const records = normalizeSpans(body, projectId, dependencies.configuredProjectId());
    await dependencies.insertSpans(records);
    return { accepted: records.length };
  };
}
