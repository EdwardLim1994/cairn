import { resolveStaticAuthorizationHeaders } from "./authorization";
import { getOAuthAccessToken } from "./oauth-client";
import { resolveHeaderRows, type HeaderRow } from "./headers";

type AuthorizationTemplate = {
  type: "bearer" | "basic" | "api-key" | "oauth-client-credentials";
  config: Record<string, string>;
};

export async function resolveMockApiHandshakeHeaders(options: {
  projectId: string;
  authorizationTemplateId: string | null;
  authorizationTemplate: AuthorizationTemplate | null;
  headerTemplateHeaders: HeaderRow[];
  customHeaders: HeaderRow[];
  variables: Map<string, string>;
  fetch: typeof globalThis.fetch;
  timeoutMs: number;
}) {
  const headers = resolveHeaderRows(
    options.headerTemplateHeaders,
    options.customHeaders,
    options.variables,
  );
  const template = options.authorizationTemplate;
  if (!template) return headers;

  const authorizationHeaders =
    template.type === "oauth-client-credentials"
      ? [
          {
            name: "Authorization",
            value: `Bearer ${await getOAuthAccessToken({
              projectId: options.projectId,
              templateId: options.authorizationTemplateId!,
              config: {
                tokenUrl: template.config.tokenUrl!,
                clientId: template.config.clientId!,
                clientSecret: template.config.clientSecret!,
                scope: template.config.scope,
              },
              variables: options.variables,
              fetch: options.fetch,
              timeoutMs: options.timeoutMs,
            })}`,
          },
        ]
      : resolveStaticAuthorizationHeaders(template, options.variables);
  for (const { name, value } of authorizationHeaders) headers[name] = value;
  return headers;
}
