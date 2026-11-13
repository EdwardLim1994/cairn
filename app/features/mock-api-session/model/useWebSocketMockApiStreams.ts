import { ref } from "vue";

type WebSocketState = "connecting" | "connected" | "disconnected";
type WebSocketMessage = { id: number; data: string; receivedAt: string };
type WebSocketStream = {
  addEventListener: EventSource["addEventListener"];
  close: EventSource["close"];
};

export function useWebSocketMockApiStreams(options: {
  connect: (id: string) => Promise<unknown>;
  disconnect: (id: string) => Promise<unknown>;
  trigger: (id: string) => Promise<unknown>;
  createEventSource?: (url: string) => WebSocketStream;
  confirmDisconnect?: () => boolean;
  syncNodes: () => void;
  onError: (message: string) => void;
}) {
  const websocketStates = ref<Record<string, WebSocketState>>({});
  const websocketMessages = ref<Record<string, WebSocketMessage[]>>({});
  const websocketUnread = ref<Record<string, boolean>>({});
  const responsePanelOpenId = ref<string | null>(null);
  const websocketStreams = new Map<string, WebSocketStream>();

  function createEventSource(url: string) {
    return options.createEventSource ? options.createEventSource(url) : new EventSource(url);
  }

  function closeWebSocketStream(id: string) {
    websocketStreams.get(id)?.close();
    websocketStreams.delete(id);
  }

  function openWebSocketStream(id: string) {
    closeWebSocketStream(id);
    const stream = createEventSource(`/api/mock-apis/${encodeURIComponent(id)}/events`);
    websocketStreams.set(id, stream);
    stream.addEventListener("message", (event) => {
      const message = JSON.parse((event as MessageEvent).data) as WebSocketMessage;
      const currentMessages = websocketMessages.value[id] ?? [];
      if (!currentMessages.some(({ id: messageId }) => messageId === message.id))
        websocketMessages.value[id] = [...currentMessages, message].slice(-100);
      if (responsePanelOpenId.value !== id) websocketUnread.value[id] = true;
      options.syncNodes();
    });
    stream.addEventListener("state", (event) => {
      const { state } = JSON.parse((event as MessageEvent).data) as { state: WebSocketState };
      websocketStates.value[id] = state;
      if (state === "disconnected") closeWebSocketStream(id);
      options.syncNodes();
    });
  }

  async function connectWebSocket(id: string) {
    websocketStates.value[id] = "connecting";
    options.syncNodes();
    try {
      await options.connect(id);
      websocketStates.value[id] = "connected";
      openWebSocketStream(id);
    } catch (cause) {
      websocketStates.value[id] = "disconnected";
      options.onError(cause instanceof Error ? cause.message : "Could not connect WebSocket");
    }
    options.syncNodes();
  }

  async function disconnectWebSocket(id: string) {
    if (
      !(options.confirmDisconnect ?? (() => window.confirm("Close this WebSocket connection?")))()
    )
      return;
    try {
      await options.disconnect(id);
      websocketStates.value[id] = "disconnected";
      closeWebSocketStream(id);
    } catch (cause) {
      options.onError(cause instanceof Error ? cause.message : "Could not disconnect WebSocket");
    }
    options.syncNodes();
  }

  async function triggerWebSocket(id: string) {
    try {
      await options.trigger(id);
    } catch (cause) {
      options.onError(cause instanceof Error ? cause.message : "Could not send WebSocket message");
    }
  }

  function toggleResponsePanel(id: string) {
    responsePanelOpenId.value = responsePanelOpenId.value === id ? null : id;
    websocketUnread.value[id] = false;
    options.syncNodes();
  }

  function openResponsePanel(id: string) {
    responsePanelOpenId.value = id;
    websocketUnread.value[id] = false;
    options.syncNodes();
  }

  function dispose() {
    for (const stream of websocketStreams.values()) stream.close();
    websocketStreams.clear();
  }

  return {
    websocketStates,
    websocketMessages,
    websocketUnread,
    responsePanelOpenId,
    connectWebSocket,
    disconnectWebSocket,
    triggerWebSocket,
    toggleResponsePanel,
    openResponsePanel,
    dispose,
  };
}
