import { randomUUID } from "node:crypto";
import type { ServiceCreateRequest } from "#shared/api/services";
import type { SqliteTransaction } from "../../db";

export function createCreateServiceUseCase(dependencies: {
  ensureProject: () => Promise<string>;
  transaction: <T>(work: (tx: SqliteTransaction) => Promise<T>) => Promise<T>;
  createService: (
    tx: SqliteTransaction,
    projectId: string,
    id: string,
    input: ServiceCreateRequest,
    protoStorageKey: string | null,
  ) => Promise<void>;
  createPosition: (
    tx: SqliteTransaction,
    projectId: string,
    id: string,
    x: number,
    y: number,
  ) => Promise<unknown>;
  putProtoFile: (key: string, content: string) => Promise<unknown>;
  removeProtoFile: (key: string) => Promise<unknown>;
  newId?: () => string;
  newProtoId?: () => string;
}) {
  return async (input: ServiceCreateRequest) => {
    const id = (dependencies.newId ?? randomUUID)();
    const projectId = await dependencies.ensureProject();
    const protoStorageKey =
      input.apiType === "GRPC" && input.protoContent
        ? `services/${id}/${(dependencies.newProtoId ?? randomUUID)()}.proto`
        : null;
    if (protoStorageKey) await dependencies.putProtoFile(protoStorageKey, input.protoContent!);
    try {
      await dependencies.transaction(async (tx) => {
        await dependencies.createService(tx, projectId, id, input, protoStorageKey);
        await dependencies.createPosition(
          tx,
          projectId,
          id,
          input.positionX ?? 0,
          input.positionY ?? 0,
        );
      });
    } catch (error) {
      if (protoStorageKey) await dependencies.removeProtoFile(protoStorageKey).catch(() => {});
      throw error;
    }
    return { id };
  };
}
