// @vitest-environment happy-dom
import { ref } from "vue";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { createApiClient, type ApiTransportOptions } from "../models/api-client";
import { useServiceViewModel, type ServiceDraft } from "./useServiceViewModel";
import { createPinia, setActivePinia } from "pinia";
import { useGraphStore } from "../stores/graph";
import { mount } from "@vue/test-utils";
import ServiceSettingsPanel from "../components/ServiceSettingsPanel.vue";

const service = {
  id: "service-1",
  projectId: "project-1",
  name: "Orders",
  framework: "Spring Boot",
  baseUrl: "http://localhost:8080",
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
      apiType: "REST",
      method: "GET",
      url: "/orders",
      createdAt: "2025-01-01T00:00:00.000Z",
    },
  ],
};

describe("service view model", () => {
  beforeEach(() => setActivePinia(createPinia()));

  function setup() {
    const calls: { url: string; options: ApiTransportOptions }[] = [];
    const apiClient = createApiClient(async (url, options) => {
      calls.push({ url, options });
      return { id: "service-1" };
    });
    const draft = ref<ServiceDraft>({
      name: "Orders",
      framework: "Spring Boot",
      baseUrl: "http://localhost:8080",
      active: true,
      endpoints: [
        { id: "endpoint-1", name: "List orders", apiType: "REST", method: "GET", url: "/orders" },
      ],
    });
    const editingServiceId = ref<string | null>(null);
    const dialogOpen = ref(false);
    const frameworkMenuOpen = ref(true);
    const addPosition = ref({ x: 12, y: 24 });
    const events: string[] = [];
    const errors: string[] = [];
    const warningBatches: string[][] = [];
    const options = {
      apiClient,
      draft,
      editingServiceId,
      dialogOpen,
      frameworkMenuOpen,
      addPosition,
      services: () => [service],
      saveCanvas: async () => void events.push("save-canvas"),
      loadCanvas: async () => void events.push("load-canvas"),
      closeSettings: () => events.push("close"),
      frameworkLabel: (framework: string) => (framework.includes(".net") ? ".NET" : framework),
      onError: (message: string) => errors.push(message),
      onImportWarnings: (warnings: string[]) => warningBatches.push(warnings),
    };
    return { vm: useServiceViewModel(options), ...options, calls, events, errors, warningBatches };
  }

  it("creates default drafts, starts add flow, edits services, and resolves endpoint owners", () => {
    const context = setup();
    expect(context.vm.newServiceDraft()).toEqual({
      name: "",
      framework: "",
      baseUrl: "http://localhost:3000",
      active: true,
      endpoints: [{ name: "", apiType: "REST", method: "GET", url: "/" }],
    });
    context.vm.beginAddService({ x: 70, y: 90 });
    expect(context.addPosition.value).toEqual({ x: 70, y: 90 });
    expect(context.dialogOpen.value).toBe(true);
    expect(context.frameworkMenuOpen.value).toBe(false);
    expect(context.vm.editService("missing")).toBe(false);
    expect(context.vm.editService("service-1")).toBe(true);
    expect(context.draft.value).toMatchObject({ name: "Orders", framework: "Spring Boot" });
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
    expect(context.events).toEqual(["save-canvas", "close", "load-canvas", "save-canvas"]);

    context.events.length = 0;
    context.vm.editService("service-1");
    await context.vm.saveService();
    expect(context.calls[1]?.url).toBe("/api/services/service-1");
    expect(context.calls[1]?.options.method).toBe("PUT");
    expect(context.events).toEqual(["save-canvas", "close", "load-canvas", "save-canvas"]);
  });

  it("deletes only after confirmation and reports API errors", async () => {
    const context = setup();
    await context.vm.deleteService("service-1", () => false);
    expect(context.calls).toHaveLength(0);
    await context.vm.deleteService("service-1", () => true);
    expect(context.calls[0]?.options.method).toBe("DELETE");
    expect(context.events).toEqual(["save-canvas", "load-canvas", "save-canvas"]);
  });

  it("integrates service form edits with the graph store and service API", async () => {
    const context = setup();
    const graphStore = useGraphStore();
    graphStore.applyCanvas({
      services: [service],
      edges: [],
      mockApis: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      mockNode: { x: 560, y: 160 },
    });
    context.editingServiceId.value = "service-1";
    const wrapper = mount(ServiceSettingsPanel, {
      props: {
        draft: context.draft.value,
        frameworkMenuOpen: false,
        editingServiceId: "service-1",
      },
    });
    await wrapper.get("footer button.app__button--primary").trigger("click");
    context.draft.value.name = "Updated Orders";
    await context.vm.saveService();
    graphStore.services[0]!.name = context.draft.value.name;

    expect(context.calls[0]?.options.method).toBe("PUT");
    expect(graphStore.services[0]?.name).toBe("Updated Orders");
    expect(wrapper.emitted("save")).toEqual([[]]);
  });

  it("imports valid OpenAPI files through the service settings control with per-operation warnings", async () => {
    const context = setup();
    let importPromise: Promise<unknown> | undefined;
    const wrapper = mount(ServiceSettingsPanel, {
      props: {
        draft: context.draft.value,
        frameworkMenuOpen: false,
        editingServiceId: "service-1",
        onImportOpenApi: (file: File) => (importPromise = context.vm.importOpenApiFile(file)),
      },
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
      apiType: "REST",
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
  });

  it("reports parser failures through the service settings flow without changing endpoint drafts", async () => {
    const context = setup();
    let importPromise: Promise<unknown> | undefined;
    const wrapper = mount(ServiceSettingsPanel, {
      props: {
        draft: context.draft.value,
        frameworkMenuOpen: false,
        editingServiceId: "service-1",
        onImportOpenApi: (file: File) => (importPromise = context.vm.importOpenApiFile(file)),
      },
    });
    const file = new File(["not valid OpenAPI"], "invalid.yaml", { type: "text/yaml" });
    const input = wrapper.get('[aria-label="Upload OpenAPI schema"]');
    Object.defineProperty(input.element, "files", { configurable: true, value: [file] });
    await input.trigger("change");
    await importPromise;

    expect(context.draft.value.endpoints).toEqual([
      { id: "endpoint-1", name: "List orders", apiType: "REST", method: "GET", url: "/orders" },
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
          { name: "List products", apiType: "REST", method: "GET", url: "/products" },
        ],
      },
    });

    const addContext = setup();
    addContext.vm.beginAddService({ x: 20, y: 30 });
    addContext.draft.value.name = "New Orders";
    addContext.draft.value.framework = "Spring Boot";
    await addContext.vm.importOpenApiFile(new File([content], "openapi.json"));
    expect(addContext.draft.value.endpoints).toEqual([
      { name: "List products", apiType: "REST", method: "GET", url: "/products" },
    ]);
    expect(addContext.calls).toEqual([]);
    await addContext.vm.saveService();
    expect(addContext.calls[0]?.options).toMatchObject({
      method: "POST",
      body: {
        endpoints: [{ name: "List products", apiType: "REST", method: "GET", url: "/products" }],
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
        onImportOpenApi: (file: File) => (importPromise = context.vm.importOpenApiFile(file)),
        onDiscard: () => context.closeSettings(),
      },
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

    await wrapper.get("footer button.app__button--secondary").trigger("click");
    expect(context.events).toContain("close");
    expect(context.calls).toEqual([]);
    expect(context.vm.editService("service-1")).toBe(true);
    expect(context.draft.value.endpoints).toHaveLength(1);
  });
});
