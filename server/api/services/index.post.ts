import { serviceCreateRequestSchema, serviceCreateResponseSchema } from "#shared/api/services";
import { createService } from "../../repositories/services";
import { finiteNumber, record, serviceInput } from "../../utils/graph-validation";
import { ensureProject } from "../../utils/project";
import { createCreateServiceUseCase } from "../../use-cases/services/create-service";
import { ServiceHeaderTemplateOwnershipError } from "../../repositories/services/errors";

const createServiceUseCase = createCreateServiceUseCase({ ensureProject, createService });

export default defineEventHandler(async (event) => {
  const body = record(await readBody(event), "Service");
  const input = serviceCreateRequestSchema.parse({
    ...serviceInput(body),
    positionX: finiteNumber(body.positionX, "Service x", 0),
    positionY: finiteNumber(body.positionY, "Service y", 0),
  });
  try {
    return serviceCreateResponseSchema.parse(await createServiceUseCase(input));
  } catch (error) {
    if (error instanceof ServiceHeaderTemplateOwnershipError)
      throw createError({ statusCode: 400, statusMessage: error.message, cause: error });
    throw error;
  }
});
