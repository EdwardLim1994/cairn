import { runGetResponseSchema } from "#shared/api/observability";
import { findRun, RunNotFoundError } from "../../modules/runs";
import { ensureProject } from "../../utils/project";
import { createGetRunUseCase } from "../../use-cases/runs/get-run";

const getRunUseCase = createGetRunUseCase({ ensureProject, findRun });

export default defineEventHandler(async (event) => {
  try {
    return runGetResponseSchema.parse(await getRunUseCase(getRouterParam(event, "id")!));
  } catch (error) {
    if (error instanceof RunNotFoundError)
      throw createError({ statusCode: 404, statusMessage: error.message, cause: error });
    throw error;
  }
});
