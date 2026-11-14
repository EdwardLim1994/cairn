import { and, asc, eq } from "drizzle-orm";
import { getDb, type SqliteTransaction } from "../../db";
import { changedRows } from "../../db/changes";
import { headerTemplates, mockApis } from "../../db/schema";
import { detachHealthHeaderTemplate } from "../../modules/service-registry";
import { deactivateInvalidMockApis } from "./reconcile-readiness";

type HeaderInput = { name: string; headers: Array<{ name: string; value: string }> };

export async function isHeaderTemplateOwned(tx: SqliteTransaction, projectId: string, id: string) {
  const [row] = await tx
    .select({ id: headerTemplates.id })
    .from(headerTemplates)
    .where(and(eq(headerTemplates.projectId, projectId), eq(headerTemplates.id, id)));
  return Boolean(row);
}

/** Owns shared header template rows and their dependent references. */
export class HeaderTemplateRepository {
  constructor(private readonly db: ReturnType<typeof getDb>) {}

  async list(projectId: string) {
    const rows = await this.db
      .select()
      .from(headerTemplates)
      .where(eq(headerTemplates.projectId, projectId))
      .orderBy(asc(headerTemplates.createdAt));
    return rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async find(projectId: string, id: string) {
    const [row] = await this.db
      .select({ id: headerTemplates.id })
      .from(headerTemplates)
      .where(and(eq(headerTemplates.projectId, projectId), eq(headerTemplates.id, id)));
    return Boolean(row);
  }

  async create(id: string, projectId: string, input: HeaderInput) {
    await this.db.insert(headerTemplates).values({ id, projectId, ...input });
  }

  update(projectId: string, id: string, input: HeaderInput) {
    return this.db.transaction(async (tx) => {
      const result = await tx
        .update(headerTemplates)
        .set(input)
        .where(and(eq(headerTemplates.projectId, projectId), eq(headerTemplates.id, id)));
      if (changedRows(result)) await deactivateInvalidMockApis(tx, projectId);
      return changedRows(result) > 0;
    });
  }

  delete(projectId: string, id: string) {
    return this.db.transaction(async (tx) => {
      await tx
        .update(mockApis)
        .set({ headerTemplateId: null })
        .where(and(eq(mockApis.projectId, projectId), eq(mockApis.headerTemplateId, id)));
      await detachHealthHeaderTemplate(tx, projectId, id);
      const result = await tx
        .delete(headerTemplates)
        .where(and(eq(headerTemplates.projectId, projectId), eq(headerTemplates.id, id)));
      if (changedRows(result)) await deactivateInvalidMockApis(tx, projectId);
      return changedRows(result) > 0;
    });
  }
}
