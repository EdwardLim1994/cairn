import type { AuthSessionStatus } from "../utils/auth-route";
import { authRouteRedirect } from "../utils/auth-route";

export default defineNuxtRouteMiddleware(async (to) => {
  const authStatus = useState<AuthSessionStatus>("auth-session-status", () => ({
    enabled: true,
    authenticated: false,
  }));
  try {
    const requestFetch = useRequestFetch();
    authStatus.value = await requestFetch<AuthSessionStatus>("/api/auth/session");
  } catch {
    authStatus.value = { enabled: true, authenticated: false };
  }

  const redirect = authRouteRedirect(to.path, to.fullPath, to.query.returnTo, authStatus.value);
  if (redirect) return navigateTo(redirect);
});
