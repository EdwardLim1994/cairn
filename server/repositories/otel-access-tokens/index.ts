import { and, asc, eq, gt } from "drizzle-orm";
import { getDb } from "../../db";
import { otelAccessTokens } from "../../db/schema";

export async function listOtelAccessTokens(projectId: string) {
  return getDb()
    .select()
    .from(otelAccessTokens)
    .where(eq(otelAccessTokens.projectId, projectId))
    .orderBy(asc(otelAccessTokens.createdAt));
}

export async function createOtelAccessToken(input: {
  id: string;
  projectId: string;
  name: string;
  digest: string;
  expiresAt: Date;
}) {
  await getDb().insert(otelAccessTokens).values(input);
}

export async function deleteOtelAccessToken(projectId: string, id: string) {
  const result = await getDb()
    .delete(otelAccessTokens)
    .where(and(eq(otelAccessTokens.projectId, projectId), eq(otelAccessTokens.id, id)));
  return result[0].affectedRows > 0;
}

export async function hasValidOtelAccessToken(projectId: string, digest: string, now = new Date()) {
  const [row] = await getDb()
    .select({ id: otelAccessTokens.id })
    .from(otelAccessTokens)
    .where(
      and(
        eq(otelAccessTokens.projectId, projectId),
        eq(otelAccessTokens.digest, digest),
        gt(otelAccessTokens.expiresAt, now),
      ),
    )
    .limit(1);
  return Boolean(row);
}
