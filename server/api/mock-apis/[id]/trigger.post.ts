import { getMockApiExecutionTarget } from "../../../modules/mock-apis";
import { ensureProject } from "../../../utils/project";
import {
  createTriggerWebSocketMockApiUseCase,
  WebSocketMockApiMessageMissingError,
  WebSocketSessionNotConnectedError,
  WebSocketTriggerMockApiNotFoundError,
} from "../../../use-cases/mock-apis/trigger-websocket-mock-api";

const trigger = createTriggerWebSocketMockApiUseCase({
  ensureProject,
  getTarget: getMockApiExecutionTarget,
});

export default defineEventHandler(async (event) => {
  try {
    return await trigger(getRouterParam(event, "id")!);
  } catch (cause) {
    if (cause instanceof WebSocketTriggerMockApiNotFoundError)
      throw createError({ statusCode: 404, statusMessage: cause.message, cause });
    if (
      cause instanceof WebSocketSessionNotConnectedError ||
      cause instanceof WebSocketMockApiMessageMissingError
    )
      throw createError({ statusCode: 409, statusMessage: cause.message, cause });
    throw cause;
  }
});
