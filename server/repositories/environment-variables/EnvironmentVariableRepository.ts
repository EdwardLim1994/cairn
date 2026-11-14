import { and, asc, eq, ne } from "drizzle-orm";
import type { EnvironmentVariableInput } from "#shared/api/environment-variables";
import { getDb } from "../../db";
import { environmentVariables } from "../../db/schema";
import { deactivateInvalidMockApis } from "../../modules/mock-apis";

/** Owns project-scoped shared variables and their readiness effect. */
export class EnvironmentVariableRepository {
  constructor(private readonly db: ReturnType<typeof getDb>) {}

  async list(projectId: string) {
    const rows = await this.db
      .select()
      .from(environmentVariables)
      .where(eq(environmentVariables.projectId, projectId))
      .orderBy(asc(environmentVariables.name));
    return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
  }

  values(projectId: string) {
    return this.db
      .select({ name: environmentVariables.name, value: environmentVariables.value })
      .from(environmentVariables)
      .where(eq(environmentVariables.projectId, projectId));
  }

  async findByName(projectId: string, name: string, exceptId?: string) {
    const [row] = await this.db
      .select({ id: environmentVariables.id })
      .from(environmentVariables)
      .where(
        exceptId
          ? and(
              eq(environmentVariables.projectId, projectId),
              eq(environmentVariables.name, name),
              ne(environmentVariables.id, exceptId),
            )
          : and(eq(environmentVariables.projectId, projectId), eq(environmentVariables.name, name)),
      );
    return Boolean(row);
  }

  async find(projectId: string, id: string) {
    const [row] = await this.db
      .select({ id: environmentVariables.id })
      .from(environmentVariables)
      .where(and(eq(environmentVariables.id, id), eq(environmentVariables.projectId, projectId)));
    return Boolean(row);
  }

  async create(id: string, projectId: string, input: EnvironmentVariableInput) {
    await this.db.insert(environmentVariables).values({ id, projectId, ...input });
  }

  async update(id: string, projectId: string, input: EnvironmentVariableInput) {
    await this.db.transaction(async (tx) => {
      await tx
        .update(environmentVariables)
        .set(input)
        .where(and(eq(environmentVariables.id, id), eq(environmentVariables.projectId, projectId)));
      await deactivateInvalidMockApis(tx, projectId);
    });
  }

  async delete(projectId: string, id: string) {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(environmentVariables)
        .where(and(eq(environmentVariables.id, id), eq(environmentVariables.projectId, projectId)));
      await deactivateInvalidMockApis(tx, projectId);
    });
  }
}
