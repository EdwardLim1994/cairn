import type { ServiceCreateRequest, ServiceUpdateRequest } from "#shared/api/services";
import { getDb } from "../../db";
import { ServiceRepository } from "./ServiceRepository";

export { ServiceRepository } from "./ServiceRepository";

type Database = ReturnType<typeof getDb>;
export const listServices = (projectId: string) =>
  new ServiceRepository(getDb()).listServices(projectId);
export const createService = (projectId: string, id: string, input: ServiceCreateRequest) =>
  new ServiceRepository(getDb()).createService(projectId, id, input);
export const updateService = (
  projectId: string,
  id: string,
  input: ServiceUpdateRequest,
  db: Database = getDb(),
) => new ServiceRepository(db).updateService(projectId, id, input);
export const deleteService = (projectId: string, id: string, db: Database = getDb()) =>
  new ServiceRepository(db).deleteService(projectId, id);
export const listHealthTargets = (projectId: string) =>
  new ServiceRepository(getDb()).listHealthTargets(projectId);
