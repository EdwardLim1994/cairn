import { randomUUID } from "node:crypto";
import type { ServiceCreateRequest } from "#shared/api/services";

export function createCreateServiceUseCase(dependencies: {
  ensureProject: () => Promise<string>;
  createService: (projectId: string, id: string, input: ServiceCreateRequest) => Promise<void>;
  newId?: () => string;
}) {
  return async (input: ServiceCreateRequest) => {
    const id = (dependencies.newId ?? randomUUID)();
    await dependencies.createService(await dependencies.ensureProject(), id, input);
    return { id };
  };
}
