import { z } from "zod";
import { isoDateTimeSchema } from "./common";
import {
  authorizationTemplateSchema,
  headerTemplateSchema,
  readinessReasonSchema,
} from "./mock-apis";

const pointSchema = z.object({ x: z.number(), y: z.number() });
const canvasViewportSchema = z
  .object({
    x: z.number().catch(0),
    y: z.number().catch(0),
    zoom: z.number().positive().catch(1),
  })
  .catch({ x: 0, y: 0, zoom: 1 });

export const canvasGetRequestSchema = z.void();
export const canvasGetResponseSchema = z.object({
  nodesLocked: z.boolean().default(false),
  viewport: canvasViewportSchema,
  services: z.array(
    z.object({
      id: z.string(),
      codeKey: z.string(),
      projectId: z.string(),
      name: z.string(),
      apiType: z.enum(["REST", "GRPC"]).default("REST"),
      framework: z.string(),
      baseUrl: z.string(),
      grpcTls: z.boolean().default(false),
      protoFileName: z.string().nullable().default(null),
      healthCheckUrl: z.string().nullable(),
      healthCheckHeaderTemplateId: z.string().nullable(),
      healthCheckCustomHeaders: z.array(z.object({ name: z.string(), value: z.string() })),
      active: z.boolean(),
      positionX: z.number(),
      positionY: z.number(),
      createdAt: isoDateTimeSchema,
      endpoints: z.array(
        z.object({
          id: z.string(),
          codeKey: z.string(),
          projectId: z.string(),
          serviceId: z.string(),
          name: z.string(),
          method: z.string().nullable(),
          url: z.string().nullable(),
          rpcMethod: z.string().nullable(),
          createdAt: isoDateTimeSchema,
        }),
      ),
    }),
  ),
  edges: z.array(
    z.object({
      id: z.string(),
      sourceServiceId: z.string(),
      sourceEndpointId: z.string().nullable(),
      targetEndpointId: z.string(),
    }),
  ),
  mockApis: z.array(
    z.object({
      id: z.string(),
      projectId: z.string(),
      name: z.string(),
      apiType: z.enum(["HTTP", "GRPC"]).default("HTTP"),
      targetEndpointId: z.string().nullable(),
      headerTemplateId: z.string().nullable(),
      authorizationTemplateId: z.string().nullable().optional(),
      customHeaders: z.array(z.object({ name: z.string(), value: z.string() })),
      active: z.boolean(),
      positionX: z.number().nullable().optional(),
      positionY: z.number().nullable().optional(),
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
  ),
  headerTemplates: z.array(headerTemplateSchema),
  authorizationTemplates: z.array(authorizationTemplateSchema).default([]),
});

export const canvasPutRequestSchema = z.object({
  nodesLocked: z.boolean().default(false),
  viewport: pointSchema.extend({ zoom: z.number().positive() }),
  services: z.array(z.object({ id: z.string().min(1), ...pointSchema.shape })),
  mockApiPositions: z.array(z.object({ id: z.string().min(1), ...pointSchema.shape })).optional(),
  edges: z.array(
    z.object({
      sourceServiceId: z.string().min(1),
      sourceEndpointId: z.string().min(1).nullable().optional(),
      targetEndpointId: z.string().min(1),
    }),
  ),
});
export const canvasPutResponseSchema = z.object({ saved: z.literal(true) });

export type CanvasGetResponse = z.infer<typeof canvasGetResponseSchema>;
export type CanvasPutRequest = z.infer<typeof canvasPutRequestSchema>;
export type CanvasPutResponse = z.infer<typeof canvasPutResponseSchema>;
