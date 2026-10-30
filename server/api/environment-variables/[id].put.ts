import {
  environmentVariableUpdateRequestSchema,
  environmentVariableUpdateResponseSchema,
} from "#shared/api/environment-variables";
import {
  findEnvironmentVariable,
  findEnvironmentVariableByName,
  updateEnvironmentVariable,
} from "../../repositories/environment-variables";
import {
  DuplicateEnvironmentVariableError,
  EnvironmentVariableNotFoundError,
} from "../../repositories/environment-variables/errors";
import { environmentVariableInput } from "../../utils/environment-variables";
import { ensureProject } from "../../utils/project";
import { createUpdateEnvironmentVariableUseCase } from "../../use-cases/environment-variables/update-environment-variable";

const updateEnvironmentVariableUseCase = createUpdateEnvironmentVariableUseCase({
  ensureProject,
  findEnvironmentVariable,
  findByName: findEnvironmentVariableByName,
  updateEnvironmentVariable,
});

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const input = environmentVariableUpdateRequestSchema.parse(
    environmentVariableInput(await readBody(event)),
  );
  try {
    return environmentVariableUpdateResponseSchema.parse(
      await updateEnvironmentVariableUseCase(id, input),
    );
  } catch (error) {
    if (error instanceof DuplicateEnvironmentVariableError)
      throw createError({ statusCode: 409, statusMessage: error.message, cause: error });
    if (error instanceof EnvironmentVariableNotFoundError)
      throw createError({
        statusCode: 404,
        statusMessage: "Environment variable not found",
        cause: error,
      });
    throw error;
  }
});
