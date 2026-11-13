import { createServer, type Server } from "node:http";
import { createApp, createError, defineEventHandler, readBody, toNodeListener } from "h3";
import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { requireOtelAccessToken } from "../utils/otel-access-token-auth";
import { hasValidOtelAccessToken } from "../repositories/otel-access-tokens";

vi.mock("../repositories/otel-access-tokens", () => ({
  hasValidOtelAccessToken: vi.fn().mockResolvedValue(true),
}));

describe("operator authentication endpoints", () => {
  let server: Server;
  let origin: string;

  beforeAll(async () => {
    vi.stubEnv("OTEL_COLLECTOR_URL", "http://collector:4318");
    vi.stubEnv("PROJECT_ID", "auth-test");
    vi.stubEnv("AUTH_ENABLED", "true");
    vi.stubEnv("AUTH_USERNAME", "operator");
    vi.stubEnv("AUTH_PASSWORD", "test-password");
    vi.stubEnv("AUTH_SESSION_SECRET", "test-session-secret-with-more-than-32-characters");
    Object.assign(globalThis, { defineEventHandler, createError, readBody });

    const [session, login, logout, authMiddleware] = await Promise.all([
      import("./auth/session.get"),
      import("./auth/login.post"),
      import("./auth/logout.post"),
      import("../middleware/auth"),
    ]);
    const app = createApp()
      .use(authMiddleware.default)
      .use("/api/auth/session", session.default)
      .use("/api/auth/login", login.default)
      .use("/api/auth/logout", logout.default)
      .use(
        "/api/services",
        defineEventHandler(() => ({ ok: true })),
      )
      .use(
        "/v1/traces",
        defineEventHandler(async (event) => {
          await requireOtelAccessToken(event);
          return { accepted: true };
        }),
      );
    server = createServer(toNodeListener(app));
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Auth test server did not start");
    origin = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  async function login(username = "operator", password = "test-password") {
    return fetch(`${origin}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ username, password }),
    });
  }

  function sessionCookie(response: Response): string {
    const cookies = response.headers.getSetCookie();
    const cookie = cookies
      .map((value) => value.split(";", 1)[0]!)
      .findLast(
        (value) => value.startsWith("cairn-session=") && value.length > "cairn-session=".length,
      );
    if (!cookie) throw new Error("Login did not set a session cookie");
    return cookie;
  }

  it("rejects invalid credentials with generic feedback", async () => {
    const response = await login("operator", "wrong-password");
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain("test-password");
  });

  it("creates an encrypted HTTP-only session without returning secrets", async () => {
    const response = await login();
    expect(response.status).toBe(200);
    const cookie = sessionCookie(response);
    const setCookie = response.headers.getSetCookie().join(";").toLowerCase();
    expect(setCookie).toContain("httponly");
    expect(setCookie).toContain("samesite=lax");
    expect(setCookie).toContain("path=/");
    expect(cookie).not.toContain("test-password");
    expect(await response.text()).not.toContain("test-password");

    const status = await fetch(`${origin}/api/auth/session`, { headers: { cookie } });
    await expect(status.json()).resolves.toEqual({ enabled: true, authenticated: true });
  });

  it("expires sessions and clears them on logout", async () => {
    const response = await login();
    const cookie = sessionCookie(response);
    const createdAt = Date.now();
    vi.setSystemTime(createdAt + 8 * 60 * 60 * 1000 + 1);
    const expired = await fetch(`${origin}/api/auth/session`, { headers: { cookie } });
    await expect(expired.json()).resolves.toEqual({ enabled: true, authenticated: false });
    expect((await fetch(`${origin}/api/services`, { headers: { cookie } })).status).toBe(401);
    vi.setSystemTime(createdAt);

    const logout = await fetch(`${origin}/api/auth/logout`, {
      method: "POST",
      headers: { cookie, origin },
    });
    expect(logout.status).toBe(200);
    expect(logout.headers.getSetCookie().join(";")).toContain("cairn-session=");
    const afterLogout = await fetch(`${origin}/api/auth/session`);
    await expect(afterLogout.json()).resolves.toEqual({ enabled: true, authenticated: false });
    expect((await fetch(`${origin}/api/services`)).status).toBe(401);
  });

  it("reports access without a session only when authentication is disabled", async () => {
    vi.stubEnv("AUTH_ENABLED", "false");
    const response = await fetch(`${origin}/api/auth/session`);
    await expect(response.json()).resolves.toEqual({ enabled: false, authenticated: true });
    const management = await fetch(`${origin}/api/services`);
    await expect(management.json()).resolves.toEqual({ ok: true });
    vi.stubEnv("AUTH_ENABLED", "true");
  });

  it("blocks management APIs without a session and allows a valid session", async () => {
    const unauthenticated = await fetch(`${origin}/api/services`);
    expect(unauthenticated.status).toBe(401);
    const unknownAuthRoute = await fetch(`${origin}/api/auth/other`);
    expect(unknownAuthRoute.status).toBe(401);

    const loggedIn = await login();
    const cookie = sessionCookie(loggedIn);
    const authenticated = await fetch(`${origin}/api/services`, { headers: { cookie } });
    expect(authenticated.status).toBe(200);
    await expect(authenticated.json()).resolves.toEqual({ ok: true });
  });

  it("rejects cross-origin writes with a session cookie and allows same-origin writes", async () => {
    const loggedIn = await login();
    const cookie = sessionCookie(loggedIn);
    const crossOrigin = await fetch(`${origin}/api/services`, {
      method: "POST",
      headers: { cookie, origin: "https://attacker.example" },
    });
    expect(crossOrigin.status).toBe(403);

    const sameOrigin = await fetch(`${origin}/api/services`, {
      method: "POST",
      headers: { cookie, origin },
    });
    expect(sameOrigin.status).toBe(200);
  });

  it("keeps OTLP ingestion on bearer authentication with app auth enabled or disabled", async () => {
    for (const enabled of ["true", "false"]) {
      vi.stubEnv("AUTH_ENABLED", enabled);
      const missingToken = await fetch(`${origin}/v1/traces`, { method: "POST" });
      expect(missingToken.status).toBe(401);
      const validToken = await fetch(`${origin}/v1/traces`, {
        method: "POST",
        headers: { authorization: `Bearer ${"a".repeat(43)}` },
      });
      expect(validToken.status).toBe(200);
      await expect(validToken.json()).resolves.toEqual({ accepted: true });
    }
    expect(hasValidOtelAccessToken).toHaveBeenCalled();
    vi.stubEnv("AUTH_ENABLED", "true");
  });
});
