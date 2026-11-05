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

const headerSchema = z.object({ name: z.string(), value: z.string() });
const apiTypeSchema = z.enum(["REST", "GRAPHQL"]).default("REST");
export const readinessReasonSchema = z.object({ code: z.string(), message: z.string() });
const mockApiInputFields = z.object({
  name: z.string().trim().min(1).max(255),
  apiType: apiTypeSchema,
  targetEndpointId: z.string().min(1).nullable().default(null),
  description: z.string().optional().default(""),
  pathParameters: z.record(z.string(), z.string()).optional().default({}),
  requestJson: z.unknown().optional().default({}),
  headerTemplateId: z.string().min(1).nullable().optional().default(null),
  authorizationTemplateId: z.string().min(1).nullable().optional(),
  customHeaders: z.array(headerSchema).optional().default([]),
  active: z.boolean().optional().default(true),
  importMethod: z.string().max(10).nullable().optional().default(null),
  importUrl: z.string().nullable().optional().default(null),
  matchUrl: z.string().nullable().optional().default(null),
});
const validateMockApiActivation = <T extends { targetEndpointId: string | null; active: boolean }>(
  schema: z.ZodType<T>,
) =>
  schema.superRefine(({ targetEndpointId, active }, context) => {
    if (!targetEndpointId && active)
      context.addIssue({
        code: "custom",
        path: ["active"],
        message: "Mock APIs without an endpoint must be inactive",
      });
  });
const mockApiInputSchema = validateMockApiActivation(mockApiInputFields);

export const mockApiListRequestSchema = z.void();
export const mockApiCreateRequestSchema = mockApiInputSchema;
export const mockApiUpdateRequestSchema = mockApiInputSchema;
export const mockApiListResponseSchema = z.array(
  z.object({
    id: z.string(),
    projectId: z.string(),
    name: z.string(),
    apiType: z.enum(["REST", "GRAPHQL"]),
    targetEndpointId: z.string().nullable(),
    headerTemplateId: z.string().nullable(),
    authorizationTemplateId: z.string().nullable().optional(),
    customHeaders: z.array(headerSchema),
    active: z.boolean(),
    status: z.enum(["draft", "inactive", "ready"]),
    readinessReasons: z.array(readinessReasonSchema),
    importMethod: z.string().nullable(),
    importUrl: z.string().nullable(),
    matchUrl: z.string().nullable(),
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

export const headerTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  headers: z.array(headerSchema),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export const headerTemplateInputSchema = z.object({
  name: z.string().trim().min(1).max(255),
  headers: z.array(headerSchema),
});
export const authorizationTemplateInputSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().optional(),
    name: z.string().trim().min(1).max(255),
    type: z.literal("bearer"),
    token: z.string(),
  }),
  z.object({
    id: z.string().optional(),
    name: z.string().trim().min(1).max(255),
    type: z.literal("basic"),
    username: z.string(),
    password: z.string(),
  }),
  z.object({
    id: z.string().optional(),
    name: z.string().trim().min(1).max(255),
    type: z.literal("api-key"),
    headerName: z.string(),
    value: z.string(),
  }),
  z.object({
    id: z.string().optional(),
    name: z.string().trim().min(1).max(255),
    type: z.literal("oauth-client-credentials"),
    tokenUrl: z.url(),
    clientId: z.string(),
    clientSecret: z.string(),
    scope: z.string().optional(),
  }),
]);
export const authorizationTemplateSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    name: z.string(),
    type: z.literal("bearer"),
    token: z.string(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  }),
  z.object({
    id: z.string(),
    name: z.string(),
    type: z.literal("basic"),
    username: z.string(),
    password: z.string(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  }),
  z.object({
    id: z.string(),
    name: z.string(),
    type: z.literal("api-key"),
    headerName: z.string(),
    value: z.string(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  }),
  z.object({
    id: z.string(),
    name: z.string(),
    type: z.literal("oauth-client-credentials"),
    tokenUrl: z.url(),
    clientId: z.string(),
    clientSecret: z.string(),
    scope: z.string().optional(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  }),
]);
export const mockApiSettingsSaveRequestSchema = z.object({
  environmentVariables: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string().trim().min(1).max(255),
      value: z.string(),
    }),
  ),
  headerTemplates: z.array(headerTemplateInputSchema.extend({ id: z.string().optional() })),
  authorizationTemplates: z.array(authorizationTemplateInputSchema).default([]),
  mockApis: z.array(
    validateMockApiActivation(mockApiInputFields.extend({ id: z.string().optional() })),
  ),
});
export const mockApiSettingsSaveResponseSchema = z.object({
  saved: z.literal(true),
  idMap: z.object({
    environmentVariables: z.record(z.string(), z.string()),
    headerTemplates: z.record(z.string(), z.string()),
    authorizationTemplates: z.record(z.string(), z.string()).default({}),
    mockApis: z.record(z.string(), z.string()),
  }),
});
export type MockApiSettingsSaveRequest = z.infer<typeof mockApiSettingsSaveRequestSchema>;
export type HeaderTemplate = z.infer<typeof headerTemplateSchema>;
export type AuthorizationTemplateInput = z.infer<typeof authorizationTemplateInputSchema>;
export type AuthorizationTemplate = z.infer<typeof authorizationTemplateSchema>;
export type HeaderInput = z.infer<typeof headerSchema>;

export type MockApiInput = z.infer<typeof mockApiCreateRequestSchema>;
export type MockApiListResponse = z.infer<typeof mockApiListResponseSchema>;
export type MockApiRunResponse = z.infer<typeof mockApiRunResponseSchema>;
