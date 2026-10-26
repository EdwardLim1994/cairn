import { randomBytes, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { mockApis, runs, serviceEndpoints, services } from "../../../db/schema";
import { getAppConfig } from "../../../utils/config";
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
      requestJson: serviceEndpoints.requestJson,
      baseUrl: services.baseUrl,
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

  const target = /^https?:\/\//i.test(row.url)
    ? new URL(row.url)
    : new URL(row.url, `${row.baseUrl.replace(/\/$/, "")}/`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getAppConfig().outboundRequestTimeoutMs);
  try {
    const response = await fetch(target, {
      method: row.method,
      headers: {
        traceparent: `00-${traceId}-${spanId}-01`,
        ...(row.method === "GET" ? {} : { "content-type": "application/json" }),
      },
      ...(row.method === "GET" ? {} : { body: JSON.stringify(row.requestJson) }),
      signal: controller.signal,
    });
    const responseBody = await response.text();
    const responseHeaders = Object.fromEntries(response.headers.entries());
    const status = response.ok ? "completed" : "failed";
    const error = response.ok ? null : `Target returned HTTP ${response.status}`;
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
