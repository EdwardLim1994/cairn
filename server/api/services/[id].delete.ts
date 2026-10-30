import { serviceDeleteResponseSchema } from "#shared/api/services";
import { deleteService } from "../../repositories/services";
import { ensureProject } from "../../utils/project";
import { createDeleteServiceUseCase } from "../../use-cases/services/delete-service";

const deleteServiceUseCase = createDeleteServiceUseCase({ ensureProject, deleteService });

export default defineEventHandler(async (event) => {
  const result = await deleteServiceUseCase(getRouterParam(event, "id")!);
  if (!result) throw createError({ statusCode: 404, statusMessage: "Service not found" });
  return serviceDeleteResponseSchema.parse(result);
});
