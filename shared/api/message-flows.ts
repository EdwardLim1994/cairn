import { z } from "zod";

const secretVariable = z.string().trim().min(1).max(255).optional();

export const kafkaConnectionSchema = z
  .object({
    brokers: z.string().trim().min(1).max(2048),
    clientId: z.string().trim().min(1).max(255).optional(),
    securityProtocol: z
      .enum(["PLAINTEXT", "SSL", "SASL_PLAINTEXT", "SASL_SSL"])
      .default("PLAINTEXT"),
    saslMechanism: z.enum(["plain", "scram-sha-256", "scram-sha-512"]).optional(),
    username: z.string().trim().min(1).max(255).optional(),
    passwordVariable: secretVariable,
  })
  .superRefine((connection, context) => {
    if (
      connection.securityProtocol.startsWith("SASL") &&
      (!connection.username || !connection.passwordVariable)
    )
      context.addIssue({
        code: "custom",
        path: ["passwordVariable"],
        message: "SASL requires a username and password variable",
      });
  });

export const rabbitMqConnectionSchema = z
  .object({
    host: z.string().trim().min(1).max(255),
    port: z.number().int().min(1).max(65535).default(5672),
    virtualHost: z.string().max(255).default("/"),
    username: z.string().trim().min(1).max(255).optional(),
    passwordVariable: secretVariable,
    tls: z.boolean().default(false),
  })
  .superRefine((connection, context) => {
    if (Boolean(connection.username) !== Boolean(connection.passwordVariable))
      context.addIssue({
        code: "custom",
        path: ["passwordVariable"],
        message: "RabbitMQ username and password variable must be set together",
      });
  });

export const messageDestinationInputSchema = z.discriminatedUnion("broker", [
  z.object({
    id: z.string().min(1),
    queueId: z.string().min(1).optional(),
    queueName: z.string().trim().min(1).max(255).optional(),
    codeKey: z.string().trim().min(1).max(128),
    broker: z.literal("kafka"),
    name: z.string().trim().min(1).max(255),
    connection: kafkaConnectionSchema,
    x: z.number(),
    y: z.number(),
  }),
  z.object({
    id: z.string().min(1),
    queueId: z.string().min(1).optional(),
    queueName: z.string().trim().min(1).max(255).optional(),
    codeKey: z.string().trim().min(1).max(128),
    broker: z.literal("rabbitmq"),
    name: z.string().trim().min(1).max(255),
    connection: rabbitMqConnectionSchema,
    x: z.number(),
    y: z.number(),
  }),
]);

export const messageConnectionInputSchema = z
  .discriminatedUnion("type", [
    z.object({
      type: z.literal("publish"),
      id: z.string().min(1).optional(),
      destinationId: z.string().min(1),
      endpointId: z.string().min(1).optional(),
      serviceId: z.string().min(1).optional(),
      subscriptionId: z.string().min(1).optional(),
      routingKey: z.string().trim().min(1).max(255).optional(),
    }),
    z.object({
      type: z.literal("subscribe"),
      id: z.string().min(1).optional(),
      destinationId: z.string().min(1),
      serviceId: z.string().min(1),
      consumerGroup: z.string().trim().min(1).max(255).optional(),
      bindingKey: z.string().trim().min(1).max(255).optional(),
    }),
  ])
  .superRefine((connection, context) => {
    if (
      connection.type === "publish" &&
      (Boolean(connection.endpointId) === Boolean(connection.serviceId) ||
        (Boolean(connection.subscriptionId) && Boolean(connection.endpointId)))
    )
      context.addIssue({
        code: "custom",
        path: ["endpointId"],
        message:
          "Publish connections need an endpoint or a service, and subscription sources need their service",
      });
  });

export type MessageDestinationInput = z.infer<typeof messageDestinationInputSchema>;
export type MessageConnectionInput = z.infer<typeof messageConnectionInputSchema>;
export type KafkaConnection = z.infer<typeof kafkaConnectionSchema>;
export type RabbitMqConnection = z.infer<typeof rabbitMqConnectionSchema>;

export const messageDestinationHealthResponseSchema = z.array(
  z.object({ id: z.string(), online: z.boolean() }),
);
export type MessageDestinationHealthResponse = z.infer<
  typeof messageDestinationHealthResponseSchema
>;
