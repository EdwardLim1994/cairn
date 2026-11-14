import { beforeEach, describe, expect, it } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { useMockApiStore } from "../../../entities/mock-api";
import { useMockApiViewModel } from "../model/useMockApiViewModel";
import { ref } from "vue";
import { createApiClient } from "../../../shared/api";
import type { GraphMockApi, GraphService } from "../../../models/graph";

const service = {
  id: "service-1",
  projectId: "project-1",
  name: "Orders",
  apiType: "REST" as const,
  grpcTls: false,
  protoFileName: null,
  framework: "Spring Boot",
  baseUrl: "http://localhost:8080",
  healthCheckUrl: null,
  healthCheckHeaderTemplateId: null,
  healthCheckCustomHeaders: [],
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
      method: "GET",
      url: "/orders/{orderId}",
      rpcMethod: null,
      createdAt: "2025-01-01T00:00:00.000Z",
    },
  ],
};
const websocketService: GraphService = {
  ...service,
  id: "websocket-service-1",
  apiType: "WEBSOCKET",
  baseUrl: "wss://example.test/events",
  endpoints: service.endpoints.map((endpoint) => ({
    ...endpoint,
    id: "websocket-endpoint-1",
    serviceId: "websocket-service-1",
    method: null,
    url: "wss://example.test/events",
  })),
};

describe("mock API view model", () => {
  beforeEach(() => setActivePinia(createPinia()));

  function setup(
    failVariables = false,
    failSave = false,
    services: GraphService[] = [service],
    refresh?: (store: ReturnType<typeof useMockApiStore>) => boolean,
  ) {
    const store = useMockApiStore();
    const errors: string[] = [];
    const operations: string[] = [];
    const calls: { url: string; method: string }[] = [];
    const savedBodies: unknown[] = [];
    const apiClient = createApiClient(async (url, options) => {
      calls.push({ url, method: options.method });
      if (url === "/api/mock-api-settings") savedBodies.push(options.body);
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
      if (url === "/api/mock-api-settings") {
        if (failSave) throw new Error("save failed");
        const body = options.body as {
          environmentVariables: { id?: string }[];
          headerTemplates: { id?: string }[];
          authorizationTemplates: { id?: string }[];
          mockApis: { id?: string }[];
        };
        const mapped = (rows: { id?: string }[]) =>
          Object.fromEntries(
            rows.flatMap(({ id }, index) => (id ? [[id, index ? id : "created-id"]] : [])),
          );
        return {
          saved: true,
          idMap: {
            environmentVariables: mapped(body.environmentVariables),
            headerTemplates: mapped(body.headerTemplates),
            authorizationTemplates: mapped(body.authorizationTemplates),
            mockApis: mapped(body.mockApis),
          },
        };
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
    const viewModel = useMockApiViewModel({
      store,
      apiClient,
      services: () => services,
      environmentCardDraft,
      editingEnvironmentVariableId,
      expandedEnvironmentVariableId,
      variablesOpen,
      panelOpen,
      environmentVariablesLoading,
      registeredApisOpen,
      saveCanvas: async () => void operations.push("save"),
      loadCanvas: async () => {
        operations.push("load");
        return refresh?.(store);
      },
      closeSettings: () => operations.push("close"),
      onError: (message) => errors.push(message),
    });
    return {
      store,
      errors,
      operations,
      calls,
      savedBodies,
      viewModel,
      environmentCardDraft,
      editingEnvironmentVariableId,
      expandedEnvironmentVariableId,
      variablesOpen,
      panelOpen,
      environmentVariablesLoading,
      registeredApisOpen,
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
        apiType: "HTTP",
        targetEndpointId: "endpoint-1",
        headerTemplateId: null,
        customHeaders: [],
        active: true,
        status: "ready" as const,
        readinessReasons: [],
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

  it("targets WebSocket endpoints and keeps their text request exact through save and discard", async () => {
    const { store, viewModel, savedBodies } = setup(false, false, [service, websocketService]);
    const draft = viewModel.addMockDraft("WEBSOCKET");
    const message = '  subscribe {{channel}}\n{"limit": 2}  ';
    draft.name = "Watch events";
    draft.requestJson = message;

    await viewModel.saveMockDraft();

    const savedSettings = savedBodies[0] as {
      mockApis: Array<{ apiType: string; targetEndpointId: string | null; requestJson: unknown }>;
    };
    expect(savedSettings.mockApis[0]).toMatchObject({
      apiType: "WEBSOCKET",
      targetEndpointId: "websocket-endpoint-1",
      requestJson: message,
    });

    const savedApi: GraphMockApi = {
      id: "saved-websocket-api",
      projectId: "project-1",
      name: "Watch events",
      apiType: "WEBSOCKET",
      targetEndpointId: "websocket-endpoint-1",
      headerTemplateId: null,
      authorizationTemplateId: null,
      customHeaders: [],
      active: true,
      status: "ready",
      readinessReasons: [],
      pathParameters: {},
      requestJson: message,
      description: "",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    store.setMockApis([savedApi]);
    viewModel.discardMockSettings();
    expect(store.mockDraft[0]?.requestJson).toBe(message);
  });

  it("selects a WebSocket endpoint when adding a WebSocket mock API draft", () => {
    const { viewModel } = setup(false, false, [service, websocketService]);

    const draft = viewModel.addMockDraft("WEBSOCKET");

    expect(draft).toMatchObject({
      apiType: "WEBSOCKET",
      targetEndpointId: "websocket-endpoint-1",
      requestJson: "",
      active: true,
    });
  });

  it("confirms template deletion and detaches staged APIs while retaining custom headers", async () => {
    const { store, viewModel, savedBodies, operations } = setup();
    const template = { id: "template-1", name: "Tenant", headers: [] };
    store.headerTemplates = [template];
    store.setMockDraft([
      {
        name: "Get order",
        targetEndpointId: "endpoint-1",
        headerTemplateId: template.id,
        customHeaders: [{ name: "X-Local", value: "kept" }],
        description: "",
        requestJson: "{}",
        pathParameters: {},
      },
    ]);
    let confirmation = "";
    expect(
      await viewModel.removeHeaderTemplate(template, (message) => {
        confirmation = message;
        return false;
      }),
    ).toBe(false);
    expect(confirmation).toContain("Get order");
    expect(store.headerTemplates).toEqual([template]);
    expect(await viewModel.removeHeaderTemplate(template, () => true)).toBe(true);
    expect(savedBodies.at(-1)).toMatchObject({ headerTemplates: [] });
    expect(operations).toContain("load");
    expect(store.mockDraft[0]).toMatchObject({
      headerTemplateId: null,
      customHeaders: [{ name: "X-Local", value: "kept" }],
    });
  });

  it("maps staged authorization templates and their API assignments after Save", async () => {
    const context = setup();
    context.store.authorizationTemplates = [
      {
        id: "draft-auth",
        name: "Bearer auth",
        type: "bearer",
        token: "secret",
        pendingCreate: true,
      },
    ];
    const api = context.viewModel.addMockDraft();
    api.name = "Authenticated API";
    api.targetEndpointId = "endpoint-1";
    api.authorizationTemplateId = "draft-auth";

    await context.viewModel.saveMockDraft();

    expect(context.store.authorizationTemplates).toMatchObject([
      { id: "created-id", name: "Bearer auth", type: "bearer", token: "secret" },
    ]);
    expect(context.store.authorizationTemplates[0]?.pendingCreate).toBe(false);
    expect(context.store.mockDraft[0]?.authorizationTemplateId).toBe("created-id");
    expect(context.errors).toEqual([]);
  });

  it("restores staged API, variable, and template changes on Discard", () => {
    const context = setup();
    context.store.setMockApis([
      {
        id: "saved-api",
        projectId: "project-1",
        name: "Saved",
        apiType: "HTTP",
        targetEndpointId: "endpoint-1",
        headerTemplateId: null,
        customHeaders: [],
        active: false,
        status: "inactive",
        readinessReasons: [],
        description: "",
        pathParameters: {},
        requestJson: {},
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    context.store.savedEnvironmentVariableIds = ["saved-variable"];
    context.store.savedEnvironmentVariableValues = {
      "saved-variable": { name: "TOKEN", value: "saved" },
    };
    context.store.setEnvironmentVariables([
      { id: "saved-variable", name: "TOKEN", value: "edited" },
      { id: "draft-variable", name: "NEW", value: "value", pendingCreate: true },
    ]);
    context.store.headerTemplates = [{ id: "draft-template", name: "New", headers: [] }];
    context.store.setAuthorizationTemplates([
      { id: "saved-auth", name: "Saved auth", type: "bearer", token: "saved" },
    ]);
    const savedAuth = context.store.authorizationTemplates[0]!;
    if (savedAuth.type === "bearer") savedAuth.token = "edited";
    context.store.authorizationTemplates.push({
      id: "draft-auth",
      name: "New auth",
      type: "api-key",
      headerName: "X-Key",
      value: "secret",
      pendingCreate: true,
    });
    context.store.setMockDraft([
      {
        name: "Unsaved",
        targetEndpointId: null,
        description: "",
        requestJson: "{}",
        pathParameters: {},
      },
    ]);

    context.viewModel.discardMockSettings();
    expect(context.store.environmentVariables).toEqual([
      { id: "saved-variable", name: "TOKEN", value: "saved" },
    ]);
    expect(context.store.headerTemplates).toEqual([]);
    expect(context.store.authorizationTemplates).toEqual([
      { id: "saved-auth", name: "Saved auth", type: "bearer", token: "saved" },
    ]);
    expect(context.store.mockDraft).toMatchObject([{ name: "Saved", active: false }]);
    expect(context.operations).toEqual(["close"]);
  });

  it("keeps staged changes open when the transaction save fails", async () => {
    const context = setup(false, true);
    context.panelOpen.value = true;
    const draft = context.viewModel.addMockDraft();
    draft.name = "Unsaved";
    await context.viewModel.saveMockDraft();
    expect(context.panelOpen.value).toBe(true);
    expect(context.store.mockDraft[0]?.name).toBe("Unsaved");
    expect(context.operations).toEqual([]);
    expect(context.errors).toEqual(["save failed"]);
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
    viewModel.openEnvironmentVariable(variable);
    await viewModel.deleteEnvironmentVariable(variable);
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
    expect(context.operations).toEqual(["close", "load"]);
    expect(context.errors).toEqual([]);
  });

  it("updates retained mock APIs and variables and deletes removed records", async () => {
    const context = setup();
    const existing = {
      id: "mock-keep",
      projectId: "project-1",
      name: "Get order",
      apiType: "HTTP" as const,
      targetEndpointId: "endpoint-1",
      headerTemplateId: null,
      customHeaders: [],
      active: true,
      status: "ready" as const,
      readinessReasons: [],
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

    expect(context.calls).toEqual([{ url: "/api/mock-api-settings", method: "PUT" }]);
    expect(context.errors).toEqual([]);
  });
  it("refreshes canonical API data after a single save and reports refresh failures", async () => {
    const draft = {
      name: "Get order",
      apiType: "HTTP" as const,
      targetEndpointId: "endpoint-1",
      description: "",
      requestJson: "{}",
      pathParameters: { orderId: "42" },
      customHeaders: [],
      active: true,
    };
    const success = setup(false, false, [service], (store) => {
      store.setMockApis([{ ...draft, id: "created-id" }] as never);
      return true;
    });
    await success.viewModel.saveMockApi(null, draft);
    expect(success.calls.map(({ method }) => method)).toEqual(["POST"]);
    expect(success.operations).toEqual(["load"]);
    expect(success.store.mockApis[0]?.name).toBe("Get order");

    success.store.setMockApis([]);
    const failed = setup(false, false, [service], () => false);
    await expect(failed.viewModel.saveMockApi(null, draft)).rejects.toThrow(
      "workspace could not refresh",
    );
    expect(failed.store.mockApis).toEqual([]);
  });

  it("requires a successful canvas refresh after saving a template or variable", async () => {
    const template = {
      id: "draft-header",
      name: "Tenant headers",
      headers: [{ name: "X-Tenant", value: "demo" }],
      pendingCreate: true,
    };
    const templateFailure = setup(false, false, [service], () => false);
    await expect(templateFailure.viewModel.saveHeaderTemplate(template)).rejects.toThrow(
      "workspace could not refresh",
    );
    expect(templateFailure.operations).toEqual(["load"]);

    const variableFailure = setup(false, false, [service], () => false);
    await expect(
      variableFailure.viewModel.saveEnvironmentVariable(null, { name: "TOKEN", value: "secret" }),
    ).rejects.toThrow("workspace could not refresh");
    expect(variableFailure.operations).toEqual(["load"]);
  });
});
