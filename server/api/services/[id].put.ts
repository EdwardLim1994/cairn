import { serviceUpdateRequestSchema, serviceUpdateResponseSchema } from "#shared/api/services";
import { getDb } from "../../db";
import { ServiceWriteRepository } from "../../modules/service-registry";
import { deactivateInvalidMockApis } from "../../modules/mock-apis";
import {
  ServiceEndpointOwnershipError,
  ServiceHeaderTemplateOwnershipError,
} from "../../modules/service-registry";
import { ensureProject } from "../../utils/project";
import { serviceInput } from "../../utils/graph-validation";
import { createUpdateServiceUseCase } from "../../use-cases/services/update-service";
import { webSocketSessionRegistry } from "../../utils/websocket-sessions";
import { putProtoFile, removeProtoFile } from "../../utils/proto-storage";

const updateServiceUseCase = createUpdateServiceUseCase({
  ensureProject,
  transaction: (work) => getDb().transaction(work),
  findProto: (tx, projectId, id) => new ServiceWriteRepository(tx).findProto(projectId, id),
  updateService: (tx, projectId, id, input, protoStorageKey, protoFileName) =>
    new ServiceWriteRepository(tx).update(projectId, id, input, protoStorageKey, protoFileName),
  reconcileReadiness: deactivateInvalidMockApis,
  putProtoFile,
  removeProtoFile,
});

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const input = serviceUpdateRequestSchema.parse(serviceInput(await readBody(event)));
  try {
    const result = await updateServiceUseCase(id, input);
    if (result === "not-found")
      throw createError({ statusCode: 404, statusMessage: "Service not found" });
    webSocketSessionRegistry.closeProject(await ensureProject());
    return serviceUpdateResponseSchema.parse({ id });
  } catch (error) {
    if (error instanceof ServiceEndpointOwnershipError)
      throw createError({ statusCode: 400, statusMessage: error.message, cause: error });
    if (error instanceof ServiceHeaderTemplateOwnershipError)
      throw createError({ statusCode: 400, statusMessage: error.message, cause: error });
    throw error;
  }
});
