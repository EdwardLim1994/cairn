import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vite-plus/test";
import WebSocket, { WebSocketServer } from "ws";
import { openWebSocketConnection } from "../../../../utils/websocket-client";

describe("openWebSocketConnection", () => {
  const httpServers: ReturnType<typeof createServer>[] = [];
  const websocketServers: WebSocketServer[] = [];
  const clients: WebSocket[] = [];

  afterEach(async () => {
    for (const client of clients) client.terminate();
    await Promise.all(
      websocketServers.map(
        (server) => new Promise<void>((resolve) => server.close(() => resolve())),
      ),
    );
    await Promise.all(
      httpServers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
    );
    clients.length = 0;
    websocketServers.length = 0;
    httpServers.length = 0;
  });

  it("resolves after the socket opens and passes handshake options", async () => {
    const httpServer = createServer();
    httpServers.push(httpServer);
    const websocketServer = new WebSocketServer({ server: httpServer });
    websocketServers.push(websocketServer);
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const address = httpServer.address();
    if (!address || typeof address === "string")
      throw new Error("Test WebSocket server did not bind");

    const socket = openWebSocketConnection(
      `ws://127.0.0.1:${address.port}/events`,
      { Authorization: "Bearer token" },
      500,
    );
    const client = await socket;
    clients.push(client);

    expect(client.readyState).toBe(WebSocket.OPEN);
    expect(client.url).toContain("/events");
  });

  it("rejects when the server does not complete the WebSocket handshake", async () => {
    const httpServer = createServer((_request, response) => {
      response.writeHead(200).end("not a websocket");
    });
    httpServers.push(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const address = httpServer.address();
    if (!address || typeof address === "string") throw new Error("Test HTTP server did not bind");

    await expect(
      openWebSocketConnection(`ws://127.0.0.1:${address.port}/events`, {}, 500),
    ).rejects.toThrow();
  });

  it("rejects when the WebSocket URL is invalid", async () => {
    await expect(openWebSocketConnection("not a URL", {}, 500)).rejects.toThrow();
  });
});
