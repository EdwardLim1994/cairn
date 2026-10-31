import { describe, expect, it } from "vite-plus/test";
import { mergeHeaderRows, resolveHeaderRows, validateHeaderRows } from "./headers";

describe("mock API header rows", () => {
  it("uses case-insensitive custom overrides and preserves empty values", () => {
    expect(
      mergeHeaderRows(
        [
          { name: "X-Tenant-ID", value: "{{missing}}" },
          { name: "X-Default", value: "yes" },
        ],
        [{ name: "x-tenant-id", value: "" }],
      ),
    ).toEqual([
      { name: "x-tenant-id", value: "" },
      { name: "X-Default", value: "yes" },
    ]);
  });

  it("resolves only effective values and validates resolved newlines", () => {
    expect(
      resolveHeaderRows(
        [{ name: "X-Token", value: "{{missing}}" }],
        [{ name: "x-token", value: "Bearer {{token}}" }],
        new Map([["token", "abc"]]),
      ),
    ).toEqual({ "x-token": "Bearer abc" });
    expect(() =>
      resolveHeaderRows(
        [],
        [{ name: "X-Token", value: "{{token}}" }],
        new Map([["token", "a\nb"]]),
      ),
    ).toThrow(/newline/);
    expect(() =>
      resolveHeaderRows([], [{ name: "X-Token", value: "{{missing}}" }], new Map()),
    ).toThrow(/Undefined environment variable: missing/);
  });

  it("rejects duplicate, invalid, newline, and traceparent rows", () => {
    expect(() =>
      validateHeaderRows([
        { name: "X-Name", value: "a" },
        { name: "x-name", value: "b" },
      ]),
    ).toThrow(/Duplicate/);
    expect(() => validateHeaderRows([{ name: "Bad Name", value: "x" }])).toThrow(/name is invalid/);
    expect(() => validateHeaderRows([{ name: "X-Name", value: "a\rb" }])).toThrow(/newline/);
    expect(() => validateHeaderRows([{ name: "traceparent", value: "override" }])).toThrow(
      /reserved/,
    );
  });
});
