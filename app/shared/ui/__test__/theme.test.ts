import { describe, expect, it, vi } from "vite-plus/test";

describe("shared theme", () => {
  it("assigns semantic palettes while inheriting component defaults", async () => {
    vi.stubGlobal("defineAppConfig", (config: unknown) => config);
    try {
      const { default: config } = await import("../../../app.config");
      expect(config.ui.colors).toMatchObject({ primary: "cyan", neutral: "slate", error: "red" });
      expect(Object.keys(config.ui)).toEqual(["colors"]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
