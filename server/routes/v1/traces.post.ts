import { otlpIngestResponseSchema, otlpTracesRequestSchema } from "#shared/api/observability";
import { insertOtlpSpans } from "../../repositories/telemetry";
import { getAppConfig } from "../../utils/config";
import { ensureProject } from "../../utils/project";
import { readOtlpBody } from "../../utils/otlp";
import { createIngestOtlpTracesUseCase } from "../../use-cases/telemetry/ingest-otlp-traces";

const ingestOtlpTracesUseCase = createIngestOtlpTracesUseCase({
  ensureProject,
  configuredProjectId: () => getAppConfig().projectId,
  insertSpans: insertOtlpSpans,
});

export default defineEventHandler(async (event) => {
  const parsed = otlpTracesRequestSchema.safeParse(await readOtlpBody(event, "Trace payload"));
  if (!parsed.success)
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? "Trace payload is invalid",
      cause: parsed.error,
    });
  const body = parsed.data;
  return otlpIngestResponseSchema.parse(await ingestOtlpTracesUseCase(body));
});
