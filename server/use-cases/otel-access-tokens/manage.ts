import type { OtelAccessTokenCreateInput } from "#shared/api/otel-access-tokens";
import { generateAccessToken, isAccessTokenValid } from "./token";

export function createListOtelAccessTokensUseCase(deps: {
  ensureProject: () => Promise<string>;
  list: (
    projectId: string,
  ) => Promise<Array<{ id: string; name: string; expiresAt: Date; createdAt: Date }>>;
}) {
  return async () => {
    const projectId = await deps.ensureProject();
    return (await deps.list(projectId)).map(({ id, name, expiresAt, createdAt }) => ({
      id,
      name,
      expiresAt: expiresAt.toISOString(),
      createdAt: createdAt.toISOString(),
      expired: !isAccessTokenValid(expiresAt),
    }));
  };
}

export function createOtelAccessTokenUseCase(deps: {
  ensureProject: () => Promise<string>;
  create: (input: {
    id: string;
    projectId: string;
    name: string;
    digest: string;
    expiresAt: Date;
  }) => Promise<void>;
}) {
  return async (input: OtelAccessTokenCreateInput) => {
    const projectId = await deps.ensureProject();
    const generated = generateAccessToken();
    const expiresAt = new Date(input.expiresAt);
    await deps.create({ ...generated, projectId, name: input.name, expiresAt });
    return {
      id: generated.id,
      name: input.name,
      token: generated.token,
      expiresAt: expiresAt.toISOString(),
    };
  };
}

export function createDeleteOtelAccessTokenUseCase(deps: {
  ensureProject: () => Promise<string>;
  remove: (projectId: string, id: string) => Promise<boolean>;
}) {
  return async (id: string) => deps.remove(await deps.ensureProject(), id);
}
