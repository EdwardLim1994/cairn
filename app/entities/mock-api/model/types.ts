import type { AuthorizationTemplateInput } from "#shared/api/mock-apis";

export type MockApiDraft = {
  id?: string;
  name: string;
  apiType?: "HTTP" | "GRPC" | "WEBSOCKET";
  targetEndpointId: string | null;
  headerTemplateId?: string | null;
  authorizationTemplateId?: string | null;
  customHeaders?: Array<{ name: string; value: string }>;
  active?: boolean;
  status?: "draft" | "inactive" | "ready";
  readinessReasons?: Array<{ code: string; message: string }>;
  description: string;
  requestJson: unknown;
  pathParameters: Record<string, string>;
};

export type EnvironmentVariable = {
  id: string;
  name: string;
  value: string;
  pendingCreate?: boolean;
};

export type EnvironmentVariableValues = Record<string, { name: string; value: string }>;

export type HeaderTemplateDraft = {
  id: string;
  name: string;
  headers: Array<{ name: string; value: string }>;
  pendingCreate?: boolean;
};

export type AuthorizationTemplateDraft = AuthorizationTemplateInput & {
  id: string;
  pendingCreate?: boolean;
};

export type MockApiRunResult = {
  id: string;
  status: string;
  responseStatus: number | null;
  grpcStatus?: number | null;
  grpcStatusName?: string | null;
  responseBody: string | null;
  error: string | null;
  traceId: string;
  totalDurationMs?: number | null;
  telemetryState?: "available" | "unavailable" | "expired" | "partial";
  flow?: {
    status: string;
    incomplete: boolean;
    telemetryState?: "available" | "unavailable" | "expired" | "partial";
  };
};
