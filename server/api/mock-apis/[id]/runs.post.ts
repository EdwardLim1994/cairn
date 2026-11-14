import { mockApiRunResponseSchema } from "#shared/api/mock-apis";
import {
  getEnvironmentVariableValues,
  MockApiNotFoundError,
  MockApiNotReadyError,
} from "../../../modules/mock-apis";
import { getMockApiExecutionTarget } from "../../../modules/mock-apis";
import { createRun, finishRun } from "../../../modules/runs";
import { addMockRunFailureLog } from "../../../modules/observability";
import { getAppConfig } from "../../../utils/config";
import { ensureProject } from "../../../utils/project";
import { createRunMockApiUseCase } from "../../../use-cases/mock-apis/run-mock-api";

const runMockApiUseCase = createRunMockApiUseCase({
  ensureProject,
  getTarget: getMockApiExecutionTarget,
  getVariables: getEnvironmentVariableValues,
  createRun,
  finishRun,
  addFailureLog: addMockRunFailureLog,
  fetch: globalThis.fetch,
  timeoutMs: () => getAppConfig().outboundRequestTimeoutMs,
});

export default defineEventHandler(async (event) => {
  try {
    const result = await runMockApiUseCase(getRouterParam(event, "id")!);
    return mockApiRunResponseSchema.parse(result);
  } catch (cause) {
    if (cause instanceof MockApiNotFoundError)
      throw createError({ statusCode: 404, statusMessage: cause.message, cause });
    if (cause instanceof MockApiNotReadyError)
      throw createError({ statusCode: 409, statusMessage: cause.message, cause });
    throw cause;
  }
});
