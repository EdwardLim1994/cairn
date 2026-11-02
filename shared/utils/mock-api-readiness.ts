import { findVariableReferences } from "./environment-variables";
import { mergeHeaderRows, resolveHeaderRows, type HeaderRow } from "./headers";

export type ReadinessReason = { code: string; message: string };
export type MockApiReadinessInput = {
  targetEndpointId: string | null;
  headerTemplateId?: string | null;
  headerTemplateExists?: boolean;
  authorizationTemplateId?: string | null;
  authorizationTemplateExists?: boolean;
  authorizationTemplate?: {
    type: "bearer" | "basic" | "api-key" | "oauth-client-credentials";
    config: Record<string, string>;
  } | null;
  pathParameters: Record<string, string>;
  requestJson: unknown;
  customHeaders: HeaderRow[];
  active: boolean;
  importUrl?: string | null;
  matchUrl?: string | null;
};

export function evaluateMockApiReadiness(
  api: MockApiReadinessInput,
  endpointUrl: string | null,
  templateHeaders: HeaderRow[],
  variables: Map<string, string>,
) {
  const reasons: ReadinessReason[] = [];
  const addMissing = (value: unknown, context: string) => {
    for (const name of new Set(findVariableReferences(value)))
      if (!variables.has(name))
        reasons.push({
          code: "variable-missing",
          message: `${context} uses missing variable {{${name}}}`,
        });
  };

  if (!endpointUrl) {
    reasons.push({ code: "endpoint-missing", message: "Select a service endpoint" });
  } else {
    const route = endpointUrl.split(/[?#]/, 1)[0] ?? endpointUrl;
    const names = [...route.matchAll(/\{([A-Za-z_][\w-]*)(?::[^{}]+)?\}|:([A-Za-z_][\w-]*)/g)].map(
      (match) => match[1] ?? match[2]!,
    );
    for (const name of names) {
      const value = api.pathParameters[name];
      if (!value)
        reasons.push({
          code: "path-value-missing",
          message: `Enter a value for path parameter ${name}`,
        });
      else addMissing(value, `Path parameter ${name}`);
    }
  }
  if (api.headerTemplateId && api.headerTemplateExists === false)
    reasons.push({
      code: "header-template-missing",
      message: "Selected header template is unavailable",
    });
  if (api.authorizationTemplateId && api.authorizationTemplateExists === false)
    reasons.push({
      code: "authorization-template-missing",
      message: "Selected authorization template is unavailable",
    });
  if (api.authorizationTemplate) {
    const { type, config } = api.authorizationTemplate;
    const generatedNames = type === "api-key" ? [config.headerName ?? ""] : ["Authorization"];
    for (const headerName of generatedNames) {
      if (
        headerName &&
        [...templateHeaders, ...api.customHeaders].some(
          (header) => header.name.toLowerCase() === headerName.toLowerCase(),
        )
      )
        reasons.push({
          code: "authorization-header-conflict",
          message: `Header ${headerName} conflicts with selected authorization`,
        });
    }
    const variableValues =
      type === "bearer"
        ? [config.token]
        : type === "basic"
          ? [config.username, config.password]
          : type === "api-key"
            ? [config.value]
            : [config.tokenUrl, config.clientId, config.clientSecret, config.scope];
    addMissing(variableValues, "Authorization");
  }

  addMissing(api.requestJson, "Request body");
  if (!api.targetEndpointId && (api.matchUrl || api.importUrl))
    addMissing(api.matchUrl ?? api.importUrl, "Imported URL");
  try {
    const headers = mergeHeaderRows(templateHeaders, api.customHeaders);
    addMissing(
      headers.map(({ value }) => value),
      "Header",
    );
    if (!reasons.some(({ code }) => code === "variable-missing"))
      resolveHeaderRows(templateHeaders, api.customHeaders, variables);
  } catch (error) {
    reasons.push({
      code: "header-invalid",
      message: error instanceof Error ? error.message : "Header is invalid",
    });
  }

  return {
    status: reasons.length ? "draft" : api.active ? "ready" : "inactive",
    reasons,
  } as const;
}
