export function createDeleteEnvironmentVariableUseCase(dependencies: {
  ensureProject: () => Promise<string>;
  deleteEnvironmentVariable: (projectId: string, id: string) => Promise<void>;
}) {
  return async (id: string) => {
    await dependencies.deleteEnvironmentVariable(await dependencies.ensureProject(), id);
    return { id };
  };
}
