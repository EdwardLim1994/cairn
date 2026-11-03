import { safeLocalReturnPath } from "./auth-redirect";

export type AuthSessionStatus = { enabled: boolean; authenticated: boolean };

export function authRouteRedirect(
  path: string,
  fullPath: string,
  returnTo: unknown,
  status: AuthSessionStatus,
): string | { path: string; query: { returnTo: string } } | undefined {
  if (path === "/login") {
    return !status.enabled || status.authenticated ? safeLocalReturnPath(returnTo) : undefined;
  }
  return status.enabled && !status.authenticated
    ? { path: "/login", query: { returnTo: fullPath } }
    : undefined;
}
