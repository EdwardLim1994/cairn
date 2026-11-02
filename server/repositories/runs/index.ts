import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../db";
import {
  headerTemplates,
  authorizationTemplates,
  mockApis,
  runs,
  serviceEndpoints,
  services,
  spans,
} from "../../db/schema";
import { listMockApis } from "../mock-apis";

export async function getMockApiExecutionTarget(projectId: string, id: string) {
  await listMockApis(projectId);
  const [target] = await getDb()
    .select({
      mockApiId: mockApis.id,
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
      endpointId: serviceEndpoints.id,
      method: serviceEndpoints.method,
      endpointUrl: serviceEndpoints.url,
      url: serviceEndpoints.url,
      requestJson: mockApis.requestJson,
      pathParameters: mockApis.pathParameters,
      mockApiName: mockApis.name,
      baseUrl: services.baseUrl,
      serviceName: services.name,
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
      services,
      and(eq(serviceEndpoints.serviceId, services.id), eq(services.projectId, projectId)),
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
    .where(and(eq(mockApis.id, id), eq(mockApis.projectId, projectId)));
  return (
    target && {
      ...target,
      headerTemplateExists: target.headerTemplateExists !== null,
      authorizationTemplateExists: target.authorizationTemplateExists !== null,
      authorizationTemplate:
        target.authorizationTemplateType && target.authorizationTemplateConfig
          ? {
              type: target.authorizationTemplateType,
              config: target.authorizationTemplateConfig,
            }
          : null,
    }
  );
}

export async function createRun(projectId: string, mockApiId: string, id: string, traceId: string) {
  await getDb().insert(runs).values({ id, projectId, mockApiId, traceId, status: "running" });
}

export async function finishRun(
  id: string,
  result: {
    status: "completed" | "failed";
    responseStatus?: number | null;
    responseHeaders?: Record<string, string> | null;
    responseBody?: string | null;
    error: string | null;
  },
) {
  await getDb()
    .update(runs)
    .set({ ...result, finishedAt: new Date() })
    .where(eq(runs.id, id));
}

export async function findRun(projectId: string, id: string) {
  const [run] = await getDb()
    .select()
    .from(runs)
    .where(and(eq(runs.id, id), eq(runs.projectId, projectId)));
  return (
    run && {
      ...run,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      lastTelemetryAt: run.lastTelemetryAt?.toISOString() ?? null,
    }
  );
}

export async function getRunFlowData(projectId: string, id: string) {
  const db = getDb();
  const [run] = await db
    .select()
    .from(runs)
    .where(and(eq(runs.id, id), eq(runs.projectId, projectId)));
  if (!run) return undefined;
  const records = await db
    .select()
    .from(spans)
    .where(and(eq(spans.projectId, projectId), eq(spans.traceId, run.traceId)))
    .orderBy(asc(spans.startTime));
  const registeredServices = await db
    .select({ name: services.name })
    .from(services)
    .where(eq(services.projectId, projectId));
  let failedTargetService: string | undefined;
  if (run.status === "failed" && run.mockApiId) {
    const [target] = await db
      .select({ name: services.name })
      .from(mockApis)
      .innerJoin(serviceEndpoints, eq(mockApis.targetEndpointId, serviceEndpoints.id))
      .innerJoin(services, eq(serviceEndpoints.serviceId, services.id))
      .where(and(eq(mockApis.id, run.mockApiId), eq(mockApis.projectId, projectId)));
    failedTargetService = target?.name;
  }
  return { run, spans: records, registeredServices, failedTargetService };
}
