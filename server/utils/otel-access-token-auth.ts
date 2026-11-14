import { digestAccessToken } from "../use-cases/otel-access-tokens/token";
import { hasValidOtelAccessToken } from "../modules/project-access";
import { getAppConfig } from "./config";

export async function requireOtelAccessToken(event: {
  node: { req: { headers: Record<string, string | string[] | undefined> } };
}) {
  const authorization = event.node.req.headers.authorization;
  const match =
    typeof authorization === "string" && /^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization);
  if (
    !match ||
    !(await hasValidOtelAccessToken(getAppConfig().projectId, digestAccessToken(match[1]!)))
  ) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }
}
