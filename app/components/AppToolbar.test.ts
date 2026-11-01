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
    expect(wrapper.text()).not.toContain("services");
    expect(wrapper.find('[class*="bg-[#15966f]"]').exists()).toBe(false);
    await wrapper.get('[aria-label="Collapse all nodes"]').trigger("click");
    await wrapper.get('[aria-label="Use light theme"]').trigger("click");
    expect(wrapper.emitted("toggleAll")).toEqual([[]]);
    expect(wrapper.emitted("toggleTheme")).toEqual([[]]);
  });
});
