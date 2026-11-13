import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { MockApiSettingsSaveRequest } from "#shared/api/mock-apis";
import { getDb } from "../db";
import {
  authorizationTemplates,
  environmentVariables,
  graphNodePositions,
  headerTemplates,
  mockApis,
  serviceEndpoints,
  services,
} from "../db/schema";
import { evaluateMockApiReadiness } from "#shared/utils/mock-api-readiness";
import { validateHeaderRows } from "#shared/utils/headers";

type Database = ReturnType<typeof getDb>;
const draftId = (id: string | undefined) => Boolean(id?.startsWith("draft-"));

function validateVariables(
  variables: MockApiSettingsSaveRequest["environmentVariables"],
  oldIds: Set<string>,
) {
  const names = new Set<string>();
  for (const variable of variables) {
    if (names.has(variable.name))
      throw new Error(`Duplicate environment variable: ${variable.name}`);
    names.add(variable.name);
    if (variable.id && !oldIds.has(variable.id) && !draftId(variable.id))
      throw new Error("Environment variable changed in another session; reload and retry");
  }
}

function createTemplateIds(
  templates: { id?: string; name: string }[],
  oldIds: Set<string>,
  category: "Header" | "Authorization",
) {
  const names = new Set<string>();
  const ids = new Map<string, string>();
  for (const template of templates) {
    const key = template.name.toLowerCase();
    if (names.has(key))
      throw new Error(`Duplicate ${category.toLowerCase()} template: ${template.name}`);
    names.add(key);
    if (category === "Header")
      validateHeaderRows(
        (template as MockApiSettingsSaveRequest["headerTemplates"][number]).headers,
        "Template header",
      );
    if (template.id && !oldIds.has(template.id) && !draftId(template.id))
      throw new Error(`${category} template changed in another session; reload and retry`);
    ids.set(
      template.id ?? `new:${template.name}`,
      template.id && oldIds.has(template.id) ? template.id : randomUUID(),
    );
  }
  return ids;
}

function validateApiEntries(
  apis: MockApiSettingsSaveRequest["mockApis"],
  oldIds: Set<string>,
  templateIds: Map<string, string>,
  authorizationIds: Map<string, string>,
) {
  const ids = new Set<string>();
  return apis.map((api) => {
    if (api.id && !oldIds.has(api.id) && !draftId(api.id))
      throw new Error("Mock API changed in another session; reload and retry");
    const id = api.id && oldIds.has(api.id) ? api.id : randomUUID();
    if (ids.has(id)) throw new Error("Duplicate mock API ID");
    ids.add(id);
    if (api.headerTemplateId && !templateIds.has(api.headerTemplateId))
      throw new Error(`Selected header template is unavailable for ${api.name}`);
    if (api.authorizationTemplateId && !authorizationIds.has(api.authorizationTemplateId))
      throw new Error(`Selected authorization template is unavailable for ${api.name}`);
    validateHeaderRows(api.customHeaders, "Custom header");
    return { api, id };
  });
}

export async function saveMockApiSettings(
  projectId: string,
  input: MockApiSettingsSaveRequest,
  db: Database = getDb(),
) {
  return db.transaction(async (tx) => {
    const idMap = {
      environmentVariables: {} as Record<string, string>,
      headerTemplates: {} as Record<string, string>,
      authorizationTemplates: {} as Record<string, string>,
      mockApis: {} as Record<string, string>,
    };
    const [oldVariables, oldTemplates, oldAuthTemplates, oldApis] = await Promise.all([
      tx.select().from(environmentVariables).where(eq(environmentVariables.projectId, projectId)),
      tx.select().from(headerTemplates).where(eq(headerTemplates.projectId, projectId)),
      tx
        .select()
        .from(authorizationTemplates)
        .where(eq(authorizationTemplates.projectId, projectId)),
      tx.select().from(mockApis).where(eq(mockApis.projectId, projectId)),
    ]);
    const oldVariableIds = new Set(oldVariables.map(({ id }) => id));
    const oldTemplateIds = new Set(oldTemplates.map(({ id }) => id));
    const oldAuthTemplateIds = new Set(oldAuthTemplates.map(({ id }) => id));
    const oldApiIds = new Set(oldApis.map(({ id }) => id));
    validateVariables(input.environmentVariables, oldVariableIds);
    const templateIds = createTemplateIds(input.headerTemplates, oldTemplateIds, "Header");
    const authTemplateIds = createTemplateIds(
      input.authorizationTemplates,
      oldAuthTemplateIds,
      "Authorization",
    );

    const endpoints = input.mockApis.flatMap(({ targetEndpointId }) =>
      targetEndpointId ? [targetEndpointId] : [],
    );
    const ownedEndpoints = endpoints.length
      ? await tx
          .select({ id: serviceEndpoints.id, apiType: services.apiType })
          .from(serviceEndpoints)
          .innerJoin(services, eq(serviceEndpoints.serviceId, services.id))
          .where(
            and(eq(serviceEndpoints.projectId, projectId), inArray(serviceEndpoints.id, endpoints)),
          )
      : [];
    if (ownedEndpoints.length !== new Set(endpoints).size)
      throw new Error("One or more selected endpoints are not in this project");
    const endpointTypes = new Map(ownedEndpoints.map(({ id, apiType }) => [id, apiType]));
    if (
      input.mockApis.some(
        (api) =>
          api.targetEndpointId &&
          endpointTypes.get(api.targetEndpointId) !==
            { GRPC: "GRPC", WEBSOCKET: "WEBSOCKET", HTTP: "REST" }[api.apiType],
      )
    )
      throw new Error("Mock API type must match service API type");
    const apiEntries = validateApiEntries(input.mockApis, oldApiIds, templateIds, authTemplateIds);
    const apiIds = new Set(apiEntries.map(({ id }) => id));

    const newVariableIds = new Set<string>();
    await Promise.all(
      input.environmentVariables.map(async (variable) => {
        const id = variable.id && oldVariableIds.has(variable.id) ? variable.id : randomUUID();
        if (variable.id) idMap.environmentVariables[variable.id] = id;
        newVariableIds.add(id);
        const { name, value } = variable;
        if (variable.id && oldVariableIds.has(variable.id))
          await tx
            .update(environmentVariables)
            .set({ name, value })
            .where(eq(environmentVariables.id, id));
        else await tx.insert(environmentVariables).values({ id, projectId, name, value });
      }),
    );
    const variables = new Map(input.environmentVariables.map(({ name, value }) => [name, value]));

    const newTemplateIds = new Set<string>();
    await Promise.all(
      input.headerTemplates.map(async (template) => {
        const id = templateIds.get(template.id ?? `new:${template.name}`)!;
        if (template.id) idMap.headerTemplates[template.id] = id;
        newTemplateIds.add(id);
        const { name, headers } = template;
        if (oldTemplateIds.has(id))
          await tx.update(headerTemplates).set({ name, headers }).where(eq(headerTemplates.id, id));
        else await tx.insert(headerTemplates).values({ id, projectId, name, headers });
      }),
    );

    const newAuthTemplateIds = new Set<string>();
    await Promise.all(
      input.authorizationTemplates.map(async (template) => {
        const id = authTemplateIds.get(template.id ?? `new:${template.name}`)!;
        if (template.id) idMap.authorizationTemplates[template.id] = id;
        newAuthTemplateIds.add(id);
        const { id: _draftId, name, type, ...fields } = template;
        const config = Object.fromEntries(Object.entries(fields)) as Record<string, string>;
        if (oldAuthTemplateIds.has(id))
          await tx
            .update(authorizationTemplates)
            .set({ name, type, config })
            .where(eq(authorizationTemplates.id, id));
        else await tx.insert(authorizationTemplates).values({ id, projectId, name, type, config });
      }),
    );

    await Promise.all(
      apiEntries.map(async ({ api, id }) => {
        if (api.id) idMap.mockApis[api.id] = id;
        const headerTemplateId = api.headerTemplateId
          ? templateIds.get(api.headerTemplateId)!
          : null;
        const row = {
          name: api.name,
          apiType: api.apiType,
          targetEndpointId: api.targetEndpointId,
          headerTemplateId,
          authorizationTemplateId: api.authorizationTemplateId
            ? authTemplateIds.get(api.authorizationTemplateId)!
            : null,
          customHeaders: api.customHeaders,
          active: api.active,
          pathParameters: api.pathParameters,
          requestJson: api.requestJson,
          description: api.description,
        };
        if (oldApiIds.has(id)) await tx.update(mockApis).set(row).where(eq(mockApis.id, id));
        else await tx.insert(mockApis).values({ id, projectId, ...row });
      }),
    );
    const removedAuthTemplateIds = [...oldAuthTemplateIds].filter(
      (id) => !newAuthTemplateIds.has(id),
    );
    if (removedAuthTemplateIds.length) {
      await tx
        .update(mockApis)
        .set({ authorizationTemplateId: null })
        .where(
          and(
            eq(mockApis.projectId, projectId),
            inArray(mockApis.authorizationTemplateId, removedAuthTemplateIds),
          ),
        );
      await tx
        .delete(authorizationTemplates)
        .where(
          and(
            eq(authorizationTemplates.projectId, projectId),
            inArray(authorizationTemplates.id, removedAuthTemplateIds),
          ),
        );
    }

    const removedTemplateIds = [...oldTemplateIds].filter((id) => !newTemplateIds.has(id));
    if (removedTemplateIds.length) {
      await tx
        .update(mockApis)
        .set({ headerTemplateId: null })
        .where(
          and(
            eq(mockApis.projectId, projectId),
            inArray(mockApis.headerTemplateId, removedTemplateIds),
          ),
        );
      await tx
        .update(services)
        .set({ healthCheckHeaderTemplateId: null })
        .where(
          and(
            eq(services.projectId, projectId),
            inArray(services.healthCheckHeaderTemplateId, removedTemplateIds),
          ),
        );
      await tx
        .delete(headerTemplates)
        .where(
          and(
            eq(headerTemplates.projectId, projectId),
            inArray(headerTemplates.id, removedTemplateIds),
          ),
        );
    }
    const removedApiIds = [...oldApiIds].filter((id) => !apiIds.has(id));
    if (removedApiIds.length) {
      await tx
        .delete(graphNodePositions)
        .where(
          and(
            eq(graphNodePositions.projectId, projectId),
            eq(graphNodePositions.nodeType, "mock_api"),
            inArray(graphNodePositions.entityId, removedApiIds),
          ),
        );
      await tx
        .delete(mockApis)
        .where(and(eq(mockApis.projectId, projectId), inArray(mockApis.id, removedApiIds)));
    }
    const removedVariableIds = [...oldVariableIds].filter((id) => !newVariableIds.has(id));
    if (removedVariableIds.length)
      await tx
        .delete(environmentVariables)
        .where(
          and(
            eq(environmentVariables.projectId, projectId),
            inArray(environmentVariables.id, removedVariableIds),
          ),
        );

    const savedApis = await tx.select().from(mockApis).where(eq(mockApis.projectId, projectId));
    const savedEndpoints = savedApis.flatMap(({ targetEndpointId }) =>
      targetEndpointId ? [targetEndpointId] : [],
    );
    const endpointRows = savedEndpoints.length
      ? await tx
          .select()
          .from(serviceEndpoints)
          .where(
            and(
              eq(serviceEndpoints.projectId, projectId),
              inArray(serviceEndpoints.id, savedEndpoints),
            ),
          )
      : [];
    const endpointUrls = new Map(endpointRows.map(({ id, url }) => [id, url]));
    const deactivatedIds = (
      await Promise.all(
        savedApis.map(async (api) => {
          const [template, authTemplate] = await Promise.all([
            api.headerTemplateId
              ? tx
                  .select()
                  .from(headerTemplates)
                  .where(
                    and(
                      eq(headerTemplates.id, api.headerTemplateId),
                      eq(headerTemplates.projectId, projectId),
                    ),
                  )
              : Promise.resolve([]),
            api.authorizationTemplateId
              ? tx
                  .select()
                  .from(authorizationTemplates)
                  .where(
                    and(
                      eq(authorizationTemplates.id, api.authorizationTemplateId),
                      eq(authorizationTemplates.projectId, projectId),
                    ),
                  )
              : Promise.resolve([]),
          ]);
          const readiness = evaluateMockApiReadiness(
            {
              ...api,
              apiType: api.apiType as "REST" | "GRAPHQL" | "WEBSOCKET",
              targetApiType: api.targetEndpointId
                ? (endpointTypes.get(api.targetEndpointId) as
                    | "REST"
                    | "GRAPHQL"
                    | "WEBSOCKET"
                    | undefined)
                : null,
              headerTemplateExists: !api.headerTemplateId || template.length > 0,
              authorizationTemplateExists: !api.authorizationTemplateId || authTemplate.length > 0,
              authorizationTemplate: authTemplate[0]
                ? { type: authTemplate[0].type, config: authTemplate[0].config }
                : null,
            },
            api.targetEndpointId ? (endpointUrls.get(api.targetEndpointId) ?? null) : null,
            template[0]?.headers ?? [],
            variables,
          );
          return api.active && readiness.status === "draft" ? api.id : null;
        }),
      )
    ).filter((id): id is string => id !== null);
    if (deactivatedIds.length)
      await tx.update(mockApis).set({ active: false }).where(inArray(mockApis.id, deactivatedIds));
    return { saved: true as const, idMap };
  });
}
