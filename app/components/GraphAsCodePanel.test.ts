// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vite-plus/test";
import { defineComponent, h } from "vue";
import { parse } from "yaml";
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
      return () => h("section", [slots.header?.(), slots.body?.(), slots.footer?.()]);
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

const validCode = "version: 1\nservices: []\n";

function applyButton(wrapper: ReturnType<typeof mountPanel>) {
  return wrapper.findAll("button").find((button) => button.text() === "Apply changes")!;
}

function mountPanel(initialCode = "") {
  return mount(GraphAsCodePanel, {
    props: { open: true, initialCode },
    global: { components, stubs: { DialogTitle: true, DialogDescription: true } },
  });
}

describe("GraphAsCodePanel", () => {
  it("starts empty for an empty graph and emits valid manifest only on Apply", async () => {
    const wrapper = mountPanel();
    const editor = wrapper.get("textarea");
    expect((editor.element as HTMLTextAreaElement).value).toBe("");
    await editor.setValue(validCode);
    await applyButton(wrapper).trigger("click");
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
    await applyButton(wrapper).trigger("click");
    expect(wrapper.emitted("apply")).toBeUndefined();
    expect(wrapper.get('[role="alert"]').text()).toContain("services.0.framework");
  });

  it("blocks malformed YAML", async () => {
    const wrapper = mountPanel();
    await wrapper.get("textarea").setValue("{ invalid");
    await applyButton(wrapper).trigger("click");
    expect(wrapper.emitted("apply")).toBeUndefined();
    expect(wrapper.get('[role="alert"]').text()).toBeTruthy();
  });

  it("accepts a valid legacy JSON manifest", async () => {
    const wrapper = mountPanel();
    await wrapper.get("textarea").setValue(JSON.stringify({ version: 1, services: [] }));
    await applyButton(wrapper).trigger("click");
    expect(wrapper.emitted("apply")).toEqual([[{ version: 1, services: [] }]]);
  });

  it("parses YAML and reports malformed YAML", async () => {
    const wrapper = mountPanel();
    const yaml = "version: 1\nservices: []\n";
    await wrapper.get("textarea").setValue(yaml);
    await applyButton(wrapper).trigger("click");
    expect(wrapper.emitted("apply")?.[0]?.[0]).toEqual(parse(yaml));

    await wrapper.get("textarea").setValue("version: [unterminated");
    await applyButton(wrapper).trigger("click");
    expect(wrapper.emitted("apply")).toHaveLength(1);
    expect(wrapper.get('[role="alert"]').text()).toBeTruthy();
  });

  it("loads imported file into editor draft without applying it", async () => {
    const wrapper = mountPanel();
    const input = wrapper.get('input[type="file"]');
    Object.defineProperty(input.element, "files", {
      value: [new File([validCode], "graph.yaml", { type: "application/yaml" })],
      configurable: true,
    });
    await input.trigger("change");
    await flushPromises();
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(validCode);
    expect(wrapper.emitted("apply")).toBeUndefined();
  });

  it("discards editor draft when closing the panel", async () => {
    const wrapper = mountPanel(validCode);
    await wrapper.get("textarea").setValue("{}");
    await wrapper.get('[aria-label="Close panel"]').trigger("click");
    expect(wrapper.emitted("update:open")).toEqual([[false]]);
  });
});
