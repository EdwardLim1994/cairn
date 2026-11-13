// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vite-plus/test";
import { defineComponent, h } from "vue";
import ServiceSettingsPanel from "../ui/ServiceSettingsPanel.vue";

const nuxtUiStubs = {
  ConfirmDialog: defineComponent({
    props: { open: Boolean, title: String, confirmLabel: String },
    emits: ["confirm", "cancel"],
    setup(props, { emit }) {
      return () =>
        props.open
          ? h("div", { role: "alertdialog", "aria-label": props.title }, [
              h("button", { onClick: () => emit("cancel") }, "Cancel"),
              h("button", { onClick: () => emit("confirm") }, props.confirmLabel),
            ])
          : null;
    },
  }),
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
  UIcon: defineComponent({ setup: () => () => h("span") }),
  UFileUpload: defineComponent({
    props: { modelValue: File },
    emits: ["update:modelValue"],
    setup(_props, { emit, attrs }) {
      return () =>
        h("input", {
          ...attrs,
          type: "file",
          onChange: (event: Event) =>
            emit("update:modelValue", (event.target as HTMLInputElement).files?.[0]),
        });
    },
  }),
  UCheckbox: defineComponent({
    props: { modelValue: Boolean },
    emits: ["update:modelValue"],
    setup(props, { emit, attrs }) {
      return () =>
        h("input", {
          ...attrs,
          type: "checkbox",
          checked: props.modelValue,
          onChange: (event: Event) =>
            emit("update:modelValue", (event.target as HTMLInputElement).checked),
        });
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
    props: { headerTemplates: [], outboundCallEdges: [], endpointOptions: [], ...props },
    global: {
      components: nuxtUiStubs,
      stubs: {
        ConfirmDialog: nuxtUiStubs.ConfirmDialog,
        DialogTitle: true,
        DialogDescription: true,
      },
    },
  });
}

const draft = {
  name: "Orders",
  apiType: "REST" as const,
  framework: "Spring Boot",
  baseUrl: "http://localhost:8080",
  grpcTls: false,
  protoContent: null,
  healthCheckUrl: null,
  healthCheckHeaderTemplateId: null,
  healthCheckCustomHeaders: [],
  active: true,
  endpoints: [
    {
      id: "endpoint-1",
      name: "List orders",
      method: "GET" as const,
      url: "/orders",
      rpcMethod: null,
    },
  ],
};

describe("ServiceSettingsPanel", () => {
  it("shows the health polling cadence and live last-check age only in settings", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-09T00:00:05.000Z"));
    const wrapper = mountPanel({
      draft: structuredClone(draft),
      frameworkMenuOpen: false,
      editingServiceId: "service-1",
      lastHealthCheckAt: "2026-11-09T00:00:00.000Z",
    });

    expect(wrapper.text()).toContain("Checks every 1 minute");
    expect(wrapper.text()).toContain("Checked 5 seconds ago");
    vi.advanceTimersByTime(1000);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("Checked 6 seconds ago");
    wrapper.unmount();
    vi.useRealTimers();
  });

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
    const panelDraft: Omit<typeof draft, "apiType"> & {
      apiType: "REST" | "GRPC" | "WEBSOCKET";
    } = structuredClone(draft);
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
    expect(wrapper.find('option[value="Other"]').exists()).toBe(true);
    await framework.setValue(".NET");
    expect(panelDraft.framework).toBe(".NET");
    expect(wrapper.emitted("update:frameworkMenuOpen")).toEqual([[true], [false]]);
  });

  it("configures WebSocket service addresses and endpoint drafts", async () => {
    const panelDraft: Omit<typeof draft, "apiType"> & {
      apiType: "REST" | "GRPC" | "WEBSOCKET";
    } = structuredClone(draft);
    const wrapper = mountPanel({
      draft: panelDraft,
      frameworkMenuOpen: false,
      editingServiceId: null,
    });

    await wrapper.get("#service-api-type").setValue("WEBSOCKET");
    expect(panelDraft).toMatchObject({
      apiType: "WEBSOCKET",
      baseUrl: "ws://localhost:3000/socket",
      endpoints: [{ method: null, url: "ws://localhost:3000/socket", rpcMethod: null }],
    });
    await wrapper.get('[aria-expanded="false"]').trigger("click");
    expect(wrapper.text()).toContain("WebSocket URL");
    expect(wrapper.get("#service-endpoint-url-endpoint-1").attributes("placeholder")).toBe(
      "ws://localhost:4000/events",
    );
  });

  it("adds Kafka subscribers to the service draft and includes them when saving", async () => {
    const wrapper = mountPanel({
      draft: structuredClone(draft),
      frameworkMenuOpen: false,
      editingServiceId: "service-1",
      messageDestinations: [
        {
          id: "orders-topic",
          projectId: "project-1",
          broker: "kafka",
          name: "Orders",
          connection: { brokers: "localhost:9092", securityProtocol: "PLAINTEXT" },
          x: 0,
          y: 0,
        },
      ],
      messageSubscriptions: [],
    });

    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("New subscriber"))!
      .trigger("click");
    expect(wrapper.text()).toContain("Consumers / subscribers");
    expect(wrapper.text()).toContain("Orders");
    await wrapper
      .findAll("footer button")
      .find((button) => button.text() === "Update")!
      .trigger("click");
    expect(wrapper.emitted("save")?.[0]?.[0]).toMatchObject([
      {
        destinationId: "orders-topic",
        consumerGroup: "cairn-consumers",
      },
    ]);
  });

  it("adds repeatable combined outbound targets to endpoints and removes saved calls", async () => {
    const wrapper = mountPanel({
      draft: structuredClone(draft),
      frameworkMenuOpen: false,
      editingServiceId: "service-1",
      endpointOptions: [
        { id: "endpoint-1", serviceId: "service-1", label: "Orders | List orders (GET)" },
        { id: "endpoint-2", serviceId: "service-2", label: "Payments | Create payment (POST)" },
      ],
      outboundCallEdges: [],
    });

    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("List orders"))!
      .trigger("click");
    const newCallButtons = wrapper
      .findAll("button")
      .filter((button) => button.text().trim() === "New");
    await newCallButtons[0]!.trigger("click");
    await wrapper
      .findAll("button")
      .filter((button) => button.text().trim() === "New")[0]!
      .trigger("click");
    expect(wrapper.findAll('[aria-label^="Outbound call "][aria-label$=" target"]')).toHaveLength(
      2,
    );
    await wrapper.get('[aria-label="Outbound call 1 target"]').setValue("endpoint:endpoint-2");
    expect(wrapper.emitted("setOutboundCall")).toEqual([
      ["endpoint-1", undefined, "endpoint:endpoint-2"],
    ]);

    const existingCallEdges = [
      { id: "edge-1", sourceEndpointId: "endpoint-1", targetEndpointId: "endpoint-2" },
    ];
    const existingCall = mountPanel({
      draft: structuredClone(draft),
      frameworkMenuOpen: false,
      editingServiceId: "service-1",
      endpointOptions: [
        { id: "endpoint-2", serviceId: "service-2", label: "Payments | Create payment (POST)" },
      ],
      outboundCallEdges: existingCallEdges,
    });
    await existingCall
      .findAll("button")
      .find((button) => button.text().includes("List orders"))!
      .trigger("click");
    expect(existingCall.text()).toContain("Payments | Create payment (POST)");
    await existingCall.get('[aria-label="Delete outbound call 1"]').trigger("click");
    expect(existingCall.emitted("removeOutboundCall")).toEqual([["edge-1"]]);
  });

  it("shows legacy service-level publishes under the first endpoint", async () => {
    const wrapper = mountPanel({
      draft: structuredClone(draft),
      frameworkMenuOpen: false,
      editingServiceId: "service-1",
      messageDestinations: [
        {
          id: "topic-1",
          projectId: "project-1",
          broker: "kafka",
          name: "Orders",
          connection: { brokers: "localhost:9092", securityProtocol: "PLAINTEXT" },
          x: 0,
          y: 0,
        },
      ],
      messageConnections: [
        {
          id: "publish-1",
          type: "publish",
          serviceId: "service-1",
          destinationId: "topic-1",
        },
      ],
    });

    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("List orders"))!
      .trigger("click");

    expect(
      (wrapper.get('[aria-label="Outbound call 1 target"]').element as HTMLSelectElement).value,
    ).toBe("destination:topic-1");
  });

  it("lets saved consumer cards add multiple combined outbound targets", async () => {
    const wrapper = mountPanel({
      draft: structuredClone(draft),
      frameworkMenuOpen: false,
      editingServiceId: "service-1",
      endpointOptions: [
        { id: "endpoint-2", serviceId: "service-2", label: "Payments | Create payment (POST)" },
      ],
      messageDestinations: [
        {
          id: "topic-2",
          projectId: "project-1",
          broker: "kafka",
          name: "Payments",
          connection: { brokers: "localhost:9092", securityProtocol: "PLAINTEXT" },
          x: 0,
          y: 0,
        },
      ],
      messageSubscriptions: [
        {
          id: "subscription-1",
          type: "subscribe",
          destinationId: "topic-1",
          serviceId: "service-1",
          consumerGroup: "orders",
        },
      ],
      messageConnections: [],
      outboundCallEdges: [],
    });

    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("Select topic"))!
      .trigger("click");
    await wrapper
      .findAll("button")
      .filter((button) => button.text().trim() === "New")[0]!
      .trigger("click");
    await wrapper
      .findAll("button")
      .filter((button) => button.text().trim() === "New")[0]!
      .trigger("click");
    await wrapper.get('[aria-label="Outbound call 1 target"]').setValue("endpoint:endpoint-2");
    await wrapper.get('[aria-label="Outbound call 1 target"]').setValue("destination:topic-2");
    expect(wrapper.emitted("setOutboundCall")).toEqual([
      ["subscription-1", undefined, "endpoint:endpoint-2"],
      ["subscription-1", undefined, "destination:topic-2"],
    ]);
  });

  it("shows the GET-only health URL and reusable header controls for Other", async () => {
    const panelDraft = {
      ...structuredClone(draft),
      healthCheckCustomHeaders: [{ name: "X-Key", value: "{{apiKey}}" }],
    };
    const wrapper = mountPanel({
      draft: panelDraft,
      frameworkMenuOpen: false,
      editingServiceId: null,
      headerTemplates: [{ id: "template-1", name: "Auth", headers: [] }],
    });
    await wrapper.get('[aria-label="Framework: Spring Boot"]').setValue("Other");
    expect(wrapper.get('input[aria-label="Health-check header name"]').element).toBeTruthy();
    expect(wrapper.text()).toContain("use an absolute URL when the health endpoint");
    expect(wrapper.find('option[value="template-1"]').exists()).toBe(true);
    expect(
      wrapper.find('input[placeholder="Leave blank to use the framework default"]').exists(),
    ).toBe(true);
  });

  it("emits save, discard, endpoint edit intents, and service deletion", async () => {
    const wrapper = mountPanel({
      draft: structuredClone(draft),
      frameworkMenuOpen: false,
      editingServiceId: "service-1",
    });
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Update")!
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

    expect(wrapper.emitted("removeService")).toBeUndefined();
    await wrapper.get('[role="alertdialog"] button:last-child').trigger("click");

    expect(wrapper.emitted("save")).toEqual([[[]]]);
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

  it("shows gRPC controls and emits uploaded proto files", async () => {
    const panelDraft: Omit<typeof draft, "apiType"> & { apiType: "REST" | "GRPC" } =
      structuredClone(draft);
    const wrapper = mountPanel({
      draft: panelDraft,
      frameworkMenuOpen: false,
      editingServiceId: null,
    });
    await wrapper.get("#service-api-type").setValue("GRPC");
    expect(panelDraft.apiType).toBe("GRPC");
    expect(wrapper.text()).toContain("Target address");
    expect(wrapper.text()).toContain("Use TLS");
    expect(wrapper.findAll('input[type="file"]')).toHaveLength(1);
    expect(wrapper.find('input[aria-label="Upload OpenAPI schema"]').exists()).toBe(false);

    const file = new File(['syntax = "proto3";'], "service.proto", { type: "text/plain" });
    Object.defineProperty(wrapper.get('input[type="file"]').element, "files", {
      configurable: true,
      value: [file],
    });
    await wrapper.get('input[type="file"]').trigger("change");
    expect(wrapper.emitted("importProto")).toEqual([[file]]);
  });

  it("uses Nuxt UI form controls while keeping the service draft editable", async () => {
    const panelDraft = structuredClone(draft);
    const wrapper = mountPanel({
      draft: panelDraft,
      frameworkMenuOpen: false,
      editingServiceId: null,
    });

    await wrapper.get('[aria-expanded="false"]').trigger("click");

    expect(wrapper.findAll('input:not([type="file"])')).toHaveLength(5);
    expect(wrapper.findAll("select")).toHaveLength(4);
    expect(wrapper.findAll("button")).toHaveLength(10);
    expect(wrapper.find('select option[value="PATCH"]').exists()).toBe(true);
    await wrapper.get('input[placeholder="e.g. Checkout API"]').setValue("Catalog API");
    await wrapper.findAll("select").at(3)!.setValue("POST");

    expect(panelDraft.name).toBe("Catalog API");
    expect(panelDraft.endpoints[0]?.method).toBe("POST");
    expect(
      wrapper.get('input[placeholder="e.g. Checkout API"]').attributes("required"),
    ).toBeDefined();
  });

  it("discards an untouched create form without a warning", async () => {
    const wrapper = mountPanel({
      draft: structuredClone(draft),
      frameworkMenuOpen: false,
      editingServiceId: null,
    });
    await wrapper
      .findAll("footer button")
      .find((button) => button.text() === "Discard")!
      .trigger("click");
    expect(wrapper.emitted("discard")).toEqual([[]]);
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(false);
  });

  it("keeps a changed editor open when discard is canceled", async () => {
    const wrapper = mountPanel({
      draft: structuredClone(draft),
      frameworkMenuOpen: false,
      editingServiceId: "service-1",
    });
    await wrapper.get("#service-name").setValue("Changed orders");
    await wrapper
      .findAll("footer button")
      .find((button) => button.text() === "Discard")!
      .trigger("click");
    expect(wrapper.emitted("discard")).toBeUndefined();
    await wrapper.get('[role="alertdialog"] button:first-child').trigger("click");
    expect(wrapper.emitted("discard")).toBeUndefined();
    await wrapper
      .findAll("footer button")
      .find((button) => button.text() === "Discard")!
      .trigger("click");
    await wrapper.get('[role="alertdialog"] button:last-child').trigger("click");
    expect(wrapper.emitted("discard")).toEqual([[]]);
  });

  it("keeps a saved service when deletion is canceled", async () => {
    const wrapper = mountPanel({
      draft: structuredClone(draft),
      frameworkMenuOpen: false,
      editingServiceId: "service-1",
    });
    await wrapper.get('[aria-label="Remove service"]').trigger("click");
    await wrapper.get('[role="alertdialog"] button:first-child').trigger("click");
    expect(wrapper.emitted("removeService")).toBeUndefined();
  });
});
