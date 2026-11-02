import { and, eq, inArray } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "../../db/schema";
import {
  authorizationTemplates,
  environmentVariables,
  headerTemplates,
  mockApis,
  serviceEndpoints,
} from "../../db/schema";
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
      .where(and(eq(mockApis.projectId, projectId), eq(mockApis.active, true))),
    tx
      .select({ name: environmentVariables.name, value: environmentVariables.value })
      .from(environmentVariables)
      .where(eq(environmentVariables.projectId, projectId)),
  ]);
  const values = new Map(variables.map(({ name, value }) => [name, value]));
  const invalidIds = apis.flatMap(
    ({
      api,
      endpointUrl,
      templateHeaders,
      templateId,
      authorizationTemplateType,
      authorizationTemplateConfig,
      authorizationTemplateExists,
    }) => {
      const authorizationTemplate =
        authorizationTemplateType && authorizationTemplateConfig
          ? { type: authorizationTemplateType, config: authorizationTemplateConfig }
          : null;
      const readiness = evaluateMockApiReadiness(
        {
          ...api,
          headerTemplateExists: !api.headerTemplateId || Boolean(templateId),
          authorizationTemplateExists:
            !api.authorizationTemplateId || Boolean(authorizationTemplateExists),
          authorizationTemplate,
        },
        endpointUrl ?? null,
        templateHeaders ?? [],
        values,
      );
      return readiness.status === "draft" ? [api.id] : [];
    },
  );
  if (invalidIds.length)
    await tx.update(mockApis).set({ active: false }).where(inArray(mockApis.id, invalidIds));
}
