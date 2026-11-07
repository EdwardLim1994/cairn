import { EventEmitter } from "node:events";
import type WebSocket from "ws";
import { describe, expect, it, vi } from "vite-plus/test";
import { createTriggerWebSocketMockApiUseCase } from "./trigger-websocket-mock-api";
import { WebSocketSessionRegistry } from "../../utils/websocket-sessions";

describe("trigger WebSocket mock API", () => {
  it("sends the exact configured text only on the owning connected session", async () => {
    const registry = new WebSocketSessionRegistry();
    const session = registry.reserve("project-1", "endpoint-1", "api-1");
    const send = vi.fn();
    const socket = Object.assign(new EventEmitter(), { send }) as unknown as WebSocket;
    registry.setSocket(session, socket);
    registry.setState(session, "connected");
    const useCase = createTriggerWebSocketMockApiUseCase({
      ensureProject: async () => "project-1",
      getTarget: async () => ({ targetEndpointId: "endpoint-1", requestJson: " raw text\n" }),
      registry,
    });
    await expect(useCase("api-1")).resolves.toEqual({ triggered: true });
    expect(send).toHaveBeenCalledExactlyOnceWith(" raw text\n");
    await expect(useCase("other-api")).rejects.toThrow("not connected");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("refuses to send while disconnected", async () => {
    const registry = new WebSocketSessionRegistry();
    registry.reserve("project-1", "endpoint-1", "api-1");
    const useCase = createTriggerWebSocketMockApiUseCase({
      ensureProject: async () => "project-1",
      getTarget: async () => ({ targetEndpointId: "endpoint-1", requestJson: "hello" }),
      registry,
    });
    await expect(useCase("api-1")).rejects.toThrow("not connected");
  });
});
