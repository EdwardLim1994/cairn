import { getDb } from "../../db";
import { HeaderTemplateRepository } from "./HeaderTemplateRepository";
import { MockApiRepository } from "./MockApiRepository";

export { MockApiRepository } from "./MockApiRepository";

type Database = ReturnType<typeof getDb>;

export const listHeaderTemplates = (projectId: string, db: Database = getDb()) =>
  new HeaderTemplateRepository(db).list(projectId);
export const findHeaderTemplate = (projectId: string, id: string, db: Database = getDb()) =>
  new HeaderTemplateRepository(db).find(projectId, id);
export const createHeaderTemplate = (
  id: string,
  projectId: string,
  input: { name: string; headers: Array<{ name: string; value: string }> },
  db: Database = getDb(),
) => new HeaderTemplateRepository(db).create(id, projectId, input);
export const updateHeaderTemplate = (
  projectId: string,
  id: string,
  input: { name: string; headers: Array<{ name: string; value: string }> },
  db: Database = getDb(),
) => new HeaderTemplateRepository(db).update(projectId, id, input);
export const deleteHeaderTemplate = (projectId: string, id: string, db: Database = getDb()) =>
  new HeaderTemplateRepository(db).delete(projectId, id);

export const listMockApis = (projectId: string, db: Database = getDb()) =>
  new MockApiRepository(db).list(projectId);
export const findMockApiEndpoint = (projectId: string, endpointId: string) =>
  new MockApiRepository(getDb()).findEndpoint(projectId, endpointId);
export const findMockApi = (projectId: string, id: string) =>
  new MockApiRepository(getDb()).find(projectId, id);
export const createMockApi = (
  id: string,
  projectId: string,
  input: import("#shared/api/mock-apis").MockApiInput,
) => new MockApiRepository(getDb()).create(id, projectId, input);
export const updateMockApi = (
  id: string,
  projectId: string,
  input: import("#shared/api/mock-apis").MockApiInput,
) => new MockApiRepository(getDb()).update(id, projectId, input);
export const deleteMockApi = (projectId: string, id: string) =>
  new MockApiRepository(getDb()).delete(projectId, id);
export const getMockApiExecutionTarget = (projectId: string, id: string) =>
  new MockApiRepository(getDb()).getExecutionTarget(projectId, id);
export const findMockApiTargetEndpointId = (projectId: string, id: string) =>
  new MockApiRepository(getDb()).findTargetEndpointId(projectId, id);
