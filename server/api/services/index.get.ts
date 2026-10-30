import { serviceListResponseSchema } from "#shared/api/services";
import { listServices } from "../../repositories/services";
import { ensureProject } from "../../utils/project";
import { createListServicesUseCase } from "../../use-cases/services/list-services";

const listServicesUseCase = createListServicesUseCase({ ensureProject, listServices });

export default defineEventHandler(async () =>
  serviceListResponseSchema.parse(await listServicesUseCase()),
);
