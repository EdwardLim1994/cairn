// @vitest-environment happy-dom
import { ref } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { useGraphStore } from "../stores/graph";
import { useSettingsPanelViewModel } from "./useSettingsPanelViewModel";

describe("settings panel view model", () => {
  beforeEach(() => setActivePinia(createPinia()));

  function setup() {
    const serviceDialog = ref(true);
    const mockPanel = ref(true);
    const frameworkMenuOpen = ref(true);
    const store = useGraphStore();
    store.setSelection("service-1");
    const syncNodes = vi.fn();
    const model = useSettingsPanelViewModel({
      serviceDialog,
      mockPanel,
      frameworkMenuOpen,
      graphStore: store,
      syncNodes,
    });
    return { serviceDialog, mockPanel, frameworkMenuOpen, store, syncNodes, model };
  }

  it("closes panels and clears graph selection", () => {
    const context = setup();
    context.model.closeSettings();
    expect(context.serviceDialog.value).toBe(false);
    expect(context.mockPanel.value).toBe(false);
    expect(context.frameworkMenuOpen.value).toBe(false);
    expect(context.store.selectedNodeId).toBeNull();
    expect(context.syncNodes).toHaveBeenCalledOnce();
  });

  it("keeps clicks inside a panel open and closes the framework dropdown outside its control", () => {
    const context = setup();
    const panel = document.createElement("div");
    panel.className = "app__side-dialog";
    const child = document.createElement("button");
    panel.append(child);
    document.body.append(panel);
    const event = new PointerEvent("pointerdown", { bubbles: true });
    child.dispatchEvent(event);
    context.model.closeSettingsOutside(event);
    expect(context.serviceDialog.value).toBe(true);
    expect(context.frameworkMenuOpen.value).toBe(false);
    document.body.removeChild(panel);
  });

  it("keeps the settings panel and framework dropdown open for its portaled options", () => {
    const context = setup();
    const options = document.createElement("div");
    options.className = "app__framework-select-menu";
    document.body.append(options);
    const event = new PointerEvent("pointerdown", { bubbles: true });
    options.dispatchEvent(event);
    context.model.closeSettingsOutside(event);

    expect(context.serviceDialog.value).toBe(true);
    expect(context.mockPanel.value).toBe(true);
    expect(context.frameworkMenuOpen.value).toBe(true);
    document.body.removeChild(options);
  });

  it("keeps settings panels open when clicking outside", () => {
    const context = setup();
    context.model.closeSettingsOutside(new PointerEvent("pointerdown"));
    expect(context.serviceDialog.value).toBe(true);
    expect(context.mockPanel.value).toBe(true);
    expect(context.store.selectedNodeId).toBe("service-1");
  });
});
