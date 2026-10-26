import { createError } from "h3";
import { httpUrl, record } from "./graph-validation";

const methods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

export function mockApiInput(value: unknown) {
  const input = record(value, "Mock API");
  const method = typeof input.method === "string" ? input.method.toUpperCase() : "";
  if (!methods.has(method))
    throw createError({ statusCode: 400, statusMessage: "Unsupported REST method" });
  if (typeof input.targetEndpointId !== "string" || !input.targetEndpointId)
    throw createError({ statusCode: 400, statusMessage: "A service endpoint is required" });
  if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 255)
    throw createError({ statusCode: 400, statusMessage: "Mock API name is required" });
  const description = input.description === undefined ? "" : input.description;
  if (typeof description !== "string")
    throw createError({ statusCode: 400, statusMessage: "Description must be text" });
  return {
    name: input.name.trim(),
    method,
    url: httpUrl(input.url, "Mock API URL"),
    targetEndpointId: input.targetEndpointId,
    description,
  };
}
