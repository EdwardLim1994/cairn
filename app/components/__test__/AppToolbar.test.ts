// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";
import { defineComponent, h } from "vue";
import AppToolbar from "../AppToolbar.vue";

const components = {
  UColorModeButton: { template: '<button aria-label="Switch color mode" />' },
  UButton: defineComponent({
    inheritAttrs: false,
    props: { type: String },
    setup(props, { attrs, slots }) {
      return () => h("button", { ...attrs, type: props.type ?? "button" }, slots.default?.());
    },
  }),
};

describe("AppToolbar", () => {
  it("hides sign out when operator authentication is disabled", () => {
    const wrapper = mount(AppToolbar, {
      props: { logsOpen: false, authEnabled: false },
      global: { components },
    });
    expect(wrapper.find('[aria-label="Sign out"]').exists()).toBe(false);
  });

  it("omits service status and emits graph and theme actions", async () => {
    const wrapper = mount(AppToolbar, {
      props: { logsOpen: false },
      global: { components },
    });
    expect(wrapper.get("header").classes()).toContain("z-[80]");
    expect(wrapper.get("header").text()).toContain("Cairn");
    expect(wrapper.get('[aria-label="Manage nodes"]').classes()).toContain("app__toolbar-button");
    expect(wrapper.text()).not.toContain("services");
    expect(wrapper.find('[class*="bg-[#15966f]"]').exists()).toBe(false);
    expect(wrapper.find('[aria-label="Graph as code"]').exists()).toBe(false);
    expect(wrapper.find('[aria-label="Switch color mode"]').exists()).toBe(true);
    await wrapper.get('[aria-label="Mock APIs"]').trigger("click");
    await wrapper.get('[aria-label="Manage nodes"]').trigger("click");
    await wrapper.get('[aria-label="Manage access tokens"]').trigger("click");
    await wrapper.get('[aria-label="Run history"]').trigger("click");
    expect(wrapper.find('[aria-label="Lock node positions"]').exists()).toBe(false);

    expect(wrapper.emitted("openMockApis")).toEqual([[]]);
    expect(wrapper.emitted("openManageNodes")).toEqual([[]]);
    expect(wrapper.emitted("openAccessTokens")).toEqual([[]]);
    expect(wrapper.emitted("openHistory")).toEqual([[]]);
  });

  it("shows the project ID only when configured", () => {
    const withProject = mount(AppToolbar, {
      props: { logsOpen: false, projectId: "cairn-dev" },
      global: { components },
    });
    expect(withProject.get('[aria-label="Project ID"]').text()).toContain("cairn-dev");
    expect(withProject.text()).not.toContain("workspace");
    expect(withProject.text()).not.toContain("environment");

    const withoutProject = mount(AppToolbar, {
      props: { logsOpen: false },
      global: { components },
    });
    expect(withoutProject.find('[aria-label="Project ID"]').exists()).toBe(false);
  });

  it("always shows sign out and emits its action", async () => {
    const wrapper = mount(AppToolbar, {
      props: { logsOpen: false },
      global: { components },
    });
    await wrapper.get('[aria-label="Sign out"]').trigger("click");
    expect(wrapper.emitted("signOut")).toEqual([[]]);
  });
});
