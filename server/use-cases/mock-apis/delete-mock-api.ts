import { MockApiNotFoundError } from "../../repositories/mock-apis/errors";

export function createDeleteMockApiUseCase(dependencies: {
  ensureProject: () => Promise<string>;
  deleteMockApi: (projectId: string, id: string) => Promise<boolean>;
}) {
  return async (id: string) => {
    const projectId = await dependencies.ensureProject();
    if (!(await dependencies.deleteMockApi(projectId, id))) throw new MockApiNotFoundError();
    return { id };
  };
}
