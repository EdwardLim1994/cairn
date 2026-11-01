import { createError } from "h3";
import { validateHeaderRows } from "#shared/utils/headers";

export type EndpointInput = {
  id?: string;
  name: string;
  apiType: string;
  method: string;
  url: string;
};

export type ServiceInput = {
  name: string;
  framework: string;
  baseUrl: string;
  healthCheckUrl: string | null;
  healthCheckHeaderTemplateId: string | null;
  healthCheckCustomHeaders: Array<{ name: string; value: string }>;
  active: boolean;
  endpoints: EndpointInput[];
};

const methods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

export function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw createError({ statusCode: 400, statusMessage: `${label} must be an object` });
  }
  return value as Record<string, unknown>;
}

function requiredText(value: unknown, label: string, maxLength = 255): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw createError({
      statusCode: 400,
      statusMessage: `${label} is required and must be at most ${maxLength} characters`,
    });
  }
  return value.trim();
}

export function httpUrl(value: unknown, label: string): string {
  const text = requiredText(value, label, 2048);
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: `${label} must be a valid HTTP or HTTPS URL`,
    });
  }
  if (!new Set(["http:", "https:"]).has(url.protocol) || url.username || url.password) {
    throw createError({
      statusCode: 400,
      statusMessage: `${label} must be a valid HTTP or HTTPS URL without credentials`,
    });
  }
  return url.toString().replace(/\/$/, "");
}

function endpointPath(value: unknown): string {
  const text = requiredText(value, "Endpoint URL", 2048);
  if (/^https?:\/\//i.test(text)) return httpUrl(text, "Endpoint URL");
  if (!text.startsWith("/") || text.startsWith("//")) {
    throw createError({
      statusCode: 400,
      statusMessage: "Endpoint URL must be an absolute HTTP URL or begin with /",
    });
  }
  return text;
}

function endpoint(value: unknown): EndpointInput {
  const input = record(value, "Endpoint");
  const method = requiredText(input.method, "Endpoint method", 10).toUpperCase();
  if (!methods.has(method))
    throw createError({ statusCode: 400, statusMessage: "Unsupported REST method" });
  if (input.apiType !== "REST")
    throw createError({ statusCode: 400, statusMessage: "Only REST endpoints are supported" });
  return {
    id: typeof input.id === "string" ? input.id : undefined,
    name: requiredText(input.name, "Endpoint name"),
    apiType: "REST",
    method,
    url: endpointPath(input.url),
  };
}

export function serviceInput(value: unknown): ServiceInput {
  const input = record(value, "Service");
  if (!Array.isArray(input.endpoints))
    throw createError({ statusCode: 400, statusMessage: "Endpoints must be an array" });
  let healthCheckUrl: string | null = null;
  if (input.healthCheckUrl != null && input.healthCheckUrl !== "") {
    const value = requiredText(input.healthCheckUrl, "Health-check URL", 2048);
    if (/^https?:\/\//i.test(value)) healthCheckUrl = httpUrl(value, "Health-check URL");
    else if (value.startsWith("/") && !value.startsWith("//")) healthCheckUrl = value;
    else
      throw createError({
        statusCode: 400,
        statusMessage: "Health-check URL must be an HTTP(S) URL or begin with /",
      });
  }
  const healthCheckCustomHeaders = input.healthCheckCustomHeaders ?? [];
  if (!Array.isArray(healthCheckCustomHeaders))
    throw createError({ statusCode: 400, statusMessage: "Health-check headers must be an array" });
  try {
    validateHeaderRows(
      healthCheckCustomHeaders as Array<{ name: string; value: string }>,
      "Custom header",
    );
  } catch (error) {
    throw createError({ statusCode: 400, statusMessage: (error as Error).message });
  }
  const templateId = input.healthCheckHeaderTemplateId;
  if (templateId != null && typeof templateId !== "string")
    throw createError({
      statusCode: 400,
      statusMessage: "Health-check header template is invalid",
    });
  return {
    name: requiredText(input.name, "Service name"),
    framework: requiredText(input.framework, "Framework", 100),
    baseUrl: httpUrl(input.baseUrl, "Base URL"),
    healthCheckUrl,
    healthCheckHeaderTemplateId: typeof templateId === "string" && templateId ? templateId : null,
    healthCheckCustomHeaders: healthCheckCustomHeaders as Array<{ name: string; value: string }>,
    active: input.active === undefined ? true : Boolean(input.active),
    endpoints: input.endpoints.map(endpoint),
  };
}

export function finiteNumber(value: unknown, label: string, fallback: number): number {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(number))
    throw createError({ statusCode: 400, statusMessage: `${label} must be a finite number` });
  return number;
}
