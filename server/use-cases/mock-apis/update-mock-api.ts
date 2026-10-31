import type { MockApiInput } from "#shared/api/mock-apis";
import { MockApiEndpointError, MockApiNotFoundError } from "../../repositories/mock-apis/errors";
import { validateEndpointPathParameters } from "../../utils/mock-api-validation";

export function createUpdateMockApiUseCase(dependencies: {
  ensureProject: () => Promise<string>;
  findMockApi: (projectId: string, id: string) => Promise<boolean>;
  findMockApiEndpoint: (
    projectId: string,
    endpointId: string,
  ) => Promise<{ id: string; url: string } | undefined>;
  updateMockApi: (id: string, projectId: string, input: MockApiInput) => Promise<void>;
}) {
  return async (id: string, input: MockApiInput) => {
    const projectId = await dependencies.ensureProject();
    if (!(await dependencies.findMockApi(projectId, id))) throw new MockApiNotFoundError();
    const endpoint = input.targetEndpointId
      ? await dependencies.findMockApiEndpoint(projectId, input.targetEndpointId)
      : undefined;
    if (input.targetEndpointId && !endpoint)
      throw new MockApiEndpointError("Selected endpoint is not in this project");
    if (!endpoint && input.active)
      throw new MockApiEndpointError("An API without an endpoint must be inactive");
    if (endpoint) validateEndpointPathParameters(input.pathParameters, endpoint.url);
    await dependencies.updateMockApi(id, projectId, input);
    return { id };
  };
}
