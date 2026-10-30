import { beforeEach, describe, expect, it } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { useMockApiStore } from "../stores/mockApis";
import { useMockApiViewModel } from "./useMockApiViewModel";
import { ref } from "vue";
import { createApiClient } from "../models/api-client";

const service = {
  id: "service-1",
  projectId: "project-1",
  name: "Orders",
  framework: "Spring Boot",
  baseUrl: "http://localhost:8080",
  active: true,
  positionX: 0,
  positionY: 0,
  createdAt: "2025-01-01T00:00:00.000Z",
  endpoints: [
    {
      id: "endpoint-1",
      projectId: "project-1",
      serviceId: "service-1",
      name: "Get order",
      apiType: "REST",
      method: "GET",
      url: "/orders/{orderId}",
      createdAt: "2025-01-01T00:00:00.000Z",
    },
  ],
};

describe("mock API view model", () => {
  beforeEach(() => setActivePinia(createPinia()));

  function setup(failVariables = false) {
    const store = useMockApiStore();
    const errors: string[] = [];
    const operations: string[] = [];
    const calls: { url: string; method: string }[] = [];
    const apiClient = createApiClient(async (url, options) => {
      calls.push({ url, method: options.method });
      if (url === "/api/environment-variables" && options.method === "GET") {
        if (failVariables) throw new Error("offline");
        return [
          {
            id: "variable-1",
            projectId: "project-1",
            name: "TOKEN",
            value: "secret",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ];
      }
      return { id: "created-id" };
    });
    const environmentCardDraft = ref({ name: "", value: "" });
    const editingEnvironmentVariableId = ref<string | null>(null);
    const expandedEnvironmentVariableId = ref<string | null>(null);
    const variablesOpen = ref(false);
    const panelOpen = ref(false);
    const environmentVariablesLoading = ref(false);
    const registeredApisOpen = ref(false);
    const importWarnings = ref<Array<{ id: number; message: string }>>([]);
    const viewModel = useMockApiViewModel({
      store,
      apiClient,
      services: () => [service],
      environmentCardDraft,
      editingEnvironmentVariableId,
      expandedEnvironmentVariableId,
      variablesOpen,
      panelOpen,
      environmentVariablesLoading,
      registeredApisOpen,
      importWarnings,
      saveCanvas: async () => void operations.push("save"),
      loadCanvas: async () => void operations.push("load"),
      closeSettings: () => operations.push("close"),
      onError: (message) => errors.push(message),
    });
    return {
      store,
      errors,
      operations,
      calls,
      viewModel,
      environmentCardDraft,
      editingEnvironmentVariableId,
      expandedEnvironmentVariableId,
      variablesOpen,
      panelOpen,
      environmentVariablesLoading,
      registeredApisOpen,
      importWarnings,
    };
  }

  it("resolves endpoint path parameters and keeps only matching values", () => {
    const { viewModel } = setup();
    const draft = {
      name: "Get order",
      targetEndpointId: "endpoint-1" as string | null,
      description: "",
      requestJson: "{}",
      pathParameters: { orderId: "42", unused: "drop" },
    };
    expect(viewModel.endpointPathParameterNames(draft)).toEqual(["orderId"]);
    viewModel.setMockEndpoint(draft);
    expect(draft.pathParameters).toEqual({ orderId: "42" });
    draft.targetEndpointId = null;
    expect(viewModel.endpointPathParameterNames(draft)).toEqual([]);
  });

  it("opens the panel, loads variables, and prepares editable API drafts", async () => {
    const context = setup();
    context.store.setMockApis([
      {
        id: "mock-1",
        projectId: "project-1",
        name: "Get order",
        targetEndpointId: "endpoint-1",
        description: "",
        pathParameters: { orderId: "7" },
        requestJson: { includeItems: true },
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    await context.viewModel.openPanel("mock-1");
    expect(context.panelOpen.value).toBe(true);
    expect(context.registeredApisOpen.value).toBe(true);
    expect(context.store.mockDraft[0]).toMatchObject({
      name: "Get order",
      pathParameters: { orderId: "7" },
      requestJson: '{\n  "includeItems": true\n}',
    });
    expect(context.store.environmentVariables).toMatchObject([{ name: "TOKEN", value: "secret" }]);
    expect(context.store.savedEnvironmentVariableIds).toEqual(["variable-1"]);
    expect(context.environmentVariablesLoading.value).toBe(false);
  });

  it("keeps the panel open and reports variable loading errors", async () => {
    const context = setup(true);
    await context.viewModel.openPanel();
    expect(context.panelOpen.value).toBe(true);
    expect(context.environmentVariablesLoading.value).toBe(false);
    expect(context.errors).toEqual(["offline"]);
  });

  it("formats valid request JSON and reports invalid JSON", () => {
    const { viewModel, errors } = setup();
    const draft = {
      name: "Create order",
      targetEndpointId: null,
      description: "",
      requestJson: '{"a":1}',
      pathParameters: {},
    };
    viewModel.formatRequestJson(draft);
    expect(draft.requestJson).toBe('{\n  "a": 1\n}');
    draft.requestJson = "{";
    viewModel.formatRequestJson(draft);
    expect(errors).toEqual(["Request for Create order must be valid JSON"]);
  });

  it("adds and removes drafts", () => {
    const { store, viewModel } = setup();
    const draft = viewModel.addMockDraft();
    expect(draft.targetEndpointId).toBe("endpoint-1");
    expect(store.mockDraft).toEqual([draft]);
    viewModel.removeMockDraft(0);
    expect(store.mockDraft).toEqual([]);
  });

  it("imports matching Postman requests and returns individual mismatch warnings", async () => {
    const { store, viewModel, importWarnings, registeredApisOpen } = setup();
    const collection = JSON.stringify({
      info: { name: "Orders" },
      item: [
        { name: "Get order", request: { method: "GET", url: "http://localhost:8080/orders/42" } },
        { name: "Unknown", request: { method: "POST", url: "http://localhost:8080/unknown" } },
      ],
    });
    const warnings = await viewModel.importCollection(collection);
    expect(store.mockDraft).toHaveLength(1);
    expect(store.mockDraft[0]?.pathParameters).toEqual({ orderId: "42" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("Unknown");
    expect(importWarnings.value).toEqual([{ id: 0, message: warnings[0] }]);
    expect(registeredApisOpen.value).toBe(true);
    viewModel.dismissImportWarning(0);
    expect(importWarnings.value).toEqual([]);
  });

  it("edits, validates, saves, creates, and deletes shared variables", async () => {
    const { store, viewModel, errors, environmentCardDraft } = setup();
    store.setEnvironmentVariables([{ id: "variable-1", name: "TOKEN", value: "old" }]);
    store.setSavedEnvironmentVariableIds(["variable-1"]);
    store.setSavedEnvironmentVariableValues({ "variable-1": { name: "TOKEN", value: "old" } });
    const variable = store.environmentVariables[0]!;
    viewModel.editEnvironmentVariable(variable);
    environmentCardDraft.value = { name: "TOKEN", value: "new" };
    await viewModel.updateEnvironmentVariable();
    expect(store.savedEnvironmentVariableValues["variable-1"]).toEqual({
      name: "TOKEN",
      value: "new",
    });
    expect(variable.value).toBe("new");
    viewModel.handleEnvironmentVariableToggle(variable, true);
    viewModel.deleteEnvironmentVariable(variable);
    expect(store.environmentVariables).toEqual([]);
    expect(errors).toEqual([]);
  });

  it("adds variables and saves drafts and variables together", async () => {
    const context = setup();
    await context.viewModel.addEnvironmentVariable();
    const variable = context.store.environmentVariables[0]!;
    context.environmentCardDraft.value.name = "TOKEN";
    context.environmentCardDraft.value.value = "secret";
    context.editingEnvironmentVariableId.value = variable.id;
    const mock = context.viewModel.addMockDraft();
    mock.name = "Get order";
    mock.targetEndpointId = "endpoint-1";
    mock.requestJson = "{}";
    await context.viewModel.saveMockDraft();

    expect(context.store.environmentVariables[0]?.id).toBe("created-id");
    expect(context.store.environmentVariables[0]?.pendingCreate).toBeUndefined();
    expect(context.store.savedEnvironmentVariableIds).toEqual(["created-id"]);
    expect(context.operations).toEqual(["save", "close", "load", "save"]);
    expect(context.errors).toEqual([]);
  });

  it("updates retained mock APIs and variables and deletes removed records", async () => {
    const context = setup();
    const existing = {
      id: "mock-keep",
      projectId: "project-1",
      name: "Get order",
      targetEndpointId: "endpoint-1",
      pathParameters: {},
      requestJson: {},
      description: "",
      createdAt: "2025-01-01T00:00:00.000Z",
    };
    context.store.setMockApis([existing, { ...existing, id: "mock-delete", name: "Old call" }]);
    context.store.setMockDraft([{ ...existing, requestJson: "{}" }]);
    context.store.setEnvironmentVariables([{ id: "variable-1", name: "TOKEN", value: "new" }]);
    context.store.setSavedEnvironmentVariableIds(["variable-1", "variable-delete"]);
    context.store.setSavedEnvironmentVariableValues({
      "variable-1": { name: "TOKEN", value: "old" },
      "variable-delete": { name: "OLD", value: "value" },
    });

    await context.viewModel.saveMockDraft();

    expect(context.calls).toEqual(
      expect.arrayContaining([
        { url: "/api/environment-variables/variable-delete", method: "DELETE" },
        { url: "/api/environment-variables/variable-1", method: "PUT" },
        { url: "/api/mock-apis/mock-delete", method: "DELETE" },
        { url: "/api/mock-apis/mock-keep", method: "PUT" },
      ]),
    );
    expect(context.errors).toEqual([]);
  });
});
