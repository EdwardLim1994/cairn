import { describe, expect, it } from "vite-plus/test";
import { authRouteRedirect } from "./auth-route";

describe("authRouteRedirect", () => {
  it("sends protected destinations to login and preserves the requested route", () => {
    expect(
      authRouteRedirect("/", "/?tab=health", undefined, { enabled: true, authenticated: false }),
    ).toEqual({ path: "/login", query: { returnTo: "/?tab=health" } });
  });

  it("opens protected routes for valid sessions and returns signed-in users from login", () => {
    expect(
      authRouteRedirect("/services", "/services", undefined, {
        enabled: true,
        authenticated: true,
      }),
    ).toBeUndefined();
    expect(
      authRouteRedirect("/login", "/login", "/services?tab=health", {
        enabled: true,
        authenticated: true,
      }),
    ).toBe("/services?tab=health");
  });

  it("allows the main page only when authentication is disabled or the session is valid", () => {
    expect(
      authRouteRedirect("/", "/", undefined, { enabled: false, authenticated: true }),
    ).toBeUndefined();
    expect(
      authRouteRedirect("/login", "/login", undefined, {
        enabled: false,
        authenticated: true,
      }),
    ).toBe("/");
    expect(
      authRouteRedirect("/services", "/services", undefined, {
        enabled: true,
        authenticated: false,
      }),
    ).toEqual({ path: "/login", query: { returnTo: "/services" } });
  });
});
