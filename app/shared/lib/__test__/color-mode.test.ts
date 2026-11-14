import { describe, expect, it } from "vite-plus/test";
import { migrateColorMode } from "../color-mode";

describe("color mode migration", () => {
  function storage(initial: string | null = null) {
    let value = initial;
    return {
      getItem: () => value,
      setItem: (_key: string, next: string) => {
        value = next;
      },
    };
  }
  it.each([
    [true, "dark"],
    [false, "light"],
    [null, "system"],
    ["invalid", "system"],
  ])("migrates %s to %s", (legacy, expected) => {
    const target = storage();
    expect(migrateColorMode(legacy, target, "mode")).toBe(expected);
    expect(target.getItem()).toBe(expected);
  });
  it.each(["light", "dark", "system"])("preserves an existing %s choice", (preference) => {
    const target = storage(preference);
    expect(migrateColorMode(true, target, "mode")).toBe(preference);
  });
  it("does not reapply legacy state on repeat startup", () => {
    const target = storage();
    migrateColorMode(false, target, "mode");
    expect(migrateColorMode(true, target, "mode")).toBe("light");
  });
  it("allows rendering when storage is unavailable", () => {
    expect(
      migrateColorMode(
        true,
        {
          getItem() {
            throw new Error("denied");
          },
          setItem() {},
        },
        "mode",
      ),
    ).toBeUndefined();
  });
});
