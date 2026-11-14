import { serviceDeleteResponseSchema } from "#shared/api/services";
import { getDb } from "../../db";
import { GraphPositionRepository } from "../../modules/graph-canvas";
import { deactivateInvalidMockApis } from "../../modules/mock-apis";
import { ServiceWriteRepository } from "../../modules/service-registry";
import { ensureProject } from "../../utils/project";
import { createDeleteServiceUseCase } from "../../use-cases/services/delete-service";
import { webSocketSessionRegistry } from "../../utils/websocket-sessions";
import { removeProtoFile } from "../../utils/proto-storage";

const deleteServiceUseCase = createDeleteServiceUseCase({
  ensureProject,
  transaction: (work) => getDb().transaction(work),
  deleteService: (tx, projectId, id) => new ServiceWriteRepository(tx).delete(projectId, id),
  deletePosition: async (tx, projectId, id) => {
    await new GraphPositionRepository(tx).deleteServicePosition(projectId, id);
  },
  reconcileReadiness: deactivateInvalidMockApis,
  removeProtoFile,
});

export default defineEventHandler(async (event) => {
  const result = await deleteServiceUseCase(getRouterParam(event, "id")!);
  if (!result) throw createError({ statusCode: 404, statusMessage: "Service not found" });
  webSocketSessionRegistry.closeProject(await ensureProject());
  return serviceDeleteResponseSchema.parse(result);
});
