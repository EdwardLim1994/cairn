import { resolveStringVariables } from "#shared/utils/environment-variables";

type StaticAuthorizationTemplate = {
  type: "bearer" | "basic" | "api-key" | "oauth-client-credentials";
  config: Record<string, string>;
};

export function resolveStaticAuthorizationHeaders(
  template: StaticAuthorizationTemplate | null,
  variables: Map<string, string>,
) {
  if (!template) return [];
  const { config } = template;
  switch (template.type) {
    case "bearer":
      return [
        {
          name: "Authorization",
          value: `Bearer ${resolveStringVariables(config.token!, variables)}`,
        },
      ];
    case "basic": {
      const username = resolveStringVariables(config.username!, variables);
      const password = resolveStringVariables(config.password!, variables);
      return [
        {
          name: "Authorization",
          value: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
        },
      ];
    }
    case "api-key":
      return [
        { name: config.headerName!, value: resolveStringVariables(config.value!, variables) },
      ];
    case "oauth-client-credentials":
      return [];
  }
}
