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
    apiType: z.enum(["REST", "GRPC"]).default("REST"),
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
    });
  });

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

const graphCodeV1Schema = z.object({ version: z.literal(1), services: z.array(serviceSchema) });
const graphCodeV2Schema = z.object({
  version: z.literal(2),
  services: z.array(serviceSchema),
  destinations: z.array(destinationSchema),
  messageConnections: z.array(messageConnectionSchema),
});

export const graphCodeManifestSchema = z
  .discriminatedUnion("version", [graphCodeV1Schema, graphCodeV2Schema])
  .superRefine((manifest, context) => {
    const serviceByKey = new Map<string, z.infer<typeof serviceSchema>>();
    manifest.services.forEach((service, serviceIndex) => {
      if (serviceByKey.has(service.key))
        context.addIssue({
          code: "custom",
          path: ["services", serviceIndex, "key"],
          message: `Duplicate service key: ${service.key}`,
        });
      else serviceByKey.set(service.key, service);
    });

    manifest.services.forEach((service, serviceIndex) => {
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
          const target = `${connection.serviceKey}\0${connection.endpointKey}`;
          const path = [
            "services",
            serviceIndex,
            "endpoints",
            endpointIndex,
            "outboundConnections",
            connectionIndex,
          ];
          if (targets.has(target))
            context.addIssue({ code: "custom", path, message: "Duplicate outbound connection" });
          targets.add(target);
          const targetService = serviceByKey.get(connection.serviceKey);
          const targetEndpoint = targetService?.endpoints.find(
            (candidate) => candidate.key === connection.endpointKey,
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
    });

    if (manifest.version !== 2) return;
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
    manifest.messageConnections.forEach((connection, index) => {
      const path = ["messageConnections", index];
      const destination = destinationByKey.get(connection.destinationKey);
      const service = serviceByKey.get(connection.serviceKey);
      const connectionKey =
        connection.type === "publish"
          ? `${connection.type}:${connection.destinationKey}:${connection.serviceKey}:${connection.endpointKey}`
          : `${connection.type}:${connection.destinationKey}:${connection.serviceKey}`;
      if (seen.has(connectionKey))
        context.addIssue({ code: "custom", path, message: "Duplicate message connection" });
      seen.add(connectionKey);
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
      if (connection.type === "publish") {
        if (
          connection.endpointKey &&
          !service?.endpoints.some((endpoint) => endpoint.key === connection.endpointKey)
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
      } else if (destination?.broker === "kafka") {
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
      } else if (destination?.broker === "rabbitmq") {
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
    });
  });

export type GraphCodeManifest = {
  version: 1 | 2;
  services: Array<z.input<typeof serviceSchema>>;
  destinations?: Array<z.input<typeof destinationSchema>>;
  messageConnections?: Array<z.input<typeof messageConnectionSchema>>;
};
