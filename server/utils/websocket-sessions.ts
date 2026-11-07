import type WebSocket from "ws";
import { EventEmitter } from "node:events";

export type WebSocketSessionState = "connecting" | "connected" | "disconnected";

export type WebSocketSession = {
  projectId: string;
  endpointId: string;
  mockApiId: string;
  state: WebSocketSessionState;
  socket: WebSocket | null;
  messages: Array<{ id: number; data: string; receivedAt: string }>;
  nextMessageId: number;
  events: EventEmitter;
};

export class WebSocketEndpointOccupiedError extends Error {
  constructor(readonly activeMockApiId: string) {
    super("A WebSocket session is already active for this endpoint");
    this.name = "WebSocketEndpointOccupiedError";
  }
}

function endpointKey(projectId: string, endpointId: string) {
  return `${projectId}\0${endpointId}`;
}

export class WebSocketSessionRegistry {
  private readonly sessions = new Map<string, WebSocketSession>();

  reserve(projectId: string, endpointId: string, mockApiId: string) {
    const key = endpointKey(projectId, endpointId);
    const existing = this.sessions.get(key);
    if (existing && existing.state !== "disconnected")
      throw new WebSocketEndpointOccupiedError(existing.mockApiId);

    const session: WebSocketSession = {
      projectId,
      endpointId,
      mockApiId,
      state: "connecting",
      socket: null,
      messages: [],
      nextMessageId: 1,
      events: new EventEmitter(),
    };
    this.sessions.set(key, session);
    return session;
  }

  get(projectId: string, endpointId: string) {
    return this.sessions.get(endpointKey(projectId, endpointId));
  }

  getForMockApi(projectId: string, mockApiId: string) {
    return [...this.sessions.values()].find(
      (session) => session.projectId === projectId && session.mockApiId === mockApiId,
    );
  }

  setSocket(session: WebSocketSession, socket: WebSocket) {
    if (this.get(session.projectId, session.endpointId) !== session)
      throw new Error("WebSocket session reservation is no longer active");
    session.socket = socket;
    socket.on("message", (data, isBinary) => {
      if (isBinary) return;
      const text = Buffer.isBuffer(data)
        ? data.toString("utf8")
        : Array.isArray(data)
          ? Buffer.concat(data).toString("utf8")
          : Buffer.from(data as ArrayBuffer).toString("utf8");
      const message = {
        id: session.nextMessageId++,
        data: text,
        receivedAt: new Date().toISOString(),
      };
      session.messages.push(message);
      if (session.messages.length > 100) session.messages.shift();
      session.events.emit("message", message);
    });
    socket.on("close", () => {
      this.setState(session, "disconnected");
      session.events.emit("state", { state: "disconnected" });
    });
  }

  subscribe(session: WebSocketSession, listener: (event: { type: string; data: unknown }) => void) {
    const message = (data: unknown) => listener({ type: "message", data });
    const state = (data: unknown) => listener({ type: "state", data });
    session.events.on("message", message);
    session.events.on("state", state);
    return () => {
      session.events.off("message", message);
      session.events.off("state", state);
    };
  }

  close(projectId: string, endpointId: string, mockApiId: string) {
    const session = this.get(projectId, endpointId);
    if (!session || session.mockApiId !== mockApiId) return undefined;
    session.socket?.close(1000, "Disconnected by user");
    session.socket?.terminate();
    session.events.emit("state", { state: "disconnected" });
    return this.release(projectId, endpointId, mockApiId);
  }

  closeProject(projectId: string) {
    for (const session of this.sessions.values()) {
      if (session.projectId === projectId)
        this.close(projectId, session.endpointId, session.mockApiId);
    }
  }

  setState(session: WebSocketSession, state: WebSocketSessionState) {
    if (this.get(session.projectId, session.endpointId) !== session) return false;
    session.state = state;
    return true;
  }

  release(projectId: string, endpointId: string, mockApiId?: string) {
    const key = endpointKey(projectId, endpointId);
    const session = this.sessions.get(key);
    if (!session || (mockApiId && session.mockApiId !== mockApiId)) return undefined;
    this.sessions.delete(key);
    return session;
  }

  clear() {
    this.sessions.clear();
  }
}

export const webSocketSessionRegistry = new WebSocketSessionRegistry();
