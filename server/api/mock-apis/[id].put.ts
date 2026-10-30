import { mockApiUpdateRequestSchema, mockApiUpdateResponseSchema } from "#shared/api/mock-apis";
import { findMockApi, findMockApiEndpoint, updateMockApi } from "../../repositories/mock-apis";
import { MockApiEndpointError, MockApiNotFoundError } from "../../repositories/mock-apis/errors";
import { ensureProject } from "../../utils/project";
import { mockApiInput } from "../../utils/mock-api-validation";
import { createUpdateMockApiUseCase } from "../../use-cases/mock-apis/update-mock-api";

const updateMockApiUseCase = createUpdateMockApiUseCase({
  ensureProject,
  findMockApi,
  findMockApiEndpoint,
  updateMockApi,
});

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const input = mockApiUpdateRequestSchema.parse(mockApiInput(await readBody(event)));
  try {
    return mockApiUpdateResponseSchema.parse(await updateMockApiUseCase(id, input));
  } catch (error) {
    if (error instanceof MockApiEndpointError)
      throw createError({ statusCode: 400, statusMessage: error.message, cause: error });
    if (error instanceof MockApiNotFoundError)
      throw createError({ statusCode: 404, statusMessage: "Mock API not found", cause: error });
    throw error;
  }
});
