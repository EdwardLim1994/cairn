// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";
import { defineComponent, h } from "vue";
import AppToolbar from "./AppToolbar.vue";

const components = {
  UButton: defineComponent({
    inheritAttrs: false,
    props: { type: String },
    setup(props, { attrs, slots }) {
      return () => h("button", { ...attrs, type: props.type ?? "button" }, slots.default?.());
    },
  }),
};

describe("AppToolbar", () => {
  it("omits service status and emits graph and theme actions", async () => {
    const wrapper = mount(AppToolbar, {
      props: { allNodesCollapsed: false, dark: true },
      global: { components },
    });
    expect(wrapper.get("header").classes()).toContain("max-[720px]:flex-wrap");
    expect(wrapper.get("header").text()).toContain("Cairn");
    expect(wrapper.get('[aria-label="Manage nodes"]').classes()).toContain("max-[720px]:size-8");
    expect(wrapper.text()).not.toContain("services");
    expect(wrapper.find('[class*="bg-[#15966f]"]').exists()).toBe(false);
    await wrapper.get('[aria-label="Collapse all nodes"]').trigger("click");
    await wrapper.get('[aria-label="Auto arrange"]').trigger("click");
    await wrapper.get('[aria-label="Graph as code"]').trigger("click");
    await wrapper.get('[aria-label="Use light theme"]').trigger("click");
    await wrapper.get('[aria-label="Mock APIs"]').trigger("click");
    await wrapper.get('[aria-label="Manage nodes"]').trigger("click");
    await wrapper.get('[aria-label="Manage access tokens"]').trigger("click");
    await wrapper.get('[aria-label="Mock API call history"]').trigger("click");
    expect(wrapper.emitted("toggleAll")).toEqual([[]]);
    expect(wrapper.emitted("autoArrange")).toEqual([[]]);
    expect(wrapper.emitted("openGraphAsCode")).toEqual([[]]);
    expect(wrapper.find('[aria-label="Lock node positions"]').exists()).toBe(false);
    expect(wrapper.emitted("toggleTheme")).toEqual([[]]);
    expect(wrapper.emitted("openMockApis")).toEqual([[]]);
    expect(wrapper.emitted("openManageNodes")).toEqual([[]]);
    expect(wrapper.emitted("openAccessTokens")).toEqual([[]]);
    expect(wrapper.emitted("openHistory")).toEqual([[]]);
  });

  it("shows the project ID only when configured", () => {
    const withProject = mount(AppToolbar, {
      props: { allNodesCollapsed: false, dark: false, projectId: "cairn-dev" },
      global: { components },
    });
    expect(withProject.get('[aria-label="Project ID"]').text()).toContain("cairn-dev");
    expect(withProject.text()).not.toContain("workspace");
    expect(withProject.text()).not.toContain("environment");

    const withoutProject = mount(AppToolbar, {
      props: { allNodesCollapsed: false, dark: false },
      global: { components },
    });
    expect(withoutProject.find('[aria-label="Project ID"]').exists()).toBe(false);
  });

  it("shows sign out only when authentication is enabled", async () => {
    const wrapper = mount(AppToolbar, {
      props: { allNodesCollapsed: false, dark: false, authEnabled: true },
      global: { components },
    });
    await wrapper.get('[aria-label="Sign out"]').trigger("click");
    expect(wrapper.emitted("signOut")).toEqual([[]]);

    const disabled = mount(AppToolbar, {
      props: { allNodesCollapsed: false, dark: false, authEnabled: false },
      global: { components },
    });
    expect(disabled.find('[aria-label="Sign out"]').exists()).toBe(false);
  });
});
