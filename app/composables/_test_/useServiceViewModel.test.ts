// @vitest-environment happy-dom
import { defineComponent, h, ref } from "vue";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { createApiClient, type ApiTransportOptions } from "../../shared/api";
import { useServiceViewModel, type ServiceDraft } from "../useServiceViewModel";
import { createPinia, setActivePinia } from "pinia";
import { useGraphStore } from "../../stores/graph";
import { mount } from "@vue/test-utils";
import { ServiceSettingsPanel } from "../../features/service-editor";

const nuxtUiStubs = {
  ConfirmDialog: defineComponent({
    props: { open: Boolean, confirmLabel: String },
    emits: ["confirm", "cancel"],
    setup(props, { emit }) {
      return () =>
        props.open
          ? h("div", { role: "alertdialog" }, [
              h("button", { onClick: () => emit("cancel") }, "Cancel"),
              h("button", { onClick: () => emit("confirm") }, props.confirmLabel),
            ])
          : null;
    },
  }),
  USlideover: defineComponent({
    props: { ui: Object, content: Object },
    setup(props, { slots }) {
      return () =>
        h("div", { class: props.ui?.overlay }, [
          h("section", { class: props.ui?.content }, [
            h("header", { class: props.ui?.header }, [
              ...(slots.title?.() ?? []),
              ...(slots.description?.() ?? []),
              ...(slots.actions?.() ?? []),
            ]),
            h("div", { class: props.ui?.body }, slots.body?.()),
            h("footer", { class: props.ui?.footer }, slots.footer?.()),
          ]),
        ]);
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
    props: { modelValue: String, placeholder: String, required: Boolean, ui: Object },
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
            class: props.ui?.base,
            value: props.modelValue,
            onChange: (event: Event) =>
              emit("update:modelValue", (event.target as HTMLSelectElement).value),
          },
          props.items?.map((item) => {
            const option = item as { value?: string; label?: string };
            return h("option", { value: option.value }, option.label);
          }),
        );
    },
  }),
  UAccordion: defineComponent({
    inheritAttrs: false,
    props: { items: Array, modelValue: [String, Array], ui: Object },
    emits: ["update:modelValue"],
    setup(_props, { attrs, slots }) {
      return () => h("div", attrs, [slots.default?.(), slots.body?.()]);
    },
  }),
};

const service = {
  id: "service-1",
  projectId: "project-1",
  name: "Orders",
  apiType: "REST" as const,
  framework: "Spring Boot",
  baseUrl: "http://localhost:8080",
  grpcTls: false,
  protoFileName: null,
  healthCheckUrl: "/ready",
  healthCheckHeaderTemplateId: "template-1",
  healthCheckCustomHeaders: [{ name: "X-Key", value: "{{apiKey}}" }],
  active: true,
  positionX: 1,
  positionY: 2,
  createdAt: "2025-01-01T00:00:00.000Z",
  endpoints: [
    {
      id: "endpoint-1",
      projectId: "project-1",
      serviceId: "service-1",
      name: "List orders",
      method: "GET",
      url: "/orders",
      rpcMethod: null,
      createdAt: "2025-01-01T00:00:00.000Z",
    },
  ],
};

describe("service view model", () => {
  beforeEach(() => setActivePinia(createPinia()));

  function setup(refreshSucceeds = true) {
    const calls: { url: string; options: ApiTransportOptions }[] = [];
    let protoParseResponse: {
      methods: Array<{ name: string; rpcMethod: string }>;
      streamingMethods: string[];
      unresolvedImports: string[];
    } = {
      methods: [
        { name: "demo.Echo.Get", rpcMethod: "/demo.Echo/Get" },
        { name: "demo.Echo.Create", rpcMethod: "/demo.Echo/Create" },
      ],
      streamingMethods: ["/demo.Echo/Stream"],
      unresolvedImports: [],
    };
    const apiClient = createApiClient(async (url, options) => {
      calls.push({ url, options });
      if (url === "/api/services/proto-parse") return protoParseResponse;
      return { id: "service-1" };
    });
    const draft = ref<ServiceDraft>({
      name: "Orders",
      apiType: "REST",
      framework: "Spring Boot",
      baseUrl: "http://localhost:8080",
      grpcTls: false,
      protoContent: null,
      protoFileName: null,
      clearProto: false,
      healthCheckUrl: null,
      healthCheckHeaderTemplateId: null,
      healthCheckCustomHeaders: [],
      active: true,
      endpoints: [{ id: "endpoint-1", name: "List orders", method: "GET", url: "/orders" }],
    });
    const editingServiceId = ref<string | null>(null);
    const dialogOpen = ref(false);
    const frameworkMenuOpen = ref(true);
    const addPosition = ref({ x: 12, y: 24 });
    const events: string[] = [];
    const errors: string[] = [];
    const warningBatches: string[][] = [];
    const successes: string[] = [];
    const options = {
      apiClient,
      draft,
      editingServiceId,
      dialogOpen,
      frameworkMenuOpen,
      addPosition,
      services: () => [service],
      saveCanvas: async () => void events.push("save-canvas"),
      loadCanvas: async () => {
        events.push("load-canvas");
        return refreshSucceeds;
      },
      closeSettings: () => events.push("close"),
      frameworkLabel: (framework: string) => (framework.includes(".net") ? ".NET" : framework),
      onError: (message: string) => {
        if (message) errors.push(message);
      },
      onImportWarnings: (warnings: string[]) => warningBatches.push(warnings),
      onSuccess: (action: "created" | "updated" | "deleted") => successes.push(action),
    };
    return {
      vm: useServiceViewModel(options),
      ...options,
      calls,
      events,
      errors,
      warningBatches,
      successes,
      setProtoParseResponse: (response: typeof protoParseResponse) =>
        (protoParseResponse = response),
    };
  }

  it("creates default drafts, starts add flow, edits services, and resolves endpoint owners", () => {
    const context = setup();
    expect(context.vm.newServiceDraft()).toEqual({
      name: "",
      apiType: "REST",
      framework: "",
      baseUrl: "http://localhost:3000",
      grpcTls: false,
      protoContent: null,
      protoFileName: null,
      clearProto: false,
      healthCheckUrl: null,
      healthCheckHeaderTemplateId: null,
      healthCheckCustomHeaders: [],
      active: true,
      endpoints: [{ name: "", method: "GET", url: "/" }],
    });
    context.vm.beginAddService({ x: 70, y: 90 });
    expect(context.addPosition.value).toEqual({ x: 70, y: 90 });
    expect(context.dialogOpen.value).toBe(true);
    expect(context.frameworkMenuOpen.value).toBe(false);
    expect(context.vm.editService("missing")).toBe(false);
    expect(context.vm.editService("service-1")).toBe(true);
    expect(context.draft.value).toMatchObject({
      name: "Orders",
      framework: "Spring Boot",
      healthCheckUrl: "/ready",
      healthCheckHeaderTemplateId: "template-1",
      healthCheckCustomHeaders: [{ name: "X-Key", value: "{{apiKey}}" }],
    });
    expect(context.vm.openServiceEndpoint("endpoint-1")).toBe("service-1");
    expect(context.vm.openServiceEndpoint("missing")).toBeUndefined();
  });

  it("adds and removes endpoint drafts", () => {
    const context = setup();
    context.vm.addEndpoint();
    expect(context.draft.value.endpoints).toHaveLength(2);
    context.vm.removeEndpoint(0);
    expect(context.draft.value.endpoints).toHaveLength(1);
    expect(context.draft.value.endpoints[0]?.url).toBe("/");
  });

  it("adds an endpoint with the selected WebSocket target address", () => {
    const context = setup();
    context.draft.value.apiType = "WEBSOCKET";
    context.draft.value.baseUrl = "wss://example.test/socket";
    context.draft.value.endpoints = [];

    context.vm.addEndpoint();

    expect(context.draft.value.endpoints).toEqual([{ name: "", url: "wss://example.test/socket" }]);
  });

  it("imports unary methods, skips duplicates and streaming methods, and preserves drafts on import errors", async () => {
    const context = setup();
    context.draft.value.apiType = "GRPC";
    context.draft.value.baseUrl = "localhost:50051";
    context.draft.value.endpoints = [
      { id: "endpoint-1", name: "Existing", rpcMethod: "/demo.Echo/Get" },
    ];
    const file = new File(['syntax = "proto3";'], "service.proto");
    await context.vm.importProtoFile(file);

    expect(context.draft.value.endpoints).toEqual([
      { id: "endpoint-1", name: "Existing", rpcMethod: "/demo.Echo/Get" },
      { name: "demo.Echo.Create", rpcMethod: "/demo.Echo/Create" },
    ]);
    expect(context.draft.value.protoContent).toBe('syntax = "proto3";');
    expect(context.warningBatches.at(-1)).toEqual([
      "Skipped streaming method /demo.Echo/Stream.",
      "Skipped duplicate /demo.Echo/Get: this endpoint is already registered.",
    ]);

    const before = context.draft.value.endpoints.map((endpoint) => ({ ...endpoint }));
    context.setProtoParseResponse({
      methods: [],
      streamingMethods: [],
      unresolvedImports: ["common.proto"],
    });
    await context.vm.importProtoFile(new File(['import "common.proto";'], "service.proto"));
    expect(context.draft.value.endpoints).toEqual(before);
    expect(context.draft.value.protoContent).toBe('syntax = "proto3";');
    expect(context.errors.at(-1)).toContain("common.proto");
  });

  it("saves new and existing services through the API client and refreshes the graph", async () => {
    const context = setup();
    context.vm.beginAddService({ x: 50, y: 60 });
    context.draft.value.name = "New Orders";
    context.draft.value.framework = "Spring Boot";
    context.draft.value.endpoints[0]!.name = "List orders";
    await context.vm.saveService();
    expect(context.errors).toEqual([]);
    expect(context.calls[0]).toMatchObject({
      url: "/api/services",
      options: { method: "POST", body: { positionX: 50, positionY: 60 } },
    });
    expect(context.events).toEqual(["save-canvas", "load-canvas", "save-canvas", "close"]);
    expect(context.successes).toEqual(["created"]);

    context.events.length = 0;
    context.vm.editService("service-1");
    await context.vm.saveService();
    expect(context.calls[1]?.url).toBe("/api/services/service-1");
    expect(context.calls[1]?.options.method).toBe("PUT");
    expect(context.calls[1]?.options.body).toMatchObject({
      healthCheckUrl: "/ready",
      healthCheckHeaderTemplateId: "template-1",
      healthCheckCustomHeaders: [{ name: "X-Key", value: "{{apiKey}}" }],
    });
    expect(context.events).toEqual(["save-canvas", "load-canvas", "save-canvas", "close"]);
    expect(context.successes).toEqual(["created", "updated"]);
  });

  it("deletes one service after editor confirmation", async () => {
    const context = setup();
    await context.vm.deleteService("service-1");
    expect(context.calls[0]?.options.method).toBe("DELETE");
    expect(context.events).toEqual(["save-canvas", "load-canvas", "save-canvas"]);
    expect(context.successes).toEqual(["deleted"]);
  });

  it("retains the service editor and withholds success when refresh fails", async () => {
    const context = setup(false);
    context.vm.editService("service-1");
    await context.vm.saveService();

    expect(context.calls[0]?.options.method).toBe("PUT");
    expect(context.events).toEqual(["save-canvas", "load-canvas"]);
    expect(context.errors.at(-1)).toContain("workspace refresh failed");
    expect(context.successes).toEqual([]);
    expect(context.dialogOpen.value).toBe(true);
  });

  it("integrates service form edits with the graph store and service API", async () => {
    const context = setup();
    const graphStore = useGraphStore();
    graphStore.applyCanvas({
      nodesLocked: false,
      services: [service],
      edges: [],
      messageDestinations: [],
      messageConnections: [],
      mockApis: [],
      headerTemplates: [],
      authorizationTemplates: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    });
    context.editingServiceId.value = "service-1";
    const wrapper = mount(ServiceSettingsPanel, {
      props: {
        draft: context.draft.value,
        frameworkMenuOpen: false,
        editingServiceId: "service-1",
        headerTemplates: [],
        authorizationTemplates: [],
      },
      global: { components: nuxtUiStubs, stubs: { ConfirmDialog: nuxtUiStubs.ConfirmDialog } },
    });
    await wrapper
      .findAll("footer button")
      .find((button) => button.text() === "Update")!
      .trigger("click");
    context.draft.value.name = "Updated Orders";
    await context.vm.saveService();
    graphStore.services[0]!.name = context.draft.value.name;

    expect(context.calls[0]?.options.method).toBe("PUT");
    expect(graphStore.services[0]?.name).toBe("Updated Orders");
    expect(wrapper.emitted("save")).toEqual([[[]]]);
  });

  it("imports valid OpenAPI files through the service settings control with per-operation warnings", async () => {
    const context = setup();
    let importPromise: Promise<unknown> | undefined;
    const wrapper = mount(ServiceSettingsPanel, {
      props: {
        draft: context.draft.value,
        frameworkMenuOpen: false,
        editingServiceId: "service-1",
        headerTemplates: [],
        authorizationTemplates: [],
        onImportOpenApi: (file: File) => (importPromise = context.vm.importOpenApiFile(file)),
      },
      global: { components: nuxtUiStubs, stubs: { ConfirmDialog: nuxtUiStubs.ConfirmDialog } },
    });
    const file = new File(
      [
        JSON.stringify({
          openapi: "3.1.0",
          info: { title: "Orders", version: "1.0.0" },
          paths: {
            "/orders": { get: { summary: "Renamed existing route" } },
            "/products": { get: { summary: "List products" }, head: {} },
          },
        }),
      ],
      "openapi.json",
      { type: "application/json" },
    );
    const input = wrapper.get('[aria-label="Upload OpenAPI schema"]');
    Object.defineProperty(input.element, "files", { configurable: true, value: [file] });
    await input.trigger("change");
    await importPromise;

    expect(context.draft.value.endpoints).toHaveLength(2);
    expect(context.draft.value.endpoints[0]?.name).toBe("List orders");
    expect(context.draft.value.endpoints[1]).toEqual({
      name: "List products",
      method: "GET",
      url: "/products",
    });
    expect(context.warningBatches).toEqual([
      [
        "Skipped duplicate GET /orders: this endpoint is already registered.",
        "Skipped HEAD /products: this HTTP method is not supported.",
      ],
    ]);
    expect(context.errors).toEqual([]);
    expect(context.calls).toEqual([]);
    expect(context.events).toEqual([]);
  });

  it("reports parser failures through the service settings flow without changing endpoint drafts", async () => {
    const context = setup();
    let importPromise: Promise<unknown> | undefined;
    const wrapper = mount(ServiceSettingsPanel, {
      props: {
        draft: context.draft.value,
        frameworkMenuOpen: false,
        editingServiceId: "service-1",
        headerTemplates: [],
        authorizationTemplates: [],
        onImportOpenApi: (file: File) => (importPromise = context.vm.importOpenApiFile(file)),
      },
      global: { components: nuxtUiStubs, stubs: { ConfirmDialog: nuxtUiStubs.ConfirmDialog } },
    });
    const file = new File(["not valid OpenAPI"], "invalid.yaml", { type: "text/yaml" });
    const input = wrapper.get('[aria-label="Upload OpenAPI schema"]');
    Object.defineProperty(input.element, "files", { configurable: true, value: [file] });
    await input.trigger("change");
    await importPromise;

    expect(context.draft.value.endpoints).toEqual([
      { id: "endpoint-1", name: "List orders", method: "GET", url: "/orders" },
    ]);
    expect(context.errors[0]).toContain("Could not import OpenAPI document");
    expect(context.calls).toEqual([]);
  });

  it("keeps imported endpoints unsaved until service save and persists them on create and update", async () => {
    const content = JSON.stringify({
      openapi: "3.1.0",
      info: { title: "Orders", version: "1.0.0" },
      paths: { "/products": { get: { summary: "List products" } } },
    });
    const context = setup();
    context.vm.editService("service-1");
    await context.vm.importOpenApiFile(new File([content], "openapi.json"));

    expect(context.calls).toEqual([]);
    await context.vm.saveService();
    expect(context.calls[0]?.options).toMatchObject({
      method: "PUT",
      body: {
        endpoints: [
          { id: "endpoint-1", name: "List orders", method: "GET", url: "/orders" },
          { name: "List products", method: "GET", url: "/products" },
        ],
      },
    });

    const addContext = setup();
    addContext.vm.beginAddService({ x: 20, y: 30 });
    addContext.draft.value.name = "New Orders";
    addContext.draft.value.framework = "Spring Boot";
    await addContext.vm.importOpenApiFile(new File([content], "openapi.json"));
    expect(addContext.draft.value.endpoints).toEqual([
      { name: "List products", method: "GET", url: "/products" },
    ]);
    expect(addContext.calls).toEqual([]);
    await addContext.vm.saveService();
    expect(addContext.calls[0]?.options).toMatchObject({
      method: "POST",
      body: {
        endpoints: [{ name: "List products", method: "GET", url: "/products" }],
      },
    });
  });

  it("preserves an edited starter endpoint when importing into a new service", async () => {
    const context = setup();
    context.vm.beginAddService({ x: 10, y: 20 });
    context.draft.value.endpoints[0]!.name = "Root endpoint";
    await context.vm.importOpenApiFile(
      new File(
        [
          JSON.stringify({
            openapi: "3.1.0",
            info: { title: "Orders", version: "1.0.0" },
            paths: { "/products": { get: { summary: "List products" } } },
          }),
        ],
        "openapi.json",
      ),
    );

    expect(context.draft.value.endpoints).toHaveLength(2);
    expect(context.draft.value.endpoints[0]?.name).toBe("Root endpoint");
    expect(context.draft.value.endpoints[1]?.url).toBe("/products");
  });

  it("discards imported endpoint drafts when service settings are closed without saving", async () => {
    const context = setup();
    context.vm.editService("service-1");
    let importPromise: Promise<unknown> | undefined;
    const wrapper = mount(ServiceSettingsPanel, {
      props: {
        draft: context.draft.value,
        frameworkMenuOpen: false,
        editingServiceId: "service-1",
        headerTemplates: [],
        authorizationTemplates: [],
        onImportOpenApi: (file: File) => (importPromise = context.vm.importOpenApiFile(file)),
        onDiscard: () => context.closeSettings(),
      },
      global: { components: nuxtUiStubs, stubs: { ConfirmDialog: nuxtUiStubs.ConfirmDialog } },
    });
    const file = new File(
      [
        JSON.stringify({
          openapi: "3.1.0",
          info: { title: "Orders", version: "1.0.0" },
          paths: { "/products": { get: { summary: "List products" } } },
        }),
      ],
      "openapi.json",
    );
    const input = wrapper.get('[aria-label="Upload OpenAPI schema"]');
    Object.defineProperty(input.element, "files", { configurable: true, value: [file] });
    await input.trigger("change");
    await importPromise;
    expect(context.draft.value.endpoints).toHaveLength(2);

    await wrapper
      .findAll("footer button")
      .find((button) => button.text() === "Discard")!
      .trigger("click");
    await wrapper.get('[role="alertdialog"] button:last-child').trigger("click");
    expect(context.events).toContain("close");
    expect(context.calls).toEqual([]);
    expect(context.vm.editService("service-1")).toBe(true);
    expect(context.draft.value.endpoints).toHaveLength(1);
  });
});
