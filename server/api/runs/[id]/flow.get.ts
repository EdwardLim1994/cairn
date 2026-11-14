import { runFlowResponseSchema } from "#shared/api/observability";
import { getRunFlowData, RunNotFoundError } from "../../../modules/runs";
import { getAppConfig } from "../../../utils/config";
import { ensureProject } from "../../../utils/project";
import { createGetRunFlowUseCase } from "../../../use-cases/runs/get-run-flow";

const getRunFlowUseCase = createGetRunFlowUseCase({
  ensureProject,
  getRunFlowData,
  telemetryQuietMs: () => getAppConfig().telemetryQuietMs,
  telemetryMaxWaitMs: () => getAppConfig().telemetryMaxWaitMs,
  telemetryRetentionDays: () => getAppConfig().telemetryRetentionDays,
});

export default defineEventHandler(async (event) => {
  try {
    return runFlowResponseSchema.parse(await getRunFlowUseCase(getRouterParam(event, "id")!));
  } catch (error) {
    if (error instanceof RunNotFoundError)
      throw createError({ statusCode: 404, statusMessage: error.message, cause: error });
    throw error;
  }
});
