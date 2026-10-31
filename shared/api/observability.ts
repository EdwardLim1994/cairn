import { z } from "zod";
import { isoDateTimeSchema, jsonObjectSchema } from "./common";
export {
  idParamsSchema as runGetRequestSchema,
  idParamsSchema as runFlowRequestSchema,
} from "./common";

const severitySchema = z.string().min(1).max(20);
export const logListRequestSchema = z.object({
  service: z.union([z.string(), z.array(z.string())]).optional(),
  severity: z.union([z.string(), z.array(z.string())]).optional(),
  search: z.string().optional(),
});
export const logListResponseSchema = z.array(
  z.object({
    id: z.number().int(),
    projectId: z.string(),
    traceId: z.string().nullable(),
    serviceName: z.string(),
    severity: severitySchema,
    timestamp: isoDateTimeSchema,
    message: z.string(),
    attributes: jsonObjectSchema,
    receivedAt: isoDateTimeSchema,
  }),
);

export const runGetResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  mockApiId: z.string().nullable(),
  traceId: z.string(),
  status: z.enum(["running", "completed", "failed"]),
  responseStatus: z.number().int().nullable(),
  responseHeaders: z.record(z.string(), z.string()).nullable(),
  responseBody: z.string().nullable(),
  error: z.string().nullable(),
  startedAt: isoDateTimeSchema,
  finishedAt: isoDateTimeSchema.nullable(),
  lastTelemetryAt: isoDateTimeSchema.nullable(),
});
export const runFlowResponseSchema = z.object({
  runId: z.string(),
  traceId: z.string(),
  runStatus: z.enum(["running", "completed", "failed"]),
  status: z.enum(["pending", "complete"]),
  incomplete: z.boolean(),
  spans: z.array(
    z.object({
      id: z.number().int(),
      projectId: z.string(),
      traceId: z.string(),
      spanId: z.string(),
      parentSpanId: z.string().nullable(),
      serviceName: z.string(),
      operationName: z.string(),
      startTime: isoDateTimeSchema,
      endTime: isoDateTimeSchema,
      statusCode: z.string(),
      attributes: jsonObjectSchema,
      receivedAt: isoDateTimeSchema,
    }),
  ),
  edges: z.array(
    z.object({
      sourceService: z.string(),
      targetService: z.string(),
      sourceSpanId: z.string(),
      targetSpanId: z.string(),
    }),
  ),
  errorServices: z.array(z.string()),
});

const otlpValueSchema = z.record(z.string(), z.unknown());
export const otlpLogsRequestSchema = z
  .object({ resourceLogs: z.array(otlpValueSchema).optional() })
  .loose();
export const otlpTracesRequestSchema = z
  .object({ resourceSpans: z.array(otlpValueSchema).optional() })
  .loose();
export const otlpIngestResponseSchema = z.object({ accepted: z.number().int().nonnegative() });

export type LogListRequest = z.infer<typeof logListRequestSchema>;
export type LogListResponse = z.infer<typeof logListResponseSchema>;
export type RunGetResponse = z.infer<typeof runGetResponseSchema>;
export type RunFlowResponse = z.infer<typeof runFlowResponseSchema>;
export type OtlpLogsRequest = z.infer<typeof otlpLogsRequestSchema>;
export type OtlpTracesRequest = z.infer<typeof otlpTracesRequestSchema>;
