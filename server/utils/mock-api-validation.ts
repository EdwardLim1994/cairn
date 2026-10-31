import { createError } from "h3";
import { record } from "./graph-validation";

export function pathParameterNames(url: string): string[] {
  const route = url.split(/[?#]/, 1)[0] ?? url;
  return [...route.matchAll(/\{([A-Za-z_][\w-]*)(?::[^{}]+)?\}|:([A-Za-z_][\w-]*)/g)].map(
    (match) => match[1] ?? match[2]!,
  );
}

export function mockApiPathParameters(value: unknown): Record<string, string> {
  const input = value === undefined ? {} : record(value, "Path parameters");
  const result: Record<string, string> = {};
  for (const [name, pathValue] of Object.entries(input)) {
    if (!/^[A-Za-z_][\w-]*$/.test(name))
      throw createError({ statusCode: 400, statusMessage: `Invalid path parameter name: ${name}` });
    if (typeof pathValue !== "string")
      throw createError({
        statusCode: 400,
        statusMessage: `Path parameter "${name}" must be text`,
      });
    result[name] = pathValue;
  }
  return result;
}

export function validateEndpointPathParameters(
  parameters: Record<string, string>,
  endpointUrl: string,
) {
  const available = new Set(pathParameterNames(endpointUrl));
  const unknown = Object.keys(parameters).find((name) => !available.has(name));
  if (unknown)
    throw createError({ statusCode: 400, statusMessage: `Unknown path parameter: ${unknown}` });
}

export function mockApiInput(value: unknown) {
  const input = record(value, "Mock API");
  const targetEndpointId = input.targetEndpointId ?? null;
  if (targetEndpointId !== null && (typeof targetEndpointId !== "string" || !targetEndpointId))
    throw createError({ statusCode: 400, statusMessage: "Service endpoint is invalid" });
  if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 255)
    throw createError({ statusCode: 400, statusMessage: "Mock API name is required" });
  const description = input.description === undefined ? "" : input.description;
  if (typeof description !== "string")
    throw createError({ statusCode: 400, statusMessage: "Description must be text" });
  let requestJson: unknown;
  try {
    const encoded = JSON.stringify(input.requestJson ?? {});
    if (encoded === undefined) throw new Error("Mock API request cannot be serialized");
    requestJson = JSON.parse(encoded);
  } catch {
    throw createError({ statusCode: 400, statusMessage: "Mock API request must be valid JSON" });
  }
  const customHeaders = input.customHeaders ?? [];
  if (
    !Array.isArray(customHeaders) ||
    customHeaders.some(
      (header) =>
        !header ||
        typeof header !== "object" ||
        typeof header.name !== "string" ||
        typeof header.value !== "string",
    )
  )
    throw createError({
      statusCode: 400,
      statusMessage: "Custom headers must contain text names and values",
    });
  if (input.active !== undefined && typeof input.active !== "boolean")
    throw createError({ statusCode: 400, statusMessage: "Active must be a boolean" });
  if (input.headerTemplateId != null && typeof input.headerTemplateId !== "string")
    throw createError({ statusCode: 400, statusMessage: "Header template ID must be text" });
  for (const key of ["importMethod", "importUrl", "matchUrl"] as const)
    if (input[key] != null && typeof input[key] !== "string")
      throw createError({ statusCode: 400, statusMessage: `${key} must be text` });
  return {
    name: input.name.trim(),
    targetEndpointId,
    description,
    pathParameters: mockApiPathParameters(input.pathParameters),
    requestJson,
    headerTemplateId: input.headerTemplateId ?? null,
    customHeaders: input.customHeaders ?? [],
    active: input.active ?? targetEndpointId !== null,
    importMethod: input.importMethod ?? null,
    importUrl: input.importUrl ?? null,
    matchUrl: input.matchUrl ?? null,
  };
}
