import { describe, expect, it } from "vite-plus/test";
import { parsePostmanCollection } from "./postman-import";

describe("Postman path parameter import", () => {
  it("keeps concrete and unresolved path values for matching endpoints", () => {
    const collection = JSON.stringify({
      info: { name: "items" },
      item: [
        { name: "Concrete", request: { method: "GET", url: "http://localhost:8080/items/a%2Fb" } },
        {
          name: "Variable",
          request: { method: "GET", url: "http://localhost:8080/items/{{itemId}}" },
        },
      ],
    });
    const result = parsePostmanCollection(collection, [
      {
        apiType: "REST" as const,
        baseUrl: "http://localhost:8080",
        endpoints: [{ id: "endpoint-1", method: "GET", url: "/items/{itemId}" }],
      },
    ]);
    expect(result.drafts).toHaveLength(2);
    expect(result.drafts[0]?.pathParameters).toEqual({ itemId: "a/b" });
    expect(result.drafts[1]?.pathParameters).toEqual({ itemId: "{{itemId}}" });
    expect(result.warnings).toEqual(['"Variable": Uses missing variable {{itemId}}.']);
  });

  it("normalizes trailing slashes from the service URL and route paths", () => {
    const result = parsePostmanCollection(
      JSON.stringify({
        info: { name: "items" },
        item: [
          {
            name: "Get item",
            request: { method: "GET", url: "http://localhost:8080/items/42///" },
          },
        ],
      }),
      [
        {
          apiType: "REST",
          baseUrl: "http://localhost:8080///",
          endpoints: [{ id: "endpoint-1", method: "GET", url: "/items/{id}///" }],
        },
      ],
    );

    expect(result.drafts).toMatchObject([
      { targetEndpointId: "endpoint-1", pathParameters: { id: "42" } },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("walks nested folders, expands collection variables, and matches query parameters regardless of order", () => {
    const result = parsePostmanCollection(
      JSON.stringify({
        info: { name: "orders" },
        variable: [{ key: "host", value: "localhost:8080" }],
        item: [
          {
            name: "Folder",
            item: [
              {
                name: "Search orders",
                request: {
                  method: "GET",
                  url: {
                    protocol: "http",
                    host: ["{{host}}"],
                    path: ["orders"],
                    query: [
                      { key: "status", value: "new" },
                      { key: "page", value: 1 },
                    ],
                  },
                },
              },
            ],
          },
        ],
      }),
      [
        {
          apiType: "REST",
          baseUrl: "http://localhost:8080",
          endpoints: [{ id: "endpoint-1", method: "GET", url: "/orders?page=1&status=new" }],
        },
      ],
    );
    expect(result.drafts).toMatchObject([
      { name: "Search orders", targetEndpointId: "endpoint-1" },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("reports URL, API type, method, and invalid body mismatches per request", () => {
    const result = parsePostmanCollection(
      JSON.stringify({
        info: { name: "mismatch" },
        item: [
          { name: "Missing URL", request: { method: "GET", url: "http://localhost:8080/missing" } },
          { name: "Wrong type", request: { method: "GET", url: "http://localhost:8080/graphql" } },
          {
            name: "Wrong method",
            request: { method: "POST", url: "http://localhost:8080/orders" },
          },
          {
            name: "Invalid body",
            request: {
              method: "POST",
              url: "http://localhost:8080/upload",
              body: { mode: "formdata", formdata: [] },
            },
          },
        ],
      }),
      [
        {
          apiType: "GRAPHQL",
          baseUrl: "http://localhost:8080",
          endpoints: [{ id: "graphql", method: "POST", url: "/graphql" }],
        },
        {
          apiType: "REST",
          baseUrl: "http://localhost:8080",
          endpoints: [
            { id: "orders", method: "GET", url: "/orders" },
            { id: "upload", method: "POST", url: "/upload" },
          ],
        },
      ],
    );
    expect(result.drafts).toHaveLength(3);
    expect(
      result.drafts.every(({ targetEndpointId, active }) => !targetEndpointId && !active),
    ).toBe(true);
    expect(result.warnings).toHaveLength(4);
    expect(result.warnings.join("\n")).toContain("URL did not match");
    expect(result.warnings.join("\n")).toContain("matching endpoint belongs to a GraphQL service");
    expect(result.warnings.join("\n")).toContain("HTTP method POST");
    expect(result.warnings.join("\n")).toContain("request body is not JSON");
  });

  it("rejects malformed collections and collections without request items", () => {
    expect(() => parsePostmanCollection("not json", [])).toThrow();
    expect(() => parsePostmanCollection(JSON.stringify({ info: {}, item: [] }), [])).toThrow(
      "No requests found in this Postman collection",
    );
    expect(() => parsePostmanCollection(JSON.stringify({ info: {}, item: {} }), [])).toThrow(
      "This is not a Postman collection",
    );
  });

  it("retains enabled explicit headers and warns about disabled, protected, and inherited behavior", () => {
    const result = parsePostmanCollection(
      JSON.stringify({
        info: { name: "headers" },
        auth: { type: "bearer" },
        event: [{ listen: "prerequest", script: { exec: ["do work"] } }],
        item: [
          {
            name: "Get order",
            request: {
              method: "GET",
              url: "http://localhost:8080/orders",
              header: [
                { key: "X-Tenant", value: "{{tenant}}" },
                { key: "X-Disabled", value: "ignored", disabled: true },
                { key: "traceparent", value: "forbidden" },
              ],
            },
          },
        ],
      }),
      [
        {
          apiType: "REST",
          baseUrl: "http://localhost:8080",
          endpoints: [{ id: "endpoint-1", method: "GET", url: "/orders" }],
        },
      ],
    );
    expect(result.drafts[0]).toMatchObject({
      targetEndpointId: "endpoint-1",
      active: false,
      headerTemplateId: null,
      customHeaders: [{ name: "X-Tenant", value: "{{tenant}}" }],
    });
    expect(result.warnings.join("\n")).toContain("inherited authorization");
    expect(result.warnings.join("\n")).toContain("scripts");
    expect(result.warnings.join("\n")).toContain("traceparent");
  });

  it("matches with current variables while preserving original URL metadata and retries unresolved drafts", async () => {
    const services = [
      {
        apiType: "REST" as const,
        baseUrl: "http://localhost:8080",
        endpoints: [{ id: "endpoint-1", method: "GET", url: "/orders" }],
      },
    ];
    const imported = parsePostmanCollection(
      JSON.stringify({
        info: { name: "variables" },
        item: [{ name: "Get order", request: { method: "GET", url: "{{base}}/orders" } }],
      }),
      services,
    );
    expect(imported.drafts[0]?.targetEndpointId).toBeNull();
    const { retryUnmatchedPostmanDrafts } = await import("./postman-import");
    const retried = retryUnmatchedPostmanDrafts(imported.drafts, services, [
      { name: "base", value: "http://localhost:8080" },
    ]);
    expect(retried[0]).toMatchObject({
      targetEndpointId: "endpoint-1",
      importUrl: "{{base}}/orders",
    });
    expect(retried[0]?.importUrl).not.toContain("localhost");
  });

  it("uses current Cairn values before collection fallback for URL matching", () => {
    const result = parsePostmanCollection(
      JSON.stringify({
        info: { name: "variables" },
        variable: [{ key: "base", value: "http://wrong.example" }],
        item: [{ name: "Get order", request: { method: "GET", url: "{{base}}/orders" } }],
      }),
      [
        {
          apiType: "REST",
          baseUrl: "http://localhost:8080",
          endpoints: [{ id: "endpoint-1", method: "GET", url: "/orders" }],
        },
      ],
      [{ name: "base", value: "http://localhost:8080" }],
    );
    expect(result.drafts[0]?.targetEndpointId).toBe("endpoint-1");
    expect(result.drafts[0]?.importUrl).toBe("{{base}}/orders");
  });
});
