import { describe, expect, it } from "vite-plus/test";
import { safeLocalReturnPath } from "./auth-redirect";

describe("safeLocalReturnPath", () => {
  it("keeps local paths and their query and hash", () => {
    expect(safeLocalReturnPath("/services?tab=health#active")).toBe("/services?tab=health#active");
  });

  it.each([
    "https://attacker.example",
    "//attacker.example",
    "/\\attacker.example",
    "/login?returnTo=/login",
    undefined,
  ])("falls back for unsafe destination %s", (destination) => {
    expect(safeLocalReturnPath(destination)).toBe("/");
  });
});
