import { createServer } from "node:http";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { WebSocketServer } from "ws";
import { createConnectWebSocketMockApiUseCase } from "../../../use-cases/mock-apis/connect-websocket-mock-api";
import { createDisconnectWebSocketMockApiUseCase } from "../../../use-cases/mock-apis/disconnect-websocket-mock-api";
import { createTriggerWebSocketMockApiUseCase } from "../../../use-cases/mock-apis/trigger-websocket-mock-api";
import { WebSocketSessionRegistry } from "../../../utils/websocket-sessions";

describe("WebSocket mock API lifecycle integration", () => {
  const servers: WebSocketServer[] = [];
  const httpServers: ReturnType<typeof createServer>[] = [];
  afterEach(async () => {
    await Promise.all(
      servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
    );
    await Promise.all(
      httpServers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
    );
    servers.length = 0;
    httpServers.length = 0;
  });

  it("connects, sends text, receives buffered messages, disconnects, and enforces endpoint ownership", async () => {
    const httpServer = createServer();
    httpServers.push(httpServer);
    const server = new WebSocketServer({ server: httpServer });
    servers.push(server);
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const address = httpServer.address();
    if (!address || typeof address === "string")
      throw new Error("Test WebSocket server did not bind");
    const url = `ws://127.0.0.1:${address.port}/events`;
    const receivedByServer = new Promise<string>((resolve) =>
      server.once("connection", (socket) => {
        socket.once("message", (message) => {
          resolve(
            Buffer.isBuffer(message)
              ? message.toString("utf8")
              : Buffer.from(message as ArrayBuffer).toString("utf8"),
          );
          socket.send("server response");
        });
      }),
    );
    const registry = new WebSocketSessionRegistry();
    const target = (mockApiId: string) => ({
      mockApiId,
      apiType: "WEBSOCKET",
      active: true,
      targetEndpointId: "endpoint-1",
      serviceApiType: "WEBSOCKET",
      endpointUrl: url,
      baseUrl: "ws://127.0.0.1",
      serviceName: "Events",
      mockApiName: "Events",
      requestJson: "exact payload",
      pathParameters: {},
      headerTemplateId: null,
      headerTemplateExists: false,
      headerTemplateHeaders: [],
      authorizationTemplateId: null,
      authorizationTemplateExists: false,
      authorizationTemplate: null,
      customHeaders: [],
    });
    const getTarget = async (_projectId: string, id: string) => target(id);
    const connect = createConnectWebSocketMockApiUseCase({
      ensureProject: async () => "project-1",
      getTarget,
      getVariables: async () => [],
      registry,
      timeoutMs: () => 1000,
      retryCount: 1,
    });
    const trigger = createTriggerWebSocketMockApiUseCase({
      ensureProject: async () => "project-1",
      getTarget,
      registry,
    });
    const disconnect = createDisconnectWebSocketMockApiUseCase({
      ensureProject: async () => "project-1",
      getTarget,
      registry,
    });

    await connect("api-1");
    await expect(connect("api-2")).rejects.toThrow("already active");
    await trigger("api-1");
    expect(await receivedByServer).toBe("exact payload");
    await vi.waitFor(() =>
      expect(registry.get("project-1", "endpoint-1")?.messages.map(({ data }) => data)).toContain(
        "server response",
      ),
    );
    expect(await disconnect("api-1")).toBe(true);
    expect(registry.get("project-1", "endpoint-1")).toBeUndefined();
  });
});
