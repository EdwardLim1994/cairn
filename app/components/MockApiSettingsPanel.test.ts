// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vite-plus/test";
import { defineComponent, h, ref } from "vue";
import MockApiSettingsPanel from "./MockApiSettingsPanel.vue";
import type { MockApiDraft } from "../models/mock-api";

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
                h("header", { class: props.ui?.header }, [...(slots.header?.() ?? [])]),
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
  UIcon: defineComponent({
    props: { name: String },
    template: '<span aria-hidden="true" />',
  }),
  UInput: formControlStub("input"),
  UTextarea: formControlStub("textarea"),
  USelect: formControlStub("select"),
  USwitch: defineComponent({
    name: "USwitchStub",
    props: { modelValue: Boolean, size: String, disabled: Boolean },
    emits: ["update:modelValue"],
    setup(props, { emit }) {
      return () =>
        h("input", {
          type: "checkbox",
          role: "switch",
          disabled: props.disabled,
          checked: props.modelValue,
          onChange: (event: Event) =>
            emit("update:modelValue", (event.target as HTMLInputElement).checked),
        });
    },
  }),
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

function mountPanel(overrides: Record<string, unknown> = {}) {
  return mount(MockApiSettingsPanel, {
    props: {
      mockDraft: structuredClone(mockDraft),
      environmentVariables: [],
      headerTemplates: [],
      variablesOpen: true,
      apisOpen: true,
      variableDraft: { name: "", value: "" },
      environmentVariablesLoading: false,
      editingEnvironmentVariableId: null,
      expandedEnvironmentVariableId: null,
      servicesForSelect: [
        { id: "endpoint-1", label: "Orders | List orders (GET)", apiType: "HTTP" },
      ],
      endpointDetails: [{ id: "endpoint-1", url: "/orders" }],
      endpointPathParameterNames: () => [],
      ...overrides,
    } as never,
    global: { components: settingsUiStubs, stubs: { DialogTitle: true, DialogDescription: true } },
  });
}

function labelControl(wrapper: ReturnType<typeof mountPanel>, label: string, tag: string) {
  return wrapper
    .findAll("label")
    .find((item) => item.text().includes(label))!
    .get(tag);
}

describe("MockApiSettingsPanel", () => {
  it("closes on Escape but keeps the overview open on backdrop clicks", async () => {
    const wrapper = mountPanel();
    await wrapper
      .findAll("div")
      .find((node) => node.classes().includes("fixed"))!
      .trigger("click");
    expect(wrapper.emitted("discard")).toBeUndefined();
    await wrapper.get('[aria-label="Mock API settings"]').trigger("keydown.esc");
    expect(wrapper.emitted("discard")).toEqual([[]]);
  });

  it("shows overview cards and import controls without Save or Discard", async () => {
    const wrapper = mountPanel({
      environmentVariables: [{ id: "variable-1", name: "TOKEN", value: "secret" }],
      headerTemplates: [{ id: "template-1", name: "Tenant headers", headers: [] }],
      authorizationTemplates: [{ id: "auth-1", name: "Bearer", type: "bearer", token: "secret" }],
    });
    expect(wrapper.text()).toContain("Shared environment variables");
    expect(wrapper.text()).toContain("Registered mock APIs");
    expect(wrapper.text()).toContain("Fetch orders");
    expect(wrapper.text()).toContain("Import APIs");
    expect(wrapper.text()).toContain("Import environment");
    expect(wrapper.find("#mock-api-entity-editor").exists()).toBe(false);
    expect(wrapper.findAll("button").some((button) => button.text() === "Save")).toBe(false);
    expect(wrapper.findAll("button").some((button) => button.text() === "Discard")).toBe(false);
    expect(wrapper.find('[aria-label="Edit Tenant headers"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="Edit Bearer"]').exists()).toBe(true);
  });

  it("opens a header template editor with rows and returns to the overview", async () => {
    const wrapper = mountPanel({
      headerTemplates: [
        {
          id: "template-1",
          name: "Tenant headers",
          headers: [{ name: "X-Tenant", value: "{{tenant}}" }],
        },
      ],
    });
    await wrapper.get('[aria-label="Edit Tenant headers"]').trigger("click");
    expect(wrapper.find("#mock-api-entity-editor").exists()).toBe(true);
    expect(wrapper.findAll('input[aria-label="Header name"]')).toHaveLength(1);
    expect(wrapper.find('[aria-label="Delete Edit header template"]').exists()).toBe(true);
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Add header")!
      .trigger("click");
    expect(wrapper.findAll('input[aria-label="Header name"]')).toHaveLength(2);
    await wrapper.get('[aria-label="Back to Mock APIs"]').trigger("click");
    expect(wrapper.find("#mock-api-entity-editor").exists()).toBe(false);
  });

  it("edits a WebSocket API on its own page and saves the text message", async () => {
    const saveMockApi = vi.fn(async (_id: string | null, entry: MockApiDraft) => entry);
    const wrapper = mountPanel({
      mockDraft: [
        {
          id: "mock-ws",
          apiType: "WEBSOCKET",
          name: "Watch events",
          targetEndpointId: "socket-endpoint",
          active: true,
          customHeaders: [],
          description: "",
          requestJson: "subscribe",
          pathParameters: {},
        },
      ],
      servicesForSelect: [
        { id: "http-endpoint", label: "Orders | List (GET)", apiType: "HTTP" },
        { id: "socket-endpoint", label: "Events | Stream (WebSocket)", apiType: "WEBSOCKET" },
      ],
      saveMockApi,
    });
    await wrapper.get('[aria-label="Edit Watch events"]').trigger("click");
    const endpoint = labelControl(wrapper, "Service endpoint", "select");
    expect(
      Array.from((endpoint.element as HTMLSelectElement).options).map(({ value }) => value),
    ).toEqual(["", "socket-endpoint"]);
    const message = labelControl(wrapper, "Message", "textarea");
    expect((message.element as HTMLTextAreaElement).value).toBe("subscribe");
    await message.setValue("next frame");
    await wrapper.get("#mock-api-entity-editor").trigger("submit");
    expect(saveMockApi).toHaveBeenCalledWith(
      "mock-ws",
      expect.objectContaining({
        apiType: "WEBSOCKET",
        requestJson: "next frame",
      }),
    );
  });

  it("shows the authorization fields for each selected template type", async () => {
    const wrapper = mountPanel({
      authorizationTemplates: [
        { id: "bearer", name: "Bearer", type: "bearer", token: "token" },
        { id: "basic", name: "Basic", type: "basic", username: "user", password: "pass" },
        { id: "key", name: "Key", type: "api-key", headerName: "X-Key", value: "secret" },
        {
          id: "oauth",
          name: "OAuth",
          type: "oauth-client-credentials",
          tokenUrl: "https://auth.test/token",
          clientId: "client",
          clientSecret: "secret",
          scope: "read",
        },
      ],
    });
    for (const [name, field] of [
      ["Bearer", "Bearer token"],
      ["Basic", "Username"],
      ["Key", "API key value"],
      ["OAuth", "Client ID"],
    ]) {
      await wrapper.get('[aria-label="Edit ' + name + '"]').trigger("click");
      expect(wrapper.findAll("label").some((item) => item.text().includes(field!))).toBe(true);
      await wrapper.get('[aria-label="Back to Mock APIs"]').trigger("click");
    }
    await wrapper.get('[aria-label="Edit Bearer"]').trigger("click");
    await labelControl(wrapper, "Authorization type", "select").setValue("basic");
    expect(wrapper.findAll("label").some((item) => item.text().includes("Password"))).toBe(true);
  });

  it("opens new variable and authorization pages, with Save and Discard only there", async () => {
    const saveEnvironmentVariable = vi.fn(
      async (_id: string | null, draft: { name: string; value: string }) => ({
        id: "saved-variable",
        ...draft,
      }),
    );
    const wrapper = mountPanel({ mockDraft: [], saveEnvironmentVariable });
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "New variable")!
      .trigger("click");
    await labelControl(wrapper, "Variable name", "input").setValue("TOKEN");
    await labelControl(wrapper, "Value", "textarea").setValue("secret");
    expect(wrapper.findAll("button").some((button) => button.text() === "Discard")).toBe(true);
    await wrapper.get("#mock-api-entity-editor").trigger("submit");
    expect(saveEnvironmentVariable).toHaveBeenCalledWith(null, { name: "TOKEN", value: "secret" });
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "New template")!
      .trigger("click");
    expect(wrapper.find("#mock-api-entity-editor").exists()).toBe(true);
    await wrapper.get('[aria-label="Back to Mock APIs"]').trigger("click");
    expect(wrapper.findAll("button").some((button) => button.text() === "Save")).toBe(false);
  });

  it("opens a new API page and emits both import intents", async () => {
    const wrapper = mountPanel({ mockDraft: [] });
    const fileInput = wrapper.get("#postman-collection-file");
    await fileInput.trigger("change");
    await wrapper.get("#postman-environment-file").trigger("change");
    expect(wrapper.emitted("importCollection")).toHaveLength(1);
    expect(wrapper.emitted("importEnvironment")).toHaveLength(1);
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("+ New API"))!
      .trigger("click");
    expect(wrapper.find("#mock-api-entity-editor").exists()).toBe(true);
    expect(labelControl(wrapper, "API type", "select").element).toBeInstanceOf(HTMLSelectElement);
  });

  it("changes a new API to WebSocket and offers only WebSocket endpoints", async () => {
    const wrapper = mountPanel({
      mockDraft: [],
      servicesForSelect: [
        { id: "http-endpoint", label: "Orders HTTP", apiType: "HTTP" },
        { id: "socket-endpoint", label: "Events WebSocket", apiType: "WEBSOCKET" },
      ],
    });
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("+ New API"))!
      .trigger("click");
    await labelControl(wrapper, "API type", "select").setValue("WEBSOCKET");
    const endpoint = labelControl(wrapper, "Service endpoint", "select");
    expect(
      Array.from((endpoint.element as HTMLSelectElement).options).map(({ value }) => value),
    ).toEqual(["", "socket-endpoint"]);
    expect(labelControl(wrapper, "Message", "textarea").element).toBeInstanceOf(
      HTMLTextAreaElement,
    );
  });

  it("edits authorization assignment on the mock API page", async () => {
    const saveMockApi = vi.fn(async (_id: string | null, entry: MockApiDraft) => entry);
    const wrapper = mountPanel({
      mockDraft: [
        {
          id: "mock-1",
          name: "Fetch orders",
          apiType: "HTTP",
          targetEndpointId: "endpoint-1",
          authorizationTemplateId: "auth-1",
          description: "",
          requestJson: "{}",
          pathParameters: {},
        },
      ],
      authorizationTemplates: [{ id: "auth-1", name: "Bearer", type: "bearer", token: "secret" }],
      saveMockApi,
    });
    await wrapper.get('[aria-label="Edit Fetch orders"]').trigger("click");
    const authorization = labelControl(wrapper, "Authorization", "select");
    expect((authorization.element as HTMLSelectElement).value).toBe("auth-1");
    await authorization.setValue("");
    await wrapper.get("#mock-api-entity-editor").trigger("submit");
    expect(saveMockApi).toHaveBeenCalledWith(
      "mock-1",
      expect.objectContaining({
        authorizationTemplateId: "",
      }),
    );
  });
});
