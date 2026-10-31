import { z } from "zod";
import { isoDateTimeSchema } from "./common";
export { idParamsSchema as serviceIdRequestSchema } from "./common";
export {
  idResponseSchema as serviceCreateResponseSchema,
  idResponseSchema as serviceUpdateResponseSchema,
  idResponseSchema as serviceDeleteResponseSchema,
} from "./common";

const methodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const endpointInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(255),
  apiType: z.literal("REST"),
  method: methodSchema,
  url: z.string().trim().min(1).max(2048),
});
const endpointResponseSchema = endpointInputSchema.extend({
  id: z.string(),
  projectId: z.string(),
  serviceId: z.string(),
  createdAt: isoDateTimeSchema,
});

export const serviceInputSchema = z.object({
  name: z.string().trim().min(1).max(255),
  framework: z.string().trim().min(1).max(100),
  baseUrl: z.string().trim().min(1).max(2048),
  active: z.boolean().optional().default(true),
  endpoints: z.array(endpointInputSchema),
});
export const serviceCreateRequestSchema = serviceInputSchema.extend({
  positionX: z.number().optional(),
  positionY: z.number().optional(),
});
export const serviceUpdateRequestSchema = serviceInputSchema;
export const serviceListRequestSchema = z.void();
export const serviceListResponseSchema = z.array(
  z.object({
    id: z.string(),
    projectId: z.string(),
    name: z.string(),
    framework: z.string(),
    baseUrl: z.string(),
    active: z.boolean(),
    positionX: z.number(),
    positionY: z.number(),
    createdAt: isoDateTimeSchema,
    endpoints: z.array(endpointResponseSchema),
  }),
);
export const serviceHealthRequestSchema = z.void();
export const serviceHealthResponseSchema = z.array(
  z.object({ id: z.string(), online: z.boolean() }),
);

export type ServiceInput = z.infer<typeof serviceInputSchema>;
export type ServiceCreateRequest = z.infer<typeof serviceCreateRequestSchema>;
export type ServiceUpdateRequest = z.infer<typeof serviceUpdateRequestSchema>;
export type ServiceListResponse = z.infer<typeof serviceListResponseSchema>;
export type ServiceHealthResponse = z.infer<typeof serviceHealthResponseSchema>;
