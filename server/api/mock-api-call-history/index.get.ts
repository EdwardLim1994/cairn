import { mockApiCallHistoryListResponseSchema } from "#shared/api/mock-api-call-history";
import { listMockApiCallHistory } from "../../repositories/runs";
import { ensureProject } from "../../utils/project";

export default defineEventHandler(async () =>
  mockApiCallHistoryListResponseSchema.parse(await listMockApiCallHistory(await ensureProject())),
);
