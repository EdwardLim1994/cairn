import { otlpIngestResponseSchema, otlpLogsRequestSchema } from "#shared/api/observability";
import { insertOtlpLogs, listTelemetryServiceNames } from "../../repositories/telemetry";
import { getAppConfig } from "../../utils/config";
import { ensureProject } from "../../utils/project";
import { readOtlpBody } from "../../utils/otlp";
import { createIngestOtlpLogsUseCase } from "../../use-cases/telemetry/ingest-otlp-logs";

const ingestOtlpLogsUseCase = createIngestOtlpLogsUseCase({
  ensureProject,
  configuredProjectId: () => getAppConfig().projectId,
  listServiceNames: listTelemetryServiceNames,
  insertLogs: insertOtlpLogs,
});

export default defineEventHandler(async (event) => {
  const parsed = otlpLogsRequestSchema.safeParse(await readOtlpBody(event, "Log payload"));
  if (!parsed.success)
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? "Log payload is invalid",
      cause: parsed.error,
    });
  const body = parsed.data;
  return otlpIngestResponseSchema.parse(await ingestOtlpLogsUseCase(body));
});
