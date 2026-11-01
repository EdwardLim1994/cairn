import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { MockApiSettingsSaveRequest } from "#shared/api/mock-apis";
import { getDb } from "../db";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "../db/schema";
import {
  environmentVariables,
  headerTemplates,
  mockApis,
  serviceEndpoints,
  services,
} from "../db/schema";
import { evaluateMockApiReadiness } from "#shared/utils/mock-api-readiness";
import { validateHeaderRows } from "#shared/utils/headers";

type Database = MySql2Database<typeof schema>;
const draftId = (id: string | undefined) => Boolean(id?.startsWith("draft-"));

export async function saveMockApiSettings(
  projectId: string,
  input: MockApiSettingsSaveRequest,
  db: Database = getDb(),
) {
  return db.transaction(async (tx) => {
    const idMap = {
      environmentVariables: {} as Record<string, string>,
      headerTemplates: {} as Record<string, string>,
      mockApis: {} as Record<string, string>,
    };
    const [oldVariables, oldTemplates, oldApis] = await Promise.all([
      tx.select().from(environmentVariables).where(eq(environmentVariables.projectId, projectId)),
      tx.select().from(headerTemplates).where(eq(headerTemplates.projectId, projectId)),
      tx.select().from(mockApis).where(eq(mockApis.projectId, projectId)),
    ]);
    const oldVariableIds = new Set(oldVariables.map(({ id }) => id));
    const oldTemplateIds = new Set(oldTemplates.map(({ id }) => id));
    const oldApiIds = new Set(oldApis.map(({ id }) => id));
    const seenNames = new Set<string>();
    for (const variable of input.environmentVariables) {
      if (seenNames.has(variable.name))
        throw new Error(`Duplicate environment variable: ${variable.name}`);
      seenNames.add(variable.name);
      if (variable.id && !oldVariableIds.has(variable.id) && !draftId(variable.id))
        throw new Error("Environment variable changed in another session; reload and retry");
    }

    const templateNames = new Set<string>();
    const templateIds = new Map<string, string>();
    for (const template of input.headerTemplates) {
      const key = template.name.toLowerCase();
      if (templateNames.has(key)) throw new Error(`Duplicate header template: ${template.name}`);
      templateNames.add(key);
      validateHeaderRows(template.headers, "Template header");
      if (template.id && !oldTemplateIds.has(template.id) && !draftId(template.id))
        throw new Error("Header template changed in another session; reload and retry");
      templateIds.set(
        template.id ?? `new:${template.name}`,
        template.id && oldTemplateIds.has(template.id) ? template.id : randomUUID(),
      );
    }

    const endpoints = input.mockApis.flatMap(({ targetEndpointId }) =>
      targetEndpointId ? [targetEndpointId] : [],
    );
    const ownedEndpoints = endpoints.length
      ? await tx
          .select({ id: serviceEndpoints.id })
          .from(serviceEndpoints)
          .where(
            and(eq(serviceEndpoints.projectId, projectId), inArray(serviceEndpoints.id, endpoints)),
          )
      : [];
    if (ownedEndpoints.length !== new Set(endpoints).size)
      throw new Error("One or more selected endpoints are not in this project");
    const apiIds = new Set<string>();
    const apiEntries = input.mockApis.map((api) => {
      if (api.id && !oldApiIds.has(api.id) && !draftId(api.id))
        throw new Error("Mock API changed in another session; reload and retry");
      const id = api.id && oldApiIds.has(api.id) ? api.id : randomUUID();
      if (apiIds.has(id)) throw new Error("Duplicate mock API ID");
      apiIds.add(id);
      if (api.headerTemplateId && !templateIds.has(api.headerTemplateId))
        throw new Error(`Selected header template is unavailable for ${api.name}`);
      validateHeaderRows(api.customHeaders, "Custom header");
      return { api, id };
    });

    const newVariableIds = new Set<string>();
    for (const variable of input.environmentVariables) {
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
    }
    const variables = new Map(input.environmentVariables.map(({ name, value }) => [name, value]));

    const newTemplateIds = new Set<string>();
    for (const template of input.headerTemplates) {
      const id = templateIds.get(template.id ?? `new:${template.name}`)!;
      if (template.id) idMap.headerTemplates[template.id] = id;
      newTemplateIds.add(id);
      const { name, headers } = template;
      if (oldTemplateIds.has(id))
        await tx.update(headerTemplates).set({ name, headers }).where(eq(headerTemplates.id, id));
      else await tx.insert(headerTemplates).values({ id, projectId, name, headers });
    }

    for (const { api, id } of apiEntries) {
      if (api.id) idMap.mockApis[api.id] = id;
      const headerTemplateId = api.headerTemplateId ? templateIds.get(api.headerTemplateId)! : null;
      const row = {
        name: api.name,
        targetEndpointId: api.targetEndpointId,
        headerTemplateId,
        customHeaders: api.customHeaders,
        active: api.active,
        pathParameters: api.pathParameters,
        requestJson: api.requestJson,
        description: api.description,
        importMethod: api.importMethod,
        importUrl: api.importUrl,
        matchUrl: api.matchUrl,
      };
      if (oldApiIds.has(id)) await tx.update(mockApis).set(row).where(eq(mockApis.id, id));
      else await tx.insert(mockApis).values({ id, projectId, ...row });
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
    if (removedApiIds.length)
      await tx
        .delete(mockApis)
        .where(and(eq(mockApis.projectId, projectId), inArray(mockApis.id, removedApiIds)));
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
    for (const api of savedApis) {
      const template = api.headerTemplateId
        ? await tx
            .select()
            .from(headerTemplates)
            .where(
              and(
                eq(headerTemplates.id, api.headerTemplateId),
                eq(headerTemplates.projectId, projectId),
              ),
            )
        : [];
      const readiness = evaluateMockApiReadiness(
        { ...api, headerTemplateExists: !api.headerTemplateId || template.length > 0 },
        api.targetEndpointId ? (endpointUrls.get(api.targetEndpointId) ?? null) : null,
        template[0]?.headers ?? [],
        variables,
      );
      if (api.active && readiness.status === "draft")
        await tx.update(mockApis).set({ active: false }).where(eq(mockApis.id, api.id));
    }
    return { saved: true as const, idMap };
  });
}
