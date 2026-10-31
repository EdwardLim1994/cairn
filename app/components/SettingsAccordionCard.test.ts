// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";
import { defineComponent, h } from "vue";
import SettingsAccordionCard from "./SettingsAccordionCard.vue";

const stubs = {
  UButton: defineComponent({
    inheritAttrs: false,
    props: { type: String },
    setup(props, { attrs, slots }) {
      return () => h("button", { ...attrs, type: props.type ?? "button" }, slots.default?.());
    },
  }),
  UAccordion: defineComponent({
    inheritAttrs: false,
    props: { modelValue: [String, Array], ui: Object },
    emits: ["update:modelValue"],
    setup(props, { attrs, emit, slots }) {
      return () => {
        const open = props.modelValue === "settings-card";
        return h("div", attrs, [
          h(
            "button",
            {
              type: "button",
              "aria-expanded": String(open),
              onClick: () => emit("update:modelValue", open ? undefined : "settings-card"),
            },
            slots.default?.(),
          ),
          ...(open ? [h("div", slots.body?.())] : []),
        ]);
      };
    },
  }),
};

function mountCard(props: Record<string, unknown>, slots: Record<string, string> = {}) {
  return mount(SettingsAccordionCard, {
    props,
    slots,
    global: { components: stubs },
  });
}

describe("SettingsAccordionCard", () => {
  it("renders title, subtitle, and slotted content", () => {
    const wrapper = mountCard(
      { title: "API_KEY", subtitle: "Shared variable", deleteLabel: "Delete variable", open: true },
      { default: "Card content" },
    );

    expect(wrapper.text()).toContain("API_KEY");
    expect(wrapper.text()).toContain("Shared variable");
    expect(wrapper.text()).toContain("Card content");
  });

  it("emits delete when its delete action is clicked", async () => {
    const wrapper = mountCard({ title: "API_KEY", deleteLabel: "Delete variable" });

    await wrapper.get('button[aria-label="Delete variable"]').trigger("click");

    expect(wrapper.emitted("delete")).toEqual([[]]);
  });

  it("emits the new open state through the accessible accordion trigger", async () => {
    const wrapper = mountCard({ title: "API_KEY", deleteLabel: "Delete variable" });
    await wrapper.get('[aria-expanded="false"]').trigger("click");

    expect(wrapper.emitted("toggle")).toContainEqual([true]);
  });
});
