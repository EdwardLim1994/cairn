import { describe, expect, it } from "vite-plus/test";
import { finiteNumber, httpUrl, record, serviceInput } from "./graph-validation";

describe("graph input validation", () => {
  it("accepts records and rejects arrays and nulls", () => {
    expect(record({ id: "x" }, "Item")).toEqual({ id: "x" });
    expect(() => record([], "Item")).toThrow("Item must be an object");
    expect(() => record(null, "Item")).toThrow("Item must be an object");
  });

  it("normalizes valid service and endpoint input", () => {
    expect(
      serviceInput({
        name: " Orders ",
        framework: "Spring Boot",
        baseUrl: "http://localhost:8081",
        endpoints: [{ name: "Get orders", apiType: "REST", method: "get", url: "/orders/{id}" }],
      }),
    ).toMatchObject({
      name: "Orders",
      apiType: "REST",
      active: true,
      endpoints: [{ name: "Get orders", method: "GET", url: "/orders/{id}" }],
    });
  });

  it("rejects invalid URLs, endpoint methods, and paths", () => {
    expect(() => httpUrl("ftp://example.com", "Base URL")).toThrow(/HTTP or HTTPS/);
    expect(() => httpUrl("http://user:pass@example.com", "Base URL")).toThrow(
      /without credentials/,
    );
    expect(() =>
      serviceInput({
        name: "x",
        framework: "Spring Boot",
        baseUrl: "http://localhost",
        endpoints: "bad",
      }),
    ).toThrow("Endpoints must be an array");
    expect(() =>
      serviceInput({
        name: "x",
        framework: "Spring Boot",
        baseUrl: "http://localhost",
        endpoints: [{ name: "x", apiType: "REST", method: "TRACE", url: "/" }],
      }),
    ).toThrow("Unsupported REST method");
    expect(() =>
      serviceInput({
        name: "x",
        framework: "Spring Boot",
        baseUrl: "http://localhost",
        apiType: "GRAPHQL",
        endpoints: [{ name: "GraphQL", method: "GET", url: "/graphql" }],
      }),
    ).toThrow("GraphQL endpoint method must be POST");
  });

  it("validates finite numbers and falls back for omitted values", () => {
    expect(finiteNumber(undefined, "x", 12)).toBe(12);
    expect(finiteNumber("2.5", "x", 0)).toBe(2.5);
    expect(() => finiteNumber("NaN", "x", 0)).toThrow("x must be a finite number");
  });

  it("requires exactly one POST endpoint for GraphQL services", () => {
    const base = {
      name: "GraphQL",
      apiType: "GRAPHQL",
      framework: "Other",
      baseUrl: "http://localhost:8080",
    };
    expect(
      serviceInput({ ...base, endpoints: [{ name: "GraphQL", method: "POST", url: "/graphql" }] }),
    ).toMatchObject({ apiType: "GRAPHQL", endpoints: [{ method: "POST" }] });
    expect(() => serviceInput({ ...base, endpoints: [] })).toThrow(
      "Exactly one GraphQL endpoint is required",
    );
    expect(() =>
      serviceInput({
        ...base,
        endpoints: [
          { name: "GraphQL", method: "POST", url: "/graphql" },
          { name: "Extra", method: "POST", url: "/extra" },
        ],
      }),
    ).toThrow("Exactly one GraphQL endpoint is required");
  });
});
