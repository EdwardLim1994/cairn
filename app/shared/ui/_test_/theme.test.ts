import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, vi } from "vite-plus/test";

describe("shared theme", () => {
  it("keeps the recorded surface and accent colors in both modes", async () => {
    const css = await readFile(join(process.cwd(), "app/app.vue"), "utf8");
    const light = css.match(/:root \{([^}]+)\}/)?.[1];
    const dark = css.match(/\.app\.app--dark \{([^}]+)\}/)?.[1];

    expect(light).toContain("--panel: #fff;");
    expect(light).toContain("--accent: #0a7898;");
    expect(dark).toContain("--panel: #161b22;");
    expect(dark).toContain("--accent: #3cc4e6;");
    expect(css).toContain("--ui-bg: var(--panel);");
    expect(css).toContain("--ui-primary: var(--accent);");
  });

  it("shares control size and visible keyboard focus defaults", async () => {
    vi.stubGlobal("defineAppConfig", (config: unknown) => config);
    try {
      const { default: config } = await import("../../../app.config");
      for (const control of ["button", "input", "select", "textarea"] as const) {
        expect(config.ui[control].defaultVariants.size).toBe("md");
        expect(config.ui[control].slots.base).toContain("focus-visible:outline-[var(--accent)]");
      }
      expect(config.ui.accordion.slots.trigger).toContain("focus-visible:outline-[var(--accent)]");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
