import { z } from "zod";
import { isoDateTimeSchema } from "./common";
export {
  idParamsSchema as mockApiIdRequestSchema,
  idParamsSchema as mockApiRunRequestSchema,
} from "./common";
export {
  idResponseSchema as mockApiCreateResponseSchema,
  idResponseSchema as mockApiUpdateResponseSchema,
  idResponseSchema as mockApiDeleteResponseSchema,
} from "./common";

const mockApiInputSchema = z.object({
  name: z.string().trim().min(1).max(255),
  targetEndpointId: z.string().min(1),
  description: z.string().optional().default(""),
  pathParameters: z.record(z.string(), z.string()).optional().default({}),
  requestJson: z.unknown().optional().default({}),
});

export const mockApiListRequestSchema = z.void();
export const mockApiCreateRequestSchema = mockApiInputSchema;
export const mockApiUpdateRequestSchema = mockApiInputSchema;
export const mockApiListResponseSchema = z.array(
  z.object({
    id: z.string(),
    projectId: z.string(),
    name: z.string(),
    targetEndpointId: z.string().nullable(),
    pathParameters: z.record(z.string(), z.string()),
    requestJson: z.unknown(),
    description: z.string(),
    createdAt: isoDateTimeSchema,
  }),
);
export const mockApiRunResponseSchema = z.object({
  id: z.string(),
  traceId: z.string(),
  status: z.enum(["completed", "failed"]),
  responseStatus: z.number().int().nullable(),
  responseHeaders: z.record(z.string(), z.string()).nullable(),
  responseBody: z.string().nullable(),
  error: z.string().nullable(),
});

export type MockApiInput = z.infer<typeof mockApiCreateRequestSchema>;
export type MockApiListResponse = z.infer<typeof mockApiListResponseSchema>;
export type MockApiRunResponse = z.infer<typeof mockApiRunResponseSchema>;
