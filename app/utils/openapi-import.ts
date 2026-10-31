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

function normalizePath(path: string) {
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  return withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, "") : withLeadingSlash;
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
      if (!operation || typeof operation !== "object") continue;

      const method = methodKey.toUpperCase();
      const url = path.startsWith("/") ? path : `/${path}`;
      const normalizedUrl = normalizePath(url);
      if (!supportedMethods.includes(method as SupportedMethod)) {
        warnings.push(`Skipped ${method} ${normalizedUrl}: this HTTP method is not supported.`);
        continue;
      }

      const key = `${method} ${normalizedUrl}`;
      if (knownKeys.has(key)) {
        warnings.push(`Skipped duplicate ${key}: this endpoint is already registered.`);
        continue;
      }

      const details = operation as { summary?: unknown; operationId?: unknown };
      const summary = typeof details.summary === "string" ? details.summary.trim() : "";
      const operationId = typeof details.operationId === "string" ? details.operationId.trim() : "";
      endpoints.push({
        name: summary || operationId || `${method} ${url}`,
        apiType: "REST",
        method: method as SupportedMethod,
        url,
      });
      knownKeys.add(key);
    }
  }

  return { endpoints, warnings };
}
