import { logListRequestSchema, logListResponseSchema } from "#shared/api/observability";
import { queryLogs } from "../repositories/telemetry";
import { ensureProject } from "../utils/project";
import { createListLogsUseCase } from "../use-cases/telemetry/list-logs";

const listLogsUseCase = createListLogsUseCase({ ensureProject, queryLogs });

export default defineEventHandler(async (event) => {
  const query = logListRequestSchema.parse(getQuery(event));
  return logListResponseSchema.parse(await listLogsUseCase(query));
});
