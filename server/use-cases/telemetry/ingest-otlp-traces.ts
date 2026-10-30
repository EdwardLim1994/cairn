import type { OtlpTracesRequest } from "#shared/api/observability";
import {
  otlpArray,
  otlpAttributes,
  otlpObject,
  otlpTimestamp,
  resourceAttributes,
  validHex,
} from "../../utils/otlp";

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
    const records = [];
    for (const resourceSpanValue of otlpArray(body.resourceSpans, "resourceSpans")) {
      const resourceSpan = otlpObject(resourceSpanValue, "Resource span");
      const attributes = resourceAttributes(resourceSpan.resource);
      if (
        attributes["project.id"] !== undefined &&
        attributes["project.id"] !== dependencies.configuredProjectId()
      )
        continue;
      const serviceName =
        typeof attributes["service.name"] === "string" ? attributes["service.name"] : "unknown";
      for (const scopeValue of otlpArray(resourceSpan.scopeSpans, "scopeSpans")) {
        const scope = otlpObject(scopeValue, "Scope span");
        for (const spanValue of otlpArray(scope.spans, "spans")) {
          const item = otlpObject(spanValue, "Span");
          const status = otlpObject(item.status, "Span status");
          records.push({
            projectId,
            traceId: validHex(item.traceId, 32, "Trace id"),
            spanId: validHex(item.spanId, 16, "Span id"),
            parentSpanId: item.parentSpanId
              ? validHex(item.parentSpanId, 16, "Parent span id")
              : null,
            serviceName,
            operationName: typeof item.name === "string" ? item.name.slice(0, 255) : "unknown",
            startTime: otlpTimestamp(item.startTimeUnixNano, "Span start time"),
            endTime: otlpTimestamp(item.endTimeUnixNano, "Span end time"),
            statusCode: status.code === 2 ? "ERROR" : status.code === 1 ? "OK" : "UNSET",
            attributes: otlpAttributes(item.attributes),
          });
        }
      }
    }
    await dependencies.insertSpans(records);
    return { accepted: records.length };
  };
}
