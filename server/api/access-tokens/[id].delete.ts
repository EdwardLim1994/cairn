import {
  otelAccessTokenDeleteResponseSchema,
  otelAccessTokenIdRequestSchema,
} from "#shared/api/otel-access-tokens";
import { deleteOtelAccessToken } from "../../modules/project-access";
import { ensureProject } from "../../utils/project";
import { createDeleteOtelAccessTokenUseCase } from "../../use-cases/otel-access-tokens/manage";

const remove = createDeleteOtelAccessTokenUseCase({ ensureProject, remove: deleteOtelAccessToken });
export default defineEventHandler(async (event) => {
  const parsed = otelAccessTokenIdRequestSchema.safeParse(getRouterParams(event));
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? "Access token ID is invalid",
      cause: parsed.error,
    });
  }
  const { id } = parsed.data;
  if (!(await remove(id)))
    throw createError({ statusCode: 404, statusMessage: "Access token not found" });
  return otelAccessTokenDeleteResponseSchema.parse({ deleted: true });
});
