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
};
type RecordValue = Record<string, unknown>;

export type ImportedMockApi = {
  name: string;
  targetEndpointId: string;
  description: string;
  requestJson: string;
  pathParameters: Record<string, string>;
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
    const value = isRecord(variable) ? postmanText(variable.value) : "";
    if (
      isRecord(variable) &&
      typeof variable.key === "string" &&
      "value" in variable &&
      variable.value != null &&
      value !== ""
    ) {
      variables.set(variable.key, value);
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
): PostmanRequest | undefined {
  if (!isRecord(item.request)) return undefined;
  const request = item.request;
  const url = rawRequestUrl(request.url).replace(
    /\{\{([^{}]+)\}\}/g,
    (token, key: string) => variables.get(key) ?? token,
  );
  const name = typeof item.name === "string" && item.name.trim() ? item.name : url;
  return {
    name,
    method: postmanText(request.method || "GET").toUpperCase(),
    url,
    ...readRequestBody(request.body),
  };
}

function collectRequests(
  items: unknown[],
  variables: Map<string, string>,
  requests: PostmanRequest[],
) {
  for (const item of items) {
    if (!isRecord(item)) continue;
    if (Array.isArray(item.item)) collectRequests(item.item, variables, requests);
    const request = readRequest(item, variables);
    if (request) requests.push(request);
  }
}

function matchRequest(
  request: PostmanRequest,
  endpoints: { service: Service; endpoint: Endpoint }[],
) {
  const urlMatches = endpoints.filter(({ service, endpoint }) =>
    matchesEndpointUrl(request.url, service, endpoint),
  );
  const matched = urlMatches.find(
    ({ endpoint }) =>
      endpoint.apiType === "REST" && endpoint.method.toUpperCase() === request.method,
  );
  if (matched?.endpoint.id && !request.unsupportedBody) {
    return {
      draft: {
        name: request.name,
        targetEndpointId: matched.endpoint.id,
        description: "",
        requestJson: request.requestJson,
        pathParameters: routeParameters(request.url, matched.service, matched.endpoint),
      } satisfies ImportedMockApi,
    };
  }
  if (!urlMatches.length) {
    return { warning: `Skipped "${request.name}": URL did not match a registered REST endpoint.` };
  }
  if (!urlMatches.some(({ endpoint }) => endpoint.apiType === "REST")) {
    return { warning: `Skipped "${request.name}": matching endpoint is not REST.` };
  }
  if (!urlMatches.some(({ endpoint }) => endpoint.method.toUpperCase() === request.method)) {
    return {
      warning: `Skipped "${request.name}": HTTP method ${request.method} did not match the endpoint.`,
    };
  }
  return { warning: `Skipped "${request.name}": request body is not JSON.` };
}

export function parsePostmanCollection(text: string, services: Service[]): PostmanImportResult {
  const collection = readCollection(text);
  const variables = readVariables(collection);
  const requests: PostmanRequest[] = [];
  collectRequests(collection.item as unknown[], variables, requests);
  if (!requests.length) throw new Error("No requests found in this Postman collection");

  const endpoints = services.flatMap((service) =>
    service.endpoints.map((endpoint) => ({ service, endpoint })),
  );
  const drafts: ImportedMockApi[] = [];
  const warnings: string[] = [];
  for (const request of requests) {
    const result = matchRequest(request, endpoints);
    if (result.draft) drafts.push(result.draft);
    if (result.warning) warnings.push(result.warning);
  }

  return { drafts, warnings };
}
