import { randomBytes, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  environmentVariables,
  logs,
  mockApis,
  runs,
  serviceEndpoints,
  services,
} from "../../../db/schema";
import { getAppConfig } from "../../../utils/config";
import { resolveJsonVariables } from "../../../utils/environment-variables";
import { resolveEndpointPath } from "../../../utils/mock-api-paths";
import { getOutboundUrl } from "../../../utils/outbound-url";
import { ensureProject } from "../../../utils/project";

export default defineEventHandler(async (event) => {
  const projectId = await ensureProject();
  const id = getRouterParam(event, "id")!;
  const db = getDb();
  const [row] = await db
    .select({
      mockApiId: mockApis.id,
      endpointId: serviceEndpoints.id,
      method: serviceEndpoints.method,
      url: serviceEndpoints.url,
      requestJson: mockApis.requestJson,
      pathParameters: mockApis.pathParameters,
      mockApiName: mockApis.name,
      baseUrl: services.baseUrl,
      serviceName: services.name,
    })
    .from(mockApis)
    .innerJoin(serviceEndpoints, eq(mockApis.targetEndpointId, serviceEndpoints.id))
    .innerJoin(services, eq(serviceEndpoints.serviceId, services.id))
    .where(
      and(
        eq(mockApis.id, id),
        eq(mockApis.projectId, projectId),
        eq(serviceEndpoints.projectId, projectId),
        eq(services.projectId, projectId),
      ),
    );
  if (!row)
    throw createError({
      statusCode: 404,
      statusMessage: "Mock API or selected endpoint not found",
    });

  const traceId = randomBytes(16).toString("hex");
  const spanId = randomBytes(8).toString("hex");
  const runId = randomUUID();
  await db.insert(runs).values({ id: runId, projectId, mockApiId: id, traceId, status: "running" });

  const target = getOutboundUrl(row.url, row.baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getAppConfig().outboundRequestTimeoutMs);
  const logFailure = async (message: string, responseStatus: number | null) => {
    try {
      await db.insert(logs).values({
        projectId,
        traceId,
        serviceName: row.serviceName,
        severity: "ERROR",
        timestamp: new Date(),
        message: `Mock API ${row.mockApiName} failed: ${message}`,
        attributes: {
          mockApiId: id,
          runId,
          method: row.method,
          url: target.toString(),
          responseStatus,
        },
      });
    } catch (cause) {
      console.error("Could not save mock API failure log", cause);
    }
  };
  try {
    const variableRows = await db
      .select({ name: environmentVariables.name, value: environmentVariables.value })
      .from(environmentVariables)
      .where(eq(environmentVariables.projectId, projectId));
    const variables = new Map(variableRows.map(({ name, value }) => [name, value]));
    const urlWithPathParameters = resolveEndpointPath(row.url, row.pathParameters ?? {}, variables);
    const target = getOutboundUrl(urlWithPathParameters, row.baseUrl);
    const requestJson =
      row.method === "GET" ? row.requestJson : resolveJsonVariables(row.requestJson, variables);
    const response = await fetch(target, {
      method: row.method,
      headers: {
        traceparent: `00-${traceId}-${spanId}-01`,
        ...(row.method === "GET" ? {} : { "content-type": "application/json" }),
      },
      ...(row.method === "GET" ? {} : { body: JSON.stringify(requestJson) }),
      signal: controller.signal,
    });
    const responseBody = await response.text();
    const responseHeaders = Object.fromEntries(response.headers.entries());
    const status = response.ok ? "completed" : "failed";
    const errorDetails = responseBody.trim();
    const error = response.ok
      ? null
      : `Target returned HTTP ${response.status}${errorDetails ? `: ${errorDetails}` : ""}`;
    await db
      .update(runs)
      .set({
        status,
        responseStatus: response.status,
        responseHeaders,
        responseBody,
        error,
        finishedAt: new Date(),
      })
      .where(eq(runs.id, runId));
    if (!response.ok) await logFailure(error!, response.status);
    return {
      id: runId,
      traceId,
      status,
      responseStatus: response.status,
      responseHeaders,
      responseBody,
      error,
    };
  } catch (cause) {
    const timedOut = controller.signal.aborted;
    const message = timedOut
      ? `Target request timed out after ${getAppConfig().outboundRequestTimeoutMs} ms`
      : cause instanceof Error
        ? cause.message
        : "Target connection failed";
    await db
      .update(runs)
      .set({ status: "failed", error: message, finishedAt: new Date() })
      .where(eq(runs.id, runId));
    await logFailure(message, null);
    return {
      id: runId,
      traceId,
      status: "failed",
      responseStatus: null,
      responseHeaders: null,
      responseBody: null,
      error: message,
    };
  } finally {
    clearTimeout(timeout);
  }
});
