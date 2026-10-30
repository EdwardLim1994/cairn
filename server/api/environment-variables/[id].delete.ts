import { environmentVariableDeleteResponseSchema } from "#shared/api/environment-variables";
import { deleteEnvironmentVariable } from "../../repositories/environment-variables";
import { ensureProject } from "../../utils/project";
import { createDeleteEnvironmentVariableUseCase } from "../../use-cases/environment-variables/delete-environment-variable";

const deleteEnvironmentVariableUseCase = createDeleteEnvironmentVariableUseCase({
  ensureProject,
  deleteEnvironmentVariable,
});

export default defineEventHandler(async (event) => {
  return environmentVariableDeleteResponseSchema.parse(
    await deleteEnvironmentVariableUseCase(getRouterParam(event, "id")!),
  );
});
