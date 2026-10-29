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
  return url.pathname
    .replace(/\/+$/, "")
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

function normalizedQuery(url: URL) {
  return [...url.searchParams.entries()]
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey === rightKey ? leftValue.localeCompare(rightValue) : leftKey.localeCompare(rightKey),
    )
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

function isRouteParameter(segment: string) {
  return /^\{[^{}]+\}$/.test(segment) || /^:[\w-]+$/.test(segment);
}

function isPostmanPathVariable(segment: string) {
  return /^\{\{[^{}]+\}\}$/.test(segment);
}

function matchesEndpointUrl(requestValue: string, service: Service, endpoint: Endpoint) {
  try {
    const requestUrl = new URL(requestValue);
    const endpointUrl = new URL(endpoint.url, `${service.baseUrl.replace(/\/+$/, "")}/`);
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
  const endpointUrl = new URL(endpoint.url, `${service.baseUrl.replace(/\/+$/, "")}/`);
  const requestPath = pathSegments(requestUrl);
  const endpointPath = pathSegments(endpointUrl);
  const values: Record<string, string> = {};
  endpointPath.forEach((segment, index) => {
    const name =
      /^\{([^{}:]+)(?::[^{}]+)?\}$/.exec(segment)?.[1] ?? /^:([\w-]+)$/.exec(segment)?.[1];
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

  const host = Array.isArray(value.host)
    ? value.host.join(".")
    : typeof value.host === "string"
      ? value.host
      : "";
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
  return `${value.protocol}://${host}${port}/${path}${query ? `?${query}` : ""}`;
}

export function parsePostmanCollection(text: string, services: Service[]): PostmanImportResult {
  const collection: unknown = JSON.parse(text);
  if (
    !collection ||
    typeof collection !== "object" ||
    !("info" in collection) ||
    !collection.info ||
    typeof collection.info !== "object" ||
    !("item" in collection) ||
    !Array.isArray(collection.item)
  )
    throw new Error("This is not a Postman collection");

  const variables = new Map<string, string>();
  if ("variable" in collection && Array.isArray(collection.variable))
    for (const variable of collection.variable) {
      if (
        variable &&
        typeof variable === "object" &&
        "key" in variable &&
        typeof variable.key === "string" &&
        "value" in variable &&
        variable.value != null &&
        String(variable.value) !== ""
      )
        variables.set(variable.key, String(variable.value));
    }

  const requests: {
    name: string;
    method: string;
    url: string;
    requestJson: string;
    unsupportedBody: boolean;
  }[] = [];
  const visit = (items: unknown[]) => {
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const value = item as { item?: unknown[]; name?: unknown; request?: unknown };
      if (Array.isArray(value.item)) visit(value.item);
      if (!value.request || typeof value.request !== "object") continue;

      const request = value.request as {
        url?: unknown;
        method?: string;
        body?: { mode?: string; raw?: unknown };
      };
      const url = rawRequestUrl(request.url).replace(
        /\{\{([^{}]+)\}\}/g,
        (token, key: string) => variables.get(key) ?? token,
      );
      const bodyMode = request.body?.mode;
      const rawBody = request.body?.raw;
      let requestJson = "{}";
      let unsupportedBody = false;
      if (request.body && !["raw", "none", undefined].includes(bodyMode)) {
        unsupportedBody = true;
      } else if (bodyMode === "raw" && rawBody != null && rawBody !== "") {
        try {
          requestJson = JSON.stringify(
            typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody,
            null,
            2,
          );
        } catch {
          unsupportedBody = true;
        }
      }
      requests.push({
        name: typeof value.name === "string" && value.name.trim() ? value.name : url,
        method: String(request.method || "GET").toUpperCase(),
        url,
        requestJson,
        unsupportedBody,
      });
    }
  };
  visit(collection.item);
  if (!requests.length) throw new Error("No requests found in this Postman collection");

  const endpoints = services.flatMap((service) =>
    service.endpoints.map((endpoint) => ({ service, endpoint })),
  );
  const drafts: ImportedMockApi[] = [];
  const warnings: string[] = [];
  for (const request of requests) {
    const urlMatches = endpoints.filter(({ service, endpoint }) =>
      matchesEndpointUrl(request.url, service, endpoint),
    );
    const matched = urlMatches.find(
      ({ endpoint }) =>
        endpoint.apiType === "REST" && endpoint.method.toUpperCase() === request.method,
    );
    if (matched?.endpoint.id && !request.unsupportedBody) {
      drafts.push({
        name: request.name,
        targetEndpointId: matched.endpoint.id,
        description: "",
        requestJson: request.requestJson,
        pathParameters: routeParameters(request.url, matched.service, matched.endpoint),
      });
    } else if (!urlMatches.length) {
      warnings.push(`Skipped "${request.name}": URL did not match a registered REST endpoint.`);
    } else if (!urlMatches.some(({ endpoint }) => endpoint.apiType === "REST")) {
      warnings.push(`Skipped "${request.name}": matching endpoint is not REST.`);
    } else if (
      !urlMatches.some(({ endpoint }) => endpoint.method.toUpperCase() === request.method)
    ) {
      warnings.push(
        `Skipped "${request.name}": HTTP method ${request.method} did not match the endpoint.`,
      );
    } else {
      warnings.push(`Skipped "${request.name}": request body is not JSON.`);
    }
  }

  return { drafts, warnings };
}
