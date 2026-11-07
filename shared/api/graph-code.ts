import { z } from "zod";
import { kafkaConnectionSchema, rabbitMqConnectionSchema } from "./message-flows";

const frameworkSchema = z.enum(["Spring Boot", ".NET", "Other"]);
const methodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const keySchema = z.string().trim().min(1).max(128);
const headerSchema = z.object({ name: z.string(), value: z.string() });
const outboundConnectionSchema = z.object({ serviceKey: keySchema, endpointKey: keySchema });
const endpointSchema = z.object({
  key: keySchema,
  name: z.string().trim().min(1).max(255),
  method: methodSchema.nullable().optional(),
  url: z.string().trim().min(1).max(2048).nullable().optional(),
  rpcMethod: z.string().trim().min(1).max(512).nullable().optional(),
  outboundConnections: z.array(outboundConnectionSchema),
});
const serviceSchema = z
  .object({
    key: keySchema,
    name: z.string().trim().min(1).max(255),
    apiType: z.enum(["REST", "GRPC", "WEBSOCKET"]).default("REST"),
    framework: frameworkSchema,
    baseUrl: z.string().trim().min(1).max(2048),
    grpcTls: z.boolean().default(false),
    healthCheck: z
      .object({
        url: z
          .string()
          .trim()
          .min(1)
          .max(2048)
          .refine(
            (url) => /^https?:\/\//i.test(url) || (url.startsWith("/") && !url.startsWith("//")),
            "Expected HTTP URL or service path",
          ),
        headers: z.array(headerSchema),
      })
      .optional(),
    endpoints: z.array(endpointSchema),
  })
  .superRefine((service, context) => {
    if (service.apiType === "REST" && !/^https?:\/\//i.test(service.baseUrl))
      context.addIssue({ code: "custom", path: ["baseUrl"], message: "Expected HTTP URL" });
    if (service.apiType === "WEBSOCKET" && !validWebSocketUrl(service.baseUrl))
      context.addIssue({
        code: "custom",
        path: ["baseUrl"],
        message: "Expected ws:// or wss:// URL",
      });
    if (service.apiType === "GRPC") {
      const match = /^(?:\[[^\]]+\]|[^:/?#\s]+):(\d{1,5})$/.exec(service.baseUrl);
      const port = match ? Number(match[1]) : 0;
      if (!match || port < 1 || port > 65535)
        context.addIssue({
          code: "custom",
          path: ["baseUrl"],
          message: "Expected host:port gRPC target",
        });
    }
    service.endpoints.forEach((endpoint, index) => {
      if (service.apiType === "REST" && (!endpoint.method || !endpoint.url || endpoint.rpcMethod))
        context.addIssue({
          code: "custom",
          path: ["endpoints", index],
          message: "REST endpoints need method and URL",
        });
      if (service.apiType === "GRPC" && (!endpoint.rpcMethod || endpoint.method || endpoint.url))
        context.addIssue({
          code: "custom",
          path: ["endpoints", index],
          message: "gRPC endpoints need an RPC method",
        });
      if (
        service.apiType === "WEBSOCKET" &&
        (!endpoint.url || !validWebSocketUrl(endpoint.url) || endpoint.method || endpoint.rpcMethod)
      )
        context.addIssue({
          code: "custom",
          path: ["endpoints", index],
          message: "WebSocket endpoints need a ws:// or wss:// URL",
        });
    });
  });

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

const destinationSchema = z.discriminatedUnion("broker", [
  z.object({
    key: keySchema,
    queueKey: keySchema.optional(),
    queueName: z.string().trim().min(1).max(255).optional(),
    broker: z.literal("kafka"),
    name: z.string().trim().min(1).max(255),
    connection: kafkaConnectionSchema.strict(),
  }),
  z.object({
    key: keySchema,
    queueKey: keySchema.optional(),
    queueName: z.string().trim().min(1).max(255).optional(),
    broker: z.literal("rabbitmq"),
    name: z.string().trim().min(1).max(255),
    connection: rabbitMqConnectionSchema.strict(),
  }),
]);

const messageConnectionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("publish"),
    destinationKey: keySchema,
    serviceKey: keySchema,
    endpointKey: keySchema.optional(),
    routingKey: z.string().trim().min(1).max(255).optional(),
  }),
  z.object({
    type: z.literal("subscribe"),
    destinationKey: keySchema,
    serviceKey: keySchema,
    consumerGroup: z.string().trim().min(1).max(255).optional(),
    bindingKey: z.string().trim().min(1).max(255).optional(),
  }),
]);

const mockApiSchema = z.object({
  key: keySchema,
  name: z.string().trim().min(1).max(255),
  serviceKey: keySchema,
  endpointKey: keySchema,
  message: z.string().min(1),
});

const graphCodeV1Schema = z.object({ version: z.literal(1), services: z.array(serviceSchema) });
const graphCodeV2Schema = z.object({
  version: z.literal(2),
  services: z.array(serviceSchema),
  destinations: z.array(destinationSchema),
  messageConnections: z.array(messageConnectionSchema),
  mockApis: z.array(mockApiSchema).optional(),
});

type SchemaContext = z.RefinementCtx;
type GraphService = z.infer<typeof serviceSchema>;
type GraphCodeV2 = z.infer<typeof graphCodeV2Schema>;

function addServiceEndpointIssues(
  service: GraphService,
  serviceIndex: number,
  serviceByKey: Map<string, GraphService>,
  context: SchemaContext,
) {
  const endpointKeys = new Set<string>();
  service.endpoints.forEach((endpoint, endpointIndex) => {
    if (endpointKeys.has(endpoint.key))
      context.addIssue({
        code: "custom",
        path: ["services", serviceIndex, "endpoints", endpointIndex, "key"],
        message: `Duplicate endpoint key: ${endpoint.key}`,
      });
    endpointKeys.add(endpoint.key);
    const targets = new Set<string>();
    endpoint.outboundConnections.forEach((connection, connectionIndex) => {
      const path = [
        "services",
        serviceIndex,
        "endpoints",
        endpointIndex,
        "outboundConnections",
        connectionIndex,
      ];
      const targetKey = `${connection.serviceKey}\0${connection.endpointKey}`;
      if (targets.has(targetKey))
        context.addIssue({ code: "custom", path, message: "Duplicate outbound connection" });
      targets.add(targetKey);
      const targetService = serviceByKey.get(connection.serviceKey);
      const targetEndpoint = targetService?.endpoints.find(
        (item) => item.key === connection.endpointKey,
      );
      if (!targetService || !targetEndpoint)
        context.addIssue({
          code: "custom",
          path,
          message: `Unknown endpoint reference: ${connection.serviceKey}.${connection.endpointKey}`,
        });
      else if (connection.serviceKey === service.key)
        context.addIssue({
          code: "custom",
          path,
          message: "A service cannot call its own endpoint",
        });
    });
  });
}

function validateServices(services: GraphService[], context: SchemaContext) {
  const serviceByKey = new Map<string, GraphService>();
  services.forEach((service, index) => {
    if (serviceByKey.has(service.key))
      context.addIssue({
        code: "custom",
        path: ["services", index, "key"],
        message: `Duplicate service key: ${service.key}`,
      });
    else serviceByKey.set(service.key, service);
  });
  services.forEach((service, index) =>
    addServiceEndpointIssues(service, index, serviceByKey, context),
  );
  return serviceByKey;
}

function validateMessageConnection(
  connection: GraphCodeV2["messageConnections"][number],
  index: number,
  seen: Set<string>,
  destinationByKey: Map<string, z.infer<typeof destinationSchema>>,
  serviceByKey: Map<string, GraphService>,
  context: SchemaContext,
) {
  const path = ["messageConnections", index];
  const destination = destinationByKey.get(connection.destinationKey);
  const service = serviceByKey.get(connection.serviceKey);
  const key = [
    connection.type,
    connection.destinationKey,
    connection.serviceKey,
    ...(connection.type === "publish" ? [connection.endpointKey] : []),
  ].join(":");
  if (seen.has(key))
    context.addIssue({ code: "custom", path, message: "Duplicate message connection" });
  seen.add(key);
  if (!destination)
    context.addIssue({
      code: "custom",
      path: [...path, "destinationKey"],
      message: `Unknown destination reference: ${connection.destinationKey}`,
    });
  if (!service)
    context.addIssue({
      code: "custom",
      path: [...path, "serviceKey"],
      message: `Unknown service reference: ${connection.serviceKey}`,
    });
  if (connection.type === "publish")
    validatePublishConnection(connection, path, destination, service, context);
  else validateSubscriptionConnection(connection, path, destination, context);
}

function validatePublishConnection(
  connection: GraphCodeV2["messageConnections"][number] & { type: "publish" },
  path: (string | number)[],
  destination: z.infer<typeof destinationSchema> | undefined,
  service: GraphService | undefined,
  context: SchemaContext,
) {
  if (
    connection.endpointKey &&
    !service?.endpoints.some((item) => item.key === connection.endpointKey)
  )
    context.addIssue({
      code: "custom",
      path: [...path, "endpointKey"],
      message: `Unknown endpoint reference: ${connection.serviceKey}.${connection.endpointKey}`,
    });
  if (destination?.broker === "rabbitmq" && connection.routingKey === undefined)
    context.addIssue({
      code: "custom",
      path: [...path, "routingKey"],
      message: "RabbitMQ publish connections require a routing key",
    });
  if (destination?.broker === "kafka" && connection.routingKey !== undefined)
    context.addIssue({
      code: "custom",
      path: [...path, "routingKey"],
      message: "Kafka publish connections do not use routing keys",
    });
}

function validateSubscriptionConnection(
  connection: GraphCodeV2["messageConnections"][number] & { type: "subscribe" },
  path: (string | number)[],
  destination: z.infer<typeof destinationSchema> | undefined,
  context: SchemaContext,
) {
  if (destination?.broker === "kafka") {
    if (!connection.consumerGroup?.trim())
      context.addIssue({
        code: "custom",
        path: [...path, "consumerGroup"],
        message: "Kafka subscriptions require a consumer group",
      });
    if (connection.bindingKey !== undefined)
      context.addIssue({
        code: "custom",
        path: [...path, "bindingKey"],
        message: "Kafka subscriptions do not use binding keys",
      });
  }
  if (destination?.broker === "rabbitmq") {
    if (connection.consumerGroup !== undefined)
      context.addIssue({
        code: "custom",
        path: [...path, "consumerGroup"],
        message: "RabbitMQ subscriptions do not use consumer groups",
      });
    if (!connection.bindingKey?.trim())
      context.addIssue({
        code: "custom",
        path: [...path, "bindingKey"],
        message: "RabbitMQ subscriptions require a binding key",
      });
  }
}

function validateGraphCodeV2(
  manifest: GraphCodeV2,
  serviceByKey: Map<string, GraphService>,
  context: SchemaContext,
) {
  const destinationByKey = new Map<string, z.infer<typeof destinationSchema>>();
  manifest.destinations.forEach((destination, index) => {
    if (destinationByKey.has(destination.key))
      context.addIssue({
        code: "custom",
        path: ["destinations", index, "key"],
        message: `Duplicate destination key: ${destination.key}`,
      });
    else destinationByKey.set(destination.key, destination);
  });
  const seen = new Set<string>();
  manifest.messageConnections.forEach((connection, index) =>
    validateMessageConnection(connection, index, seen, destinationByKey, serviceByKey, context),
  );
}

export const graphCodeManifestSchema = z
  .discriminatedUnion("version", [graphCodeV1Schema, graphCodeV2Schema])
  .superRefine((manifest, context) => {
    const serviceByKey = validateServices(manifest.services, context);
    if (manifest.version === 2) {
      validateGraphCodeV2(manifest, serviceByKey, context);
      const mockApiKeys = new Set<string>();
      manifest.mockApis?.forEach((api, index) => {
        if (mockApiKeys.has(api.key))
          context.addIssue({
            code: "custom",
            path: ["mockApis", index, "key"],
            message: `Duplicate mock API key: ${api.key}`,
          });
        mockApiKeys.add(api.key);
        const service = serviceByKey.get(api.serviceKey);
        const endpoint = service?.endpoints.find(({ key }) => key === api.endpointKey);
        if (!service || service.apiType !== "WEBSOCKET" || !endpoint)
          context.addIssue({
            code: "custom",
            path: ["mockApis", index],
            message: "WebSocket mock APIs must target a registered WebSocket service endpoint",
          });
      });
    }
  });

export type GraphCodeManifest = {
  version: 1 | 2;
  services: Array<z.input<typeof serviceSchema>>;
  destinations?: Array<z.input<typeof destinationSchema>>;
  messageConnections?: Array<z.input<typeof messageConnectionSchema>>;
  mockApis?: Array<z.input<typeof mockApiSchema>>;
};
