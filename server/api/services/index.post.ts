import { serviceCreateRequestSchema, serviceCreateResponseSchema } from "#shared/api/services";
import { getDb } from "../../db";
import { GraphPositionRepository } from "../../modules/graph-canvas";
import {
  ServiceWriteRepository,
  ServiceHeaderTemplateOwnershipError,
} from "../../modules/service-registry";
import { finiteNumber, record, serviceInput } from "../../utils/graph-validation";
import { ensureProject } from "../../utils/project";
import { createCreateServiceUseCase } from "../../use-cases/services/create-service";
import { putProtoFile, removeProtoFile } from "../../utils/proto-storage";

const createServiceUseCase = createCreateServiceUseCase({
  ensureProject,
  transaction: (work) => getDb().transaction(work),
  createService: (tx, projectId, id, input, protoStorageKey) =>
    new ServiceWriteRepository(tx).create(projectId, id, input, protoStorageKey),
  createPosition: async (tx, projectId, id, x, y) => {
    await new GraphPositionRepository(tx).createServicePosition(projectId, id, x, y);
  },
  putProtoFile,
  removeProtoFile,
});

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
