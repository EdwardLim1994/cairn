import { describe, expect, it } from "vite-plus/test";
import {
  mockApiInput,
  mockApiPathParameters,
  pathParameterNames,
  validateEndpointPathParameters,
} from "./mock-api-validation";

describe("mock API input validation", () => {
  it("collects supported route parameter forms", () => {
    expect(pathParameterNames("/orders/{orderId:guid}/items/:item-id?expand=true")).toEqual([
      "orderId",
      "item-id",
    ]);
  });

  it("validates parameter names and text values", () => {
    expect(mockApiPathParameters({ orderId: "42" })).toEqual({ orderId: "42" });
    expect(() => mockApiPathParameters({ "9bad": "x" })).toThrow(/Invalid path parameter name/);
    expect(() => mockApiPathParameters({ id: 42 })).toThrow(/must be text/);
    expect(() => validateEndpointPathParameters({ oldId: "1" }, "/orders/{id}")).toThrow(
      /Unknown path parameter/,
    );
  });

  it("normalizes linked API defaults and preserves incomplete drafts", () => {
    expect(mockApiInput({ name: " List orders ", targetEndpointId: "endpoint-1" })).toEqual({
      name: "List orders",
      targetEndpointId: "endpoint-1",
      description: "",
      pathParameters: {},
      requestJson: {},
      headerTemplateId: null,
      customHeaders: [],
      active: true,
      importMethod: null,
      importUrl: null,
      matchUrl: null,
    });
    expect(() => mockApiInput({ name: "", targetEndpointId: "endpoint-1" })).toThrow(
      /name is required/,
    );
    expect(mockApiInput({ name: "Unmatched import" })).toMatchObject({
      targetEndpointId: null,
      active: false,
    });
    expect(() => mockApiInput({ name: "Unsafe draft", active: "yes" })).toThrow(/Active/);
    expect(() => mockApiInput({ name: "Unsafe draft", customHeaders: [{ name: "x" }] })).toThrow(
      /Custom headers/,
    );
    expect(() =>
      mockApiInput({ name: "x", targetEndpointId: "id", requestJson: BigInt(1) }),
    ).toThrow(/valid JSON/);
  });
});
