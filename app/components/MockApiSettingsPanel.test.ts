// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";
import { defineComponent, h, ref } from "vue";
import MockApiSettingsPanel from "./MockApiSettingsPanel.vue";

function formControlStub(tag: "input" | "textarea" | "select") {
  return defineComponent({
    inheritAttrs: false,
    props: { modelValue: String, items: Array, ui: Object, rows: Number },
    emits: ["update:modelValue"],
    setup(props, { attrs, emit }) {
      return () =>
        h(
          tag,
          {
            ...attrs,
            class: props.ui?.base,
            rows: props.rows,
            value: props.modelValue,
            onInput: (event: Event) =>
              emit("update:modelValue", (event.target as HTMLInputElement).value),
            onChange: (event: Event) =>
              emit("update:modelValue", (event.target as HTMLSelectElement).value),
          },
          tag === "select"
            ? props.items?.map((item) => {
                const option = item as { value: string; label: string };
                return h("option", { value: option.value }, option.label);
              })
            : undefined,
        );
    },
  });
}

const settingsUiStubs = {
  UButton: defineComponent({
    inheritAttrs: false,
    props: { type: String },
    setup(props, { attrs, slots }) {
      return () => h("button", { ...attrs, type: props.type ?? "button" }, slots.default?.());
    },
  }),
  UInput: formControlStub("input"),
  UTextarea: formControlStub("textarea"),
  USelect: formControlStub("select"),
  UAccordion: defineComponent({
    inheritAttrs: false,
    props: { modelValue: [String, Array], ui: Object, items: Array },
    emits: ["update:modelValue"],
    setup(props, { attrs, emit, slots }) {
      const uncontrolledValue = ref<string | undefined>();
      return () => {
        const selected = props.modelValue ?? uncontrolledValue.value;
        const open = Boolean(selected);
        const firstItem = props.items?.[0] as { value?: string } | undefined;
        const value = ((Array.isArray(selected) ? selected[0] : selected) ?? firstItem?.value) as
          | string
          | undefined;
        return h("div", attrs, [
          h(
            "button",
            {
              type: "button",
              class: props.ui?.trigger,
              "aria-expanded": String(open),
              onClick: () => {
                const next = open ? undefined : value;
                if (props.modelValue === undefined) uncontrolledValue.value = next;
                emit("update:modelValue", next);
              },
            },
            slots.default?.(),
          ),
          ...(open ? [h("div", slots.body?.())] : []),
        ]);
      };
    },
  }),
};

const mockDraft = [
  {
    id: "mock-1",
    name: "Fetch orders",
    targetEndpointId: "endpoint-1",
    description: "List orders",
    requestJson: "{}",
    pathParameters: {},
  },
];

describe("MockApiSettingsPanel", () => {
  it("discards when Escape is pressed in the settings dialog", async () => {
    const wrapper = mount(MockApiSettingsPanel, {
      props: {
        mockDraft: structuredClone(mockDraft),
        environmentVariables: [],
        variablesOpen: false,
        apisOpen: false,
        variableDraft: { name: "", value: "" },
        environmentVariablesLoading: false,
        editingEnvironmentVariableId: null,
        expandedEnvironmentVariableId: null,
        servicesForSelect: [],
        endpointPathParameterNames: () => [],
      },
      global: { components: settingsUiStubs },
    });

    await wrapper.get('[aria-label="Mock API settings"]').trigger("keydown.esc");

    expect(wrapper.emitted("discard")).toEqual([[]]);
  });

  it("renders shared variables, mock APIs, and import controls", async () => {
    const wrapper = mount(MockApiSettingsPanel, {
      props: {
        mockDraft: structuredClone(mockDraft),
        environmentVariables: [{ id: "var-1", name: "TOKEN", value: "secret" }],
        variablesOpen: true,
        apisOpen: true,
        variableDraft: { name: "", value: "" },
        environmentVariablesLoading: false,
        editingEnvironmentVariableId: "var-1",
        expandedEnvironmentVariableId: "var-1",
        servicesForSelect: [{ id: "endpoint-1", label: "Orders | List orders (GET)" }],
        endpointPathParameterNames: () => ["orderId"],
      },
      global: { components: settingsUiStubs },
    });

    expect(wrapper.text()).toContain("Shared environment variables");
    expect(wrapper.text()).toContain("Registered mock APIs");
    expect(wrapper.text()).toContain("Fetch orders");
    expect(wrapper.text()).toContain("Import Postman");
    expect(wrapper.text()).toContain("New variable");
    expect(wrapper.find('[aria-label="Close"]').exists()).toBe(false);
    expect(wrapper.get('label[for="environment-variable-name-var-1"]').attributes("for")).toBe(
      "environment-variable-name-var-1",
    );
    expect(wrapper.get('label[for="environment-variable-value-var-1"]').attributes("for")).toBe(
      "environment-variable-value-var-1",
    );
    await wrapper.get("#mock-api-mock-1 [aria-expanded='false']").trigger("click");
    expect(wrapper.get('label[for="mock-api-name-mock-1"]').attributes("for")).toBe(
      "mock-api-name-mock-1",
    );
    expect(wrapper.get('label[for="mock-api-endpoint-mock-1"]').attributes("for")).toBe(
      "mock-api-endpoint-mock-1",
    );
    expect(wrapper.get('label[for="mock-api-path-mock-1-orderId"]').attributes("for")).toBe(
      "mock-api-path-mock-1-orderId",
    );
    expect(wrapper.get("fieldset legend").text()).toBe("Request (JSON)");
  });

  it("emits variable, import, mock API, save, and discard interactions", async () => {
    const wrapper = mount(MockApiSettingsPanel, {
      props: {
        mockDraft: structuredClone(mockDraft),
        environmentVariables: [{ id: "var-1", name: "TOKEN", value: "secret" }],
        variablesOpen: true,
        apisOpen: true,
        variableDraft: { name: "TOKEN", value: "secret" },
        environmentVariablesLoading: false,
        editingEnvironmentVariableId: "var-1",
        expandedEnvironmentVariableId: "var-1",
        servicesForSelect: [{ id: "endpoint-1", label: "Orders | List orders (GET)" }],
        endpointPathParameterNames: () => [],
      },
      global: { components: settingsUiStubs },
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
      .get(".app__environment-variable-header button.app__button--secondary")
      .trigger("click");
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("+ New API"))!
      .trigger("click");
    const fileInput = wrapper.get('input[type="file"]');
    Object.defineProperty(fileInput.element, "files", {
      value: [new File(["{}"], "collection.json")],
    });
    await fileInput.trigger("change");

    expect(wrapper.emitted("save")).toEqual([[]]);
    expect(wrapper.emitted("discard")).toEqual([[]]);
    expect(wrapper.emitted("addVariable")).toEqual([[]]);
    expect(wrapper.emitted("addMockApi")).toEqual([[]]);
    expect(wrapper.emitted("importCollection")).toHaveLength(1);
  });

  it("uses accordion triggers to expand and collapse each settings section", async () => {
    const wrapper = mount(MockApiSettingsPanel, {
      props: {
        mockDraft: structuredClone(mockDraft),
        environmentVariables: [],
        variablesOpen: true,
        apisOpen: true,
        variableDraft: { name: "", value: "" },
        environmentVariablesLoading: false,
        servicesForSelect: [],
        endpointPathParameterNames: () => [],
      },
      global: { components: settingsUiStubs },
    });

    await wrapper.get("#shared-environment-variables-toggle [aria-expanded]").trigger("click");
    await wrapper.get("#registered-mock-apis-toggle [aria-expanded]").trigger("click");

    expect(wrapper.emitted("update:variablesOpen")).toEqual([[false]]);
    expect(wrapper.emitted("update:apisOpen")).toEqual([[false]]);
  });
});
