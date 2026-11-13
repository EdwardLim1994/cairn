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
  name: z.string().trim().min(1).max(255),
  method: methodSchema.nullable().optional(),
  url: z.string().trim().min(1).max(2048).nullable().optional(),
  rpcMethod: z.string().trim().min(1).max(512).nullable().optional(),
});
const endpointResponseSchema = endpointInputSchema.extend({
  id: z.string(),
  projectId: z.string(),
  serviceId: z.string(),
  method: methodSchema.nullable(),
  url: z.string().nullable(),
  rpcMethod: z.string().nullable(),
  createdAt: isoDateTimeSchema,
});

const serviceFieldsSchema = z.object({
  name: z.string().trim().min(1).max(255),
  apiType: z.enum(["REST", "GRPC", "WEBSOCKET"]).default("REST"),
  framework: z.string().trim().min(1).max(100),
  baseUrl: z.string().trim().min(1).max(2048),
  grpcTls: z.boolean().optional().default(false),
  protoContent: z
    .string()
    .max(1024 * 1024)
    .nullable()
    .optional(),
  protoFileName: z.string().trim().max(255).nullable().optional(),
  clearProto: z.boolean().optional().default(false),
  healthCheckUrl: z.string().trim().max(2048).nullable().optional().default(null),
  healthCheckHeaderTemplateId: z.string().nullable().optional().default(null),
  healthCheckCustomHeaders: z.array(headerRowSchema).optional().default([]),
  active: z.boolean().optional().default(true),
  endpoints: z.array(endpointInputSchema),
});
function validateService(service: z.infer<typeof serviceFieldsSchema>, context: z.RefinementCtx) {
  if (service.apiType === "GRPC") {
    const match = /^(?:\[[^\]]+\]|[^:/?#\s]+):(\d{1,5})$/.exec(service.baseUrl);
    const port = match ? Number(match[1]) : 0;
    if (!match || port < 1 || port > 65535)
      context.addIssue({
        code: "custom",
        path: ["baseUrl"],
        message: "Expected a host:port gRPC target",
      });
  }
  if (service.apiType === "WEBSOCKET" && !validWebSocketUrl(service.baseUrl))
    context.addIssue({
      code: "custom",
      path: ["baseUrl"],
      message: "Expected a ws:// or wss:// WebSocket URL",
    });
  for (const [index, endpoint] of service.endpoints.entries()) {
    validateEndpoint(service.apiType, endpoint, index, context);
  }
}

function validateEndpoint(
  apiType: z.infer<typeof serviceFieldsSchema>["apiType"],
  endpoint: z.infer<typeof endpointInputSchema>,
  index: number,
  context: z.RefinementCtx,
) {
  const invalid =
    (apiType === "REST" && (!endpoint.method || !endpoint.url || endpoint.rpcMethod)) ||
    (apiType === "GRPC" && (!endpoint.rpcMethod || endpoint.method || endpoint.url)) ||
    (apiType === "WEBSOCKET" &&
      (!endpoint.url || !validWebSocketUrl(endpoint.url) || endpoint.method || endpoint.rpcMethod));
  if (!invalid) return;
  const message = {
    REST: "REST endpoints need method and URL",
    GRPC: "gRPC endpoints need an RPC method",
    WEBSOCKET: "WebSocket endpoints need a ws:// or wss:// URL",
  }[apiType];
  context.addIssue({ code: "custom", path: ["endpoints", index], message });
}

function validWebSocketUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "ws:" || url.protocol === "wss:") &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
export const serviceInputSchema = serviceFieldsSchema.superRefine(validateService);
export const serviceCreateRequestSchema = serviceFieldsSchema
  .extend({
    positionX: z.number().optional(),
    positionY: z.number().optional(),
  })
  .superRefine(validateService);
export const serviceUpdateRequestSchema = serviceFieldsSchema.superRefine(validateService);
export const serviceListRequestSchema = z.void();
export const serviceListResponseSchema = z.array(
  z.object({
    id: z.string(),
    projectId: z.string(),
    name: z.string(),
    apiType: z.enum(["REST", "GRPC", "WEBSOCKET"]),
    protoFileName: z.string().nullable(),
    framework: z.string(),
    baseUrl: z.string(),
    grpcTls: z.boolean(),
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
export const protoParseRequestSchema = z.object({ content: z.string().max(1024 * 1024) });
export const protoParseResponseSchema = z.object({
  methods: z.array(z.object({ name: z.string(), rpcMethod: z.string() })),
  streamingMethods: z.array(z.string()),
  unresolvedImports: z.array(z.string()),
});

export type ServiceInput = z.input<typeof serviceInputSchema>;
export type ServiceCreateRequest = z.input<typeof serviceCreateRequestSchema>;
export type ServiceUpdateRequest = z.input<typeof serviceUpdateRequestSchema>;
export type ServiceListResponse = z.infer<typeof serviceListResponseSchema>;
export type ServiceHealthResponse = z.infer<typeof serviceHealthResponseSchema>;
