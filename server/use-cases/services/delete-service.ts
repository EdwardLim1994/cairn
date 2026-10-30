export function createDeleteServiceUseCase(dependencies: {
  ensureProject: () => Promise<string>;
  deleteService: (projectId: string, id: string) => Promise<boolean>;
}) {
  return async (id: string) =>
    (await dependencies.deleteService(await dependencies.ensureProject(), id)) ? { id } : null;
}
