import WebSocket from "ws";

export function openWebSocketConnection(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
) {
  return new Promise<WebSocket>((resolve, reject) => {
    let socket: WebSocket;
    try {
      socket = new WebSocket(url, {
        headers,
        handshakeTimeout: timeoutMs,
        perMessageDeflate: false,
      });
    } catch (error) {
      reject(error);
      return;
    }
    const cleanup = () => {
      socket.off("open", onOpen);
      socket.off("error", onError);
    };
    const onOpen = () => {
      cleanup();
      resolve(socket);
    };
    const onError = (error: Error) => {
      cleanup();
      socket.terminate();
      reject(error);
    };
    socket.once("open", onOpen);
    socket.once("error", onError);
  });
}
