import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { runs, spans } from "../../db/schema";
import { getAppConfig } from "../../utils/config";
import { ensureProject } from "../../utils/project";
import {
  otlpArray,
  otlpAttributes,
  otlpTimestamp,
  readOtlpBody,
  resourceAttributes,
  validHex,
} from "../../utils/otlp";

export default defineEventHandler(async (event) => {
  const body = await readOtlpBody(event, "Trace payload");
  const projectId = await ensureProject();
  const records: (typeof spans.$inferInsert)[] = [];
  for (const resourceSpanValue of otlpArray(body.resourceSpans, "resourceSpans")) {
    const resourceSpan = otlpObject(resourceSpanValue, "Resource span");
    const attributes = resourceAttributes(resourceSpan.resource);
    if (
      attributes["project.id"] !== undefined &&
      attributes["project.id"] !== getAppConfig().projectId
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
  const db = getDb();
  if (records.length) {
    await db.transaction(async (tx) => {
      for (const span of records)
        await tx
          .insert(spans)
          .values(span)
          .onDuplicateKeyUpdate({
            set: {
              serviceName: span.serviceName,
              operationName: span.operationName,
              endTime: span.endTime,
              statusCode: span.statusCode,
              attributes: span.attributes,
            },
          });
    });
    const traceIds = [...new Set(records.map((span) => span.traceId))];
    await db
      .update(runs)
      .set({ lastTelemetryAt: new Date() })
      .where(and(eq(runs.projectId, projectId), inArray(runs.traceId, traceIds)));
  }
  return { accepted: records.length };
});
