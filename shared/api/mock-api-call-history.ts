import { z } from "zod";
import { isoDateTimeSchema } from "./common";

export { idParamsSchema as mockApiCallHistoryIdRequestSchema } from "./common";

export const mockApiCallHistoryListRequestSchema = z.void();
export const mockApiCallHistoryDeleteResponseSchema = z.object({ id: z.string() });
export const mockApiCallHistoryClearResponseSchema = z.object({
  deleted: z.number().int().nonnegative(),
});
export const mockApiCallHistoryListResponseSchema = z.array(
  z.object({
    id: z.string(),
    projectId: z.string(),
    runId: z.string(),
    mockApiId: z.string(),
    mockApiName: z.string(),
    method: z.string(),
    url: z.string(),
    requestBody: z.unknown().nullable(),
    traceId: z.string(),
    status: z.enum(["running", "completed", "failed"]),
    triggeredAt: isoDateTimeSchema,
    responseStatus: z.number().int().nullable(),
    grpcStatus: z.number().int().nullable().optional(),
    grpcStatusName: z.string().nullable().optional(),
    responseHeaders: z.record(z.string(), z.string()).nullable(),
    responseBody: z.string().nullable(),
    error: z.string().nullable(),
  }),
);

export type MockApiCallHistoryEntry = z.infer<typeof mockApiCallHistoryListResponseSchema>[number];
