import { randomUUID } from "node:crypto";
import type { EnvironmentVariableInput } from "#shared/api/environment-variables";
import { DuplicateEnvironmentVariableError } from "../../repositories/environment-variables/errors";

export function createCreateEnvironmentVariableUseCase(dependencies: {
  ensureProject: () => Promise<string>;
  findByName: (projectId: string, name: string) => Promise<boolean>;
  createEnvironmentVariable: (
    id: string,
    projectId: string,
    input: EnvironmentVariableInput,
  ) => Promise<void>;
  newId?: () => string;
}) {
  return async (input: EnvironmentVariableInput) => {
    const projectId = await dependencies.ensureProject();
    if (await dependencies.findByName(projectId, input.name))
      throw new DuplicateEnvironmentVariableError(`Variable "${input.name}" already exists`);
    const id = (dependencies.newId ?? randomUUID)();
    await dependencies.createEnvironmentVariable(id, projectId, input);
    return { id };
  };
}
