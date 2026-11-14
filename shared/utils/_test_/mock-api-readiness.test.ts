import { describe, expect, it } from "vite-plus/test";
import { evaluateMockApiReadiness } from "../mock-api-readiness";

const base = {
  targetEndpointId: "endpoint-1",
  pathParameters: {},
  requestJson: { token: "{{token}}" },
  customHeaders: [{ name: "Authorization", value: "Bearer {{token}}" }],
  active: true,
};

describe("mock API readiness", () => {
  it("validates GraphQL syntax without requiring a schema", () => {
    const valid = evaluateMockApiReadiness(
      {
        ...base,
        apiType: "GRAPHQL",
        customHeaders: [],
        requestJson: { query: "query { orders { id } }", variables: {} },
      },
      "/graphql",
      [],
      new Map(),
    );
    expect(valid.status).toBe("ready");
    const invalid = evaluateMockApiReadiness(
      {
        ...base,
        apiType: "GRAPHQL",
        customHeaders: [],
        requestJson: { query: "query {", variables: {} },
      },
      "/graphql",
      [],
      new Map(),
    );
    expect(invalid.reasons.map(({ code }) => code)).toContain("graphql-syntax-invalid");
    const invalidVariables = evaluateMockApiReadiness(
      {
        ...base,
        apiType: "GRAPHQL",
        customHeaders: [],
        requestJson: { query: "query { orders { id } }", variables: "{" },
      },
      "/graphql",
      [],
      new Map(),
    );
    expect(invalidVariables.reasons.map(({ code }) => code)).toContain("graphql-variables-invalid");
  });

  it("requires a WebSocket text message and preserves message variable readiness", () => {
    const ready = evaluateMockApiReadiness(
      {
        ...base,
        apiType: "WEBSOCKET",
        endpointApiType: "WEBSOCKET",
        requestJson: "subscribe {{channel}}\n",
        customHeaders: [],
      },
      "wss://example.test/events",
      [],
      new Map([["channel", "orders"]]),
    );
    expect(ready).toEqual({ status: "ready", reasons: [] });
    const missing = evaluateMockApiReadiness(
      { ...base, apiType: "WEBSOCKET", endpointApiType: "WEBSOCKET", requestJson: "  " },
      "wss://example.test/events",
      [],
      new Map(),
    );
    expect(missing.reasons.map(({ code }) => code)).toContain("websocket-message-missing");
    const wrongEndpoint = evaluateMockApiReadiness(
      { ...base, apiType: "WEBSOCKET", endpointApiType: "REST", requestJson: "hello" },
      "/events",
      [],
      new Map(),
    );
    expect(wrongEndpoint.reasons.map(({ code }) => code)).toContain("endpoint-type-mismatch");
  });

  it("reports missing endpoint, path values, and referenced variables", () => {
    const result = evaluateMockApiReadiness(
      { ...base, targetEndpointId: null },
      null,
      [],
      new Map(),
    );
    expect(result.status).toBe("draft");
    expect(result.reasons.map(({ code }) => code)).toContain("endpoint-missing");
    const withEndpoint = evaluateMockApiReadiness(base, "/orders/{id}", [], new Map());
    expect(withEndpoint.reasons.map(({ code }) => code)).toContain("path-value-missing");
    expect(withEndpoint.reasons.filter(({ code }) => code === "variable-missing")).toHaveLength(2);
  });

  it("becomes inactive when valid and does not infer reactivation", () => {
    const result = evaluateMockApiReadiness(
      { ...base, active: false, requestJson: {} },
      "/orders",
      [],
      new Map([["token", ""]]),
    );
    expect(result).toEqual({ status: "inactive", reasons: [] });
  });

  it("derives readiness from effective overridden headers", () => {
    const result = evaluateMockApiReadiness(
      { ...base, requestJson: {} },
      "/orders",
      [{ name: "Authorization", value: "{{gone}}" }],
      new Map([["token", "ok"]]),
    );
    expect(result).toEqual({ status: "ready", reasons: [] });
  });

  it("reports a deleted selected template", () => {
    const result = evaluateMockApiReadiness(
      { ...base, headerTemplateId: "gone", headerTemplateExists: false },
      "/orders",
      [],
      new Map([["token", "ok"]]),
    );
    expect(result.reasons.map(({ code }) => code)).toContain("header-template-missing");
  });

  it("rejects Authorization conflicts without including header values", () => {
    const result = evaluateMockApiReadiness(
      {
        ...base,
        customHeaders: [{ name: "authorization", value: "sensitive-raw-value" }],
        authorizationTemplateId: "auth-1",
        authorizationTemplateExists: true,
        authorizationTemplate: { type: "bearer", config: { token: "sensitive-token" } },
        requestJson: {},
      },
      "/orders",
      [],
      new Map(),
    );
    expect(result.status).toBe("draft");
    expect(result.reasons).toContainEqual({
      code: "authorization-header-conflict",
      message: "Header Authorization conflicts with selected authorization",
    });
    expect(JSON.stringify(result)).not.toContain("sensitive");
  });

  it("rejects API key conflicts against raw header templates case-insensitively", () => {
    const result = evaluateMockApiReadiness(
      {
        ...base,
        customHeaders: [],
        authorizationTemplateId: "api-key-1",
        authorizationTemplateExists: true,
        authorizationTemplate: {
          type: "api-key",
          config: { headerName: "X-API-Key", value: "secret" },
        },
        requestJson: {},
      },
      "/orders",
      [{ name: "x-api-key", value: "raw-value" }],
      new Map(),
    );
    expect(result.status).toBe("draft");
    expect(result.reasons.map(({ message }) => message)).toContain(
      "Header X-API-Key conflicts with selected authorization",
    );
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(JSON.stringify(result)).not.toContain("raw-value");
  });
});
