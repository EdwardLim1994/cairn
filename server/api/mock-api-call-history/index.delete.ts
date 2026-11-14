import { mockApiCallHistoryClearResponseSchema } from "#shared/api/mock-api-call-history";
import { clearMockApiCallHistory } from "../../modules/runs";
import { ensureProject } from "../../utils/project";

export default defineEventHandler(async () =>
  mockApiCallHistoryClearResponseSchema.parse({
    deleted: await clearMockApiCallHistory(await ensureProject()),
  }),
);
