import { describe, expect, it } from "vite-plus/test";
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
