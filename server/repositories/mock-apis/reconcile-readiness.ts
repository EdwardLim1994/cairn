import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import {
  authorizationTemplates,
  environmentVariables,
  headerTemplates,
  mockApis,
} from "../../db/schema";
import { listEndpointDetails } from "../../modules/service-registry";
import {
  evaluateMockApiReadiness,
  type MockApiReadinessInput,
} from "#shared/utils/mock-api-readiness";

type Database = ReturnType<typeof getDb>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Persists deactivation when a saved dependency makes an active API invalid. */
export class MockApiReadinessService {
  constructor(private readonly tx: Transaction) {}

  async deactivateInvalid(projectId: string) {
    const tx = this.tx;
    const [apis, variables] = await Promise.all([
      tx
        .select({
          api: mockApis,
          templateHeaders: headerTemplates.headers,
          templateId: headerTemplates.id,
          authorizationTemplateType: authorizationTemplates.type,
          authorizationTemplateConfig: authorizationTemplates.config,
          authorizationTemplateExists: authorizationTemplates.id,
        })
        .from(mockApis)
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
    const endpoints = await listEndpointDetails(
      tx,
      projectId,
      apis.flatMap(({ api }) => (api.targetEndpointId ? [api.targetEndpointId] : [])),
    );
    const endpointById = new Map(endpoints.map((endpoint) => [endpoint.id, endpoint]));
    const invalidIds = apis.flatMap(
      ({
        api,
        templateHeaders,
        templateId,
        authorizationTemplateType,
        authorizationTemplateConfig,
        authorizationTemplateExists,
      }) => {
        const endpoint = api.targetEndpointId ? endpointById.get(api.targetEndpointId) : undefined;
        const endpointUrl = endpoint?.url ?? null;
        const endpointApiType = endpoint?.serviceApiType ?? null;
        const authorizationTemplate =
          authorizationTemplateType && authorizationTemplateConfig
            ? { type: authorizationTemplateType, config: authorizationTemplateConfig }
            : null;
        const readiness = evaluateMockApiReadiness(
          {
            ...api,
            apiType: api.apiType as MockApiReadinessInput["apiType"],
            endpointApiType: endpointApiType as MockApiReadinessInput["endpointApiType"],
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
}

export const deactivateInvalidMockApis = (tx: Transaction, projectId: string) =>
  new MockApiReadinessService(tx).deactivateInvalid(projectId);
