import { websocketSessionResponseSchema } from "#shared/api/mock-apis";
import { getEnvironmentVariableValues } from "../../../repositories/environment-variables";
import { getMockApiExecutionTarget } from "../../../repositories/runs";
import { getAppConfig } from "../../../utils/config";
import { ensureProject } from "../../../utils/project";
import { createConnectWebSocketMockApiUseCase } from "../../../use-cases/mock-apis/connect-websocket-mock-api";
import {
  WebSocketConnectionFailedError,
  WebSocketMockApiNotFoundError,
  WebSocketMockApiNotReadyError,
} from "../../../use-cases/mock-apis/connect-websocket-mock-api";
import { WebSocketEndpointOccupiedError } from "../../../utils/websocket-sessions";

const connectWebSocketMockApi = createConnectWebSocketMockApiUseCase({
  ensureProject,
  getTarget: getMockApiExecutionTarget,
  getVariables: getEnvironmentVariableValues,
  timeoutMs: () => getAppConfig().outboundRequestTimeoutMs,
});

export default defineEventHandler(async (event) => {
  try {
    return websocketSessionResponseSchema.parse(
      await connectWebSocketMockApi(getRouterParam(event, "id")!),
    );
  } catch (cause) {
    if (cause instanceof WebSocketMockApiNotFoundError)
      throw createError({ statusCode: 404, statusMessage: cause.message, cause });
    if (cause instanceof WebSocketEndpointOccupiedError)
      throw createError({ statusCode: 409, statusMessage: cause.message, cause });
    if (cause instanceof WebSocketMockApiNotReadyError)
      throw createError({ statusCode: 409, statusMessage: cause.message, cause });
    if (cause instanceof WebSocketConnectionFailedError)
      throw createError({ statusCode: 502, statusMessage: cause.message, cause });
    throw cause;
  }
});
