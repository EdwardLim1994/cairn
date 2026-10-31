import { randomUUID } from "node:crypto";
import type { MockApiInput } from "#shared/api/mock-apis";
import { MockApiEndpointError } from "../../repositories/mock-apis/errors";
import { validateEndpointPathParameters } from "../../utils/mock-api-validation";

export function createCreateMockApiUseCase(dependencies: {
  ensureProject: () => Promise<string>;
  findMockApiEndpoint: (
    projectId: string,
    endpointId: string,
  ) => Promise<{ id: string; url: string } | undefined>;
  createMockApi: (id: string, projectId: string, input: MockApiInput) => Promise<void>;
  newId?: () => string;
}) {
  return async (input: MockApiInput) => {
    const projectId = await dependencies.ensureProject();
    const endpoint = input.targetEndpointId
      ? await dependencies.findMockApiEndpoint(projectId, input.targetEndpointId)
      : undefined;
    if (input.targetEndpointId && !endpoint)
      throw new MockApiEndpointError("Selected endpoint is not in this project");
    if (!endpoint && input.active)
      throw new MockApiEndpointError("An API without an endpoint must be inactive");
    if (endpoint) validateEndpointPathParameters(input.pathParameters, endpoint.url);
    const id = (dependencies.newId ?? randomUUID)();
    await dependencies.createMockApi(id, projectId, input);
    return { id };
  };
}
