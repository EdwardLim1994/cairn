import { serviceHealthResponseSchema } from "#shared/api/services";
import { listHealthTargets } from "../../modules/service-registry";
import { ensureProject } from "../../utils/project";
import { createCheckServiceHealthUseCase } from "../../use-cases/services/check-service-health";

const checkServiceHealthUseCase = createCheckServiceHealthUseCase({
  ensureProject,
  listHealthTargets,
  fetch: globalThis.fetch,
});

export default defineEventHandler(async () =>
  serviceHealthResponseSchema.parse(await checkServiceHealthUseCase()),
);
