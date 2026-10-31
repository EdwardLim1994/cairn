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
  it("shows service count and emits graph and theme actions", async () => {
    const wrapper = mount(AppToolbar, {
      props: { serviceCount: 3, allNodesCollapsed: false, dark: true },
      global: { components },
    });
    expect(wrapper.text()).toContain("3 services");
    await wrapper.get('[aria-label="Collapse all nodes"]').trigger("click");
    await wrapper.get('[aria-label="Use light theme"]').trigger("click");
    expect(wrapper.emitted("toggleAll")).toEqual([[]]);
    expect(wrapper.emitted("toggleTheme")).toEqual([[]]);
  });
});
