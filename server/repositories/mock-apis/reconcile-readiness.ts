import { and, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "../../db/schema";
import { environmentVariables, headerTemplates, mockApis, serviceEndpoints } from "../../db/schema";
import { evaluateMockApiReadiness } from "#shared/utils/mock-api-readiness";

type Database = MySql2Database<typeof schema>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Persist deactivation when a saved dependency change makes an active API invalid. */
export async function deactivateInvalidMockApis(tx: Transaction, projectId: string) {
  const [apis, variables] = await Promise.all([
    tx
      .select({
        api: mockApis,
        endpointUrl: serviceEndpoints.url,
        templateHeaders: headerTemplates.headers,
        templateId: headerTemplates.id,
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
      .where(and(eq(mockApis.projectId, projectId), eq(mockApis.active, true))),
    tx
      .select({ name: environmentVariables.name, value: environmentVariables.value })
      .from(environmentVariables)
      .where(eq(environmentVariables.projectId, projectId)),
  ]);
  const values = new Map(variables.map(({ name, value }) => [name, value]));
  for (const { api, endpointUrl, templateHeaders, templateId } of apis) {
    const readiness = evaluateMockApiReadiness(
      { ...api, headerTemplateExists: !api.headerTemplateId || Boolean(templateId) },
      endpointUrl ?? null,
      templateHeaders ?? [],
      values,
    );
    if (readiness.status === "draft")
      await tx.update(mockApis).set({ active: false }).where(eq(mockApis.id, api.id));
  }
}
