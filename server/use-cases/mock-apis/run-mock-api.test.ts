import { describe, expect, it, vi } from "vite-plus/test";
import { MockApiNotFoundError, MockApiNotReadyError } from "../../repositories/mock-apis/errors";
import { createRunMockApiUseCase } from "./run-mock-api";

function requestUrl(input: RequestInfo | URL): string {
  return input instanceof URL ? input.href : typeof input === "string" ? input : input.url;
}

const target = {
  mockApiId: "mock-1",
  apiType: "REST" as const,
  targetApiType: "REST" as const,
  endpointId: "endpoint-1",
  targetEndpointId: "endpoint-1",
  endpointUrl: "/orders/{orderId}",
  method: "POST",
  url: "/orders/{orderId}",
  requestJson: { token: "{{TOKEN}}", enabled: true },
  pathParameters: { orderId: "42" },
  active: true,
  headerTemplateId: null,
  headerTemplateExists: true,
  authorizationTemplateId: null,
  authorizationTemplateExists: true,
  headerTemplateHeaders: [],
  authorizationTemplate: null,
  customHeaders: [],
  mockApiName: "Create order",
  baseUrl: "http://localhost:8081",
  serviceName: "order-service",
};

function setup(overrides: Partial<Parameters<typeof createRunMockApiUseCase>[0]> = {}) {
  const deps = {
    ensureProject: vi.fn().mockResolvedValue("project-1"),
    getTarget: vi.fn().mockResolvedValue(target),
    getVariables: vi.fn().mockResolvedValue([{ name: "TOKEN", value: "abc" }]),
    createRun: vi.fn().mockResolvedValue(undefined),
    finishRun: vi.fn().mockResolvedValue(undefined),
    addFailureLog: vi.fn().mockResolvedValue(undefined),
    fetch: vi
      .fn()
      .mockResolvedValue(
        new Response("ok", { status: 201, headers: { "content-type": "text/plain" } }),
      ),
    timeoutMs: () => 1000,
    newRunId: () => "run-1",
    newTraceIds: () => ({ traceId: "a".repeat(32), spanId: "b".repeat(16) }),
    ...overrides,
  };
  return { deps, run: createRunMockApiUseCase(deps) };
}

describe("mock API run use case", () => {
  it("runs a request with substituted values and persists the response", async () => {
    const { deps, run } = setup();
    const result = await run("mock-1");
    expect(result).toMatchObject({
      id: "run-1",
      traceId: "a".repeat(32),
      status: "completed",
      responseStatus: 201,
      responseBody: "ok",
      error: null,
    });
    expect(deps.createRun).toHaveBeenCalledWith(
      "project-1",
      "mock-1",
      "run-1",
      "a".repeat(32),
      "Create order",
      "POST",
      "http://localhost:8081/orders/42",
      { token: "abc", enabled: true },
    );
    expect(deps.fetch).toHaveBeenCalledWith(
      "http://localhost:8081/orders/42",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "abc", enabled: true }),
      }),
    );
    const request = vi.mocked(deps.fetch).mock.calls[0]![1] as RequestInit;
    expect(new Headers(request.headers).get("traceparent")).toBe(
      `00-${"a".repeat(32)}-${"b".repeat(16)}-01`,
    );
    expect(new Headers(request.headers).get("content-type")).toBe("application/json");
    expect(deps.finishRun).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "completed" }),
    );
    expect(deps.addFailureLog).not.toHaveBeenCalled();
  });

  it("sends GraphQL query, variables, and operation name as JSON and completes HTTP 200 errors", async () => {
    const graphqlTarget = {
      ...target,
      apiType: "GRAPHQL" as const,
      targetApiType: "GRAPHQL" as const,
      endpointUrl: "/graphql",
      url: "/graphql",
      method: "POST",
      pathParameters: {},
      customHeaders: [{ name: "Content-Type", value: "text/plain" }],
      requestJson: {
        query: "query GetOrder { order(id: $id) { id } }",
        variables: { id: "{{ORDER_ID}}" },
        operationName: "GetOrder",
      },
    };
    const responseBody = JSON.stringify({
      data: { order: null },
      errors: [{ message: "missing" }],
    });
    const { deps, run } = setup({
      getTarget: vi.fn().mockResolvedValue(graphqlTarget),
      getVariables: vi.fn().mockResolvedValue([{ name: "ORDER_ID", value: "42" }]),
      fetch: vi.fn().mockResolvedValue(new Response(responseBody, { status: 200 })),
    });
    const result = await run("mock-1");
    expect(result).toMatchObject({ status: "completed", responseStatus: 200, responseBody });
    expect(deps.fetch).toHaveBeenCalledWith(
      "http://localhost:8081/graphql",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          query: "query GetOrder { order(id: $id) { id } }",
          variables: { id: "42" },
          operationName: "GetOrder",
        }),
      }),
    );
    const request = vi.mocked(deps.fetch).mock.calls[0]![1] as RequestInit;
    expect(new Headers(request.headers).get("content-type")).toBe("application/json");
    expect(deps.createRun).toHaveBeenCalledWith(
      "project-1",
      "mock-1",
      "run-1",
      "a".repeat(32),
      "Create order",
      "POST",
      "http://localhost:8081/graphql",
      expect.objectContaining({ operationName: "GetOrder" }),
    );
    expect(deps.finishRun).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "completed", responseStatus: 200, responseBody }),
    );
  });

  it("sends GET requests without a body or default content type", async () => {
    const { deps, run } = setup({
      getTarget: vi.fn().mockResolvedValue({ ...target, method: "GET" }),
    });
    await run("mock-1");
    const request = vi.mocked(deps.fetch).mock.calls[0]![1] as RequestInit;
    expect(request.method).toBe("GET");
    expect(request.body).toBeUndefined();
    expect(new Headers(request.headers).has("content-type")).toBe(false);
    expect(vi.mocked(deps.createRun).mock.calls[0]?.[7]).toBeNull();
  });

  it("records detailed HTTP failures and their logs", async () => {
    const { deps, run } = setup({
      fetch: vi.fn().mockResolvedValue(new Response("invalid order", { status: 400 })),
    });
    const result = await run("mock-1");
    expect(result).toMatchObject({
      status: "failed",
      error: "Target returned HTTP 400: invalid order",
    });
    expect(deps.finishRun).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "failed" }),
    );
    expect(vi.mocked(deps.createRun).mock.calls[0]?.[7]).toEqual({
      token: "abc",
      enabled: true,
    });
    expect(deps.addFailureLog).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project-1",
        serviceName: "order-service",
        responseStatus: 400,
        url: "http://localhost:8081/orders/42",
      }),
    );
  });

  it("records outbound exceptions as failed runs", async () => {
    const { deps, run } = setup({
      fetch: vi.fn().mockRejectedValue(new Error("connection refused")),
    });
    await expect(run("mock-1")).resolves.toMatchObject({
      status: "failed",
      error: "connection refused",
    });
    expect(deps.addFailureLog).toHaveBeenCalledOnce();
  });

  it("records timeouts and tolerates failure-log persistence errors", async () => {
    const fetch = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const { deps, run } = setup({
      fetch,
      timeoutMs: () => 1,
      addFailureLog: vi.fn().mockRejectedValue(new Error("log database unavailable")),
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(run("mock-1")).resolves.toMatchObject({
      status: "failed",
      error: "Target request timed out after 1 ms",
    });
    expect(deps.finishRun).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "failed" }),
    );
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  it("rejects mock APIs without a target before creating a run", async () => {
    const { deps, run } = setup({ getTarget: vi.fn().mockResolvedValue(undefined) });
    await expect(run("missing")).rejects.toBeInstanceOf(MockApiNotFoundError);
    expect(deps.createRun).not.toHaveBeenCalled();
  });

  it("rejects inactive or incomplete APIs before creating a run or sending a request", async () => {
    const inactive = setup({ getTarget: vi.fn().mockResolvedValue({ ...target, active: false }) });
    await expect(inactive.run("mock-1")).rejects.toBeInstanceOf(MockApiNotReadyError);
    expect(inactive.deps.createRun).not.toHaveBeenCalled();
    expect(inactive.deps.fetch).not.toHaveBeenCalled();

    const missing = setup({ getVariables: vi.fn().mockResolvedValue([]) });
    await expect(missing.run("mock-1")).rejects.toThrow(/missing variable/);
    expect(missing.deps.createRun).not.toHaveBeenCalled();
    expect(missing.deps.fetch).not.toHaveBeenCalled();
  });

  it("uses template and custom headers, with custom values overriding case-insensitively", async () => {
    const { deps, run } = setup({
      getVariables: vi.fn().mockResolvedValue([{ name: "TOKEN", value: "abc" }]),
      getTarget: vi.fn().mockResolvedValue({
        ...target,
        headerTemplateHeaders: [
          { name: "X-Tenant", value: "default" },
          { name: "Content-Type", value: "application/custom" },
        ],
        customHeaders: [{ name: "x-tenant", value: "{{TOKEN}}" }],
      }),
    });
    await run("mock-1");
    const request = vi.mocked(deps.fetch).mock.calls[0]![1] as RequestInit;
    const headers = new Headers(request.headers);
    expect(headers.get("x-tenant")).toBe("abc");
    expect(headers.get("content-type")).toBe("application/custom");
  });

  it("adds generated static authorization headers to the outbound request", async () => {
    const { deps, run } = setup({
      getTarget: vi.fn().mockResolvedValue({
        ...target,
        authorizationTemplate: { type: "bearer", config: { token: "{{TOKEN}}" } },
      }),
    });
    await run("mock-1");
    const request = vi.mocked(deps.fetch).mock.calls[0]![1] as RequestInit;
    expect(new Headers(request.headers).get("authorization")).toBe("Bearer abc");
  });

  it("rejects raw header conflicts before creating a run or sending credentials", async () => {
    const { deps, run } = setup({
      getTarget: vi.fn().mockResolvedValue({
        ...target,
        customHeaders: [{ name: "AUTHORIZATION", value: "raw-secret" }],
        authorizationTemplateId: "auth-1",
        authorizationTemplate: { type: "bearer", config: { token: "{{TOKEN}}" } },
      }),
    });
    await expect(run("mock-1")).rejects.toThrow(
      "Header Authorization conflicts with selected authorization",
    );
    expect(deps.createRun).not.toHaveBeenCalled();
    expect(deps.fetch).not.toHaveBeenCalled();
    expect(deps.addFailureLog).not.toHaveBeenCalled();
  });

  it("uses OAuth access tokens for the target request", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) =>
      requestUrl(input).includes("auth.example.com")
        ? tokenResponse()
        : new Response("ok", { status: 200 }),
    );
    const { deps, run } = setup({
      fetch,
      getTarget: vi.fn().mockResolvedValue({
        ...target,
        authorizationTemplateId: "oauth-template",
        authorizationTemplate: {
          type: "oauth-client-credentials",
          config: {
            tokenUrl: "https://auth.example.com/token",
            clientId: "client",
            clientSecret: "secret",
            scope: "read",
          },
        },
      }),
    });
    await expect(run("mock-1")).resolves.toMatchObject({ status: "completed" });
    const targetRequest = fetch.mock.calls.find(([url]) =>
      requestUrl(url).includes("localhost:8081"),
    );
    expect(targetRequest).toBeDefined();
    expect(new Headers(targetRequest![1]?.headers).get("authorization")).toBe(
      "Bearer access-token",
    );
    expect(deps.finishRun).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "completed" }),
    );
  });

  it("fails OAuth acquisition without sending the target request or logging secrets", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) =>
      requestUrl(input).includes("auth.example.com")
        ? new Response("private-client-secret", { status: 401 })
        : new Response("target reached", { status: 200 }),
    );
    const { deps, run } = setup({
      fetch,
      getTarget: vi.fn().mockResolvedValue({
        ...target,
        authorizationTemplateId: "oauth-failure-template",
        authorizationTemplate: {
          type: "oauth-client-credentials",
          config: {
            tokenUrl: "https://auth.example.com/token",
            clientId: "client",
            clientSecret: "private-client-secret",
          },
        },
      }),
    });
    await expect(run("mock-1")).resolves.toMatchObject({
      status: "failed",
      error: "OAuth token request failed",
    });
    expect(fetch.mock.calls.some(([url]) => requestUrl(url).includes("localhost:8081"))).toBe(
      false,
    );
    expect(deps.finishRun).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "failed", error: "OAuth token request failed" }),
    );
    expect(JSON.stringify(vi.mocked(deps.addFailureLog).mock.calls)).not.toContain(
      "private-client-secret",
    );
  });
});

function tokenResponse() {
  return new Response(JSON.stringify({ access_token: "access-token", expires_in: 3600 }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
