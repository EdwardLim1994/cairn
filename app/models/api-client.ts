import { z } from "zod";
import {
  canvasGetRequestSchema,
  canvasGetResponseSchema,
  canvasPutRequestSchema,
  canvasPutResponseSchema,
} from "#shared/api/canvas";
import {
  environmentVariableCreateRequestSchema,
  environmentVariableCreateResponseSchema,
  environmentVariableDeleteResponseSchema,
  environmentVariableIdRequestSchema,
  environmentVariableListRequestSchema,
  environmentVariableListResponseSchema,
  environmentVariableUpdateRequestSchema,
  environmentVariableUpdateResponseSchema,
} from "#shared/api/environment-variables";
import {
  mockApiCreateRequestSchema,
  mockApiCreateResponseSchema,
  mockApiDeleteResponseSchema,
  mockApiIdRequestSchema,
  mockApiListRequestSchema,
  mockApiListResponseSchema,
  mockApiRunRequestSchema,
  mockApiRunResponseSchema,
  mockApiUpdateRequestSchema,
  mockApiUpdateResponseSchema,
} from "#shared/api/mock-apis";
import {
  logListRequestSchema,
  logListResponseSchema,
  runFlowRequestSchema,
  runFlowResponseSchema,
} from "#shared/api/observability";
import {
  serviceCreateRequestSchema,
  serviceCreateResponseSchema,
  serviceDeleteResponseSchema,
  serviceHealthRequestSchema,
  serviceHealthResponseSchema,
  serviceIdRequestSchema,
  serviceListRequestSchema,
  serviceListResponseSchema,
  serviceUpdateRequestSchema,
  serviceUpdateResponseSchema,
} from "#shared/api/services";

type Method = "GET" | "POST" | "PUT" | "DELETE";

export type ApiTransportOptions = {
  method: Method;
  body?: unknown;
  query?: unknown;
};

export type ApiTransport = (url: string, options: ApiTransportOptions) => Promise<unknown>;

export function createApiClient(transport: ApiTransport) {
  async function send<RequestSchema extends z.ZodType, ResponseSchema extends z.ZodType>(
    url: string,
    method: Method,
    input: z.input<RequestSchema>,
    requestSchema: RequestSchema,
    responseSchema: ResponseSchema,
  ): Promise<z.output<ResponseSchema>> {
    const request = requestSchema.parse(input);
    const transportOptions: ApiTransportOptions = { method };
    if (method === "GET") transportOptions.query = request;
    else if (method !== "DELETE") transportOptions.body = request;
    const response = await transport(url, transportOptions);
    return responseSchema.parse(response);
  }

  return {
    getCanvas: () =>
      send("/api/canvas", "GET", undefined, canvasGetRequestSchema, canvasGetResponseSchema),
    saveCanvas: (input: z.input<typeof canvasPutRequestSchema>) =>
      send("/api/canvas", "PUT", input, canvasPutRequestSchema, canvasPutResponseSchema),
    listServices: () =>
      send("/api/services", "GET", undefined, serviceListRequestSchema, serviceListResponseSchema),
    createService: (input: z.input<typeof serviceCreateRequestSchema>) =>
      send("/api/services", "POST", input, serviceCreateRequestSchema, serviceCreateResponseSchema),
    updateService: (rawId: string, input: z.input<typeof serviceUpdateRequestSchema>) => {
      const { id } = serviceIdRequestSchema.parse({ id: rawId });
      return send(
        `/api/services/${encodeURIComponent(id)}`,
        "PUT",
        input,
        serviceUpdateRequestSchema,
        serviceUpdateResponseSchema,
      );
    },
    deleteService: (rawId: string) => {
      const { id } = serviceIdRequestSchema.parse({ id: rawId });
      return send(
        `/api/services/${encodeURIComponent(id)}`,
        "DELETE",
        undefined,
        z.void(),
        serviceDeleteResponseSchema,
      );
    },
    checkServiceHealth: () =>
      send(
        "/api/services/health",
        "GET",
        undefined,
        serviceHealthRequestSchema,
        serviceHealthResponseSchema,
      ),
    listMockApis: () =>
      send("/api/mock-apis", "GET", undefined, mockApiListRequestSchema, mockApiListResponseSchema),
    createMockApi: (input: z.input<typeof mockApiCreateRequestSchema>) =>
      send(
        "/api/mock-apis",
        "POST",
        input,
        mockApiCreateRequestSchema,
        mockApiCreateResponseSchema,
      ),
    updateMockApi: (rawId: string, input: z.input<typeof mockApiUpdateRequestSchema>) => {
      const { id } = mockApiIdRequestSchema.parse({ id: rawId });
      return send(
        `/api/mock-apis/${encodeURIComponent(id)}`,
        "PUT",
        input,
        mockApiUpdateRequestSchema,
        mockApiUpdateResponseSchema,
      );
    },
    deleteMockApi: (rawId: string) => {
      const { id } = mockApiIdRequestSchema.parse({ id: rawId });
      return send(
        `/api/mock-apis/${encodeURIComponent(id)}`,
        "DELETE",
        undefined,
        z.void(),
        mockApiDeleteResponseSchema,
      );
    },
    runMockApi: (rawId: string) => {
      const { id } = mockApiRunRequestSchema.parse({ id: rawId });
      return send(
        `/api/mock-apis/${encodeURIComponent(id)}/runs`,
        "POST",
        undefined,
        z.void(),
        mockApiRunResponseSchema,
      );
    },
    listEnvironmentVariables: () =>
      send(
        "/api/environment-variables",
        "GET",
        undefined,
        environmentVariableListRequestSchema,
        environmentVariableListResponseSchema,
      ),
    createEnvironmentVariable: (input: z.input<typeof environmentVariableCreateRequestSchema>) =>
      send(
        "/api/environment-variables",
        "POST",
        input,
        environmentVariableCreateRequestSchema,
        environmentVariableCreateResponseSchema,
      ),
    updateEnvironmentVariable: (
      rawId: string,
      input: z.input<typeof environmentVariableUpdateRequestSchema>,
    ) => {
      const { id } = environmentVariableIdRequestSchema.parse({ id: rawId });
      return send(
        `/api/environment-variables/${encodeURIComponent(id)}`,
        "PUT",
        input,
        environmentVariableUpdateRequestSchema,
        environmentVariableUpdateResponseSchema,
      );
    },
    deleteEnvironmentVariable: (rawId: string) => {
      const { id } = environmentVariableIdRequestSchema.parse({ id: rawId });
      return send(
        `/api/environment-variables/${encodeURIComponent(id)}`,
        "DELETE",
        undefined,
        z.void(),
        environmentVariableDeleteResponseSchema,
      );
    },
    listLogs: (input: z.input<typeof logListRequestSchema>) =>
      send("/api/logs", "GET", input, logListRequestSchema, logListResponseSchema),
    getRunFlow: (rawId: string) => {
      const { id } = runFlowRequestSchema.parse({ id: rawId });
      return send(
        `/api/runs/${encodeURIComponent(id)}/flow`,
        "GET",
        { id },
        runFlowRequestSchema,
        runFlowResponseSchema,
      );
    },
  };
}
