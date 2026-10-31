import { randomBytes, randomUUID } from "node:crypto";
import type { MockApiRunResponse } from "#shared/api/mock-apis";
import { MockApiNotFoundError } from "../../repositories/mock-apis/errors";
import { resolveJsonVariables } from "../../utils/environment-variables";
import { resolveEndpointPath } from "../../utils/mock-api-paths";
import { getOutboundUrl } from "../../utils/outbound-url";

type ExecutionTarget = {
  mockApiId: string;
  endpointId: string;
  method: string;
  url: string;
  requestJson: unknown;
  pathParameters: Record<string, string> | null;
  mockApiName: string;
  baseUrl: string;
  serviceName: string;
};

export function createRunMockApiUseCase(dependencies: {
  ensureProject: () => Promise<string>;
  getTarget: (projectId: string, id: string) => Promise<ExecutionTarget | undefined>;
  getVariables: (projectId: string) => Promise<Array<{ name: string; value: string }>>;
  createRun: (projectId: string, mockApiId: string, id: string, traceId: string) => Promise<void>;
  finishRun: (
    id: string,
    result: {
      status: "completed" | "failed";
      responseStatus?: number | null;
      responseHeaders?: Record<string, string> | null;
      responseBody?: string | null;
      error: string | null;
    },
  ) => Promise<void>;
  addFailureLog: (input: {
    projectId: string;
    traceId: string;
    serviceName: string;
    mockApiName: string;
    mockApiId: string;
    runId: string;
    method: string;
    url: string;
    responseStatus: number | null;
    message: string;
  }) => Promise<void>;
  fetch: typeof globalThis.fetch;
  timeoutMs: () => number;
  newRunId?: () => string;
  newTraceIds?: () => { traceId: string; spanId: string };
}) {
  return async (id: string): Promise<MockApiRunResponse> => {
    const projectId = await dependencies.ensureProject();
    const target = await dependencies.getTarget(projectId, id);
    if (!target) throw new MockApiNotFoundError("Mock API or selected endpoint not found");

    const runId = (dependencies.newRunId ?? randomUUID)();
    const { traceId, spanId } = dependencies.newTraceIds?.() ?? {
      traceId: randomBytes(16).toString("hex"),
      spanId: randomBytes(8).toString("hex"),
    };
    await dependencies.createRun(projectId, id, runId, traceId);

    const timeoutMs = dependencies.timeoutMs();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let targetUrl = getOutboundUrl(target.url, target.baseUrl).toString();
    const logFailure = async (message: string, responseStatus: number | null) => {
      try {
        await dependencies.addFailureLog({
          projectId,
          traceId,
          serviceName: target.serviceName,
          mockApiName: target.mockApiName,
          mockApiId: id,
          runId,
          method: target.method,
          url: targetUrl,
          responseStatus,
          message,
        });
      } catch (cause) {
        console.error("Could not save mock API failure log", cause);
      }
    };

    try {
      const variables = new Map(
        (await dependencies.getVariables(projectId)).map(({ name, value }) => [name, value]),
      );
      const resolvedPath = resolveEndpointPath(target.url, target.pathParameters ?? {}, variables);
      targetUrl = getOutboundUrl(resolvedPath, target.baseUrl).toString();
      const isGet = target.method === "GET";
      const requestJson = isGet
        ? target.requestJson
        : resolveJsonVariables(target.requestJson, variables);
      const response = await dependencies.fetch(targetUrl, {
        method: target.method,
        headers: {
          traceparent: `00-${traceId}-${spanId}-01`,
          ...(isGet ? {} : { "content-type": "application/json" }),
        },
        ...(isGet ? {} : { body: JSON.stringify(requestJson) }),
        signal: controller.signal,
      });
      const responseBody = await response.text();
      const responseHeaders = Object.fromEntries(response.headers.entries());
      const status = response.ok ? "completed" : "failed";
      const bodyError = responseBody.trim();
      const errorPrefix = `Target returned HTTP ${response.status}`;
      let error: string | null = null;
      if (!response.ok) {
        error = errorPrefix;
        if (bodyError) error = `${errorPrefix}: ${bodyError}`;
      }
      await dependencies.finishRun(runId, {
        status,
        responseStatus: response.status,
        responseHeaders,
        responseBody,
        error,
      });
      if (error) await logFailure(error, response.status);
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
      let message = "Target connection failed";
      if (controller.signal.aborted) message = `Target request timed out after ${timeoutMs} ms`;
      else if (cause instanceof Error) message = cause.message;
      await dependencies.finishRun(runId, { status: "failed", error: message });
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
  };
}
