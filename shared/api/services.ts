import { z } from "zod";
import { isoDateTimeSchema } from "./common";
export { idParamsSchema as serviceIdRequestSchema } from "./common";
export {
  idResponseSchema as serviceCreateResponseSchema,
  idResponseSchema as serviceUpdateResponseSchema,
  idResponseSchema as serviceDeleteResponseSchema,
} from "./common";

const methodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const headerRowSchema = z.object({ name: z.string(), value: z.string() });
const endpointInputSchema = z.object({
  id: z.string().optional(),
  codeKey: z.string().trim().min(1).max(128).optional(),
  name: z.string().trim().min(1).max(255),
  method: methodSchema,
  url: z.string().trim().min(1).max(2048),
});
const endpointResponseSchema = endpointInputSchema.extend({
  id: z.string(),
  codeKey: z.string(),
  projectId: z.string(),
  serviceId: z.string(),
  createdAt: isoDateTimeSchema,
});

const serviceInputFields = z.object({
  codeKey: z.string().trim().min(1).max(128).optional(),
  name: z.string().trim().min(1).max(255),
  apiType: z.enum(["REST", "GRAPHQL"]).default("REST"),
  framework: z.string().trim().min(1).max(100),
  baseUrl: z.string().trim().min(1).max(2048),
  healthCheckUrl: z.string().trim().max(2048).nullable().optional().default(null),
  healthCheckHeaderTemplateId: z.string().nullable().optional().default(null),
  healthCheckCustomHeaders: z.array(headerRowSchema).optional().default([]),
  active: z.boolean().optional().default(true),
  endpoints: z.array(endpointInputSchema),
});
const validateServiceApiType = <
  T extends { apiType: "REST" | "GRAPHQL"; endpoints: { method: string }[] },
>(
  schema: z.ZodType<T>,
) =>
  schema.superRefine(({ apiType, endpoints }, context) => {
    if (apiType === "GRAPHQL" && endpoints.length !== 1)
      context.addIssue({
        code: "custom",
        path: ["endpoints"],
        message: "Exactly one GraphQL endpoint is required",
      });
    if (apiType === "GRAPHQL" && endpoints[0]?.method !== "POST")
      context.addIssue({
        code: "custom",
        path: ["endpoints", 0, "method"],
        message: "GraphQL endpoint method must be POST",
      });
  });
export const serviceInputSchema = validateServiceApiType(serviceInputFields);
export const serviceCreateRequestSchema = validateServiceApiType(
  serviceInputFields.extend({
    positionX: z.number().optional(),
    positionY: z.number().optional(),
  }),
);
export const serviceUpdateRequestSchema = validateServiceApiType(
  serviceInputFields
    .omit({ codeKey: true })
    .extend({ endpoints: z.array(endpointInputSchema.omit({ codeKey: true })) }),
);
export const serviceListRequestSchema = z.void();
export const serviceListResponseSchema = z.array(
  z.object({
    id: z.string(),
    codeKey: z.string(),
    projectId: z.string(),
    name: z.string(),
    apiType: z.enum(["REST", "GRAPHQL"]),
    framework: z.string(),
    baseUrl: z.string(),
    healthCheckUrl: z.string().nullable(),
    healthCheckHeaderTemplateId: z.string().nullable(),
    healthCheckCustomHeaders: z.array(headerRowSchema),
    active: z.boolean(),
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
