import type { ServiceUpdateRequest } from "#shared/api/services";
import { randomUUID } from "node:crypto";
import type { SqliteTransaction } from "../../db";

export function createUpdateServiceUseCase(dependencies: {
  ensureProject: () => Promise<string>;
  transaction: <T>(work: (tx: SqliteTransaction) => Promise<T>) => Promise<T>;
  findProto: (
    tx: SqliteTransaction,
    projectId: string,
    id: string,
  ) => Promise<{
    protoStorageKey: string | null;
    protoFileName: string | null;
  } | null>;
  updateService: (
    tx: SqliteTransaction,
    projectId: string,
    id: string,
    input: ServiceUpdateRequest,
    protoStorageKey: string | null,
    protoFileName: string | null,
  ) => Promise<void>;
  reconcileReadiness: (tx: SqliteTransaction, projectId: string) => Promise<void>;
  putProtoFile: (key: string, content: string) => Promise<unknown>;
  removeProtoFile: (key: string) => Promise<unknown>;
  newProtoId?: () => string;
}) {
  return async (id: string, input: ServiceUpdateRequest) => {
    const projectId = await dependencies.ensureProject();
    const newProtoStorageKey =
      input.apiType === "GRPC" && input.protoContent
        ? `services/${id}/${(dependencies.newProtoId ?? randomUUID)()}.proto`
        : null;
    const clearProto = input.apiType !== "GRPC" || input.clearProto;
    let uploaded = false;
    let oldProtoStorageKey: string | null = null;
    let result: "updated" | "not-found";
    try {
      result = await dependencies.transaction(async (tx) => {
        const existing = await dependencies.findProto(tx, projectId, id);
        if (!existing) return "not-found" as const;
        oldProtoStorageKey = existing.protoStorageKey;
        const protoStorageKey = clearProto
          ? null
          : (newProtoStorageKey ?? existing.protoStorageKey);
        const protoFileName = clearProto
          ? null
          : newProtoStorageKey
            ? (input.protoFileName ?? null)
            : existing.protoFileName;
        if (newProtoStorageKey) {
          await dependencies.putProtoFile(newProtoStorageKey, input.protoContent!);
          uploaded = true;
        }
        await dependencies.updateService(tx, projectId, id, input, protoStorageKey, protoFileName);
        await dependencies.reconcileReadiness(tx, projectId);
        return "updated" as const;
      });
    } catch (error) {
      if (uploaded && newProtoStorageKey)
        await dependencies.removeProtoFile(newProtoStorageKey).catch(() => {});
      throw error;
    }
    if (result === "updated" && oldProtoStorageKey && (clearProto || newProtoStorageKey))
      await dependencies.removeProtoFile(oldProtoStorageKey);
    return result;
  };
}
