import { randomBytes, randomUUID } from "node:crypto";
import type { MockApiRunResponse } from "#shared/api/mock-apis";
import { MockApiNotFoundError, MockApiNotReadyError } from "../../repositories/mock-apis/errors";
import { resolveJsonVariables } from "#shared/utils/environment-variables";
import { resolveEndpointPath } from "../../utils/mock-api-paths";
import { getOutboundUrl } from "../../utils/outbound-url";
import { evaluateMockApiReadiness } from "#shared/utils/mock-api-readiness";
import { resolveHeaderRows } from "../../utils/headers";
import { resolveStaticAuthorizationHeaders } from "../../utils/authorization";
import { getOAuthAccessToken } from "../../utils/oauth-client";
import { invokeUnaryGrpc } from "../../utils/grpc-client";
import { getProtoFile } from "../../utils/proto-storage";
import { status as grpcStatusCodes } from "@grpc/grpc-js";

type ExecutionTarget = {
  apiType?: "HTTP" | "GRPC";
  mockApiId: string;
  endpointId: string | null;
  targetEndpointId: string | null;
  endpointUrl: string | null;
  method: string | null;
  rpcMethod: string | null;
  url: string | null;
  requestJson: unknown;
  pathParameters: Record<string, string> | null;
  active: boolean;
  headerTemplateId: string | null;
  headerTemplateExists: boolean;
  headerTemplateHeaders: Array<{ name: string; value: string }> | null;
  authorizationTemplateId: string | null;
  authorizationTemplateExists: boolean;
  authorizationTemplate: {
    type: "bearer" | "basic" | "api-key" | "oauth-client-credentials";
    config: Record<string, string>;
  } | null;
  customHeaders: Array<{ name: string; value: string }>;
  mockApiName: string;
  baseUrl: string | null;
  serviceName: string | null;
  grpcTls: boolean;
  protoStorageKey: string | null;
};

async function authorizationHeader(
  target: ExecutionTarget,
  projectId: string,
  variables: Map<string, string>,
  fetch: typeof globalThis.fetch,
  timeoutMs: number,
) {
  if (target.authorizationTemplate?.type === "oauth-client-credentials") {
    const token = await getOAuthAccessToken({
      projectId,
      templateId: target.authorizationTemplateId!,
      config: {
        tokenUrl: target.authorizationTemplate.config.tokenUrl!,
        clientId: target.authorizationTemplate.config.clientId!,
        clientSecret: target.authorizationTemplate.config.clientSecret!,
        scope: target.authorizationTemplate.config.scope,
      },
      variables,
      fetch,
      timeoutMs,
    });
    return `Bearer ${token}`;
  }
  return resolveStaticAuthorizationHeaders(target.authorizationTemplate, variables).map(
    ({ name, value }) => [name, value] as const,
  );
}

function failureMessage(cause: unknown, aborted: boolean, timeoutMs: number) {
  if (aborted) return `Target request timed out after ${timeoutMs} ms`;
  return cause instanceof Error ? cause.message : "Target connection failed";
}

function responseError(status: number, body: string) {
  if (!body.trim()) return `Target returned HTTP ${status}`;
  return `Target returned HTTP ${status}: ${body.trim()}`;
}

function createFetchOptions(
  method: string,
  requestBody: unknown,
  headers: Headers,
  signal: AbortSignal,
): RequestInit {
  if (method === "GET") return { method, headers, signal };
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  return {
    method,
    headers,
    body: JSON.stringify(requestBody),
    signal,
  };
}

export function createRunMockApiUseCase(dependencies: {
  ensureProject: () => Promise<string>;
  getTarget: (projectId: string, id: string) => Promise<ExecutionTarget | undefined>;
  getVariables: (projectId: string) => Promise<Array<{ name: string; value: string }>>;
  createRun: (
    projectId: string,
    mockApiId: string,
    id: string,
    traceId: string,
    mockApiName: string,
    method: string,
    url: string,
    requestBody: unknown,
  ) => Promise<void>;
  finishRun: (
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
    if (!target) throw new MockApiNotFoundError("Mock API not found");
    if (!target.active) throw new MockApiNotReadyError("Mock API is inactive");
    const apiType = target.apiType ?? "HTTP";

    const variables = new Map(
      (await dependencies.getVariables(projectId)).map(({ name, value }) => [name, value]),
    );
    const readiness = evaluateMockApiReadiness(
      {
        targetEndpointId: target.targetEndpointId,
        headerTemplateId: target.headerTemplateId,
        headerTemplateExists: target.headerTemplateExists,
        authorizationTemplateId: target.authorizationTemplateId,
        authorizationTemplateExists: target.authorizationTemplateExists,
        authorizationTemplate: target.authorizationTemplate,
        pathParameters: target.pathParameters ?? {},
        requestJson: target.requestJson,
        customHeaders: target.customHeaders,
        active: target.active,
        apiType,
      },
      target.endpointUrl,
      target.headerTemplateHeaders ?? [],
      variables,
    );
    if (readiness.status !== "ready")
      throw new MockApiNotReadyError(readiness.reasons.map(({ message }) => message).join("; "));
    if (
      !target.baseUrl ||
      !target.serviceName ||
      (apiType === "HTTP" && (!target.method || !target.url)) ||
      (apiType === "GRPC" && !target.rpcMethod)
    )
      throw new MockApiNotReadyError("Selected service endpoint is unavailable");

    const runId = (dependencies.newRunId ?? randomUUID)();
    const { traceId, spanId } = dependencies.newTraceIds?.() ?? {
      traceId: randomBytes(16).toString("hex"),
      spanId: randomBytes(8).toString("hex"),
    };
    const timeoutMs = dependencies.timeoutMs();
    const grpcTarget = getOutboundUrl(`http://${target.baseUrl}`, `http://${target.baseUrl}`).host;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let targetUrl =
      apiType === "GRPC" ? grpcTarget : getOutboundUrl(target.url!, target.baseUrl).toString();
    const methodName = apiType === "GRPC" ? "GRPC" : target.method!;
    const logFailure = async (message: string, responseStatus: number | null) => {
      try {
        await dependencies.addFailureLog({
          projectId,
          traceId,
          serviceName: target.serviceName!,
          mockApiName: target.mockApiName,
          mockApiId: id,
          runId,
          method: methodName,
          url: targetUrl,
          responseStatus,
          message,
        });
      } catch (cause) {
        console.error("Could not save mock API failure log", cause);
      }
    };

    try {
      const resolvedPath =
        apiType === "HTTP"
          ? resolveEndpointPath(target.url!, target.pathParameters ?? {}, variables)
          : target.rpcMethod!;
      targetUrl =
        apiType === "HTTP" ? getOutboundUrl(resolvedPath, target.baseUrl).toString() : grpcTarget;
      const requestBody =
        apiType === "HTTP" && target.method === "GET"
          ? null
          : resolveJsonVariables(target.requestJson, variables);
      const headers = new Headers(
        resolveHeaderRows(target.headerTemplateHeaders ?? [], target.customHeaders, variables),
      );
      await dependencies.createRun(
        projectId,
        id,
        runId,
        traceId,
        target.mockApiName,
        methodName,
        targetUrl,
        requestBody,
      );
      const authorization =
        apiType === "HTTP"
          ? await authorizationHeader(target, projectId, variables, dependencies.fetch, timeoutMs)
          : [];
      if (typeof authorization === "string") headers.set("Authorization", authorization);
      else for (const [name, value] of authorization) headers.set(name, value);
      if (
        apiType === "HTTP" &&
        requestBody !== null &&
        typeof requestBody === "object" &&
        "query" in requestBody &&
        typeof requestBody.query === "string"
      )
        headers.set("content-type", "application/json");
      headers.set("traceparent", `00-${traceId}-${spanId}-01`);
      timeout = setTimeout(() => controller.abort(), timeoutMs);
      if (apiType === "GRPC") {
        if (!target.protoStorageKey)
          throw new Error("Selected gRPC service has no stored proto file");
        const proto = await getProtoFile(target.protoStorageKey);
        if (!proto) throw new Error("Stored gRPC proto file is unavailable");
        const response = await invokeUnaryGrpc({
          proto,
          rpcMethod: target.rpcMethod!,
          target: grpcTarget,
          tls: target.grpcTls,
          request: requestBody,
          traceparent: `00-${traceId}-${spanId}-01`,
          timeoutMs,
        });
        const responseBody = JSON.stringify(response);
        await dependencies.finishRun(runId, {
          status: "completed",
          responseBody,
          grpcStatus: 0,
          grpcStatusName: "OK",
          error: null,
        });
        return {
          id: runId,
          traceId,
          status: "completed",
          responseStatus: null,
          responseHeaders: null,
          responseBody,
          grpcStatus: 0,
          grpcStatusName: "OK",
          error: null,
        };
      }
      const response = await dependencies.fetch(
        targetUrl,
        createFetchOptions(target.method!, requestBody, headers, controller.signal),
      );
      const responseBody = await response.text();
      const responseHeaders = Object.fromEntries(response.headers.entries());
      const status = response.ok ? "completed" : "failed";
      const error = response.ok ? null : responseError(response.status, responseBody);
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
      const message = failureMessage(cause, controller.signal.aborted, timeoutMs);
      const grpcStatusCode =
        typeof cause === "object" &&
        cause !== null &&
        "code" in cause &&
        typeof cause.code === "number"
          ? cause.code
          : null;
      const grpcStatusName =
        grpcStatusCode === null
          ? null
          : (grpcStatusCodes[grpcStatusCode] ?? String(grpcStatusCode));
      await dependencies.finishRun(runId, {
        status: "failed",
        error: message,
        ...(apiType === "GRPC" ? { grpcStatus: grpcStatusCode, grpcStatusName } : {}),
      });
      await logFailure(message, grpcStatusCode);
      return {
        id: runId,
        traceId,
        status: "failed",
        responseStatus: null,
        responseHeaders: null,
        responseBody: null,
        error: message,
        ...(apiType === "GRPC" ? { grpcStatus: grpcStatusCode, grpcStatusName } : {}),
      };
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  };
}
