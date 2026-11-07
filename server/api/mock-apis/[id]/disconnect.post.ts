import { getMockApiExecutionTarget } from "../../../repositories/runs";
import { ensureProject } from "../../../utils/project";
import { createDisconnectWebSocketMockApiUseCase } from "../../../use-cases/mock-apis/disconnect-websocket-mock-api";

const disconnect = createDisconnectWebSocketMockApiUseCase({
  ensureProject,
  getTarget: getMockApiExecutionTarget,
});
export default defineEventHandler(async (event) => ({
  disconnected: await disconnect(getRouterParam(event, "id")!),
}));
