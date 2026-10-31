import { describe, expect, it } from "vite-plus/test";
import type { ApiTransport, ApiTransportOptions } from "./api-client";
import { createApiClient } from "./api-client";

const canvas = {
  viewport: { x: 0, y: 0, zoom: 1 },
  mockNode: { x: 1, y: 2 },
  services: [],
  edges: [],
  mockApis: [],
  headerTemplates: [],
};
const requestBody = {
  name: "Orders",
  framework: "Spring Boot",
  baseUrl: "http://localhost:8080",
  active: true,
  endpoints: [],
};
const mockApiBody = { name: "List orders", targetEndpointId: "endpoint-1", requestJson: {} };
const run = {
  id: "run-1",
  traceId: "trace-1",
  status: "completed",
  responseStatus: 200,
  responseHeaders: {},
  responseBody: "{}",
  error: null,
};
const flow = {
  runId: "run-1",
  traceId: "trace-1",
  runStatus: "completed",
  status: "complete",
  incomplete: false,
  spans: [],
  edges: [],
  errorServices: [],
};

function responseFor(url: string, options: ApiTransportOptions): unknown {
  if (url === "/api/canvas" && options.method === "GET") return canvas;
  if (url === "/api/canvas") return { saved: true };
  if (url === "/api/services" && options.method === "GET") return [];
  if (url === "/api/services/health") return [];
  if (url === "/api/mock-apis" && options.method === "GET") return [];
  if (url === "/api/environment-variables" && options.method === "GET") return [];
  if (url === "/api/logs") return [];
  if (url.endsWith("/runs/run-1/flow")) return flow;
  if (url.endsWith("/runs")) return run;
  if (options.method === "DELETE" || options.method === "POST" || options.method === "PUT")
    return { id: "id-1" };
  return { id: "id-1" };
}

describe("typed API client", () => {
  it("validates each endpoint request and response through the shared contracts", async () => {
    const requests: { url: string; options: ApiTransportOptions }[] = [];
    const transport: ApiTransport = async (url, options) => {
      requests.push({ url, options });
      return responseFor(url, options);
    };
    const client = createApiClient(transport);

    await client.getCanvas();
    await client.saveCanvas({
      viewport: { x: 0, y: 0, zoom: 1 },
      mockNode: { x: 1, y: 2 },
      services: [],
      edges: [],
    });
    await client.listServices();
    await client.createService(requestBody);
    await client.updateService("service-1", requestBody);
    await client.deleteService("service/1");
    await client.checkServiceHealth();
    await client.listMockApis();
    await client.createMockApi(mockApiBody);
    await client.updateMockApi("mock-1", mockApiBody);
    await client.deleteMockApi("mock-1");
    await client.runMockApi("mock-1");
    await client.listEnvironmentVariables();
    await client.createEnvironmentVariable({ name: "API_KEY", value: "secret" });
    await client.updateEnvironmentVariable("variable-1", { name: "API_KEY", value: "secret" });
    await client.deleteEnvironmentVariable("variable-1");
    await client.listLogs({ service: ["Orders", "Inventory"], severity: ["ERROR"] });
    await client.getRunFlow("run-1");

    expect(requests).toHaveLength(18);
    expect(
      requests.find(({ url, options }) => url === "/api/canvas" && options.method === "PUT")
        ?.options,
    ).toMatchObject({
      method: "PUT",
      body: { viewport: { zoom: 1 } },
    });
    expect(requests.find(({ url }) => url === "/api/logs")?.options.query).toEqual({
      service: ["Orders", "Inventory"],
      severity: ["ERROR"],
    });
    expect(requests.some(({ url }) => url === "/api/services/service%2F1")).toBe(true);
  });

  it("defaults missing persisted canvas viewport fields for existing projects", async () => {
    const api = createApiClient(async (url) => {
      if (url === "/api/canvas") return { ...canvas, viewport: { x: 12 } };
      return responseFor(url, { method: "GET" });
    });

    await expect(api.getCanvas()).resolves.toMatchObject({
      viewport: { x: 12, y: 0, zoom: 1 },
    });
  });

  it("rejects malformed requests and invalid server responses", async () => {
    const client = createApiClient(async () => ({ saved: false }));
    await expect(
      client.saveCanvas({
        viewport: { x: 0, y: 0, zoom: 0 },
        mockNode: { x: 0, y: 0 },
        services: [],
        edges: [],
      }),
    ).rejects.toThrow();
    await expect(client.getCanvas()).rejects.toThrow();
  });
});
