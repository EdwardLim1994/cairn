import { createError } from "h3";
import { record } from "./graph-validation";

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
    requestJson,
  };
}
