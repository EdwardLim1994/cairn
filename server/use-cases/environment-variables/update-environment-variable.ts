import type { EnvironmentVariableInput } from "#shared/api/environment-variables";
import {
  DuplicateEnvironmentVariableError,
  EnvironmentVariableNotFoundError,
} from "../../repositories/environment-variables/errors";

export function createUpdateEnvironmentVariableUseCase(dependencies: {
  ensureProject: () => Promise<string>;
  findEnvironmentVariable: (projectId: string, id: string) => Promise<boolean>;
  findByName: (projectId: string, name: string, exceptId: string) => Promise<boolean>;
  updateEnvironmentVariable: (
    id: string,
    projectId: string,
    input: EnvironmentVariableInput,
  ) => Promise<void>;
}) {
  return async (id: string, input: EnvironmentVariableInput) => {
    const projectId = await dependencies.ensureProject();
    if (!(await dependencies.findEnvironmentVariable(projectId, id)))
      throw new EnvironmentVariableNotFoundError();
    if (await dependencies.findByName(projectId, input.name, id))
      throw new DuplicateEnvironmentVariableError(`Variable "${input.name}" already exists`);
    await dependencies.updateEnvironmentVariable(id, projectId, input);
    return { id };
  };
}
