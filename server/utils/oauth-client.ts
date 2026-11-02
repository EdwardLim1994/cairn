import { resolveStringVariables } from "#shared/utils/environment-variables";
import { getOutboundUrl } from "./outbound-url";

export type OAuthClientCredentials = {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
};

const tokenCache = new Map<string, { token: string; expiresAt: number; refreshAt: number }>();
const tokenRequests = new Map<string, Promise<string>>();

export async function getOAuthAccessToken(options: {
  projectId: string;
  templateId: string;
  config: OAuthClientCredentials;
  variables: Map<string, string>;
  fetch: typeof globalThis.fetch;
  timeoutMs: number;
}): Promise<string> {
  const config = {
    tokenUrl: resolveStringVariables(options.config.tokenUrl, options.variables),
    clientId: resolveStringVariables(options.config.clientId, options.variables),
    clientSecret: resolveStringVariables(options.config.clientSecret, options.variables),
    scope: options.config.scope
      ? resolveStringVariables(options.config.scope, options.variables)
      : "",
  };
  let url: URL;
  try {
    url = new URL(config.tokenUrl);
  } catch {
    throw new Error("OAuth token request failed");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new Error("OAuth token request failed");
  const key = JSON.stringify([options.projectId, options.templateId, config]);
  const cached = tokenCache.get(key);
  if (cached && Date.now() < cached.refreshAt) return cached.token;
  for (const cacheKey of tokenCache.keys()) {
    if (
      cacheKey !== key &&
      cacheKey.startsWith(JSON.stringify([options.projectId, options.templateId]).slice(0, -1))
    )
      tokenCache.delete(cacheKey);
  }
  const pending = tokenRequests.get(key);
  if (pending) return pending;

  const request = requestToken(
    options.fetch,
    getOutboundUrl(url.toString(), url.toString()),
    config,
    options.timeoutMs,
  )
    .then(({ token, expiresIn }) => {
      if (expiresIn !== null) {
        const lifetimeMs = expiresIn * 1000;
        const expiresAt = Date.now() + lifetimeMs;
        tokenCache.set(key, { token, expiresAt, refreshAt: expiresAt - lifetimeMs * 0.1 });
      }
      return token;
    })
    .finally(() => tokenRequests.delete(key));
  tokenRequests.set(key, request);
  return request;
}

function formEncode(value: string) {
  return new URLSearchParams([["value", value]]).toString().slice("value=".length);
}

async function requestToken(
  fetch: typeof globalThis.fetch,
  url: URL,
  config: { clientId: string; clientSecret: string; scope: string },
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const credentials = `${formEncode(config.clientId)}:${formEncode(config.clientSecret)}`;
  const body = new URLSearchParams({ grant_type: "client_credentials" });
  if (config.scope) body.set("scope", config.scope);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Basic ${Buffer.from(credentials).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error();
    const result: unknown = await response.json();
    if (!result || typeof result !== "object") throw new Error();
    const token = (result as { access_token?: unknown }).access_token;
    const expires = (result as { expires_in?: unknown }).expires_in;
    if (typeof token !== "string" || !token.trim()) throw new Error();
    return {
      token,
      expiresIn:
        typeof expires === "number" && Number.isFinite(expires) && expires > 0 ? expires : null,
    };
  } catch {
    throw new Error("OAuth token request failed");
  } finally {
    clearTimeout(timeout);
  }
}
