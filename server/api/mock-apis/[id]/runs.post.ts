import { mockApiRunResponseSchema } from "#shared/api/mock-apis";
import { getEnvironmentVariableValues } from "../../../repositories/environment-variables";
import { MockApiNotFoundError } from "../../../repositories/mock-apis/errors";
import { getMockApiExecutionTarget, createRun, finishRun } from "../../../repositories/runs";
import { addMockRunFailureLog } from "../../../repositories/telemetry";
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
    throw cause;
  }
});
