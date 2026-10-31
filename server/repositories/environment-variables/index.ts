import { and, asc, eq, ne } from "drizzle-orm";
import type { EnvironmentVariableInput } from "#shared/api/environment-variables";
import { getDb } from "../../db";
import { environmentVariables } from "../../db/schema";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "../../db/schema";
import { deactivateInvalidMockApis } from "../mock-apis/reconcile-readiness";

type Database = MySql2Database<typeof schema>;

export async function listEnvironmentVariables(projectId: string) {
  const rows = await getDb()
    .select()
    .from(environmentVariables)
    .where(eq(environmentVariables.projectId, projectId))
    .orderBy(asc(environmentVariables.name));
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

export function getEnvironmentVariableValues(projectId: string) {
  return getDb()
    .select({ name: environmentVariables.name, value: environmentVariables.value })
    .from(environmentVariables)
    .where(eq(environmentVariables.projectId, projectId));
}

export async function findEnvironmentVariableByName(
  projectId: string,
  name: string,
  exceptId?: string,
) {
  const [row] = await getDb()
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

export async function findEnvironmentVariable(projectId: string, id: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: environmentVariables.id })
    .from(environmentVariables)
    .where(and(eq(environmentVariables.id, id), eq(environmentVariables.projectId, projectId)));
  return Boolean(row);
}

export async function createEnvironmentVariable(
  id: string,
  projectId: string,
  input: EnvironmentVariableInput,
): Promise<void> {
  await getDb()
    .insert(environmentVariables)
    .values({ id, projectId, ...input });
}

export async function updateEnvironmentVariable(
  id: string,
  projectId: string,
  input: EnvironmentVariableInput,
  db: Database = getDb(),
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(environmentVariables)
      .set(input)
      .where(and(eq(environmentVariables.id, id), eq(environmentVariables.projectId, projectId)));
    await deactivateInvalidMockApis(tx, projectId);
  });
}

export async function deleteEnvironmentVariable(
  projectId: string,
  id: string,
  db: Database = getDb(),
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(environmentVariables)
      .where(and(eq(environmentVariables.id, id), eq(environmentVariables.projectId, projectId)));
    await deactivateInvalidMockApis(tx, projectId);
  });
}
