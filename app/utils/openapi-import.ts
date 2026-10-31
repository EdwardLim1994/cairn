export type ServiceEndpointDraft = {
  id?: string;
  name: string;
  apiType: "REST";
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
};

export type OpenApiImportResult = {
  endpoints: ServiceEndpointDraft[];
  warnings: string[];
};

const supportedMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const operationMethods = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];
type SupportedMethod = (typeof supportedMethods)[number];

function parseOperation(
  path: string,
  methodKey: string,
  operation: unknown,
  knownKeys: Set<string>,
): { endpoint?: ServiceEndpointDraft; warning?: string } | undefined {
  if (!operation || typeof operation !== "object") return undefined;

  const method = methodKey.toUpperCase();
  const url = path.startsWith("/") ? path : `/${path}`;
  const normalizedUrl = normalizePath(url);
  if (!supportedMethods.includes(method as SupportedMethod)) {
    return { warning: `Skipped ${method} ${normalizedUrl}: this HTTP method is not supported.` };
  }

  const key = `${method} ${normalizedUrl}`;
  if (knownKeys.has(key)) {
    return { warning: `Skipped duplicate ${key}: this endpoint is already registered.` };
  }

  const details = operation as { summary?: unknown; operationId?: unknown };
  const summary = typeof details.summary === "string" ? details.summary.trim() : "";
  const operationId = typeof details.operationId === "string" ? details.operationId.trim() : "";
  knownKeys.add(key);
  return {
    endpoint: {
      name: summary || operationId || `${method} ${url}`,
      apiType: "REST",
      method: method as SupportedMethod,
      url,
    },
  };
}

function normalizePath(path: string) {
  let normalizedPath = path.startsWith("/") ? path : `/${path}`;
  while (normalizedPath.length > 1 && normalizedPath.endsWith("/"))
    normalizedPath = normalizedPath.slice(0, -1);
  return normalizedPath;
}

export async function parseOpenApiEndpoints(
  text: string,
  existingEndpoints: ServiceEndpointDraft[],
): Promise<OpenApiImportResult> {
  const { validate } = await import("@scalar/openapi-parser");
  const parsed = await validate(text);
  if (!parsed.valid) {
    const details = parsed.errors
      .map(({ message }) => message)
      .filter(Boolean)
      .slice(0, 3)
      .join(" ");
    throw new Error(
      details
        ? `Could not import OpenAPI document: ${details}`
        : "Could not import OpenAPI document",
    );
  }

  const knownKeys = new Set(
    existingEndpoints.map(({ method, url }) => `${method.toUpperCase()} ${normalizePath(url)}`),
  );
  const endpoints: ServiceEndpointDraft[] = [];
  const warnings: string[] = [];
  const paths = parsed.schema.paths ?? {};

  for (const [path, pathItem] of Object.entries(paths)) {
    for (const methodKey of operationMethods) {
      const operation = pathItem[methodKey as keyof typeof pathItem];
      const result = parseOperation(path, methodKey, operation, knownKeys);
      if (result?.endpoint) endpoints.push(result.endpoint);
      if (result?.warning) warnings.push(result.warning);
    }
  }

  return { endpoints, warnings };
}
