// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";
import AppToolbar from "./AppToolbar.vue";

describe("AppToolbar", () => {
  it("shows service count and emits graph and theme actions", async () => {
    const wrapper = mount(AppToolbar, {
      props: { serviceCount: 3, allNodesCollapsed: false, dark: true },
    });
    expect(wrapper.text()).toContain("3 services");
    await wrapper.get('[aria-label="Collapse all nodes"]').trigger("click");
    await wrapper.get('[aria-label="Use light theme"]').trigger("click");
    expect(wrapper.emitted("toggleAll")).toEqual([[]]);
    expect(wrapper.emitted("toggleTheme")).toEqual([[]]);
  });
});
