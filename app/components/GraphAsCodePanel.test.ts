// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vite-plus/test";
import { defineComponent, h } from "vue";
import GraphAsCodePanel from "./GraphAsCodePanel.vue";

vi.mock("vue-codemirror", async () => {
  const vue = await import("vue");
  return {
    Codemirror: vue.defineComponent({
      props: { modelValue: { type: String, default: "" } },
      emits: ["update:modelValue"],
      setup(props, { emit, attrs }) {
        return () =>
          vue.h("textarea", {
            ...attrs,
            value: props.modelValue,
            onInput: (event: Event) =>
              emit("update:modelValue", (event.target as HTMLTextAreaElement).value),
          });
      },
    }),
  };
});

const components = {
  USlideover: defineComponent({
    setup(_, { slots }) {
      return () =>
        h("section", [slots.title?.(), slots.description?.(), slots.body?.(), slots.footer?.()]);
    },
  }),
  UButton: defineComponent({
    inheritAttrs: false,
    props: { type: String, disabled: Boolean },
    setup(props, { attrs, slots }) {
      return () =>
        h(
          "button",
          { ...attrs, type: props.type ?? "button", disabled: props.disabled },
          slots.default?.(),
        );
    },
  }),
};

const validCode = JSON.stringify({ version: 1, services: [] });

function mountPanel(initialCode = "") {
  return mount(GraphAsCodePanel, {
    props: { open: true, initialCode },
    global: { components },
  });
}

describe("GraphAsCodePanel", () => {
  it("starts empty for an empty graph and emits valid manifest only on Apply", async () => {
    const wrapper = mountPanel();
    const editor = wrapper.get("textarea");
    expect((editor.element as HTMLTextAreaElement).value).toBe("");
    await editor.setValue(validCode);
    await wrapper.get("button:last-child").trigger("click");
    expect(wrapper.emitted("apply")).toEqual([[{ version: 1, services: [] }]]);
  });

  it("blocks invalid schema and reports field path", async () => {
    const wrapper = mountPanel();
    await wrapper.get("textarea").setValue(
      JSON.stringify({
        version: 1,
        services: [
          {
            key: "orders",
            name: "Orders",
            framework: "unsupported",
            baseUrl: "http://localhost:8080",
            endpoints: [],
          },
        ],
      }),
    );
    await wrapper.get("button:last-child").trigger("click");
    expect(wrapper.emitted("apply")).toBeUndefined();
    expect(wrapper.get('[role="alert"]').text()).toContain("services.0.framework");
  });

  it("blocks malformed JSON", async () => {
    const wrapper = mountPanel();
    await wrapper.get("textarea").setValue("{ invalid");
    await wrapper.get("button:last-child").trigger("click");
    expect(wrapper.emitted("apply")).toBeUndefined();
    expect(wrapper.get('[role="alert"]').text()).toBeTruthy();
  });

  it("loads imported file into editor draft without applying it", async () => {
    const wrapper = mountPanel();
    const input = wrapper.get('input[type="file"]');
    Object.defineProperty(input.element, "files", {
      value: [new File([validCode], "graph.json", { type: "application/json" })],
      configurable: true,
    });
    await input.trigger("change");
    await flushPromises();
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(validCode);
    expect(wrapper.emitted("apply")).toBeUndefined();
  });

  it("discards editor draft and closes panel", async () => {
    const wrapper = mountPanel(validCode);
    await wrapper.get("textarea").setValue("{}");
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Discard")!
      .trigger("click");
    expect(wrapper.emitted("update:open")).toEqual([[false]]);
  });
});
