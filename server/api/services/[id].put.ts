import { serviceUpdateRequestSchema, serviceUpdateResponseSchema } from "#shared/api/services";
import { updateService } from "../../repositories/services";
import { ServiceEndpointOwnershipError } from "../../repositories/services/errors";
import { ensureProject } from "../../utils/project";
import { serviceInput } from "../../utils/graph-validation";
import { createUpdateServiceUseCase } from "../../use-cases/services/update-service";

const updateServiceUseCase = createUpdateServiceUseCase({ ensureProject, updateService });

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const input = serviceUpdateRequestSchema.parse(serviceInput(await readBody(event)));
  try {
    const result = await updateServiceUseCase(id, input);
    if (result === "not-found")
      throw createError({ statusCode: 404, statusMessage: "Service not found" });
    return serviceUpdateResponseSchema.parse({ id });
  } catch (error) {
    if (error instanceof ServiceEndpointOwnershipError)
      throw createError({ statusCode: 400, statusMessage: error.message, cause: error });
    throw error;
  }
});
