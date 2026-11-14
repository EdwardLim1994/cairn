import {
  otelAccessTokenCreateRequestSchema,
  otelAccessTokenCreateResponseSchema,
} from "#shared/api/otel-access-tokens";
import { createOtelAccessToken } from "../../modules/project-access";
import { ensureProject } from "../../utils/project";
import { createOtelAccessTokenUseCase } from "../../use-cases/otel-access-tokens/manage";

const create = createOtelAccessTokenUseCase({ ensureProject, create: createOtelAccessToken });
export default defineEventHandler(async (event) => {
  const parsed = otelAccessTokenCreateRequestSchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? "Access token details are invalid",
      cause: parsed.error,
    });
  }
  const input = parsed.data;
  return otelAccessTokenCreateResponseSchema.parse(await create(input));
});
