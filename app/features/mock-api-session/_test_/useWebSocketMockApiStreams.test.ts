import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useWebSocketMockApiStreams } from "../model/useWebSocketMockApiStreams";

class FakeEventSource extends EventTarget {
  closed = false;

  close() {
    this.closed = true;
  }

  emit(type: string, data: unknown) {
    this.dispatchEvent(new MessageEvent(type, { data: JSON.stringify(data) }));
  }
}

function setup(overrides: Partial<Parameters<typeof useWebSocketMockApiStreams>[0]> = {}) {
  const streams: FakeEventSource[] = [];
  const confirmDisconnect = vi.fn(() => true);
  const onError = vi.fn();
  const options = {
    connect: vi.fn().mockResolvedValue({ id: "api-1" }),
    disconnect: vi.fn().mockResolvedValue({ disconnected: true }),
    trigger: vi.fn().mockResolvedValue({ sent: true }),
    createEventSource: vi.fn(() => {
      const stream = new FakeEventSource();
      streams.push(stream);
      return stream as unknown as EventSource;
    }),
    confirmDisconnect,
    syncNodes: vi.fn(),
    onError,
    ...overrides,
  };
  return {
    streams,
    options,
    confirmDisconnect,
    onError,
    controller: useWebSocketMockApiStreams(options),
  };
}

describe("WebSocket mock API streams", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("connects, reflects state, and appends distinct incoming messages", async () => {
    const { controller, options, streams } = setup();

    await controller.connectWebSocket("api/1");

    expect(options.connect).toHaveBeenCalledWith("api/1");
    expect(options.createEventSource).toHaveBeenCalledWith("/api/mock-apis/api%2F1/events");
    expect(controller.websocketStates.value["api/1"]).toBe("connected");
    const stream = streams[0]!;
    stream.emit("state", { state: "connected" });
    const message = { id: 1, data: "first", receivedAt: "now" };
    stream.emit("message", message);
    stream.emit("message", message);

    expect(controller.websocketMessages.value["api/1"]).toEqual([message]);
    expect(controller.websocketUnread.value["api/1"]).toBe(true);
    expect(options.syncNodes).toHaveBeenCalledTimes(5);
  });

  it("creates a native EventSource when no factory is injected", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "EventSource",
      class extends FakeEventSource {
        constructor(url: string) {
          super();
          urls.push(url);
        }
      },
    );
    const { controller } = setup({ createEventSource: undefined });

    await controller.connectWebSocket("api-1");

    expect(urls).toEqual(["/api/mock-apis/api-1/events"]);
    controller.dispose();
  });

  it("clears the unread mark when opening and closing the response panel", async () => {
    const { controller, streams, options } = setup();
    await controller.connectWebSocket("api-1");
    streams[0]!.emit("message", { id: 1, data: "update", receivedAt: "now" });

    controller.toggleResponsePanel("api-1");
    expect(controller.responsePanelOpenId.value).toBe("api-1");
    expect(controller.websocketUnread.value["api-1"]).toBe(false);
    controller.toggleResponsePanel("api-1");
    expect(controller.responsePanelOpenId.value).toBeNull();
    expect(options.syncNodes).toHaveBeenCalled();
  });

  it("keeps the unread mark clear when a message arrives in an open panel", async () => {
    const { controller, streams } = setup();
    await controller.connectWebSocket("api-1");
    controller.toggleResponsePanel("api-1");

    streams[0]!.emit("message", { id: 1, data: "visible", receivedAt: "now" });

    expect(controller.websocketMessages.value["api-1"]).toHaveLength(1);
    expect(controller.websocketUnread.value["api-1"]).toBe(false);
  });

  it("disconnects on a remote state event and closes the event stream", async () => {
    const { controller, streams } = setup();
    await controller.connectWebSocket("api-1");
    const stream = streams[0]!;

    stream.emit("state", { state: "disconnected" });

    expect(controller.websocketStates.value["api-1"]).toBe("disconnected");
    expect(stream.closed).toBe(true);
  });

  it("does not disconnect unless confirmed, then closes the local stream", async () => {
    const { controller, options, streams, confirmDisconnect } = setup();
    await controller.connectWebSocket("api-1");
    confirmDisconnect.mockReturnValueOnce(false);
    await controller.disconnectWebSocket("api-1");
    expect(options.disconnect).not.toHaveBeenCalled();

    await controller.disconnectWebSocket("api-1");

    expect(options.disconnect).toHaveBeenCalledWith("api-1");
    expect(controller.websocketStates.value["api-1"]).toBe("disconnected");
    expect(streams[0]!.closed).toBe(true);
  });

  it("uses the browser confirmation when no custom confirmation is provided", async () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal("window", { confirm });
    const { controller, options } = setup({ confirmDisconnect: undefined });

    await controller.disconnectWebSocket("api-1");

    expect(confirm).toHaveBeenCalledWith("Close this WebSocket connection?");
    expect(options.disconnect).toHaveBeenCalledWith("api-1");
  });

  it("reports connect, disconnect, and trigger failures with fallback messages", async () => {
    const { controller, onError } = setup({
      connect: vi.fn().mockRejectedValue(new Error("connect failed")),
      disconnect: vi
        .fn()
        .mockRejectedValueOnce(new Error("close failed"))
        .mockRejectedValueOnce("no disconnect"),
      trigger: vi
        .fn()
        .mockRejectedValueOnce("send failed")
        .mockRejectedValueOnce(new Error("trigger failed")),
    });

    await controller.connectWebSocket("api-1");
    await controller.disconnectWebSocket("api-1");
    await controller.disconnectWebSocket("api-1");
    await controller.triggerWebSocket("api-1");
    await controller.triggerWebSocket("api-1");

    expect(controller.websocketStates.value["api-1"]).toBe("disconnected");
    expect(onError.mock.calls).toEqual([
      ["connect failed"],
      ["close failed"],
      ["Could not disconnect WebSocket"],
      ["Could not send WebSocket message"],
      ["trigger failed"],
    ]);
  });

  it("triggers messages and disposes all open streams", async () => {
    const { controller, options, streams } = setup();
    await controller.connectWebSocket("api-1");
    await controller.triggerWebSocket("api-1");

    controller.dispose();

    expect(options.trigger).toHaveBeenCalledWith("api-1");
    expect(streams[0]!.closed).toBe(true);
  });
});
