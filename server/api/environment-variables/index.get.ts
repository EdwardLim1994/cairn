import { environmentVariableListResponseSchema } from "#shared/api/environment-variables";
import { listEnvironmentVariables } from "../../repositories/environment-variables";
import { ensureProject } from "../../utils/project";
import { createListEnvironmentVariablesUseCase } from "../../use-cases/environment-variables/list-environment-variables";

const listEnvironmentVariablesUseCase = createListEnvironmentVariablesUseCase({
  ensureProject,
  listEnvironmentVariables,
});

export default defineEventHandler(async () =>
  environmentVariableListResponseSchema.parse(await listEnvironmentVariablesUseCase()),
);
