import { describe, expect, it } from "vite-plus/test";
import { parse } from "yaml";
import { serializeGraphCode } from "./graph-code";

describe("serializeGraphCode", () => {
  it("starts empty when graph has no services", () => {
    expect(serializeGraphCode([], [])).toBe("");
  });

  it("serializes a WebSocket mock API with its endpoint reference and message", () => {
    const services = [
      {
        id: "push-service-id",
        codeKey: "push-service",
        projectId: "project-1",
        name: "Push Service",
        apiType: "WEBSOCKET",
        framework: "Spring Boot",
        baseUrl: "ws://localhost",
        healthCheckUrl: null,
        healthCheckHeaderTemplateId: null,
        healthCheckCustomHeaders: [],
        active: true,
        positionX: 0,
        positionY: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
        endpoints: [
          {
            id: "push-endpoint-id",
            codeKey: "notifications",
            name: "Notifications",
            method: null,
            url: "ws://localhost/ws/notifications",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    ] as never;
    const mockApis = [
      {
        id: "api-1",
        name: "Notification Stream",
        apiType: "WEBSOCKET",
        targetEndpointId: "push-endpoint-id",
        requestJson: "ping",
        description: "Graph code key: notification-stream",
      },
    ] as never;

    expect(parse(serializeGraphCode(services, [], [], [], mockApis))).toMatchObject({
      version: 2,
      destinations: [],
      messageConnections: [],
      mockApis: [
        {
          key: "notification-stream",
          name: "Notification Stream",
          serviceKey: "push-service",
          endpointKey: "notifications",
          message: "ping",
        },
      ],
    });
  });

  it("serializes keyed endpoint calls without database or canvas state", () => {
    const services = [
      {
        id: "service-1",
        codeKey: "orders",
        projectId: "project-1",
        name: "Orders",
        apiType: "REST",
        framework: "Spring Boot",
        baseUrl: "http://orders",
        healthCheckUrl: "/ready",
        healthCheckHeaderTemplateId: "template-id",
        healthCheckCustomHeaders: [{ name: "X-Key", value: "secret" }],
        active: false,
        positionX: 10,
        positionY: 20,
        createdAt: "2026-01-01T00:00:00.000Z",
        endpoints: [
          {
            id: "endpoint-1",
            codeKey: "create-order",
            projectId: "project-1",
            serviceId: "service-1",
            name: "Create order",
            method: "POST",
            url: "/orders",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
      {
        id: "service-2",
        codeKey: "inventory",
        projectId: "project-1",
        name: "Inventory",
        apiType: "REST",
        framework: "Other",
        baseUrl: "http://inventory",
        healthCheckUrl: null,
        healthCheckHeaderTemplateId: null,
        healthCheckCustomHeaders: [],
        active: true,
        positionX: 720,
        positionY: 10,
        createdAt: "2026-01-01T00:00:00.000Z",
        endpoints: [
          {
            id: "endpoint-2",
            codeKey: "reserve",
            projectId: "project-1",
            serviceId: "service-2",
            name: "Reserve",
            method: "POST",
            url: "/reserve",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    ] as never;
    const code = serializeGraphCode(services, [
      {
        id: "edge-id",
        sourceServiceId: "service-1",
        sourceEndpointId: "endpoint-1",
        targetEndpointId: "endpoint-2",
      },
    ]);

    expect(parse(code)).toEqual({
      version: 1,
      services: [
        {
          key: "orders",
          name: "Orders",
          apiType: "REST",
          framework: "Spring Boot",
          baseUrl: "http://orders",
          healthCheck: { url: "/ready", headers: [{ name: "X-Key", value: "secret" }] },
          endpoints: [
            {
              key: "create-order",
              name: "Create order",
              method: "POST",
              url: "/orders",
              outboundConnections: [{ serviceKey: "inventory", endpointKey: "reserve" }],
            },
          ],
        },
        {
          key: "inventory",
          name: "Inventory",
          apiType: "REST",
          framework: "Other",
          baseUrl: "http://inventory",
          endpoints: [
            {
              key: "reserve",
              name: "Reserve",
              method: "POST",
              url: "/reserve",
              outboundConnections: [],
            },
          ],
        },
      ],
    });
    expect(code).not.toContain("service-1");
    expect(code).not.toContain("endpoint-1");
    expect(code).not.toContain("positionX");
    expect(code).not.toContain("createdAt");
    expect(code).not.toContain("active");
  });

  it("serializes message destinations as version 2 with secret references only", () => {
    const services = [
      {
        id: "service-id",
        codeKey: "orders-service",
        name: "Orders",
        framework: "Other",
        baseUrl: "http://orders",
        endpoints: [
          {
            id: "endpoint-id",
            codeKey: "publish-order",
            name: "Publish",
            method: "POST",
            apiType: "REST",
            url: "/orders",
          },
        ],
      },
    ] as never;
    const destinations = [
      {
        id: "destination-id",
        codeKey: "orders-topic",
        broker: "kafka",
        name: "Orders topic",
        connection: {
          brokers: "kafka:9092",
          securityProtocol: "SASL_SSL",
          saslMechanism: "plain",
          username: "cairn",
          passwordVariable: "KAFKA_PASSWORD",
        },
      },
    ] as never;
    const code = serializeGraphCode(services, [], destinations, [
      {
        id: "connection-id",
        type: "publish",
        destinationId: "destination-id",
        endpointId: "endpoint-id",
      },
      {
        id: "consumer-connection-id",
        type: "subscribe",
        destinationId: "destination-id",
        serviceId: "service-id",
        consumerGroup: "orders-v1",
      },
    ] as never);
    const manifest = parse(code);

    expect(manifest).toMatchObject({
      version: 2,
      destinations: [{ key: "orders-topic", connection: { passwordVariable: "KAFKA_PASSWORD" } }],
      messageConnections: [
        {
          type: "publish",
          destinationKey: "orders-topic",
          serviceKey: "orders-service",
          endpointKey: "publish-order",
        },
        {
          type: "subscribe",
          destinationKey: "orders-topic",
          serviceKey: "orders-service",
          consumerGroup: "orders-v1",
        },
      ],
    });
    expect(code).not.toContain("destination-id");
    expect(code).not.toContain("connection-id");
    expect(code).not.toContain("positionX");
    expect(code).not.toContain("KAFKA_PASSWORD_VALUE");
  });
});
