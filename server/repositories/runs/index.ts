import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { changedRows } from "../../db/changes";
import { readSpans } from "../../db/telemetry";
import {
  headerTemplates,
  authorizationTemplates,
  mockApiCallHistory,
  mockApis,
  runs,
  serviceEndpoints,
  services,
  messageConnections,
  messageDestinations,
} from "../../db/schema";
import { listMockApis } from "../mock-apis";

export async function getMockApiExecutionTarget(projectId: string, id: string) {
  await listMockApis(projectId);
  const [target] = await getDb()
    .select({
      mockApiId: mockApis.id,
      apiType: mockApis.apiType,
      serviceApiType: services.apiType,
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
      rpcMethod: serviceEndpoints.rpcMethod,
      url: serviceEndpoints.url,
      requestJson: mockApis.requestJson,
      pathParameters: mockApis.pathParameters,
      mockApiName: mockApis.name,
      baseUrl: services.baseUrl,
      grpcTls: services.grpcTls,
      protoStorageKey: services.protoStorageKey,
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

export async function createRun(input: {
  projectId: string;
  mockApiId: string;
  id: string;
  traceId: string;
  mockApiName: string;
  method: string;
  url: string;
  requestBody: unknown;
}) {
  const { projectId, mockApiId, id, traceId, mockApiName, method, url, requestBody } = input;
  const db = getDb();
  await db.transaction(async (transaction) => {
    await transaction.insert(runs).values({ id, projectId, mockApiId, traceId, status: "running" });
    await transaction.insert(mockApiCallHistory).values({
      id,
      projectId,
      runId: id,
      mockApiId,
      mockApiName,
      method,
      url,
      requestBody,
      traceId,
      status: "running",
    });
  });
}

export async function finishRun(
  id: string,
  result: {
    status: "completed" | "failed";
    responseStatus?: number | null;
    grpcStatus?: number | null;
    grpcStatusName?: string | null;
    responseHeaders?: Record<string, string> | null;
    responseBody?: string | null;
    error: string | null;
  },
) {
  const db = getDb();
  await db.transaction(async (transaction) => {
    await transaction
      .update(runs)
      .set({ ...result, finishedAt: new Date() })
      .where(eq(runs.id, id));
    await transaction
      .update(mockApiCallHistory)
      .set({ status: result.status })
      .where(eq(mockApiCallHistory.runId, id));
  });
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
  const records = await readSpans(projectId, run.traceId);
  const registeredServices = await db
    .select({ id: services.id, name: services.name })
    .from(services)
    .where(eq(services.projectId, projectId));
  const destinations = await db
    .select()
    .from(messageDestinations)
    .where(eq(messageDestinations.projectId, projectId));
  const connections = await db
    .select()
    .from(messageConnections)
    .where(eq(messageConnections.projectId, projectId));
  const endpoints = await db
    .select({ id: serviceEndpoints.id, serviceId: serviceEndpoints.serviceId })
    .from(serviceEndpoints)
    .where(eq(serviceEndpoints.projectId, projectId));
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
  return {
    run,
    spans: records,
    registeredServices,
    destinations,
    messageConnections: connections,
    endpoints,
    failedTargetService,
  };
}

export async function listMockApiCallHistory(projectId: string) {
  const rows = await getDb()
    .select({ history: mockApiCallHistory, run: runs })
    .from(mockApiCallHistory)
    .innerJoin(runs, eq(mockApiCallHistory.runId, runs.id))
    .where(eq(mockApiCallHistory.projectId, projectId))
    .orderBy(desc(mockApiCallHistory.triggeredAt), desc(mockApiCallHistory.id));
  return rows.map(({ history, run }) => ({
    ...history,
    triggeredAt: history.triggeredAt.toISOString(),
    responseStatus: run.responseStatus,
    grpcStatus: run.grpcStatus,
    grpcStatusName: run.grpcStatusName,
    responseHeaders: run.responseHeaders,
    responseBody: run.responseBody,
    error: run.error,
  }));
}

export async function deleteMockApiCallHistory(projectId: string, id: string): Promise<boolean> {
  const result = await getDb()
    .delete(mockApiCallHistory)
    .where(and(eq(mockApiCallHistory.projectId, projectId), eq(mockApiCallHistory.id, id)));
  return changedRows(result) > 0;
}

export async function clearMockApiCallHistory(projectId: string): Promise<number> {
  const result = await getDb()
    .delete(mockApiCallHistory)
    .where(eq(mockApiCallHistory.projectId, projectId));
  return changedRows(result);
}
