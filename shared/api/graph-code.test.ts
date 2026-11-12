import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { graphCodeManifestSchema } from "./graph-code";

const validManifest = {
  version: 1,
  services: [
    {
      key: "orders",
      name: "Orders",
      apiType: "REST",
      framework: "Spring Boot",
      baseUrl: "http://localhost:8081",
      endpoints: [
        {
          key: "list-orders",
          name: "List orders",
          method: "GET",
          url: "/orders",
          outboundConnections: [],
        },
      ],
    },
  ],
};
const validEndpoint = validManifest.services[0]!.endpoints[0]!;

describe("service graph code schema", () => {
  it("accepts the checked-in GraphQL Java microservices manifest and links the notification trigger", () => {
    const source = readFileSync(
      new URL("../../graphql-java-microservices.graph.json", import.meta.url),
      "utf8",
    );
    const parsed = graphCodeManifestSchema.parse(JSON.parse(source));
    expect(parsed.version).toBe(2);
    if (parsed.version !== 2) return;
    const push = parsed.services.find(({ key }) => key === "push-service");
    expect(push?.apiType).toBe("WEBSOCKET");
    expect(push?.baseUrl).toBe("ws://localhost/");
    expect(push?.healthCheck).toEqual({
      url: "http://localhost/services/push/actuator/health/readiness",
      headers: [],
    });
    expect(push?.endpoints[0]?.url).toBe("ws://localhost/ws/notifications?token=test-token-u1");
    expect(parsed.destinations).toContainEqual(
      expect.objectContaining({
        key: "topic-notification-created",
        name: "notification.created",
        broker: "kafka",
      }),
    );
    expect(parsed.messageConnections).toContainEqual(
      expect.objectContaining({
        serviceKey: "shop-notification-service",
        destinationKey: "topic-notification-created",
        type: "publish",
      }),
    );
    expect(parsed.messageConnections).toContainEqual(
      expect.objectContaining({
        serviceKey: "push-service",
        destinationKey: "topic-notification-created",
        consumerGroup: "push-service",
        type: "subscribe",
      }),
    );
    expect(parsed.mockApis).toEqual([
      {
        key: "notification-stream",
        name: "Notification Stream",
        serviceKey: "push-service",
        endpointKey: "user-notifications",
        message: "ping",
      },
    ]);
  });

  it("accepts valid graph manifests", () => {
    expect(graphCodeManifestSchema.safeParse(validManifest).success).toBe(true);
  });

  it("accepts GraphQL HTTP endpoints and rejects gRPC endpoint mismatches", () => {
    const service = {
      ...validManifest.services[0],
      apiType: "REST",
      endpoints: [{ ...validEndpoint, method: "POST", url: "/graphql" }],
    };
    expect(graphCodeManifestSchema.safeParse({ version: 1, services: [service] }).success).toBe(
      true,
    );
    expect(
      graphCodeManifestSchema.safeParse({
        version: 1,
        services: [
          {
            ...service,
            apiType: "GRPC",
            baseUrl: "localhost:9000",
            endpoints: [{ ...service.endpoints[0], method: "POST", url: "/graphql" }],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("accepts ws and wss service endpoints and rejects other URL schemes", () => {
    const websocketService = {
      ...validManifest.services[0],
      apiType: "WEBSOCKET",
      baseUrl: "wss://example.test/socket",
      endpoints: [
        { ...validEndpoint, method: null, url: "ws://example.test/events", rpcMethod: null },
      ],
    };
    expect(
      graphCodeManifestSchema.safeParse({ version: 1, services: [websocketService] }).success,
    ).toBe(true);
    expect(
      graphCodeManifestSchema.safeParse({
        version: 1,
        services: [
          {
            ...websocketService,
            endpoints: [{ ...websocketService.endpoints[0], url: "https://example.test/events" }],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("accepts WebSocket mock APIs targeting declared WebSocket endpoints", () => {
    const websocketService = {
      ...validManifest.services[0],
      key: "push",
      apiType: "WEBSOCKET",
      baseUrl: "ws://localhost",
      endpoints: [
        {
          ...validEndpoint,
          key: "notifications",
          method: null,
          rpcMethod: null,
          url: "ws://localhost/ws/notifications",
        },
      ],
    };
    const manifest = {
      version: 2,
      services: [websocketService],
      destinations: [],
      messageConnections: [],
      mockApis: [
        {
          key: "stream",
          name: "Notification Stream",
          serviceKey: "push",
          endpointKey: "notifications",
          message: "ping",
        },
      ],
    };
    expect(graphCodeManifestSchema.safeParse(manifest).success).toBe(true);
    expect(
      graphCodeManifestSchema.safeParse({
        ...manifest,
        mockApis: [{ ...manifest.mockApis[0], endpointKey: "missing" }],
      }).success,
    ).toBe(false);
  });

  it("resolves references to services declared later in the document", () => {
    const manifest = {
      version: 1,
      services: [
        {
          ...validManifest.services[0],
          endpoints: [
            {
              ...validEndpoint,
              outboundConnections: [{ serviceKey: "target", endpointKey: "read" }],
            },
          ],
        },
        {
          ...validManifest.services[0],
          key: "target",
          endpoints: [{ ...validEndpoint, key: "read", outboundConnections: [] }],
        },
      ],
    };
    expect(graphCodeManifestSchema.safeParse(manifest).success).toBe(true);
  });

  it("reports unsupported values and duplicate service and endpoint keys with paths", () => {
    const result = graphCodeManifestSchema.safeParse({
      ...validManifest,
      services: [
        {
          ...validManifest.services[0],
          framework: "Spring Boot",
          endpoints: [validEndpoint, validEndpoint],
        },
        validManifest.services[0],
      ],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.path)).toContainEqual(["services", 1, "key"]);
    expect(result.error.issues.map((issue) => issue.path)).toContainEqual([
      "services",
      0,
      "endpoints",
      1,
      "key",
    ]);
  });

  it("reports unsupported enum values with field paths", () => {
    const result = graphCodeManifestSchema.safeParse({
      ...validManifest,
      services: [{ ...validManifest.services[0], framework: "Unsupported" }],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.path)).toContainEqual([
      "services",
      0,
      "framework",
    ]);
  });

  it("rejects duplicate connections and missing references", () => {
    const result = graphCodeManifestSchema.safeParse({
      ...validManifest,
      services: [
        {
          ...validManifest.services[0],
          endpoints: [
            {
              ...validEndpoint,
              outboundConnections: [
                { serviceKey: "missing", endpointKey: "target" },
                { serviceKey: "missing", endpointKey: "target" },
              ],
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const paths = result.error.issues.map((issue) => issue.path);
    expect(paths).toContainEqual(["services", 0, "endpoints", 0, "outboundConnections", 0]);
    expect(paths).toContainEqual(["services", 0, "endpoints", 0, "outboundConnections", 1]);
  });

  it("accepts version 2 message destinations and typed connections", () => {
    const manifest = {
      version: 2,
      services: validManifest.services,
      destinations: [
        {
          key: "orders",
          broker: "kafka",
          name: "Orders",
          connection: { brokers: "localhost:9092" },
        },
        { key: "events", broker: "rabbitmq", name: "Events", connection: { host: "localhost" } },
      ],
      messageConnections: [
        {
          type: "publish",
          destinationKey: "orders",
          serviceKey: "orders",
          endpointKey: "list-orders",
        },
        {
          type: "subscribe",
          destinationKey: "orders",
          serviceKey: "orders",
          consumerGroup: "workers",
        },
        {
          type: "publish",
          destinationKey: "events",
          serviceKey: "orders",
          endpointKey: "list-orders",
          routingKey: "orders.created",
        },
        {
          type: "subscribe",
          destinationKey: "events",
          serviceKey: "orders",
          bindingKey: "orders.*",
        },
      ],
    };
    expect(graphCodeManifestSchema.safeParse(manifest).success).toBe(true);
  });

  it("rejects duplicate destinations, unknown messaging references, broker mismatches, and literal secrets", () => {
    const manifest = {
      version: 2,
      services: validManifest.services,
      destinations: [
        {
          key: "orders",
          broker: "kafka",
          name: "Orders",
          connection: { brokers: "localhost:9092", password: "literal-secret" },
        },
        { key: "orders", broker: "rabbitmq", name: "Events", connection: { host: "localhost" } },
      ],
      messageConnections: [
        {
          type: "publish",
          destinationKey: "missing",
          serviceKey: "orders",
          endpointKey: "missing-endpoint",
          routingKey: "invalid-for-kafka",
        },
      ],
    };
    const result = graphCodeManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
    if (result.success) return;
    const messages = result.error.issues.map(({ message }) => message);
    expect(messages).toContain("Duplicate destination key: orders");
    expect(messages).toContain("Unknown destination reference: missing");
    expect(messages).toContain("Unknown endpoint reference: orders.missing-endpoint");
    expect(messages.some((message) => message.includes("Unrecognized key"))).toBe(true);
  });

  it("validates broker-specific publish and subscription fields", () => {
    const result = graphCodeManifestSchema.safeParse({
      version: 2,
      services: validManifest.services,
      destinations: [
        { key: "orders", broker: "kafka", name: "Orders", connection: { brokers: "kafka:9092" } },
        { key: "events", broker: "rabbitmq", name: "Events", connection: { host: "rabbitmq" } },
      ],
      messageConnections: [
        {
          type: "publish",
          destinationKey: "events",
          serviceKey: "orders",
          endpointKey: "list-orders",
        },
        {
          type: "publish",
          destinationKey: "orders",
          serviceKey: "orders",
          endpointKey: "list-orders",
          routingKey: "orders.created",
        },
        {
          type: "subscribe",
          destinationKey: "orders",
          serviceKey: "orders",
          consumerGroup: " ",
          bindingKey: "orders.*",
        },
        {
          type: "subscribe",
          destinationKey: "events",
          serviceKey: "orders",
          consumerGroup: "workers",
        },
      ],
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    const messages = result.error.issues.map(({ message }) => message);
    expect(messages).toContain("RabbitMQ publish connections require a routing key");
    expect(messages).toContain("Kafka publish connections do not use routing keys");
    expect(messages).toContain("Kafka subscriptions require a consumer group");
    expect(messages).toContain("Kafka subscriptions do not use binding keys");
    expect(messages).toContain("RabbitMQ subscriptions do not use consumer groups");
    expect(messages).toContain("RabbitMQ subscriptions require a binding key");
  });
});
