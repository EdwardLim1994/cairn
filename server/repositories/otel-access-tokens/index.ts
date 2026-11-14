import { getDb } from "../../db";
import { AccessTokenRepository } from "./AccessTokenRepository";
import { ProjectRepository } from "./ProjectRepository";

export { AccessTokenRepository } from "./AccessTokenRepository";
export { ProjectRepository } from "./ProjectRepository";

export const listOtelAccessTokens = (projectId: string) =>
  new AccessTokenRepository(getDb()).list(projectId);
export const createOtelAccessToken = (input: {
  id: string;
  projectId: string;
  name: string;
  digest: string;
  expiresAt: Date | null;
}) => new AccessTokenRepository(getDb()).create(input);
export const deleteOtelAccessToken = (projectId: string, id: string) =>
  new AccessTokenRepository(getDb()).delete(projectId, id);
export const hasValidOtelAccessToken = (projectId: string, digest: string, now = new Date()) =>
  new AccessTokenRepository(getDb()).isValid(projectId, digest, now);
export const ensureProjectRow = (projectId: string) =>
  new ProjectRepository(getDb()).ensure(projectId);
