import { otelAccessTokenListResponseSchema } from "#shared/api/otel-access-tokens";
import { listOtelAccessTokens } from "../../modules/project-access";
import { ensureProject } from "../../utils/project";
import { createListOtelAccessTokensUseCase } from "../../use-cases/otel-access-tokens/manage";

const list = createListOtelAccessTokensUseCase({ ensureProject, list: listOtelAccessTokens });
export default defineEventHandler(async () =>
  otelAccessTokenListResponseSchema.parse(await list()),
);
