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
      active: true,
      endpoints: [{ name: "Get orders", apiType: "REST", method: "GET", url: "/orders/{id}" }],
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
        endpoints: [{ name: "x", apiType: "GRAPHQL", method: "GET", url: "/" }],
      }),
    ).toThrow("Only REST endpoints are supported");
  });

  it("validates finite numbers and falls back for omitted values", () => {
    expect(finiteNumber(undefined, "x", 12)).toBe(12);
    expect(finiteNumber("2.5", "x", 0)).toBe(2.5);
    expect(() => finiteNumber("NaN", "x", 0)).toThrow("x must be a finite number");
  });
});
