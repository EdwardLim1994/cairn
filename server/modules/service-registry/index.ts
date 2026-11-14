// Public service operations. Persistence will move behind this entry during migration.
export {
  listServices,
  createService,
  updateService,
  deleteService,
  listHealthTargets,
  listServiceNames,
  listServiceSummaries,
  listEndpointOwners,
} from "../../repositories/services";
export {
  ServiceEndpointOwnershipError,
  ServiceHeaderTemplateOwnershipError,
} from "../../repositories/services/errors";
export { ServiceWriteRepository } from "../../repositories/services/ServiceWriteRepository";
export { ServiceEndpointReader } from "../../repositories/services/ServiceEndpointReader";

import { getDb, type SqliteTransaction } from "../../db";
import { ServiceWriteRepository } from "../../repositories/services/ServiceWriteRepository";
import { ServiceEndpointReader } from "../../repositories/services/ServiceEndpointReader";
export const detachHealthHeaderTemplate = (
  tx: SqliteTransaction,
  projectId: string,
  templateId: string,
) => new ServiceWriteRepository(tx).detachHealthHeaderTemplate(projectId, templateId);
export const detachHealthHeaderTemplates = (
  tx: SqliteTransaction,
  projectId: string,
  templateIds: string[],
) => new ServiceWriteRepository(tx).detachHealthHeaderTemplates(projectId, templateIds);
export const listEndpointDetails = (tx: SqliteTransaction, projectId: string, ids: string[]) =>
  new ServiceEndpointReader(tx).listDetails(projectId, ids);
export const findEndpointDetail = (projectId: string, id: string) =>
  getDb().transaction((tx) => new ServiceEndpointReader(tx).findDetail(projectId, id));
export const findServiceExecutionDetails = (projectId: string, id: string) =>
  getDb().transaction((tx) => new ServiceEndpointReader(tx).findExecutionDetails(projectId, id));
