import { z } from "zod";
import { isoDateTimeSchema } from "./common";

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
  viewport: canvasViewportSchema,
  mockNode: pointSchema,
  services: z.array(
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
      endpoints: z.array(
        z.object({
          id: z.string(),
          projectId: z.string(),
          serviceId: z.string(),
          name: z.string(),
          apiType: z.string(),
          method: z.string(),
          url: z.string(),
          createdAt: isoDateTimeSchema,
        }),
      ),
    }),
  ),
  edges: z.array(
    z.object({ id: z.string(), sourceServiceId: z.string(), targetEndpointId: z.string() }),
  ),
  mockApis: z.array(
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
  ),
});

export const canvasPutRequestSchema = z.object({
  viewport: pointSchema.extend({ zoom: z.number().positive() }),
  mockNode: pointSchema,
  services: z.array(z.object({ id: z.string().min(1), ...pointSchema.shape })),
  edges: z.array(
    z.object({ sourceServiceId: z.string().min(1), targetEndpointId: z.string().min(1) }),
  ),
});
export const canvasPutResponseSchema = z.object({ saved: z.literal(true) });

export type CanvasGetResponse = z.infer<typeof canvasGetResponseSchema>;
export type CanvasPutRequest = z.infer<typeof canvasPutRequestSchema>;
export type CanvasPutResponse = z.infer<typeof canvasPutResponseSchema>;
