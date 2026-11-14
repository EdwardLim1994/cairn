import { describe, expect, it } from "vite-plus/test";
import { finiteNumber, httpUrl, record, serviceInput } from "../../../../utils/graph-validation";

describe("graph input validation", () => {
  it("accepts records and rejects arrays and nulls", () => {
    expect(record({ id: "x" }, "Item")).toEqual({ id: "x" });
    expect(() => record([], "Item")).toThrow("Item must be an object");
    expect(() => record(null, "Item")).toThrow("Item must be an object");
  });

  it("normalizes valid service and endpoint input", () => {
    expect(
      serviceInput({
        name: " Orders ",
        framework: "Spring Boot",
        baseUrl: "http://localhost:8081",
        endpoints: [{ name: "Get orders", method: "get", url: "/orders/{id}" }],
      }),
    ).toMatchObject({
      name: "Orders",
      apiType: "REST",
      active: true,
      endpoints: [{ name: "Get orders", method: "GET", url: "/orders/{id}", rpcMethod: null }],
    });
  });

  it("rejects invalid URLs, endpoint methods, and paths", () => {
    expect(() => httpUrl("ftp://example.com", "Base URL")).toThrow(/HTTP or HTTPS/);
    expect(() => httpUrl("http://user:pass@example.com", "Base URL")).toThrow(
      /without credentials/,
    );
    expect(() =>
      serviceInput({
        name: "x",
        framework: "Spring Boot",
        baseUrl: "http://localhost",
        endpoints: "bad",
      }),
    ).toThrow("Endpoints must be an array");
    expect(() =>
      serviceInput({
        name: "x",
        framework: "Spring Boot",
        baseUrl: "http://localhost",
        endpoints: [{ name: "x", method: "TRACE", url: "/" }],
      }),
    ).toThrow("Unsupported REST method");
    expect(() =>
      serviceInput({
        name: "x",
        framework: "Spring Boot",
        baseUrl: "http://localhost",
        apiType: "GRAPHQL",
        endpoints: [],
      }),
    ).toThrow("Service API type must be REST, gRPC, or WebSocket");
  });

  it("validates gRPC targets and fully qualified method paths", () => {
    expect(
      serviceInput({
        name: "Orders",
        apiType: "GRPC",
        framework: "Other",
        baseUrl: "localhost:50051",
        endpoints: [{ name: "Get order", rpcMethod: "/orders.v1.Orders/Get" }],
      }),
    ).toMatchObject({
      apiType: "GRPC",
      baseUrl: "localhost:50051",
      endpoints: [{ method: null, url: null, rpcMethod: "/orders.v1.Orders/Get" }],
    });
    expect(() =>
      serviceInput({
        name: "Orders",
        apiType: "GRPC",
        framework: "Other",
        baseUrl: "localhost",
        endpoints: [],
      }),
    ).toThrow("Target address must use host:port format");
  });

  it("validates WebSocket service and endpoint URLs", () => {
    expect(
      serviceInput({
        name: "Notifications",
        apiType: "WEBSOCKET",
        framework: "Other",
        baseUrl: "wss://example.test/socket",
        endpoints: [{ name: "Events", url: "ws://example.test/events" }],
      }),
    ).toMatchObject({
      apiType: "WEBSOCKET",
      endpoints: [{ method: null, url: "ws://example.test/events", rpcMethod: null }],
    });
    expect(() =>
      serviceInput({
        name: "Notifications",
        apiType: "WEBSOCKET",
        framework: "Other",
        baseUrl: "https://example.test/socket",
        endpoints: [{ name: "Events", url: "https://example.test/events" }],
      }),
    ).toThrow(/ws:\/\/ or wss:\/\//);
  });

  it("validates finite numbers and falls back for omitted values", () => {
    expect(finiteNumber(undefined, "x", 12)).toBe(12);
    expect(finiteNumber("2.5", "x", 0)).toBe(2.5);
    expect(() => finiteNumber("NaN", "x", 0)).toThrow("x must be a finite number");
  });

  it("validates relative health-check URLs and header rows", () => {
    const valid = serviceInput({
      name: "Orders",
      framework: "Spring Boot",
      baseUrl: "http://localhost:8081",
      healthCheckUrl: "/actuator/health",
      healthCheckCustomHeaders: [{ name: "X-Probe", value: "ready" }],
      endpoints: [],
    });
    expect(valid.healthCheckUrl).toBe("/actuator/health");
    expect(valid.healthCheckCustomHeaders).toEqual([{ name: "X-Probe", value: "ready" }]);

    expect(() =>
      serviceInput({
        name: "Orders",
        framework: "Spring Boot",
        baseUrl: "http://localhost:8081",
        healthCheckUrl: "//example.com/health",
        endpoints: [],
      }),
    ).toThrow("Health-check URL must be an HTTP(S) URL or begin with /");
    expect(() =>
      serviceInput({
        name: "Orders",
        framework: "Spring Boot",
        baseUrl: "http://localhost:8081",
        healthCheckCustomHeaders: "invalid",
        endpoints: [],
      }),
    ).toThrow("Health-check headers must be an array");
    expect(() =>
      serviceInput({
        name: "Orders",
        framework: "Spring Boot",
        baseUrl: "http://localhost:8081",
        healthCheckCustomHeaders: [{ name: "bad header", value: "ready" }],
        endpoints: [],
      }),
    ).toThrow("Custom header");
  });
});
