import { createError, getCookie, getRequestHeader, getRequestURL } from "h3";
import { authSessionName, hasAuthenticatedSession } from "../utils/auth-session";
import { getAppConfig } from "../utils/config";

const publicRoutes = new Map([
  ["/api/auth/login", "POST"],
  ["/api/auth/logout", "POST"],
  ["/api/auth/session", "GET"],
]);
const stateChangingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isSameOriginRequest(event: Parameters<typeof getRequestURL>[0]): boolean {
  const origin = getRequestHeader(event, "origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === getRequestURL(event).origin;
  } catch {
    return false;
  }
}

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;
  if (!path.startsWith("/api/")) return;

  const { authEnabled } = getAppConfig();
  if (!authEnabled) return;
  if (
    stateChangingMethods.has(event.method) &&
    getCookie(event, authSessionName) !== undefined &&
    !isSameOriginRequest(event)
  ) {
    throw createError({ statusCode: 403, statusMessage: "Cross-origin request denied" });
  }
  if (publicRoutes.get(path) === event.method) return;
  if (!(await hasAuthenticatedSession(event))) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }
});
