import { endAuthSession } from "../../utils/auth-session";
import { getAppConfig } from "../../utils/config";

export default defineEventHandler(async (event) => {
  if (getAppConfig().authEnabled) await endAuthSession(event);
  return { authenticated: !getAppConfig().authEnabled };
});
