import { describe, expect, it } from "vite-plus/test";
import {
  findVariableReferences,
  resolveJsonVariables,
  resolveStringVariables,
} from "./environment-variables";
import { resolveEndpointPath } from "./mock-api-paths";
import { validateEndpointPathParameters } from "./mock-api-validation";
import { environmentVariableInput } from "./environment-variables";

describe("shared environment variable resolution", () => {
  const variables = new Map<string, string>([
    ["count", "3"],
    ["enabled", "true"],
    ["segment", "a/b c"],
  ]);

  it("substitutes a whole placeholder as a string value", () => {
    expect(resolveJsonVariables({ count: "{{count}}", enabled: "{{enabled}}" }, variables)).toEqual(
      {
        count: "3",
        enabled: "true",
      },
    );
  });

  it("interpolates scalar values inside strings", () => {
    expect(resolveJsonVariables("count={{count}}", variables)).toBe("count=3");
  });

  it("resolves header strings and accepts defined empty values", () => {
    expect(resolveStringVariables("Bearer {{token}}", new Map([["token", "abc"]]))).toBe(
      "Bearer abc",
    );
    expect(resolveStringVariables("{{empty}}", new Map([["empty", ""]]))).toBe("");
  });

  it("collects references from nested JSON strings", () => {
    expect(
      findVariableReferences({
        headers: ["Bearer {{token}}"],
        nested: { body: "{{tenant}}/{{token}}" },
      }),
    ).toEqual(["token", "tenant", "token"]);
  });

  it("encodes substituted path values as one segment", () => {
    expect(resolveEndpointPath("/items/{itemId:guid}", { itemId: "{{segment}}" }, variables)).toBe(
      "/items/a%2Fb%20c",
    );
  });

  it("rejects undefined variables and missing path values", () => {
    expect(() => resolveJsonVariables("{{missing}}", variables)).toThrow(
      /Undefined environment variable/,
    );
    expect(() => resolveEndpointPath("/items/:id", {}, variables)).toThrow(/no saved value/);
  });

  it("rejects path parameters that do not belong to the selected endpoint", () => {
    expect(() => validateEndpointPathParameters({ oldId: "1" }, "/items/{id}")).toThrow(
      /Unknown path parameter/,
    );
  });

  it("validates shared variable names and string values", () => {
    expect(environmentVariableInput({ name: "API_KEY", value: "secret" })).toEqual({
      name: "API_KEY",
      value: "secret",
    });
    expect(() => environmentVariableInput({ name: "bad name", value: "x" })).toThrow(
      /Variable name/,
    );
    expect(() => environmentVariableInput({ name: "API_KEY", value: 42 })).toThrow(/must be text/);
  });
});
