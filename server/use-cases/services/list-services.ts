export function createListServicesUseCase(dependencies: {
  ensureProject: () => Promise<string>;
  listServices: (projectId: string) => Promise<unknown>;
}) {
  return async () => dependencies.listServices(await dependencies.ensureProject());
}
