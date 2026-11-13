import { asc, and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { changedRows } from "../../db/changes";
import { mockApiListResponseSchema } from "#shared/api/mock-apis";
import {
  authorizationTemplates,
  environmentVariables,
  graphNodePositions,
  headerTemplates,
  mockApis,
  serviceEndpoints,
  services,
} from "../../db/schema";
import {
  evaluateMockApiReadiness,
  type MockApiReadinessInput,
} from "#shared/utils/mock-api-readiness";
import { deactivateInvalidMockApis } from "./reconcile-readiness";

type Database = ReturnType<typeof getDb>;

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
    if (changedRows(result)) await deactivateInvalidMockApis(tx, projectId);
    return changedRows(result) > 0;
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
    if (changedRows(result)) await deactivateInvalidMockApis(tx, projectId);
    return changedRows(result) > 0;
  });
}

export async function listMockApis(projectId: string, db: Database = getDb()) {
  return db.transaction(async (tx) => {
    const [rows, variableRows] = await Promise.all([
      tx
        .select({
          api: mockApis,
          endpointUrl: serviceEndpoints.url,
          endpointApiType: services.apiType,
          templateId: headerTemplates.id,
          templateHeaders: headerTemplates.headers,
          authorizationTemplateType: authorizationTemplates.type,
          authorizationTemplateConfig: authorizationTemplates.config,
          authorizationTemplateExists: authorizationTemplates.id,
        })
        .from(mockApis)
        .leftJoin(
          serviceEndpoints,
          and(
            eq(mockApis.targetEndpointId, serviceEndpoints.id),
            eq(serviceEndpoints.projectId, projectId),
          ),
        )
        .leftJoin(services, eq(serviceEndpoints.serviceId, services.id))
        .leftJoin(
          headerTemplates,
          and(
            eq(mockApis.headerTemplateId, headerTemplates.id),
            eq(headerTemplates.projectId, projectId),
          ),
        )
        .leftJoin(
          authorizationTemplates,
          and(
            eq(mockApis.authorizationTemplateId, authorizationTemplates.id),
            eq(authorizationTemplates.projectId, projectId),
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
    return mockApiListResponseSchema.parse(
      await Promise.all(
        rows.map(
          async ({
            api,
            endpointUrl,
            endpointApiType,
            templateId,
            templateHeaders,
            authorizationTemplateType,
            authorizationTemplateConfig,
            authorizationTemplateExists,
          }) => {
            const authorizationTemplate =
              authorizationTemplateType && authorizationTemplateConfig
                ? { type: authorizationTemplateType, config: authorizationTemplateConfig }
                : null;
            const readinessInput: MockApiReadinessInput = {
              targetEndpointId: api.targetEndpointId,
              apiType: api.apiType as MockApiReadinessInput["apiType"],
              endpointApiType: endpointApiType as MockApiReadinessInput["endpointApiType"],
              headerTemplateId: api.headerTemplateId,
              headerTemplateExists: !api.headerTemplateId || Boolean(templateId),
              authorizationTemplateId: api.authorizationTemplateId,
              authorizationTemplateExists:
                !api.authorizationTemplateId || Boolean(authorizationTemplateExists),
              authorizationTemplate,
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
          },
        ),
      ),
    );
  });
}

export async function findMockApiEndpoint(projectId: string, endpointId: string) {
  const [endpoint] = await getDb()
    .select({
      id: serviceEndpoints.id,
      url: serviceEndpoints.url,
      serviceApiType: services.apiType,
    })
    .from(serviceEndpoints)
    .innerJoin(services, eq(serviceEndpoints.serviceId, services.id))
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
  return getDb().transaction(async (tx) => {
    await tx
      .delete(graphNodePositions)
      .where(
        and(
          eq(graphNodePositions.projectId, projectId),
          eq(graphNodePositions.nodeType, "mock_api"),
          eq(graphNodePositions.entityId, id),
        ),
      );
    const result = await tx
      .delete(mockApis)
      .where(and(eq(mockApis.id, id), eq(mockApis.projectId, projectId)));
    return changedRows(result) > 0;
  });
}
