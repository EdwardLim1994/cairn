import { describe, expect, it } from "vite-plus/test";
import { useWorkspaceDrawerState } from "./useWorkspaceDrawerState";

describe("useWorkspaceDrawerState", () => {
  it("switches active views without leaving prior drawers open", () => {
    const { activeDrawer, model } = useWorkspaceDrawerState();
    const manageNodes = model("manage-nodes");
    const tokens = model("access-tokens");
    const history = model("history");

    manageNodes.value = true;
    expect(manageNodes.value).toBe(true);
    expect(tokens.value).toBe(false);

    tokens.value = true;
    expect(activeDrawer.value).toBe("access-tokens");
    expect(manageNodes.value).toBe(false);
    expect(tokens.value).toBe(true);

    history.value = true;
    expect(activeDrawer.value).toBe("history");
    expect(tokens.value).toBe(false);
    expect(history.value).toBe(true);

    tokens.value = false;
    expect(activeDrawer.value).toBe("history");
    history.value = false;
    expect(activeDrawer.value).toBeNull();
  });
});
