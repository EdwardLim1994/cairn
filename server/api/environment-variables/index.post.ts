import {
  environmentVariableCreateRequestSchema,
  environmentVariableCreateResponseSchema,
} from "#shared/api/environment-variables";
import {
  createEnvironmentVariable,
  findEnvironmentVariableByName,
} from "../../repositories/environment-variables";
import { DuplicateEnvironmentVariableError } from "../../repositories/environment-variables/errors";
import { environmentVariableInput } from "../../utils/environment-variables";
import { ensureProject } from "../../utils/project";
import { createCreateEnvironmentVariableUseCase } from "../../use-cases/environment-variables/create-environment-variable";

const createEnvironmentVariableUseCase = createCreateEnvironmentVariableUseCase({
  ensureProject,
  findByName: findEnvironmentVariableByName,
  createEnvironmentVariable,
});

export default defineEventHandler(async (event) => {
  const input = environmentVariableCreateRequestSchema.parse(
    environmentVariableInput(await readBody(event)),
  );
  try {
    return environmentVariableCreateResponseSchema.parse(
      await createEnvironmentVariableUseCase(input),
    );
  } catch (error) {
    if (error instanceof DuplicateEnvironmentVariableError)
      throw createError({ statusCode: 409, statusMessage: error.message, cause: error });
    throw error;
  }
});
