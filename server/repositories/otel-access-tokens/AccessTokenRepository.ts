import { and, asc, eq, gt, isNull, or } from "drizzle-orm";
import { getDb } from "../../db";
import { changedRows } from "../../db/changes";
import { otelAccessTokens } from "../../db/schema";

/** Owns project-scoped OTLP access tokens. */
export class AccessTokenRepository {
  constructor(private readonly db: ReturnType<typeof getDb>) {}

  list(projectId: string) {
    return this.db
      .select()
      .from(otelAccessTokens)
      .where(eq(otelAccessTokens.projectId, projectId))
      .orderBy(asc(otelAccessTokens.createdAt));
  }

  async create(input: {
    id: string;
    projectId: string;
    name: string;
    digest: string;
    expiresAt: Date | null;
  }) {
    await this.db.insert(otelAccessTokens).values(input);
  }

  async delete(projectId: string, id: string) {
    const result = await this.db
      .delete(otelAccessTokens)
      .where(and(eq(otelAccessTokens.projectId, projectId), eq(otelAccessTokens.id, id)));
    return changedRows(result) > 0;
  }

  async isValid(projectId: string, digest: string, now = new Date()) {
    const [row] = await this.db
      .select({ id: otelAccessTokens.id })
      .from(otelAccessTokens)
      .where(
        and(
          eq(otelAccessTokens.projectId, projectId),
          eq(otelAccessTokens.digest, digest),
          or(isNull(otelAccessTokens.expiresAt), gt(otelAccessTokens.expiresAt, now)),
        ),
      )
      .limit(1);
    return Boolean(row);
  }
}
