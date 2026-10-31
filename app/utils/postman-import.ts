import { validateHeaderRows } from "#shared/utils/headers";
import { findVariableReferences } from "#shared/utils/environment-variables";

type Endpoint = {
  id?: string;
  apiType: string;
  method: string;
  url: string;
};

type Service = {
  baseUrl: string;
  endpoints: Endpoint[];
};

type PostmanRequest = {
  name: string;
  method: string;
  url: string;
  requestJson: string;
  unsupportedBody: boolean;
  originalUrl: string;
  matchUrl: string;
  headers: { name: string; value: string }[];
  unsupportedFeatures: string[];
};
type RecordValue = Record<string, unknown>;

export type ImportedMockApi = {
  name: string;
  targetEndpointId: string | null;
  description: string;
  requestJson: string;
  pathParameters: Record<string, string>;
  customHeaders: { name: string; value: string }[];
  headerTemplateId: null;
  active: false;
  importMethod: string;
  importUrl: string;
  matchUrl: string;
};

export type PostmanImportResult = {
  drafts: ImportedMockApi[];
  warnings: string[];
};

function pathSegments(url: URL) {
  const path = url.pathname;
  return path
    .slice(0, trimTrailingSlashes(path))
    .split("/")
    .slice(1)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
}

function trimTrailingSlashes(path: string) {
  let end = path.length;
  while (end > 0 && path[end - 1] === "/") end -= 1;
  return end;
}

function normalizedQuery(url: URL) {
  return [...url.searchParams.entries()]
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey === rightKey ? leftValue.localeCompare(rightValue) : leftKey.localeCompare(rightKey),
    )
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

function isRouteParameter(segment: string) {
  return isCurlyParameter(segment) || isColonParameter(segment);
}

function isPostmanPathVariable(segment: string) {
  if (!segment.startsWith("{{") || !segment.endsWith("}}")) return false;
  const name = segment.slice(2, -2);
  return name.length > 0 && !name.includes("{") && !name.includes("}");
}

function isCurlyParameter(segment: string) {
  if (!segment.startsWith("{") || !segment.endsWith("}")) return false;
  const parameter = segment.slice(1, -1);
  return parameter.length > 0 && !parameter.includes("{") && !parameter.includes("}");
}

function isColonParameter(segment: string) {
  if (!segment.startsWith(":")) return false;
  const name = segment.slice(1);
  return /^[\w-]+$/.test(name);
}

function routeParameterName(segment: string) {
  if (isCurlyParameter(segment)) {
    const parameter = segment.slice(1, -1);
    const separator = parameter.indexOf(":");
    const name = separator < 0 ? parameter : parameter.slice(0, separator);
    const constraint = separator < 0 ? undefined : parameter.slice(separator + 1);
    return name && (constraint === undefined || constraint.length > 0) ? name : undefined;
  }
  return isColonParameter(segment) ? segment.slice(1) : undefined;
}

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value && typeof value === "object");
}

function postmanText(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return `${value}`;
  return Array.isArray(value) ? value.join(",") : "[object Object]";
}

function matchesEndpointUrl(requestValue: string, service: Service, endpoint: Endpoint) {
  try {
    const requestUrl = new URL(requestValue);
    const endpointUrl = new URL(
      endpoint.url,
      `${service.baseUrl.slice(0, trimTrailingSlashes(service.baseUrl))}/`,
    );
    if (
      requestUrl.origin !== endpointUrl.origin ||
      normalizedQuery(requestUrl) !== normalizedQuery(endpointUrl)
    )
      return false;

    const requestPath = pathSegments(requestUrl);
    const endpointPath = pathSegments(endpointUrl);
    return (
      requestPath.length === endpointPath.length &&
      endpointPath.every((segment, index) =>
        isRouteParameter(segment)
          ? true
          : !isPostmanPathVariable(requestPath[index] ?? "") && segment === requestPath[index],
      )
    );
  } catch {
    return false;
  }
}

function routeParameters(requestValue: string, service: Service, endpoint: Endpoint) {
  const requestUrl = new URL(requestValue);
  const endpointUrl = new URL(
    endpoint.url,
    `${service.baseUrl.slice(0, trimTrailingSlashes(service.baseUrl))}/`,
  );
  const requestPath = pathSegments(requestUrl);
  const endpointPath = pathSegments(endpointUrl);
  const values: Record<string, string> = {};
  endpointPath.forEach((segment, index) => {
    const name = routeParameterName(segment);
    if (name) values[name] = requestPath[index] ?? "";
  });
  return values;
}

function rawRequestUrl(url: unknown): string {
  if (typeof url === "string") return url;
  if (!url || typeof url !== "object") return "";
  const value = url as {
    raw?: unknown;
    protocol?: unknown;
    host?: unknown;
    port?: unknown;
    path?: unknown;
    query?: { key?: unknown; value?: unknown }[];
  };
  if (typeof value.raw === "string") return value.raw;
  if (typeof value.protocol !== "string") return "";

  let host = "";
  if (Array.isArray(value.host)) host = value.host.join(".");
  else if (typeof value.host === "string") host = value.host;
  const port = typeof value.port === "string" && value.port ? `:${value.port}` : "";
  const path = Array.isArray(value.path) ? value.path.join("/") : "";
  const query = (value.query ?? [])
    .filter((entry) => typeof entry.key === "string")
    .map((entry) => {
      const value = entry.value;
      const text =
        typeof value === "string" || typeof value === "number" || typeof value === "boolean"
          ? String(value)
          : "";
      return `${encodeURIComponent(entry.key as string)}=${encodeURIComponent(text)}`;
    })
    .join("&");
  const queryString = query ? `?${query}` : "";
  return `${value.protocol}://${host}${port}/${path}${queryString}`;
}

function readCollection(text: string) {
  const collection: unknown = JSON.parse(text);
  if (!isRecord(collection) || !isRecord(collection.info) || !Array.isArray(collection.item)) {
    throw new Error("This is not a Postman collection");
  }
  return collection;
}

function readVariables(collection: RecordValue) {
  const variables = new Map<string, string>();
  if (!Array.isArray(collection.variable)) return variables;

  for (const variable of collection.variable) {
    const value = isRecord(variable) ? variable.value : undefined;
    if (
      isRecord(variable) &&
      typeof variable.key === "string" &&
      (typeof value === "string" || typeof value === "number" || typeof value === "boolean") &&
      variable.enabled !== false
    ) {
      variables.set(variable.key, String(value));
    }
  }
  return variables;
}

function readRequestBody(body: unknown) {
  const requestBody = isRecord(body) ? (body as { mode?: string; raw?: unknown }) : undefined;
  const bodyMode = requestBody?.mode;
  const rawBody = requestBody?.raw;
  if (body && !["raw", "none", undefined].includes(bodyMode)) {
    return { requestJson: "{}", unsupportedBody: true };
  }
  if (bodyMode !== "raw" || rawBody == null || rawBody === "") {
    return { requestJson: "{}", unsupportedBody: false };
  }
  try {
    return {
      requestJson: JSON.stringify(
        typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody,
        null,
        2,
      ),
      unsupportedBody: false,
    };
  } catch {
    return { requestJson: "{}", unsupportedBody: true };
  }
}

function readRequest(
  item: RecordValue,
  variables: Map<string, string>,
  inheritedUnsupported: string[],
): PostmanRequest | undefined {
  if (!isRecord(item.request)) return undefined;
  const request = item.request;
  const originalUrl = rawRequestUrl(request.url);
  const matchUrl = originalUrl.replace(
    /\{\{([^{}]+)\}\}/g,
    (token, key: string) => variables.get(key) ?? token,
  );
  const name = typeof item.name === "string" && item.name.trim() ? item.name : originalUrl;
  const headers: { name: string; value: string }[] = [];
  const unsupportedFeatures = [...inheritedUnsupported];
  if (isRecord(request.auth) && request.auth.type !== "noauth")
    unsupportedFeatures.push("request authorization");
  if (Array.isArray(request.header)) {
    for (const rawHeader of request.header) {
      if (!isRecord(rawHeader) || rawHeader.disabled === true) continue;
      if (typeof rawHeader.key !== "string" || typeof rawHeader.value !== "string") {
        unsupportedFeatures.push("invalid or protected header (unsupported value)");
        continue;
      }
      const header = { name: rawHeader.key, value: rawHeader.value };
      try {
        // Validate each row so one invalid import does not discard its valid siblings.
        validateHeaderRows([...headers, header], "Imported header");
        headers.push(header);
      } catch {
        unsupportedFeatures.push(`invalid or protected header ${header.name || "(blank)"}`);
      }
    }
  }
  return {
    name,
    method: postmanText(request.method || "GET").toUpperCase(),
    url: matchUrl,
    originalUrl,
    matchUrl,
    headers,
    unsupportedFeatures,
    ...readRequestBody(request.body),
  };
}

function collectRequests(
  items: unknown[],
  variables: Map<string, string>,
  requests: PostmanRequest[],
  inheritedUnsupported: string[] = [],
) {
  for (const item of items) {
    if (!isRecord(item)) continue;
    const unsupported = [...inheritedUnsupported];
    if (item.auth) unsupported.push("inherited authorization");
    if (Array.isArray(item.event) && item.event.length) unsupported.push("scripts");
    if (Array.isArray(item.item)) collectRequests(item.item, variables, requests, unsupported);
    const request = readRequest(item, variables, unsupported);
    if (request) requests.push(request);
  }
}

function matchRequest(
  request: PostmanRequest,
  endpoints: { service: Service; endpoint: Endpoint }[],
  environmentVariables: Map<string, string>,
) {
  const url = request.matchUrl.replace(
    /\{\{([^{}]+)\}\}/g,
    (token, key: string) => environmentVariables.get(key) ?? token,
  );
  const urlMatches = endpoints.filter(({ service, endpoint }) =>
    matchesEndpointUrl(url, service, endpoint),
  );
  if (request.unsupportedBody)
    return { warning: `Skipped "${request.name}": request body is not JSON.` };
  const restMatches = urlMatches.filter(({ endpoint }) => endpoint.apiType === "REST");
  const matched = restMatches.find(
    ({ endpoint }) => endpoint.method.toUpperCase() === request.method,
  );
  const selected = matched ?? restMatches[0];
  const pathParameters = selected ? routeParameters(url, selected.service, selected.endpoint) : {};
  const draft: ImportedMockApi = {
    name: request.name,
    targetEndpointId: matched?.endpoint.id ?? null,
    description: "",
    requestJson: request.requestJson,
    pathParameters,
    customHeaders: request.headers,
    headerTemplateId: null,
    active: false,
    importMethod: request.method,
    importUrl: request.originalUrl,
    matchUrl: request.matchUrl,
  };
  const warnings = request.unsupportedFeatures.map((feature) => `${feature} is not imported.`);
  const missingVariables = new Set(
    findVariableReferences([
      request.matchUrl,
      request.requestJson,
      request.headers.map(({ value }) => value),
    ]).filter((name) => !environmentVariables.has(name)),
  );
  for (const name of missingVariables) warnings.push(`Uses missing variable {{${name}}}.`);
  if (!matched) {
    const reason = !urlMatches.length
      ? "URL did not match a registered REST endpoint"
      : !restMatches.length
        ? "matching endpoint is not REST"
        : `HTTP method ${request.method} did not match the endpoint`;
    warnings.push(`${reason}.`);
  }
  return {
    draft,
    warnings: warnings.map((warning) => `"${request.name}": ${warning}`),
  };
}

export function parsePostmanCollection(
  text: string,
  services: Service[],
  environmentEntries: { name: string; value: string }[] = [],
): PostmanImportResult {
  const collection = readCollection(text);
  const variables = readVariables(collection);
  const currentVariableNames = new Set(environmentEntries.map(({ name }) => name));
  const collectionFallback = new Map(
    [...variables].filter(([name]) => !currentVariableNames.has(name)),
  );
  const requests: PostmanRequest[] = [];
  const inheritedUnsupported = [
    ...(collection.auth ? ["inherited authorization"] : []),
    ...(Array.isArray(collection.event) && collection.event.length ? ["scripts"] : []),
  ];
  collectRequests(collection.item as unknown[], collectionFallback, requests, inheritedUnsupported);
  if (!requests.length) throw new Error("No requests found in this Postman collection");

  const endpoints = services.flatMap((service) =>
    service.endpoints.map((endpoint) => ({ service, endpoint })),
  );
  const drafts: ImportedMockApi[] = [];
  const warnings: string[] = [];
  const environmentVariables = new Map(environmentEntries.map(({ name, value }) => [name, value]));
  for (const request of requests) {
    const result = matchRequest(request, endpoints, environmentVariables);
    if (result.draft) drafts.push(result.draft);
    if ("warning" in result && result.warning) warnings.push(result.warning);
    warnings.push(...(result.warnings ?? []));
  }

  return { drafts, warnings };
}

export function retryUnmatchedPostmanDrafts<
  T extends {
    name: string;
    targetEndpointId: string | null;
    importMethod?: string | null;
    importUrl?: string | null;
    matchUrl?: string | null;
    requestJson: unknown;
    customHeaders?: { name: string; value: string }[];
    pathParameters: Record<string, string>;
  },
>(drafts: T[], services: Service[], environmentEntries: { name: string; value: string }[]) {
  const endpoints = services.flatMap((service) =>
    service.endpoints.map((endpoint) => ({ service, endpoint })),
  );
  const variables = new Map(environmentEntries.map(({ name, value }) => [name, value]));
  return drafts.map((draft) => {
    if (draft.targetEndpointId || !draft.importUrl) return draft;
    const result = matchRequest(
      {
        name: draft.name,
        method: draft.importMethod ?? "GET",
        url: draft.matchUrl ?? draft.importUrl,
        requestJson:
          typeof draft.requestJson === "string"
            ? draft.requestJson
            : JSON.stringify(draft.requestJson),
        unsupportedBody: false,
        originalUrl: draft.importUrl,
        matchUrl: draft.matchUrl ?? draft.importUrl,
        headers: draft.customHeaders ?? [],
        unsupportedFeatures: [],
      },
      endpoints,
      variables,
    );
    return result.draft ? { ...draft, ...result.draft, active: false } : draft;
  });
}
