import { describe, expect, it } from "vite-plus/test";
import { resolveStaticAuthorizationHeaders } from "../../../../utils/authorization";

describe("static authorization headers", () => {
  const variables = new Map([
    ["TOKEN", "resolved-token"],
    ["PASSWORD", "resolved-pass"],
  ]);

  it("resolves bearer tokens into Authorization headers", () => {
    expect(
      resolveStaticAuthorizationHeaders(
        { type: "bearer", config: { token: "{{TOKEN}}" } },
        variables,
      ),
    ).toEqual([{ name: "Authorization", value: "Bearer resolved-token" }]);
  });

  it("encodes resolved Basic credentials", () => {
    expect(
      resolveStaticAuthorizationHeaders(
        { type: "basic", config: { username: "service", password: "{{PASSWORD}}" } },
        variables,
      ),
    ).toEqual([{ name: "Authorization", value: "Basic c2VydmljZTpyZXNvbHZlZC1wYXNz" }]);
  });

  it("uses configured API key header name and resolved value", () => {
    expect(
      resolveStaticAuthorizationHeaders(
        { type: "api-key", config: { headerName: "X-Api-Key", value: "{{TOKEN}}" } },
        variables,
      ),
    ).toEqual([{ name: "X-Api-Key", value: "resolved-token" }]);
  });
});
