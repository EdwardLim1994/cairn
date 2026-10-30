export type MockApiDraft = {
  id?: string;
  name: string;
  targetEndpointId: string | null;
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

export type MockApiRunResult = {
  id: string;
  status: string;
  responseStatus: number | null;
  responseBody: string | null;
  error: string | null;
  traceId: string;
  flow?: { status: string; incomplete: boolean };
};
