import { mockApiCreateRequestSchema, mockApiCreateResponseSchema } from "#shared/api/mock-apis";
import { createMockApi, findMockApiEndpoint } from "../../repositories/mock-apis";
import { MockApiEndpointError } from "../../repositories/mock-apis/errors";
import { ensureProject } from "../../utils/project";
import { mockApiInput } from "../../utils/mock-api-validation";
import { createCreateMockApiUseCase } from "../../use-cases/mock-apis/create-mock-api";

const createMockApiUseCase = createCreateMockApiUseCase({
  ensureProject,
  findMockApiEndpoint,
  createMockApi,
});

export default defineEventHandler(async (event) => {
  const input = mockApiCreateRequestSchema.parse(mockApiInput(await readBody(event)));
  try {
    return mockApiCreateResponseSchema.parse(await createMockApiUseCase(input));
  } catch (error) {
    if (error instanceof MockApiEndpointError)
      throw createError({ statusCode: 400, statusMessage: error.message, cause: error });
    throw error;
  }
});
