import { describe, expect, it, vi } from "vite-plus/test";
import { resolveMockApiHandshakeHeaders } from "../../../../utils/mock-api-handshake-headers";

const base = {
  projectId: "project-1",
  authorizationTemplateId: "auth-1",
  headerTemplateHeaders: [{ name: "X-Tenant", value: "{{TENANT}}" }],
  customHeaders: [{ name: "X-Client", value: "cairn" }],
  variables: new Map([["TENANT", "acme"]]),
  timeoutMs: 1000,
};

describe("mock API WebSocket handshake headers", () => {
  it("merges configured headers and applies a resolved bearer authorization template", async () => {
    const headers = await resolveMockApiHandshakeHeaders({
      ...base,
      authorizationTemplate: { type: "bearer", config: { token: "{{TOKEN}}" } },
      variables: new Map([
        ["TENANT", "acme"],
        ["TOKEN", "resolved-token"],
      ]),
      fetch: globalThis.fetch,
    });

    expect(headers).toEqual({
      "X-Tenant": "acme",
      "X-Client": "cairn",
      Authorization: "Bearer resolved-token",
    });
  });

  it("gets OAuth client credentials for the handshake authorization header", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ access_token: "oauth-token" }), { status: 200 }),
      );
    const headers = await resolveMockApiHandshakeHeaders({
      ...base,
      authorizationTemplate: {
        type: "oauth-client-credentials",
        config: {
          tokenUrl: "https://auth.example.test/token",
          clientId: "client",
          clientSecret: "secret",
        },
      },
      fetch,
    });

    expect(headers.Authorization).toBe("Bearer oauth-token");
    expect(headers["X-Tenant"]).toBe("acme");
  });

  it("reports authorization failures without exposing token endpoint details", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response("private OAuth response", { status: 401 }));
    await expect(
      resolveMockApiHandshakeHeaders({
        ...base,
        authorizationTemplate: {
          type: "oauth-client-credentials",
          config: {
            tokenUrl: "https://auth.example.test/token",
            clientId: "client",
            clientSecret: "secret",
          },
        },
        fetch,
      }),
    ).rejects.toThrow("OAuth token request failed");
  });
});
