import { describe, expect, it } from "vite-plus/test";
import { parseOpenApiEndpoints } from "./openapi-import";

const existingEndpoints = [
  {
    id: "endpoint-1",
    name: "Existing items",
    apiType: "REST" as const,
    method: "GET" as const,
    url: "/items",
  },
];

describe("parseOpenApiEndpoints", () => {
  it("parses JSON and maps supported operations to REST endpoint drafts", async () => {
    const result = await parseOpenApiEndpoints(
      JSON.stringify({
        openapi: "3.1.0",
        info: { title: "Inventory", version: "1.0.0" },
        servers: [{ url: "https://ignored.example/api" }],
        paths: {
          "/items": { get: { summary: "List items" } },
          "/items/{id}": {
            post: {
              operationId: "createItem",
              parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
            },
          },
          "/items/replace": { put: { summary: "Replace item" } },
          "/items/modify": { patch: { summary: "Modify item" } },
          "/health": { delete: {} },
        },
      }),
      [],
    );

    expect(result.endpoints).toEqual([
      { name: "List items", apiType: "REST", method: "GET", url: "/items" },
      { name: "createItem", apiType: "REST", method: "POST", url: "/items/{id}" },
      { name: "Replace item", apiType: "REST", method: "PUT", url: "/items/replace" },
      { name: "Modify item", apiType: "REST", method: "PATCH", url: "/items/modify" },
      { name: "DELETE /health", apiType: "REST", method: "DELETE", url: "/health" },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("parses YAML and skips duplicates by method and normalized path", async () => {
    const result = await parseOpenApiEndpoints(
      [
        "openapi: 3.1.0",
        "info:",
        "  title: Inventory",
        "  version: 1.0.0",
        "paths:",
        "  /items/:",
        "    get:",
        "      summary: Renamed items",
        "    post:",
        "      summary: Create item",
      ].join("\n"),
      existingEndpoints,
    );

    expect(result.endpoints).toEqual([
      { name: "Create item", apiType: "REST", method: "POST", url: "/items/" },
    ]);
    expect(result.warnings).toEqual([
      "Skipped duplicate GET /items: this endpoint is already registered.",
    ]);
    expect(existingEndpoints[0]?.name).toBe("Existing items");
  });

  it("warns for unsupported methods and duplicate paths within the document", async () => {
    const result = await parseOpenApiEndpoints(
      JSON.stringify({
        openapi: "3.1.0",
        info: { title: "Inventory", version: "1.0.0" },
        paths: {
          "/items": {
            get: { summary: "First items" },
            head: { summary: "Head items" },
            options: {},
            trace: {},
          },
          "/items/": { get: { summary: "Duplicate items" } },
        },
      }),
      [],
    );

    expect(result.endpoints).toEqual([
      { name: "First items", apiType: "REST", method: "GET", url: "/items" },
    ]);
    expect(result.warnings).toEqual([
      "Skipped OPTIONS /items: this HTTP method is not supported.",
      "Skipped HEAD /items: this HTTP method is not supported.",
      "Skipped TRACE /items: this HTTP method is not supported.",
      "Skipped duplicate GET /items: this endpoint is already registered.",
    ]);
  });

  it("rejects invalid documents without modifying existing endpoint drafts", async () => {
    await expect(
      parseOpenApiEndpoints("not an OpenAPI document", existingEndpoints),
    ).rejects.toThrow("Could not import OpenAPI document:");
    expect(existingEndpoints).toEqual([
      { id: "endpoint-1", name: "Existing items", apiType: "REST", method: "GET", url: "/items" },
    ]);
  });
});
