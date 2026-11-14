import { mockApiCallHistoryListResponseSchema } from "#shared/api/mock-api-call-history";
import { listMockApiCallHistory } from "../../modules/runs";
import { ensureProject } from "../../utils/project";

export default defineEventHandler(async () =>
  mockApiCallHistoryListResponseSchema.parse(await listMockApiCallHistory(await ensureProject())),
);
