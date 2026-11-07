import type WebSocket from "ws";
import { evaluateMockApiReadiness } from "#shared/utils/mock-api-readiness";
import { getOutboundUrl } from "../../utils/outbound-url";
import { resolveMockApiHandshakeHeaders } from "../../utils/mock-api-handshake-headers";
import { openWebSocketConnection } from "../../utils/websocket-client";
import { WebSocketSessionRegistry, webSocketSessionRegistry } from "../../utils/websocket-sessions";

type ConnectionTarget = {
  mockApiId: string;
  apiType?: string;
  active: boolean;
  targetEndpointId: string | null;
  serviceApiType: string | null;
  endpointUrl: string | null;
  baseUrl: string | null;
  serviceName: string | null;
  mockApiName: string;
  requestJson: unknown;
  pathParameters: Record<string, string> | null;
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
};

export class WebSocketMockApiNotFoundError extends Error {}
export class WebSocketMockApiNotReadyError extends Error {}
export class WebSocketConnectionFailedError extends Error {}

type ConnectDependencies = {
  ensureProject: () => Promise<string>;
  getTarget: (projectId: string, id: string) => Promise<ConnectionTarget | undefined>;
  getVariables: (projectId: string) => Promise<Array<{ name: string; value: string }>>;
  registry?: WebSocketSessionRegistry;
  connect?: (url: string, headers: Record<string, string>, timeoutMs: number) => Promise<WebSocket>;
  wait?: (delayMs: number) => Promise<void>;
  fetch?: typeof globalThis.fetch;
  timeoutMs: () => number;
  retryCount?: number;
  retryDelayMs?: () => number;
};

function safeFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "connection failed";
  const status = /Unexpected server response: (\d{3})/.exec(message)?.[1];
  return status
    ? `WebSocket handshake failed with HTTP ${status}`
    : `WebSocket connection failed: ${message}`;
}

function sessionResponse(mockApiId: string, endpointId: string) {
  return { mockApiId, endpointId, state: "connected" as const };
}

export function createConnectWebSocketMockApiUseCase(dependencies: ConnectDependencies) {
  const registry = dependencies.registry ?? webSocketSessionRegistry;
  const connect = dependencies.connect ?? openWebSocketConnection;
  const wait =
    dependencies.wait ?? ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
  const retryCount = dependencies.retryCount ?? 3;

  return async (mockApiId: string) => {
    const projectId = await dependencies.ensureProject();
    const target = await dependencies.getTarget(projectId, mockApiId);
    if (!target) throw new WebSocketMockApiNotFoundError("Mock API not found");
    if (target.apiType !== "WEBSOCKET")
      throw new WebSocketMockApiNotReadyError("This mock API is not a WebSocket API");
    if (!target.active) throw new WebSocketMockApiNotReadyError("Mock API is inactive");

    const existing = registry.getForMockApi(projectId, mockApiId);
    if (existing?.state === "connected" && target.targetEndpointId === existing.endpointId)
      return sessionResponse(mockApiId, existing.endpointId);
    if (!target.targetEndpointId || !target.endpointUrl || !target.baseUrl || !target.serviceName)
      throw new WebSocketMockApiNotReadyError("Selected WebSocket endpoint is unavailable");

    const variables = new Map(
      (await dependencies.getVariables(projectId)).map(({ name, value }) => [name, value]),
    );
    const readiness = evaluateMockApiReadiness(
      {
        targetEndpointId: target.targetEndpointId,
        endpointApiType: target.serviceApiType as "REST" | "GRPC" | "WEBSOCKET" | null,
        apiType: "WEBSOCKET",
        headerTemplateId: target.headerTemplateId,
        headerTemplateExists: target.headerTemplateExists,
        authorizationTemplateId: target.authorizationTemplateId,
        authorizationTemplateExists: target.authorizationTemplateExists,
        authorizationTemplate: target.authorizationTemplate,
        pathParameters: target.pathParameters ?? {},
        requestJson: target.requestJson,
        customHeaders: target.customHeaders,
        active: target.active,
      },
      target.endpointUrl,
      target.headerTemplateHeaders ?? [],
      variables,
    );
    if (readiness.status !== "ready")
      throw new WebSocketMockApiNotReadyError(
        readiness.reasons.map(({ message }) => message).join("; "),
      );

    const timeoutMs = dependencies.timeoutMs();
    let headers: Record<string, string>;
    try {
      headers = await resolveMockApiHandshakeHeaders({
        projectId,
        authorizationTemplateId: target.authorizationTemplateId,
        authorizationTemplate: target.authorizationTemplate,
        headerTemplateHeaders: target.headerTemplateHeaders ?? [],
        customHeaders: target.customHeaders,
        variables,
        fetch: dependencies.fetch ?? globalThis.fetch,
        timeoutMs,
      });
    } catch (error) {
      throw new WebSocketConnectionFailedError(safeFailureMessage(error));
    }
    const url = getOutboundUrl(target.endpointUrl, target.baseUrl).toString();
    const session = registry.reserve(projectId, target.targetEndpointId, mockApiId);

    let lastError: unknown;
    for (let attempt = 0; attempt < retryCount; attempt++) {
      try {
        const socket = await connect(url, headers, timeoutMs);
        registry.setSocket(session, socket);
        registry.setState(session, "connected");
        return sessionResponse(mockApiId, target.targetEndpointId);
      } catch (error) {
        lastError = error;
        if (attempt + 1 < retryCount) await wait(dependencies.retryDelayMs?.() ?? 250);
      }
    }
    registry.release(projectId, target.targetEndpointId, mockApiId);
    throw new WebSocketConnectionFailedError(safeFailureMessage(lastError));
  };
}
