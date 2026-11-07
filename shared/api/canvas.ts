import { z } from "zod";
import { isoDateTimeSchema } from "./common";
import { messageConnectionInputSchema, messageDestinationInputSchema } from "./message-flows";
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
      apiType: z.enum(["REST", "GRPC", "WEBSOCKET"]).default("REST"),
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
      sourceSubscriptionId: z.string().nullable().optional(),
      targetEndpointId: z.string(),
    }),
  ),
  messageDestinations: z
    .array(
      messageDestinationInputSchema.and(
        z.object({
          projectId: z.string(),
          health: z.boolean().nullable().optional(),
        }),
      ),
    )
    .default([]),
  messageConnections: z
    .array(messageConnectionInputSchema.and(z.object({ id: z.string() })))
    .default([]),
  mockApis: z.array(
    z.object({
      id: z.string(),
      projectId: z.string(),
      name: z.string(),
      apiType: z.enum(["HTTP", "GRPC", "WEBSOCKET"]).default("HTTP"),
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

function validateMessageConnection(
  connection: z.infer<typeof messageConnectionInputSchema>,
  destination: z.infer<typeof messageDestinationInputSchema> | undefined,
  index: number,
  context: z.RefinementCtx,
) {
  const path = ["messageConnections", index];
  if (!destination) {
    context.addIssue({
      code: "custom",
      path: [...path, "destinationId"],
      message: "Unknown message destination",
    });
    return;
  }
  if (connection.type === "publish" && destination.broker === "kafka") {
    if (connection.routingKey !== undefined)
      context.addIssue({
        code: "custom",
        path: [...path, "routingKey"],
        message: "Kafka publish connections do not use routing keys",
      });
    return;
  }
  if (connection.type === "publish") {
    if (connection.routingKey === undefined)
      context.addIssue({
        code: "custom",
        path: [...path, "routingKey"],
        message: "RabbitMQ publish connections require a routing key",
      });
    return;
  }
  if (destination.broker === "kafka") {
    if (connection.bindingKey !== undefined)
      context.addIssue({
        code: "custom",
        path: [...path, "bindingKey"],
        message: "Kafka subscriptions do not use binding keys",
      });
    if (!connection.consumerGroup?.trim())
      context.addIssue({
        code: "custom",
        path: [...path, "consumerGroup"],
        message: "Kafka subscriptions require a consumer group",
      });
    return;
  }
  if (connection.consumerGroup !== undefined)
    context.addIssue({
      code: "custom",
      path: [...path, "consumerGroup"],
      message: "RabbitMQ subscriptions do not use consumer groups",
    });
  if (connection.bindingKey === undefined)
    context.addIssue({
      code: "custom",
      path: [...path, "bindingKey"],
      message: "RabbitMQ subscriptions require a binding key",
    });
}

export const canvasPutRequestSchema = z
  .object({
    nodesLocked: z.boolean().default(false),
    viewport: pointSchema.extend({ zoom: z.number().positive() }),
    services: z.array(z.object({ id: z.string().min(1), ...pointSchema.shape })),
    mockApiPositions: z.array(z.object({ id: z.string().min(1), ...pointSchema.shape })).optional(),
    messageDestinations: z.array(messageDestinationInputSchema).optional(),
    messageConnections: z.array(messageConnectionInputSchema).optional(),
    edges: z.array(
      z.object({
        sourceServiceId: z.string().min(1),
        sourceEndpointId: z.string().min(1).nullable().optional(),
        sourceSubscriptionId: z.string().min(1).nullable().optional(),
        targetEndpointId: z.string().min(1),
      }),
    ),
  })
  .superRefine(({ messageDestinations = [], messageConnections = [] }, context) => {
    const destinations = new Map(
      messageDestinations.map((destination) => [destination.id, destination]),
    );
    for (const [index, connection] of messageConnections.entries()) {
      const destination = destinations.get(connection.destinationId);
      validateMessageConnection(connection, destination, index, context);
    }
  });
export const canvasPutResponseSchema = z.object({ saved: z.literal(true) });

export type CanvasGetResponse = z.infer<typeof canvasGetResponseSchema>;
export type CanvasPutRequest = z.input<typeof canvasPutRequestSchema>;
export type CanvasPutResponse = z.infer<typeof canvasPutResponseSchema>;
