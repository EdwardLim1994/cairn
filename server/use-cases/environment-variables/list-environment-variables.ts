export function createListEnvironmentVariablesUseCase(dependencies: {
  ensureProject: () => Promise<string>;
  listEnvironmentVariables: (projectId: string) => Promise<unknown>;
}) {
  return async () => dependencies.listEnvironmentVariables(await dependencies.ensureProject());
}
