import { authLoginRequestSchema } from "#shared/api/auth";
import { startAuthSession, verifyOperatorCredentials } from "../../utils/auth-session";
import { getAppConfig } from "../../utils/config";

export default defineEventHandler(async (event) => {
  if (!getAppConfig().authEnabled) return { authenticated: true };

  const body = authLoginRequestSchema.safeParse(await readBody(event));
  if (!body.success || !verifyOperatorCredentials(body.data.username, body.data.password)) {
    throw createError({ statusCode: 401, statusMessage: "Invalid username or password" });
  }

  await startAuthSession(event);
  return { authenticated: true };
});
