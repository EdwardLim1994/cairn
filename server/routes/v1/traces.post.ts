import { otlpIngestResponseSchema, otlpTracesRequestSchema } from "#shared/api/observability";
import { insertOtlpSpans } from "../../modules/observability";
import { getAppConfig } from "../../utils/config";
import { ensureProject } from "../../utils/project";
import { readOtlpBody } from "../../utils/otlp";
import { createIngestOtlpTracesUseCase } from "../../use-cases/telemetry/ingest-otlp-traces";
import { requireOtelAccessToken } from "../../utils/otel-access-token-auth";
import { recordOtlpBenchmark } from "../../utils/otlp-benchmark";

const ingestOtlpTracesUseCase = createIngestOtlpTracesUseCase({
  ensureProject,
  configuredProjectId: () => getAppConfig().projectId,
  insertSpans: insertOtlpSpans,
});

export default defineEventHandler(async (event) => {
  await requireOtelAccessToken(event);
  const parseStarted = performance.now();
  const parsed = otlpTracesRequestSchema.safeParse(await readOtlpBody(event, "Trace payload"));
  recordOtlpBenchmark("traces", "parse", performance.now() - parseStarted);
  if (!parsed.success)
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? "Trace payload is invalid",
      cause: parsed.error,
    });
  const body = parsed.data;
  return otlpIngestResponseSchema.parse(await ingestOtlpTracesUseCase(body));
});
