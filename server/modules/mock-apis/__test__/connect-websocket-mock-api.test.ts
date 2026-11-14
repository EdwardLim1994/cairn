import type WebSocket from "ws";
import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  createConnectWebSocketMockApiUseCase,
  WebSocketConnectionFailedError,
} from "../../../use-cases/mock-apis/connect-websocket-mock-api";
import {
  WebSocketEndpointOccupiedError,
  WebSocketSessionRegistry,
} from "../../../utils/websocket-sessions";

const target = {
  mockApiId: "api-1",
  apiType: "WEBSOCKET",
  active: true,
  targetEndpointId: "endpoint-1",
  serviceApiType: "WEBSOCKET",
  endpointUrl: "wss://events.example.test/socket",
  baseUrl: "wss://events.example.test",
  serviceName: "Events",
  mockApiName: "Watch events",
  requestJson: "subscribe orders",
  pathParameters: {},
  headerTemplateId: "headers-1",
  headerTemplateExists: true,
  headerTemplateHeaders: [{ name: "X-Tenant", value: "{{TENANT}}" }],
  authorizationTemplateId: "auth-1",
  authorizationTemplateExists: true,
  authorizationTemplate: { type: "bearer" as const, config: { token: "{{TOKEN}}" } },
  customHeaders: [{ name: "X-Client", value: "cairn" }],
};

function createUseCase(
  options: {
    registry?: WebSocketSessionRegistry;
    connect?: (
      url: string,
      headers: Record<string, string>,
      timeoutMs: number,
    ) => Promise<WebSocket>;
    getTarget?: typeof target | undefined;
    fetch?: typeof globalThis.fetch;
  } = {},
) {
  return createConnectWebSocketMockApiUseCase({
    ensureProject: async () => "project-1",
    getTarget: async () => options.getTarget ?? target,
    getVariables: async () => [
      { name: "TENANT", value: "acme" },
      { name: "TOKEN", value: "secret-token" },
    ],
    registry: options.registry,
    connect: options.connect,
    fetch: options.fetch,
    timeoutMs: () => 1234,
    retryDelayMs: () => 0,
    wait: async () => {},
  });
}

describe("connect WebSocket mock API", () => {
  it("connects with resolved handshake headers and stores the endpoint session", async () => {
    const registry = new WebSocketSessionRegistry();
    const socket = Object.assign(new EventEmitter(), { send: vi.fn() }) as unknown as WebSocket;
    const connect = vi.fn().mockResolvedValue(socket);
    const useCase = createUseCase({ registry, connect });

    await expect(useCase("api-1")).resolves.toEqual({
      mockApiId: "api-1",
      endpointId: "endpoint-1",
      state: "connected",
    });
    expect(connect).toHaveBeenCalledWith(
      "wss://events.example.test/socket",
      {
        "X-Tenant": "acme",
        "X-Client": "cairn",
        Authorization: "Bearer secret-token",
      },
      1234,
    );
    expect(registry.get("project-1", "endpoint-1")).toMatchObject({
      mockApiId: "api-1",
      state: "connected",
      socket,
    });
  });

  it("retries initial failures three times and returns a clear handshake failure", async () => {
    const registry = new WebSocketSessionRegistry();
    const connect = vi.fn().mockRejectedValue(new Error("Unexpected server response: 401"));
    const useCase = createUseCase({ registry, connect });

    await expect(useCase("api-1")).rejects.toThrow(
      new WebSocketConnectionFailedError("WebSocket handshake failed with HTTP 401"),
    );
    expect(connect).toHaveBeenCalledTimes(3);
    expect(registry.get("project-1", "endpoint-1")).toBeUndefined();
  });

  it("rejects an occupied endpoint before opening another socket", async () => {
    const registry = new WebSocketSessionRegistry();
    registry.reserve("project-1", "endpoint-1", "api-2");
    const connect = vi.fn();
    const useCase = createUseCase({ registry, connect });

    await expect(useCase("api-1")).rejects.toBeInstanceOf(WebSocketEndpointOccupiedError);
    expect(connect).not.toHaveBeenCalled();
  });

  it("reports OAuth authorization failures without attempting a WebSocket connection", async () => {
    const registry = new WebSocketSessionRegistry();
    const connect = vi.fn();
    const useCase = createConnectWebSocketMockApiUseCase({
      ensureProject: async () => "project-1",
      getTarget: async () => ({
        ...target,
        headerTemplateHeaders: [],
        customHeaders: [],
        authorizationTemplate: {
          type: "oauth-client-credentials",
          config: {
            tokenUrl: "https://auth.example.test/token",
            clientId: "client",
            clientSecret: "secret",
          },
        },
      }),
      getVariables: async () => [],
      registry,
      connect,
      fetch: vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(new Response("private auth failure", { status: 401 })),
      timeoutMs: () => 1000,
      wait: async () => {},
    });

    await expect(useCase("api-1")).rejects.toThrow(
      "WebSocket connection failed: OAuth token request failed",
    );
    expect(connect).not.toHaveBeenCalled();
    expect(registry.get("project-1", "endpoint-1")).toBeUndefined();
  });
});
