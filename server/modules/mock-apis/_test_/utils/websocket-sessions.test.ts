import { afterEach, describe, expect, it } from "vite-plus/test";
import { EventEmitter } from "node:events";
import type WebSocket from "ws";
import {
  WebSocketEndpointOccupiedError,
  WebSocketSessionRegistry,
} from "../../../../utils/websocket-sessions";

describe("WebSocket session registry", () => {
  const registry = new WebSocketSessionRegistry();

  afterEach(() => registry.clear());

  it("allows concurrent sessions for different endpoints", () => {
    const first = registry.reserve("project-1", "endpoint-1", "api-1");
    const second = registry.reserve("project-1", "endpoint-2", "api-2");

    expect(registry.get("project-1", "endpoint-1")).toBe(first);
    expect(registry.get("project-1", "endpoint-2")).toBe(second);
    expect(first.state).toBe("connecting");
    expect(second.state).toBe("connecting");
  });

  it("rejects a second session for an occupied endpoint", () => {
    registry.reserve("project-1", "endpoint-1", "api-1");

    expect(() => registry.reserve("project-1", "endpoint-1", "api-2")).toThrow(
      WebSocketEndpointOccupiedError,
    );
    try {
      registry.reserve("project-1", "endpoint-1", "api-2");
    } catch (error) {
      expect(error).toMatchObject({ activeMockApiId: "api-1" });
    }
  });

  it("scopes endpoint ownership by project and releases only its owning API", () => {
    const first = registry.reserve("project-1", "endpoint-1", "api-1");
    const secondProject = registry.reserve("project-2", "endpoint-1", "api-2");

    expect(registry.getForMockApi("project-1", "api-1")).toBe(first);
    expect(registry.release("project-1", "endpoint-1", "other-api")).toBeUndefined();
    expect(registry.release("project-1", "endpoint-1", "api-1")).toBe(first);
    expect(registry.get("project-2", "endpoint-1")).toBe(secondProject);
  });

  it("buffers incoming text and reports an unexpected remote close", () => {
    const session = registry.reserve("project-1", "endpoint-1", "api-1");
    const socket = new EventEmitter() as WebSocket;
    registry.setSocket(session, socket);
    registry.setState(session, "connected");
    socket.emit("message", Buffer.from("hello"), false);
    socket.emit("close", 1006, Buffer.from("remote close"));

    expect(session.messages).toHaveLength(1);
    expect(session.messages[0]?.data).toBe("hello");
    expect(session.state).toBe("disconnected");
    expect(registry.get("project-1", "endpoint-1")).toBe(session);
  });

  it("closes and releases a session only for its owning mock API", () => {
    const session = registry.reserve("project-1", "endpoint-1", "api-1");
    expect(registry.close("project-1", "endpoint-1", "api-2")).toBeUndefined();
    expect(registry.close("project-1", "endpoint-1", "api-1")).toBe(session);
    expect(registry.get("project-1", "endpoint-1")).toBeUndefined();
  });
});
