import { WebSocketSessionRegistry, webSocketSessionRegistry } from "../../utils/websocket-sessions";

export class WebSocketSessionNotConnectedError extends Error {}
export class WebSocketMockApiMessageMissingError extends Error {}
export class WebSocketTriggerMockApiNotFoundError extends Error {}

export function createTriggerWebSocketMockApiUseCase(dependencies: {
  ensureProject: () => Promise<string>;
  getTarget: (
    projectId: string,
    id: string,
  ) => Promise<{ targetEndpointId: string | null; requestJson: unknown } | undefined>;
  registry?: WebSocketSessionRegistry;
}) {
  const registry = dependencies.registry ?? webSocketSessionRegistry;
  return async (mockApiId: string) => {
    const projectId = await dependencies.ensureProject();
    const target = await dependencies.getTarget(projectId, mockApiId);
    if (!target) throw new WebSocketTriggerMockApiNotFoundError("Mock API not found");
    const session = target.targetEndpointId && registry.get(projectId, target.targetEndpointId);
    if (
      !session ||
      session.mockApiId !== mockApiId ||
      session.state !== "connected" ||
      !session.socket
    )
      throw new WebSocketSessionNotConnectedError("WebSocket session is not connected");
    if (typeof target.requestJson !== "string" || !target.requestJson)
      throw new WebSocketMockApiMessageMissingError("WebSocket message is empty");
    session.socket.send(target.requestJson);
    return { triggered: true as const };
  };
}
