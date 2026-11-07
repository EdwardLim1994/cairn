import { WebSocketSessionRegistry, webSocketSessionRegistry } from "../../utils/websocket-sessions";

export function createDisconnectWebSocketMockApiUseCase(dependencies: {
  ensureProject: () => Promise<string>;
  getTarget: (
    projectId: string,
    id: string,
  ) => Promise<{ targetEndpointId: string | null } | undefined>;
  registry?: WebSocketSessionRegistry;
}) {
  const registry = dependencies.registry ?? webSocketSessionRegistry;
  return async (mockApiId: string) => {
    const projectId = await dependencies.ensureProject();
    const target = await dependencies.getTarget(projectId, mockApiId);
    if (!target?.targetEndpointId) return false;
    return Boolean(registry.close(projectId, target.targetEndpointId, mockApiId));
  };
}
