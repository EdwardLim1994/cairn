export function createListMockApisUseCase(dependencies: {
  ensureProject: () => Promise<string>;
  listMockApis: (projectId: string) => Promise<unknown>;
}) {
  return async () => dependencies.listMockApis(await dependencies.ensureProject());
}
