import { describe, expect, it } from "vite-plus/test";
import * as Canvas from "./canvas";
import { canvasGetResponseSchema, canvasPutRequestSchema, canvasPutResponseSchema } from "./canvas";
import * as EnvironmentVariables from "./environment-variables";
import {
  environmentVariableCreateRequestSchema,
  environmentVariableListResponseSchema,
} from "./environment-variables";
import { mockApiCreateRequestSchema, mockApiRunResponseSchema } from "./mock-apis";
import * as MockApis from "./mock-apis";
import * as Observability from "./observability";
import {
  logListRequestSchema,
  logListResponseSchema,
  otlpIngestResponseSchema,
  otlpLogsRequestSchema,
  otlpTracesRequestSchema,
  runFlowResponseSchema,
  runGetResponseSchema,
} from "./observability";
import {
  serviceCreateRequestSchema,
  serviceHealthResponseSchema,
  serviceListResponseSchema,
} from "./services";
import * as Services from "./services";

const date = "2026-10-30T10:00:00.000Z";

const validService = {
  id: "service-1",
  projectId: "project-1",
  name: "Orders",
  framework: "Spring Boot",
  baseUrl: "http://localhost:8080",
  healthCheckUrl: null,
  healthCheckHeaderTemplateId: null,
  healthCheckCustomHeaders: [],
  active: true,
  positionX: 0,
  positionY: 0,
  createdAt: date,
  endpoints: [],
};
const validMockApi = {
  id: "mock-1",
  projectId: "project-1",
  name: "List orders",
  targetEndpointId: "endpoint-1",
  headerTemplateId: null,
  customHeaders: [],
  active: true,
  status: "ready",
  readinessReasons: [],
  importMethod: null,
  importUrl: null,
  matchUrl: null,
  pathParameters: {},
  requestJson: {},
  description: "",
  createdAt: date,
};
const validEnvironmentVariable = {
  id: "variable-1",
  projectId: "project-1",
  name: "API_KEY",
  value: "value",
  createdAt: date,
};
const validLog = {
  id: 1,
  projectId: "project-1",
  traceId: null,
  serviceName: "Orders",
  severity: "INFO",
  timestamp: date,
  message: "request complete",
  attributes: {},
  receivedAt: date,
};
const validRun = {
  id: "run-1",
  projectId: "project-1",
  mockApiId: "mock-1",
  traceId: "trace-1",
  status: "completed",
  responseStatus: 200,
  responseHeaders: {},
  responseBody: "{}",
  error: null,
  startedAt: date,
  finishedAt: date,
  lastTelemetryAt: null,
};
const validFlow = {
  runId: "run-1",
  traceId: "trace-1",
  runStatus: "completed",
  status: "complete",
  incomplete: false,
  spans: [],
  edges: [],
  errorServices: [],
};
const validCanvas = {
  viewport: { x: 0, y: 0, zoom: 1 },
  mockNode: { x: 1, y: 2 },
  services: [validService],
  edges: [],
  mockApis: [validMockApi],
  headerTemplates: [],
};
const validServiceInput = {
  name: "Orders",
  framework: "Spring Boot",
  baseUrl: "http://localhost:8080",
  healthCheckUrl: null,
  healthCheckHeaderTemplateId: null,
  healthCheckCustomHeaders: [],
  endpoints: [],
};
const validMockApiInput = {
  name: "List orders",
  targetEndpointId: "endpoint-1",
  requestJson: {},
};
const validEnvironmentVariableInput = { name: "API_KEY", value: "value" };
const validId = { id: "id-1" };

const routeContracts: {
  name: string;
  schema: { safeParse(value: unknown): { success: boolean } };
  value: unknown;
}[] = [
  { name: "canvas GET request", schema: Canvas.canvasGetRequestSchema, value: undefined },
  { name: "canvas GET response", schema: Canvas.canvasGetResponseSchema, value: validCanvas },
  {
    name: "canvas PUT request",
    schema: Canvas.canvasPutRequestSchema,
    value: { viewport: { x: 0, y: 0, zoom: 1 }, mockNode: { x: 1, y: 2 }, services: [], edges: [] },
  },
  { name: "canvas PUT response", schema: Canvas.canvasPutResponseSchema, value: { saved: true } },
  { name: "service list request", schema: Services.serviceListRequestSchema, value: undefined },
  {
    name: "service list response",
    schema: Services.serviceListResponseSchema,
    value: [validService],
  },
  {
    name: "service create request",
    schema: Services.serviceCreateRequestSchema,
    value: validServiceInput,
  },
  { name: "service create response", schema: Services.serviceCreateResponseSchema, value: validId },
  { name: "service update id request", schema: Services.serviceIdRequestSchema, value: validId },
  {
    name: "service update body request",
    schema: Services.serviceUpdateRequestSchema,
    value: validServiceInput,
  },
  { name: "service update response", schema: Services.serviceUpdateResponseSchema, value: validId },
  { name: "service delete id request", schema: Services.serviceIdRequestSchema, value: validId },
  { name: "service delete response", schema: Services.serviceDeleteResponseSchema, value: validId },
  { name: "service health request", schema: Services.serviceHealthRequestSchema, value: undefined },
  {
    name: "service health response",
    schema: Services.serviceHealthResponseSchema,
    value: [{ id: "service-1", online: true }],
  },
  { name: "mock API list request", schema: MockApis.mockApiListRequestSchema, value: undefined },
  {
    name: "mock API list response",
    schema: MockApis.mockApiListResponseSchema,
    value: [validMockApi],
  },
  {
    name: "mock API create request",
    schema: MockApis.mockApiCreateRequestSchema,
    value: validMockApiInput,
  },
  {
    name: "mock API create response",
    schema: MockApis.mockApiCreateResponseSchema,
    value: validId,
  },
  { name: "mock API update id request", schema: MockApis.mockApiIdRequestSchema, value: validId },
  {
    name: "mock API update body request",
    schema: MockApis.mockApiUpdateRequestSchema,
    value: validMockApiInput,
  },
  {
    name: "mock API update response",
    schema: MockApis.mockApiUpdateResponseSchema,
    value: validId,
  },
  { name: "mock API delete id request", schema: MockApis.mockApiIdRequestSchema, value: validId },
  {
    name: "mock API delete response",
    schema: MockApis.mockApiDeleteResponseSchema,
    value: validId,
  },
  { name: "mock API run id request", schema: MockApis.mockApiRunRequestSchema, value: validId },
  {
    name: "mock API run response",
    schema: MockApis.mockApiRunResponseSchema,
    value: {
      id: "run-1",
      traceId: "trace-1",
      status: "completed",
      responseStatus: 200,
      responseHeaders: {},
      responseBody: "{}",
      error: null,
    },
  },
  {
    name: "environment variable list request",
    schema: EnvironmentVariables.environmentVariableListRequestSchema,
    value: undefined,
  },
  {
    name: "environment variable list response",
    schema: EnvironmentVariables.environmentVariableListResponseSchema,
    value: [validEnvironmentVariable],
  },
  {
    name: "environment variable create request",
    schema: EnvironmentVariables.environmentVariableCreateRequestSchema,
    value: validEnvironmentVariableInput,
  },
  {
    name: "environment variable create response",
    schema: EnvironmentVariables.environmentVariableCreateResponseSchema,
    value: validId,
  },
  {
    name: "environment variable update id request",
    schema: EnvironmentVariables.environmentVariableIdRequestSchema,
    value: validId,
  },
  {
    name: "environment variable update body request",
    schema: EnvironmentVariables.environmentVariableUpdateRequestSchema,
    value: validEnvironmentVariableInput,
  },
  {
    name: "environment variable update response",
    schema: EnvironmentVariables.environmentVariableUpdateResponseSchema,
    value: validId,
  },
  {
    name: "environment variable delete id request",
    schema: EnvironmentVariables.environmentVariableIdRequestSchema,
    value: validId,
  },
  {
    name: "environment variable delete response",
    schema: EnvironmentVariables.environmentVariableDeleteResponseSchema,
    value: validId,
  },
  {
    name: "log list request",
    schema: Observability.logListRequestSchema,
    value: { service: "Orders", severity: "INFO", search: "request" },
  },
  { name: "log list response", schema: Observability.logListResponseSchema, value: [validLog] },
  { name: "run detail id request", schema: Observability.runGetRequestSchema, value: validId },
  { name: "run detail response", schema: Observability.runGetResponseSchema, value: validRun },
  { name: "run flow id request", schema: Observability.runFlowRequestSchema, value: validId },
  { name: "run flow response", schema: Observability.runFlowResponseSchema, value: validFlow },
  {
    name: "OTLP log request",
    schema: Observability.otlpLogsRequestSchema,
    value: { resourceLogs: [{}] },
  },
  {
    name: "OTLP trace request",
    schema: Observability.otlpTracesRequestSchema,
    value: { resourceSpans: [{}] },
  },
  {
    name: "OTLP ingest response",
    schema: Observability.otlpIngestResponseSchema,
    value: { accepted: 1 },
  },
];

describe("shared API contracts", () => {
  it.each(routeContracts)("accepts the $name contract sample", ({ schema, value }) => {
    expect(schema.safeParse(value).success).toBe(true);
  });

  it("accepts and rejects canvas save requests and responses", () => {
    const request = {
      viewport: { x: 1, y: 2, zoom: 1 },
      mockNode: { x: 3, y: 4 },
      services: [{ id: "service-1", x: 5, y: 6 }],
      edges: [{ sourceServiceId: "service-1", targetEndpointId: "endpoint-1" }],
    };
    expect(canvasPutRequestSchema.safeParse(request).success).toBe(true);
    expect(
      canvasPutRequestSchema.safeParse({ ...request, viewport: { x: 0, y: 0, zoom: 0 } }).success,
    ).toBe(false);
    expect(canvasPutResponseSchema.safeParse({ saved: true }).success).toBe(true);
    expect(canvasPutResponseSchema.safeParse({ saved: false }).success).toBe(false);
  });

  it("accepts canvas load response shape", () => {
    expect(
      canvasGetResponseSchema.safeParse({
        viewport: { x: 0, y: 0, zoom: 1 },
        mockNode: { x: 1, y: 2 },
        services: [
          {
            id: "service-1",
            projectId: "project-1",
            name: "Orders",
            framework: "Spring Boot",
            baseUrl: "http://localhost:8080",
            healthCheckUrl: null,
            healthCheckHeaderTemplateId: null,
            healthCheckCustomHeaders: [],
            active: true,
            positionX: 1,
            positionY: 2,
            createdAt: date,
            endpoints: [],
          },
        ],
        edges: [],
        mockApis: [],
        headerTemplates: [],
      }).success,
    ).toBe(true);
  });

  it("covers service create, list, and health response contracts", () => {
    expect(
      serviceCreateRequestSchema.safeParse({
        name: "Orders",
        framework: "Spring Boot",
        baseUrl: "http://localhost:8080",
        endpoints: [{ name: "List orders", apiType: "REST", method: "GET", url: "/orders" }],
      }).success,
    ).toBe(true);
    expect(
      serviceCreateRequestSchema.safeParse({
        name: "",
        framework: "Spring Boot",
        baseUrl: "http://localhost:8080",
        endpoints: [],
      }).success,
    ).toBe(false);
    const service = {
      id: "service-1",
      projectId: "project-1",
      name: "Orders",
      framework: "Spring Boot",
      baseUrl: "http://localhost:8080",
      healthCheckUrl: null,
      healthCheckHeaderTemplateId: null,
      healthCheckCustomHeaders: [],
      active: true,
      positionX: 0,
      positionY: 0,
      createdAt: date,
      endpoints: [],
    };
    expect(serviceListResponseSchema.safeParse([service]).success).toBe(true);
    expect(serviceHealthResponseSchema.safeParse([{ id: service.id, online: true }]).success).toBe(
      true,
    );
  });

  it("covers environment variable request and list response contracts", () => {
    expect(
      environmentVariableCreateRequestSchema.safeParse({ name: "API_KEY", value: "x" }).success,
    ).toBe(true);
    expect(
      environmentVariableCreateRequestSchema.safeParse({ name: "bad-name", value: "x" }).success,
    ).toBe(false);
    expect(
      environmentVariableListResponseSchema.safeParse([
        { id: "var-1", projectId: "project-1", name: "API_KEY", value: "x", createdAt: date },
      ]).success,
    ).toBe(true);
  });

  it("covers mock API creation and run response contracts", () => {
    expect(
      mockApiCreateRequestSchema.safeParse({
        name: "Get orders",
        targetEndpointId: "endpoint-1",
        requestJson: { limit: 3 },
      }).success,
    ).toBe(true);
    expect(mockApiCreateRequestSchema.safeParse({ name: "Missing endpoint" }).success).toBe(false);
    expect(
      mockApiRunResponseSchema.safeParse({
        id: "run-1",
        traceId: "trace-1",
        status: "failed",
        responseStatus: 400,
        responseHeaders: { "content-type": "text/plain" },
        responseBody: "invalid request",
        error: "Target returned HTTP 400",
      }).success,
    ).toBe(true);
  });

  it("covers log query/response, run, flow, and OTLP contracts", () => {
    expect(
      logListRequestSchema.safeParse({ service: ["Orders"], severity: ["ERROR"], search: "failed" })
        .success,
    ).toBe(true);
    expect(
      logListResponseSchema.safeParse([
        {
          id: 1,
          projectId: "project-1",
          traceId: null,
          serviceName: "Orders",
          severity: "ERROR",
          timestamp: date,
          message: "failed",
          attributes: {},
          receivedAt: date,
        },
      ]).success,
    ).toBe(true);
    expect(
      runGetResponseSchema.safeParse({
        id: "run-1",
        projectId: "project-1",
        mockApiId: null,
        traceId: "trace-1",
        status: "running",
        responseStatus: null,
        responseHeaders: null,
        responseBody: null,
        error: null,
        startedAt: date,
        finishedAt: null,
        lastTelemetryAt: null,
      }).success,
    ).toBe(true);
    expect(
      runFlowResponseSchema.safeParse({
        runId: "run-1",
        traceId: "trace-1",
        runStatus: "completed",
        status: "complete",
        incomplete: false,
        spans: [],
        edges: [],
        errorServices: [],
      }).success,
    ).toBe(true);
    expect(otlpLogsRequestSchema.safeParse({ resourceLogs: [{}] }).success).toBe(true);
    expect(otlpTracesRequestSchema.safeParse({ resourceSpans: [{}] }).success).toBe(true);
    expect(otlpLogsRequestSchema.safeParse({ resourceLogs: "invalid" }).success).toBe(false);
    expect(otlpIngestResponseSchema.safeParse({ accepted: 1 }).success).toBe(true);
  });
});
