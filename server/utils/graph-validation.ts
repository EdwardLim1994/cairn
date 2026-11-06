import { createError } from "h3";
import { validateHeaderRows } from "#shared/utils/headers";

export type EndpointInput = {
  id?: string;
  codeKey?: string;
  name: string;
  method?: string | null;
  url?: string | null;
  rpcMethod?: string | null;
};

export type ServiceInput = {
  codeKey?: string;
  name: string;
  apiType: "REST" | "GRPC";
  framework: string;
  baseUrl: string;
  grpcTls: boolean;
  protoContent?: string | null;
  protoFileName?: string | null;
  clearProto?: boolean;
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

function optionalKey(value: unknown, label: string): string | undefined {
  return value === undefined ? undefined : requiredText(value, label, 128);
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

function endpoint(value: unknown, apiType: "REST" | "GRPC"): EndpointInput {
  const input = record(value, "Endpoint");
  const common = {
    id: typeof input.id === "string" ? input.id : undefined,
    codeKey: optionalKey(input.codeKey, "Endpoint key"),
    name: requiredText(input.name, "Endpoint name"),
  };
  if (apiType === "GRPC")
    return {
      ...common,
      method: null,
      url: null,
      rpcMethod: requiredText(input.rpcMethod, "RPC method", 512),
    };
  const method = requiredText(input.method, "Endpoint method", 10).toUpperCase();
  if (!methods.has(method))
    throw createError({ statusCode: 400, statusMessage: "Unsupported REST method" });
  return {
    ...common,
    method,
    url: endpointPath(input.url),
    rpcMethod: null,
  };
}

function healthCheckUrl(input: Record<string, unknown>): string | null {
  if (input.healthCheckUrl == null || input.healthCheckUrl === "") return null;
  const value = requiredText(input.healthCheckUrl, "Health-check URL", 2048);
  if (/^https?:\/\//i.test(value)) return httpUrl(value, "Health-check URL");
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  throw createError({
    statusCode: 400,
    statusMessage: "Health-check URL must be an HTTP(S) URL or begin with /",
  });
}

function healthHeaders(input: Record<string, unknown>) {
  const headers = input.healthCheckCustomHeaders ?? [];
  if (!Array.isArray(headers))
    throw createError({ statusCode: 400, statusMessage: "Health-check headers must be an array" });
  try {
    validateHeaderRows(headers as Array<{ name: string; value: string }>, "Custom header");
  } catch (error) {
    throw createError({ statusCode: 400, statusMessage: (error as Error).message });
  }
  return headers as Array<{ name: string; value: string }>;
}

function optionalNullableString(value: unknown) {
  if (typeof value === "string" || value === null) return value;
  return undefined;
}

export function serviceInput(value: unknown): ServiceInput {
  const input = record(value, "Service");
  if (!Array.isArray(input.endpoints))
    throw createError({ statusCode: 400, statusMessage: "Endpoints must be an array" });
  if (input.apiType !== undefined && input.apiType !== "REST" && input.apiType !== "GRPC")
    throw createError({ statusCode: 400, statusMessage: "Service API type must be REST or gRPC" });
  const apiType = input.apiType === "GRPC" ? "GRPC" : "REST";
  const baseUrl =
    apiType === "REST"
      ? httpUrl(input.baseUrl, "Base URL")
      : requiredText(input.baseUrl, "gRPC target", 2048);
  if (apiType === "GRPC" && !/^(?:\[[^\]]+\]|[^:/?#\s]+):\d{1,5}$/.test(baseUrl))
    throw createError({
      statusCode: 400,
      statusMessage: "Target address must use host:port format",
    });
  const parsedHealthCheckUrl = healthCheckUrl(input);
  const healthCheckCustomHeaders = healthHeaders(input);
  const templateId = input.healthCheckHeaderTemplateId;
  if (templateId != null && typeof templateId !== "string")
    throw createError({
      statusCode: 400,
      statusMessage: "Health-check header template is invalid",
    });
  return {
    codeKey: optionalKey(input.codeKey, "Service key"),
    name: requiredText(input.name, "Service name"),
    apiType,
    framework: requiredText(input.framework, "Framework", 100),
    baseUrl,
    grpcTls: Boolean(input.grpcTls),
    protoContent: optionalNullableString(input.protoContent),
    protoFileName: typeof input.protoFileName === "string" ? input.protoFileName : null,
    clearProto: input.clearProto === true,
    healthCheckUrl: parsedHealthCheckUrl,
    healthCheckHeaderTemplateId: typeof templateId === "string" && templateId ? templateId : null,
    healthCheckCustomHeaders: healthCheckCustomHeaders as Array<{ name: string; value: string }>,
    active: input.active === undefined ? true : Boolean(input.active),
    endpoints: input.endpoints.map((value) => endpoint(value, apiType)),
  };
}

export function finiteNumber(value: unknown, label: string, fallback: number): number {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(number))
    throw createError({ statusCode: 400, statusMessage: `${label} must be a finite number` });
  return number;
}
