import { mockApiDeleteResponseSchema } from "#shared/api/mock-apis";
import { deleteMockApi, MockApiNotFoundError } from "../../modules/mock-apis";
import { ensureProject } from "../../utils/project";
import { createDeleteMockApiUseCase } from "../../use-cases/mock-apis/delete-mock-api";

const deleteMockApiUseCase = createDeleteMockApiUseCase({ ensureProject, deleteMockApi });

export default defineEventHandler(async (event) => {
  try {
    return mockApiDeleteResponseSchema.parse(
      await deleteMockApiUseCase(getRouterParam(event, "id")!),
    );
  } catch (error) {
    if (error instanceof MockApiNotFoundError)
      throw createError({ statusCode: 404, statusMessage: "Mock API not found", cause: error });
    throw error;
  }
});
