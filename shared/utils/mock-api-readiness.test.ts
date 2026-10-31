import { describe, expect, it } from "vite-plus/test";
import { evaluateMockApiReadiness } from "./mock-api-readiness";

const base = {
  targetEndpointId: "endpoint-1",
  pathParameters: {},
  requestJson: { token: "{{token}}" },
  customHeaders: [{ name: "Authorization", value: "Bearer {{token}}" }],
  active: true,
};

describe("mock API readiness", () => {
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
});
