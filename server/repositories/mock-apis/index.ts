import { asc, and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "../../db/schema";
import {
  environmentVariables,
  headerTemplates,
  mockApis,
  serviceEndpoints,
  services,
} from "../../db/schema";
import { evaluateMockApiReadiness } from "#shared/utils/mock-api-readiness";
import { deactivateInvalidMockApis } from "./reconcile-readiness";

type Database = MySql2Database<typeof schema>;

export async function listHeaderTemplates(projectId: string, db: Database = getDb()) {
  const rows = await db
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

export async function findHeaderTemplate(projectId: string, id: string, db: Database = getDb()) {
  const [row] = await db
    .select({ id: headerTemplates.id })
    .from(headerTemplates)
    .where(and(eq(headerTemplates.projectId, projectId), eq(headerTemplates.id, id)));
  return Boolean(row);
}

export async function createHeaderTemplate(
  id: string,
  projectId: string,
  input: { name: string; headers: Array<{ name: string; value: string }> },
  db: Database = getDb(),
) {
  await db.insert(headerTemplates).values({ id, projectId, ...input });
}

export async function updateHeaderTemplate(
  projectId: string,
  id: string,
  input: { name: string; headers: Array<{ name: string; value: string }> },
  db: Database = getDb(),
) {
  return db.transaction(async (tx) => {
    const result = await tx
      .update(headerTemplates)
      .set(input)
      .where(and(eq(headerTemplates.projectId, projectId), eq(headerTemplates.id, id)));
    if (result[0]?.affectedRows) await deactivateInvalidMockApis(tx, projectId);
    return Boolean(result[0]?.affectedRows);
  });
}

export async function deleteHeaderTemplate(projectId: string, id: string, db: Database = getDb()) {
  return db.transaction(async (tx) => {
    await tx
      .update(mockApis)
      .set({ headerTemplateId: null })
      .where(and(eq(mockApis.projectId, projectId), eq(mockApis.headerTemplateId, id)));
    await tx
      .update(services)
      .set({ healthCheckHeaderTemplateId: null })
      .where(and(eq(services.projectId, projectId), eq(services.healthCheckHeaderTemplateId, id)));
    const result = await tx
      .delete(headerTemplates)
      .where(and(eq(headerTemplates.projectId, projectId), eq(headerTemplates.id, id)));
    if (result[0]?.affectedRows) await deactivateInvalidMockApis(tx, projectId);
    return Boolean(result[0]?.affectedRows);
  });
}

export async function listMockApis(projectId: string, db: Database = getDb()) {
  return db.transaction(async (tx) => {
    const [rows, variableRows] = await Promise.all([
      tx
        .select({
          api: mockApis,
          endpointUrl: serviceEndpoints.url,
          templateId: headerTemplates.id,
          templateHeaders: headerTemplates.headers,
        })
        .from(mockApis)
        .leftJoin(
          serviceEndpoints,
          and(
            eq(mockApis.targetEndpointId, serviceEndpoints.id),
            eq(serviceEndpoints.projectId, projectId),
          ),
        )
        .leftJoin(
          headerTemplates,
          and(
            eq(mockApis.headerTemplateId, headerTemplates.id),
            eq(headerTemplates.projectId, projectId),
          ),
        )
        .where(eq(mockApis.projectId, projectId))
        .orderBy(asc(mockApis.createdAt)),
      tx
        .select({ name: environmentVariables.name, value: environmentVariables.value })
        .from(environmentVariables)
        .where(eq(environmentVariables.projectId, projectId)),
    ]);
    const variables = new Map(variableRows.map(({ name, value }) => [name, value]));
    return Promise.all(
      rows.map(async ({ api, endpointUrl, templateId, templateHeaders }) => {
        const readinessInput = {
          targetEndpointId: api.targetEndpointId,
          headerTemplateId: api.headerTemplateId,
          headerTemplateExists: !api.headerTemplateId || Boolean(templateId),
          pathParameters: api.pathParameters,
          requestJson: api.requestJson,
          customHeaders: api.customHeaders,
          active: api.active,
        };
        let readiness = evaluateMockApiReadiness(
          readinessInput,
          endpointUrl,
          templateHeaders ?? [],
          variables,
        );
        if (api.active && readiness.status === "draft") {
          await tx.update(mockApis).set({ active: false }).where(eq(mockApis.id, api.id));
          readiness = evaluateMockApiReadiness(
            { ...readinessInput, active: false },
            endpointUrl,
            templateHeaders ?? [],
            variables,
          );
        }
        return {
          ...api,
          active: api.active && readiness.status !== "draft",
          status: readiness.status,
          readinessReasons: readiness.reasons,
          createdAt: api.createdAt.toISOString(),
        };
      }),
    );
  });
}

export async function findMockApiEndpoint(projectId: string, endpointId: string) {
  const [endpoint] = await getDb()
    .select({ id: serviceEndpoints.id, url: serviceEndpoints.url })
    .from(serviceEndpoints)
    .where(and(eq(serviceEndpoints.id, endpointId), eq(serviceEndpoints.projectId, projectId)));
  return endpoint;
}

export async function findMockApi(projectId: string, id: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: mockApis.id })
    .from(mockApis)
    .where(and(eq(mockApis.id, id), eq(mockApis.projectId, projectId)));
  return Boolean(row);
}

export async function createMockApi(
  id: string,
  projectId: string,
  input: import("#shared/api/mock-apis").MockApiInput,
) {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.insert(mockApis).values({ id, projectId, ...input });
    await deactivateInvalidMockApis(tx, projectId);
  });
}

export async function updateMockApi(
  id: string,
  projectId: string,
  input: import("#shared/api/mock-apis").MockApiInput,
): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .update(mockApis)
      .set(input)
      .where(and(eq(mockApis.id, id), eq(mockApis.projectId, projectId)));
    await deactivateInvalidMockApis(tx, projectId);
  });
}

export async function deleteMockApi(projectId: string, id: string): Promise<boolean> {
  const result = await getDb()
    .delete(mockApis)
    .where(and(eq(mockApis.id, id), eq(mockApis.projectId, projectId)));
  return Boolean(result[0]?.affectedRows);
}
