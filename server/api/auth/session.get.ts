import { authSessionStatusSchema } from "#shared/api/auth";
import { hasAuthenticatedSession } from "../../utils/auth-session";
import { getAppConfig } from "../../utils/config";

export default defineEventHandler(async (event) => {
  const enabled = getAppConfig().authEnabled;
  return authSessionStatusSchema.parse({
    enabled,
    authenticated: !enabled || (await hasAuthenticatedSession(event)),
  });
});
