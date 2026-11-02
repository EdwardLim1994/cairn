import { mockApiCallHistoryDeleteResponseSchema } from "#shared/api/mock-api-call-history";
import { deleteMockApiCallHistory } from "../../repositories/runs";
import { ensureProject } from "../../utils/project";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  if (!(await deleteMockApiCallHistory(await ensureProject(), id))) {
    throw createError({ statusCode: 404, statusMessage: "Mock API call history entry not found" });
  }
  return mockApiCallHistoryDeleteResponseSchema.parse({ id });
});
