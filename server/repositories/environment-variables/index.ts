import type { EnvironmentVariableInput } from "#shared/api/environment-variables";
import { getDb } from "../../db";
import { EnvironmentVariableRepository } from "./EnvironmentVariableRepository";

export { EnvironmentVariableRepository } from "./EnvironmentVariableRepository";

export const listEnvironmentVariables = (projectId: string) =>
  new EnvironmentVariableRepository(getDb()).list(projectId);
export const getEnvironmentVariableValues = (projectId: string) =>
  new EnvironmentVariableRepository(getDb()).values(projectId);
export const findEnvironmentVariableByName = (projectId: string, name: string, exceptId?: string) =>
  new EnvironmentVariableRepository(getDb()).findByName(projectId, name, exceptId);
export const findEnvironmentVariable = (projectId: string, id: string) =>
  new EnvironmentVariableRepository(getDb()).find(projectId, id);
export const createEnvironmentVariable = (
  id: string,
  projectId: string,
  input: EnvironmentVariableInput,
) => new EnvironmentVariableRepository(getDb()).create(id, projectId, input);
export const updateEnvironmentVariable = (
  id: string,
  projectId: string,
  input: EnvironmentVariableInput,
  db = getDb(),
) => new EnvironmentVariableRepository(db).update(id, projectId, input);
export const deleteEnvironmentVariable = (projectId: string, id: string, db = getDb()) =>
  new EnvironmentVariableRepository(db).delete(projectId, id);
