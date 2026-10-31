import { describe, expect, it } from "vite-plus/test";
import { parsePostmanEnvironment } from "./postman-environment-import";

describe("Postman environment import", () => {
  it("imports enabled scalars, preserves empty strings, and skips collisions", () => {
    const result = parsePostmanEnvironment(
      JSON.stringify({
        values: [
          { key: "token", value: "saved" },
          { key: "count", value: 4 },
          { key: "same", value: "first" },
          { key: "same", value: "second" },
          { key: "enabled", value: false },
          { key: "empty", value: "" },
          { key: "disabled", value: "x", enabled: false },
          { key: "token", value: "again" },
          { key: "invalid-name", value: "x" },
          { key: "object", value: { value: "x" } },
          { key: "nullish", value: null },
        ],
      }),
      ["token"],
    );
    expect(result.variables).toEqual([
      { name: "count", value: "4" },
      { name: "same", value: "first" },
      { name: "enabled", value: "false" },
      { name: "empty", value: "" },
    ]);
    expect(result.warnings.join("\n")).toContain('duplicate environment variable "token"');
    expect(result.warnings.join("\n")).toContain("invalid name");
    expect(result.warnings.join("\n")).toContain("only string, number, and boolean");
  });

  it("rejects invalid documents without returning partial drafts", () => {
    expect(() => parsePostmanEnvironment("not json")).toThrow();
    expect(() => parsePostmanEnvironment(JSON.stringify({ values: {} }))).toThrow(
      "This is not a Postman environment",
    );
  });
});
