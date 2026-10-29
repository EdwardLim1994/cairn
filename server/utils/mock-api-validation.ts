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
  if (typeof input.targetEndpointId !== "string" || !input.targetEndpointId)
    throw createError({ statusCode: 400, statusMessage: "A service endpoint is required" });
  if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 255)
    throw createError({ statusCode: 400, statusMessage: "Mock API name is required" });
  const description = input.description === undefined ? "" : input.description;
  if (typeof description !== "string")
    throw createError({ statusCode: 400, statusMessage: "Description must be text" });
  let requestJson: unknown;
  try {
    const encoded = JSON.stringify(input.requestJson ?? {});
    if (encoded === undefined) throw new Error();
    requestJson = JSON.parse(encoded);
  } catch {
    throw createError({ statusCode: 400, statusMessage: "Mock API request must be valid JSON" });
  }
  return {
    name: input.name.trim(),
    targetEndpointId: input.targetEndpointId,
    description,
    pathParameters: mockApiPathParameters(input.pathParameters),
    requestJson,
  };
}
