import type { MockApiInput } from "#shared/api/mock-apis";
import { MockApiEndpointError, MockApiNotFoundError } from "../../modules/mock-apis";
import { validateEndpointPathParameters } from "../../utils/mock-api-validation";

export function createUpdateMockApiUseCase(dependencies: {
  ensureProject: () => Promise<string>;
  findMockApi: (projectId: string, id: string) => Promise<boolean>;
  findMockApiEndpoint: (
    projectId: string,
    endpointId: string,
  ) => Promise<
    { id: string; url: string | null; serviceApiType: "REST" | "GRPC" | "WEBSOCKET" } | undefined
  >;
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
    const expectedServiceType = { HTTP: "REST", WEBSOCKET: "WEBSOCKET", GRPC: "GRPC" }[
      input.apiType
    ];
    if (endpoint && endpoint.serviceApiType !== expectedServiceType)
      throw new MockApiEndpointError("Mock API type must match the selected service endpoint");
    if (input.apiType === "HTTP" && endpoint?.url)
      validateEndpointPathParameters(input.pathParameters, endpoint.url);
    await dependencies.updateMockApi(id, projectId, input);
    return { id };
  };
}
