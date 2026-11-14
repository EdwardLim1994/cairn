import { asc, and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { changedRows } from "../../db/changes";
import { mockApiListResponseSchema } from "#shared/api/mock-apis";
import {
  authorizationTemplates,
  environmentVariables,
  headerTemplates,
  mockApis,
} from "../../db/schema";
import {
  evaluateMockApiReadiness,
  type MockApiReadinessInput,
} from "#shared/utils/mock-api-readiness";
import { GraphPositionRepository } from "../../modules/graph-canvas";
import {
  findEndpointDetail,
  findServiceExecutionDetails,
  listEndpointDetails,
} from "../../modules/service-registry";
import { deactivateInvalidMockApis } from "./reconcile-readiness";

type Database = ReturnType<typeof getDb>;
export class MockApiRepository {
  constructor(private readonly db: Database) {}

  async list(projectId: string) {
    return this.db.transaction(async (tx) => {
      const [rows, variableRows] = await Promise.all([
        tx
          .select({
            api: mockApis,
            templateId: headerTemplates.id,
            templateHeaders: headerTemplates.headers,
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
          .where(eq(mockApis.projectId, projectId))
          .orderBy(asc(mockApis.createdAt)),
        tx
          .select({ name: environmentVariables.name, value: environmentVariables.value })
          .from(environmentVariables)
          .where(eq(environmentVariables.projectId, projectId)),
      ]);
      const variables = new Map(variableRows.map(({ name, value }) => [name, value]));
      const endpointDetails = await listEndpointDetails(
        tx,
        projectId,
        rows.flatMap(({ api }) => (api.targetEndpointId ? [api.targetEndpointId] : [])),
      );
      const endpointById = new Map(endpointDetails.map((endpoint) => [endpoint.id, endpoint]));
      return mockApiListResponseSchema.parse(
        await Promise.all(
          rows.map(
            async ({
              api,
              templateId,
              templateHeaders,
              authorizationTemplateType,
              authorizationTemplateConfig,
              authorizationTemplateExists,
            }) => {
              const endpoint = api.targetEndpointId
                ? endpointById.get(api.targetEndpointId)
                : undefined;
              const endpointUrl = endpoint?.url ?? null;
              const endpointApiType = endpoint?.serviceApiType ?? null;
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

  async findEndpoint(projectId: string, endpointId: string) {
    return findEndpointDetail(projectId, endpointId);
  }

  async getExecutionTarget(projectId: string, id: string) {
    await this.list(projectId);
    const [target] = await this.db
      .select({
        mockApiId: mockApis.id,
        apiType: mockApis.apiType,
        active: mockApis.active,
        targetEndpointId: mockApis.targetEndpointId,
        headerTemplateId: mockApis.headerTemplateId,
        authorizationTemplateId: mockApis.authorizationTemplateId,
        authorizationTemplateType: authorizationTemplates.type,
        authorizationTemplateConfig: authorizationTemplates.config,
        authorizationTemplateExists: authorizationTemplates.id,
        headerTemplateHeaders: headerTemplates.headers,
        headerTemplateExists: headerTemplates.id,
        customHeaders: mockApis.customHeaders,
        requestJson: mockApis.requestJson,
        pathParameters: mockApis.pathParameters,
        mockApiName: mockApis.name,
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
      .where(and(eq(mockApis.id, id), eq(mockApis.projectId, projectId)));
    if (!target) return undefined;
    const service = target.targetEndpointId
      ? await findServiceExecutionDetails(projectId, target.targetEndpointId)
      : undefined;
    return {
      ...target,
      serviceApiType: service?.serviceApiType ?? null,
      endpointId: service?.endpointId ?? null,
      method: service?.method ?? null,
      endpointUrl: service?.endpointUrl ?? null,
      rpcMethod: service?.rpcMethod ?? null,
      url: service?.endpointUrl ?? null,
      baseUrl: service?.baseUrl ?? null,
      grpcTls: service?.grpcTls ?? null,
      protoStorageKey: service?.protoStorageKey ?? null,
      serviceName: service?.serviceName ?? null,
      headerTemplateExists: target.headerTemplateExists !== null,
      authorizationTemplateExists: target.authorizationTemplateExists !== null,
      authorizationTemplate:
        target.authorizationTemplateType && target.authorizationTemplateConfig
          ? { type: target.authorizationTemplateType, config: target.authorizationTemplateConfig }
          : null,
    };
  }

  async find(projectId: string, id: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: mockApis.id })
      .from(mockApis)
      .where(and(eq(mockApis.id, id), eq(mockApis.projectId, projectId)));
    return Boolean(row);
  }

  async findTargetEndpointId(projectId: string, id: string) {
    const [row] = await this.db
      .select({ targetEndpointId: mockApis.targetEndpointId })
      .from(mockApis)
      .where(and(eq(mockApis.id, id), eq(mockApis.projectId, projectId)));
    return row?.targetEndpointId ?? null;
  }

  async create(id: string, projectId: string, input: import("#shared/api/mock-apis").MockApiInput) {
    await this.db.transaction(async (tx) => {
      await tx.insert(mockApis).values({ id, projectId, ...input });
      await deactivateInvalidMockApis(tx, projectId);
    });
  }

  async update(
    id: string,
    projectId: string,
    input: import("#shared/api/mock-apis").MockApiInput,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(mockApis)
        .set(input)
        .where(and(eq(mockApis.id, id), eq(mockApis.projectId, projectId)));
      await deactivateInvalidMockApis(tx, projectId);
    });
  }

  async delete(projectId: string, id: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      await new GraphPositionRepository(tx).deleteMockApiPosition(projectId, id);
      const result = await tx
        .delete(mockApis)
        .where(and(eq(mockApis.id, id), eq(mockApis.projectId, projectId)));
      return changedRows(result) > 0;
    });
  }
}
