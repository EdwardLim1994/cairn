// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vite-plus/test";
import { defineComponent, h } from "vue";
import ServiceSettingsPanel from "./ServiceSettingsPanel.vue";

const nuxtUiStubs = {
  USlideover: defineComponent({
    name: "USlideover",
    props: { open: Boolean, side: String, close: [Boolean, Object], content: Object, ui: Object },
    emits: ["update:open"],
    setup(props, { emit, slots }) {
      return () =>
        h(
          "div",
          {
            class: props.ui?.overlay,
            onClick: (event: MouseEvent) => {
              if (event.target !== event.currentTarget) return;
              const outsideEvent = new Event("interactOutside", { cancelable: true });
              (props.content?.onInteractOutside as ((event: Event) => void) | undefined)?.(
                outsideEvent,
              );
              if (!outsideEvent.defaultPrevented) emit("update:open", false);
            },
          },
          [
            h(
              "section",
              {
                ...props.content,
                class: props.ui?.content,
                role: "dialog",
                "aria-modal": "true",
                onKeydown: (event: KeyboardEvent) => {
                  if ((event.key === "Escape" || event.keyCode === 27) && props.open) {
                    emit("update:open", false);
                  }
                },
              },
              [
                h("header", { class: props.ui?.header }, [
                  ...(slots.title?.() ?? []),
                  ...(slots.description?.() ?? []),
                  ...(slots.actions?.() ?? []),
                ]),
                h("div", { class: props.ui?.body }, slots.body?.()),
                h("footer", { class: props.ui?.footer }, slots.footer?.()),
              ],
            ),
          ],
        );
    },
  }),
  UButton: defineComponent({
    inheritAttrs: false,
    props: { type: String },
    setup(props, { attrs, slots }) {
      return () => h("button", { ...attrs, type: props.type ?? "button" }, slots.default?.());
    },
  }),
  UInput: defineComponent({
    inheritAttrs: false,
    props: {
      modelValue: String,
      placeholder: String,
      required: Boolean,
      ui: Object,
    },
    emits: ["update:modelValue"],
    setup(props, { attrs, emit }) {
      return () =>
        h("input", {
          ...attrs,
          class: props.ui?.base,
          value: props.modelValue,
          placeholder: props.placeholder,
          required: props.required,
          onInput: (event: Event) =>
            emit("update:modelValue", (event.target as HTMLInputElement).value),
        });
    },
  }),
  USelect: defineComponent({
    inheritAttrs: false,
    props: { modelValue: String, items: Array, ui: Object, open: Boolean, placeholder: String },
    emits: ["update:modelValue", "update:open"],
    setup(props, { attrs, emit }) {
      return () =>
        h(
          "select",
          {
            ...attrs,
            role: typeof props.open === "boolean" ? "combobox" : undefined,
            class: props.ui?.base,
            value: props.modelValue,
            placeholder: props.placeholder,
            onClick: () => {
              if (typeof props.open === "boolean") emit("update:open", !props.open);
            },
            onChange: (event: Event) => {
              emit("update:modelValue", (event.target as HTMLSelectElement).value);
              if (typeof props.open === "boolean") emit("update:open", false);
            },
          },
          props.items?.map((item) => {
            const option =
              item && typeof item === "object"
                ? (item as { value?: unknown; label?: unknown })
                : undefined;
            const value = option?.value ?? item;
            const label = option?.label ?? item;
            return h("option", { value: String(value) }, String(label));
          }),
        );
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

function mountPanel(props: Record<string, unknown>) {
  return mount(ServiceSettingsPanel, {
    props,
    global: { components: nuxtUiStubs },
  });
}

const draft = {
  name: "Orders",
  framework: "Spring Boot",
  baseUrl: "http://localhost:8080",
  active: true,
  endpoints: [
    {
      id: "endpoint-1",
      name: "List orders",
      apiType: "REST" as const,
      method: "GET" as const,
      url: "/orders",
    },
  ],
};

describe("ServiceSettingsPanel", () => {
  it("discards when Escape is pressed in the settings dialog", async () => {
    const wrapper = mountPanel({
      draft: structuredClone(draft),
      frameworkMenuOpen: false,
      editingServiceId: "service-1",
    });

    await wrapper.get('[aria-label="Service settings"]').trigger("keydown.esc");

    expect(wrapper.emitted("discard")).toEqual([[]]);
  });

  it("keeps the panel open when its backdrop is clicked", async () => {
    const wrapper = mountPanel({
      draft: structuredClone(draft),
      frameworkMenuOpen: false,
      editingServiceId: "service-1",
    });
    await wrapper
      .findAll("div")
      .find((node) => node.classes().includes("fixed"))!
      .trigger("click");
    expect(wrapper.emitted("discard")).toBeUndefined();
  });

  it("renders service fields and endpoint details and supports framework editing", async () => {
    const panelDraft = structuredClone(draft);
    const wrapper = mountPanel({
      draft: panelDraft,
      frameworkMenuOpen: false,
      editingServiceId: "service-1",
    });

    expect(wrapper.find('[aria-label="Service settings"]').exists()).toBe(true);
    expect(wrapper.get('label[for="service-name"]').attributes("for")).toBe("service-name");
    expect(wrapper.text()).toContain("List orders");
    await wrapper.get('[aria-expanded="false"]').trigger("click");
    expect(wrapper.get('label[for="service-endpoint-name-endpoint-1"]').attributes("for")).toBe(
      "service-endpoint-name-endpoint-1",
    );
    const framework = wrapper.get('[aria-label="Framework: Spring Boot"]');
    await framework.trigger("click");
    expect(wrapper.emitted("update:frameworkMenuOpen")).toEqual([[true]]);
    expect(wrapper.find('option[value=".NET"]').exists()).toBe(true);
    await framework.setValue(".NET");
    expect(panelDraft.framework).toBe(".NET");
    expect(wrapper.emitted("update:frameworkMenuOpen")).toEqual([[true], [false]]);
  });

  it("emits save, discard, endpoint edit intents, and service deletion", async () => {
    const wrapper = mountPanel({
      draft: structuredClone(draft),
      frameworkMenuOpen: false,
      editingServiceId: "service-1",
    });
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Save")!
      .trigger("click");
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Discard")!
      .trigger("click");
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "+ New endpoint")!
      .trigger("click");
    await wrapper.get('[aria-label="Remove List orders"]').trigger("click");
    await wrapper.get('[aria-label="Remove service"]').trigger("click");

    expect(wrapper.emitted("save")).toEqual([[]]);
    expect(wrapper.emitted("discard")).toEqual([[]]);
    expect(wrapper.emitted("addEndpoint")).toEqual([[]]);
    expect(wrapper.emitted("removeEndpoint")).toEqual([[0]]);
    expect(wrapper.emitted("removeService")).toEqual([["service-1"]]);
  });

  it("opens the JSON/YAML file picker and emits the selected OpenAPI file", async () => {
    const wrapper = mountPanel({
      draft: structuredClone(draft),
      frameworkMenuOpen: false,
      editingServiceId: "service-1",
    });
    const input = wrapper.get('[aria-label="Upload OpenAPI schema"]');
    const click = vi.spyOn(input.element as HTMLInputElement, "click");
    const file = new File(["openapi: 3.1.0"], "service.yaml", { type: "text/yaml" });

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Import OpenAPI")!
      .trigger("click");
    expect(click).toHaveBeenCalledOnce();
    expect((input.element as HTMLInputElement).accept).toContain(".json");
    expect((input.element as HTMLInputElement).accept).toContain(".yaml");

    Object.defineProperty(input.element, "files", { configurable: true, value: [file] });
    await input.trigger("change");
    expect(wrapper.emitted("importOpenApi")).toEqual([[file]]);
  });

  it("uses Nuxt UI form controls while keeping the service draft editable", async () => {
    const panelDraft = structuredClone(draft);
    const wrapper = mountPanel({
      draft: panelDraft,
      frameworkMenuOpen: false,
      editingServiceId: null,
    });

    await wrapper.get('[aria-expanded="false"]').trigger("click");

    expect(wrapper.findAll('input:not([type="file"])')).toHaveLength(4);
    expect(wrapper.findAll("select")).toHaveLength(3);
    expect(wrapper.findAll("button")).toHaveLength(6);
    expect(wrapper.find('select option[value="PATCH"]').exists()).toBe(true);
    await wrapper.get('input[placeholder="e.g. Checkout API"]').setValue("Catalog API");
    await wrapper.findAll("select").at(2)!.setValue("POST");

    expect(panelDraft.name).toBe("Catalog API");
    expect(panelDraft.endpoints[0]?.method).toBe("POST");
    expect(
      wrapper.get('input[placeholder="e.g. Checkout API"]').attributes("required"),
    ).toBeDefined();
  });
});
