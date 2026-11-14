import type { SqliteTransaction } from "../../db";

export function createDeleteServiceUseCase(dependencies: {
  ensureProject: () => Promise<string>;
  transaction: <T>(work: (tx: SqliteTransaction) => Promise<T>) => Promise<T>;
  deleteService: (
    tx: SqliteTransaction,
    projectId: string,
    id: string,
  ) => Promise<{
    protoStorageKey: string | null;
  } | null>;
  deletePosition: (tx: SqliteTransaction, projectId: string, id: string) => Promise<unknown>;
  reconcileReadiness: (tx: SqliteTransaction, projectId: string) => Promise<void>;
  removeProtoFile: (key: string) => Promise<unknown>;
}) {
  return async (id: string) => {
    const projectId = await dependencies.ensureProject();
    const deleted = await dependencies.transaction(async (tx) => {
      await dependencies.deletePosition(tx, projectId, id);
      const service = await dependencies.deleteService(tx, projectId, id);
      if (service) await dependencies.reconcileReadiness(tx, projectId);
      return service;
    });
    if (!deleted) return null;
    if (deleted.protoStorageKey) await dependencies.removeProtoFile(deleted.protoStorageKey);
    return { id };
  };
}
