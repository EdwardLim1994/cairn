import type { ServiceUpdateRequest } from "#shared/api/services";

export function createUpdateServiceUseCase(dependencies: {
  ensureProject: () => Promise<string>;
  updateService: (
    projectId: string,
    id: string,
    input: ServiceUpdateRequest,
  ) => Promise<"updated" | "not-found">;
}) {
  return async (id: string, input: ServiceUpdateRequest) =>
    dependencies.updateService(await dependencies.ensureProject(), id, input);
}
