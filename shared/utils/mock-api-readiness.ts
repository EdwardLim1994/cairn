import { parse } from "graphql";
import { findVariableReferences } from "./environment-variables";
import { mergeHeaderRows, resolveHeaderRows, type HeaderRow } from "./headers";

export type ReadinessReason = { code: string; message: string };
export type MockApiReadinessInput = {
  apiType?: "REST" | "HTTP" | "GRAPHQL" | "GRPC";
  targetApiType?: "REST" | "GRAPHQL" | "GRPC" | null;
  targetEndpointId: string | null;
  endpointApiType?: "REST" | "GRAPHQL" | "GRPC" | null;
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

function addMissingVariables(
  value: unknown,
  context: string,
  variables: Map<string, string>,
  reasons: ReadinessReason[],
) {
  for (const name of new Set(findVariableReferences(value)))
    if (!variables.has(name))
      reasons.push({
        code: "variable-missing",
        message: `${context} uses missing variable {{${name}}}`,
      });
}

function addPathParameterReasons(
  api: MockApiReadinessInput,
  endpointUrl: string,
  variables: Map<string, string>,
  reasons: ReadinessReason[],
) {
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
    else addMissingVariables(value, `Path parameter ${name}`, variables, reasons);
  }
}

function addAuthorizationReasons(
  template: NonNullable<MockApiReadinessInput["authorizationTemplate"]>,
  templateHeaders: HeaderRow[],
  customHeaders: HeaderRow[],
  variables: Map<string, string>,
  reasons: ReadinessReason[],
) {
  const { type, config } = template;
  const headerName = type === "api-key" ? (config.headerName ?? "") : "Authorization";
  if (
    headerName &&
    [...templateHeaders, ...customHeaders].some(
      (header) => header.name.toLowerCase() === headerName.toLowerCase(),
    )
  )
    reasons.push({
      code: "authorization-header-conflict",
      message: `Header ${headerName} conflicts with selected authorization`,
    });

  let values: (string | undefined)[];
  switch (type) {
    case "bearer":
      values = [config.token];
      break;
    case "basic":
      values = [config.username, config.password];
      break;
    case "api-key":
      values = [config.value];
      break;
    case "oauth-client-credentials":
      values = [config.tokenUrl, config.clientId, config.clientSecret, config.scope];
  }
  addMissingVariables(values, "Authorization", variables, reasons);
}

function addHeaderReasons(
  templateHeaders: HeaderRow[],
  customHeaders: HeaderRow[],
  variables: Map<string, string>,
  reasons: ReadinessReason[],
) {
  try {
    const headers = mergeHeaderRows(templateHeaders, customHeaders);
    addMissingVariables(
      headers.map(({ value }) => value),
      "Header",
      variables,
      reasons,
    );
    if (!reasons.some(({ code }) => code === "variable-missing"))
      resolveHeaderRows(templateHeaders, customHeaders, variables);
  } catch (error) {
    reasons.push({
      code: "header-invalid",
      message: error instanceof Error ? error.message : "Header is invalid",
    });
  }
}

function expectedEndpointType(apiType: MockApiReadinessInput["apiType"]) {
  if (apiType === "GRPC") return "GRPC";
  if (apiType === "GRAPHQL") return "GRAPHQL";
  return "REST";
}

function addEndpointReasons(
  api: MockApiReadinessInput,
  endpointUrl: string | null,
  expectedType: string,
  variables: Map<string, string>,
  reasons: ReadinessReason[],
) {
  if (!api.targetEndpointId) {
    reasons.push({ code: "endpoint-missing", message: "Select a service endpoint" });
    return;
  }
  if (api.endpointApiType && api.endpointApiType !== expectedType) {
    reasons.push({
      code: "endpoint-type-mismatch",
      message: "Mock API type must match the selected service endpoint",
    });
    return;
  }
  if (api.apiType !== "GRPC" && !endpointUrl) {
    reasons.push({ code: "endpoint-missing", message: "Select a REST endpoint" });
    return;
  }
  if (api.apiType !== "GRPC" && endpointUrl) {
    addPathParameterReasons(api, endpointUrl, variables, reasons);
    if (api.apiType && api.targetApiType && expectedType !== api.targetApiType)
      reasons.push({
        code: "api-type-mismatch",
        message: "Mock API type must match service API type",
      });
  }
}

function addGraphqlReasons(
  api: MockApiReadinessInput,
  variables: Map<string, string>,
  reasons: ReadinessReason[],
) {
  const request =
    api.requestJson && typeof api.requestJson === "object" && !Array.isArray(api.requestJson)
      ? (api.requestJson as { query?: unknown; variables?: unknown })
      : {};
  const query = request.query;
  if (typeof query !== "string" || !query.trim()) {
    reasons.push({ code: "graphql-query-missing", message: "Enter a GraphQL query" });
  } else {
    try {
      parse(query);
    } catch (error) {
      reasons.push({
        code: "graphql-syntax-invalid",
        message: error instanceof Error ? error.message : "GraphQL syntax is invalid",
      });
    }
  }
  const requestVariables = request.variables;
  if (
    requestVariables !== undefined &&
    (!requestVariables || typeof requestVariables !== "object" || Array.isArray(requestVariables))
  )
    reasons.push({
      code: "graphql-variables-invalid",
      message: "GraphQL variables must be a JSON object",
    });
  addMissingVariables(api.requestJson, "GraphQL request", variables, reasons);
}

function readinessStatus(reasons: ReadinessReason[], active: boolean) {
  if (reasons.length) return "draft" as const;
  return active ? ("ready" as const) : ("inactive" as const);
}

export function evaluateMockApiReadiness(
  api: MockApiReadinessInput,
  endpointUrl: string | null,
  templateHeaders: HeaderRow[],
  variables: Map<string, string>,
) {
  const reasons: ReadinessReason[] = [];
  const expectedType = expectedEndpointType(api.apiType);
  addEndpointReasons(api, endpointUrl, expectedType, variables, reasons);
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
  if (api.authorizationTemplate)
    addAuthorizationReasons(
      api.authorizationTemplate,
      templateHeaders,
      api.customHeaders,
      variables,
      reasons,
    );

  if (api.apiType === "GRAPHQL") {
    addGraphqlReasons(api, variables, reasons);
  } else addMissingVariables(api.requestJson, "Request body", variables, reasons);
  if (!api.targetEndpointId && (api.matchUrl || api.importUrl))
    addMissingVariables(api.matchUrl ?? api.importUrl, "Imported URL", variables, reasons);
  addHeaderReasons(templateHeaders, api.customHeaders, variables, reasons);

  return { status: readinessStatus(reasons, api.active), reasons };
}
