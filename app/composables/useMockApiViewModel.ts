import { watch, type Ref } from "vue";
import type { createApiClient } from "../models/api-client";
import type { useMockApiStore } from "../stores/mockApis";
import type { GraphService } from "../models/graph";
import type {
  AuthorizationTemplateDraft,
  EnvironmentVariable,
  HeaderTemplateDraft,
  MockApiDraft,
} from "../models/mock-api";
import { parsePostmanCollection, retryUnmatchedPostmanDrafts } from "../utils/postman-import";
import { parsePostmanEnvironment } from "../utils/postman-environment-import";

type Store = ReturnType<typeof useMockApiStore>;
type ImportWarning = { id: number; message: string };

export function useMockApiViewModel(options: {
  store: Store;
  apiClient: ReturnType<typeof createApiClient>;
  services: () => GraphService[];
  environmentCardDraft: Ref<{ name: string; value: string }>;
  editingEnvironmentVariableId: Ref<string | null>;
  expandedEnvironmentVariableId: Ref<string | null>;
  variablesOpen: Ref<boolean>;
  panelOpen: Ref<boolean>;
  environmentVariablesLoading: Ref<boolean>;
  registeredApisOpen: Ref<boolean>;
  importWarnings: Ref<ImportWarning[]>;
  saveCanvas: () => Promise<void>;
  loadCanvas: () => Promise<void>;
  closeSettings: () => void;
  onError: (message: string) => void;
}) {
  let nextWarningId = 0;
  function postmanServices() {
    return options
      .services()
      .filter((service) => service.apiType !== "WEBSOCKET")
      .map(({ apiType, baseUrl, endpoints }) => ({
        apiType: apiType === "GRPC" ? ("GRPC" as const) : ("REST" as const),
        baseUrl,
        endpoints,
      }));
  }

  function retryUnmatchedImports() {
    const previous = options.store.mockDraft;
    const retried = retryUnmatchedPostmanDrafts(
      options.store.mockDraft,
      postmanServices(),
      options.store.environmentVariables.map(({ name, value }) => ({ name, value })),
    ) as MockApiDraft[];
    const resolvedNames = new Set(
      retried.flatMap((entry, index) =>
        !previous[index]?.targetEndpointId && entry.targetEndpointId ? [entry.name] : [],
      ),
    );
    options.store.mockDraft = retried;
    if (resolvedNames.size)
      options.importWarnings.value = options.importWarnings.value.filter(
        ({ message }) =>
          ![...resolvedNames].some(
            (name) =>
              message.includes(`"${name}"`) &&
              (message.includes("URL did not match") || message.includes("Uses missing variable")),
          ),
      );
  }

  watch(
    () =>
      JSON.stringify({
        endpoints: options.services().flatMap((service) =>
          service.endpoints.map(({ id, url, method }) => ({
            id,
            url,
            method,
            apiType: service.apiType ?? "REST",
            baseUrl: service.baseUrl,
          })),
        ),
        variables: options.store.environmentVariables.map(({ name, value }) => ({ name, value })),
      }),
    retryUnmatchedImports,
  );
  function endpointPathParameterNames(entry: MockApiDraft) {
    if ((entry.apiType ?? "HTTP") !== "HTTP") return [];
    const endpoint = options
      .services()
      .find(
        (service) =>
          (service.apiType ?? "REST") === "REST" &&
          service.endpoints.some((item) => item.id === entry.targetEndpointId),
      )
      ?.endpoints.find((item) => item.id === entry.targetEndpointId);
    return endpoint?.url
      ? [
          ...(endpoint.url.split(/[?#]/, 1)[0] ?? endpoint.url).matchAll(
            /\{([A-Za-z_][\w-]*)(?::[^{}]+)?\}|:([A-Za-z_][\w-]*)/g,
          ),
        ].map((match) => match[1] ?? match[2]!)
      : [];
  }

  function setMockEndpoint(entry: MockApiDraft) {
    const allowed = new Set(endpointPathParameterNames(entry));
    entry.pathParameters = Object.fromEntries(
      Object.entries(entry.pathParameters ?? {}).filter(([key]) => allowed.has(key)),
    );
    for (const name of allowed) entry.pathParameters[name] ??= "";
  }

  function formatRequestJson(entry: MockApiDraft) {
    if (entry.apiType === "WEBSOCKET") return;
    try {
      const request =
        typeof entry.requestJson === "string"
          ? entry.requestJson
          : JSON.stringify(entry.requestJson ?? {});
      entry.requestJson = JSON.stringify(JSON.parse(request), null, 2);
    } catch {
      options.onError(`Request for ${entry.name || "mock API"} must be valid JSON`);
    }
  }

  function websocketMessageValue(value: unknown) {
    return typeof value === "string" ? value : "";
  }

  function addMockDraft(apiType: MockApiDraft["apiType"] = "HTTP") {
    const serviceApiType =
      apiType === "HTTP" ? "REST" : apiType === "WEBSOCKET" ? "WEBSOCKET" : "GRPC";
    const endpointId = options
      .services()
      .filter((service) => (service.apiType ?? "REST") === serviceApiType)
      .flatMap((service) => service.endpoints)
      .find((item) => item.id)?.id;
    const entry: MockApiDraft = {
      id: `draft-${crypto.randomUUID()}`,
      name: "",
      apiType,
      targetEndpointId: endpointId ?? null,
      description: "",
      requestJson: apiType === "WEBSOCKET" ? "" : "{}",
      pathParameters: {},
      customHeaders: [],
      active: Boolean(endpointId),
    };
    if (apiType === "HTTP") setMockEndpoint(entry);
    options.store.addMockDraft(entry);
    return entry;
  }

  function importCollection(content: string) {
    const result = parsePostmanCollection(
      content,
      postmanServices(),
      options.store.environmentVariables.map(({ name, value }) => ({ name, value })),
    );
    options.store.mockDraft.push(
      ...result.drafts.map((draft) => ({ ...draft, id: `draft-${crypto.randomUUID()}` })),
    );
    retryUnmatchedImports();
    options.registeredApisOpen.value = true;
    options.importWarnings.value = [
      ...options.importWarnings.value,
      ...result.warnings.map((message) => ({ id: nextWarningId++, message })),
    ];
    return result.warnings;
  }

  function importEnvironment(content: string) {
    const existingNames = options.store.environmentVariables.map(({ name }) => name);
    const result = parsePostmanEnvironment(content, existingNames);
    options.store.environmentVariables.push(
      ...result.variables.map(({ name, value }) => ({
        id: `draft-${crypto.randomUUID()}`,
        name,
        value,
        pendingCreate: true,
      })),
    );
    options.variablesOpen.value = true;
    retryUnmatchedImports();
    options.importWarnings.value = [
      ...options.importWarnings.value,
      ...result.warnings.map((message) => ({ id: nextWarningId++, message })),
    ];
    return result.warnings;
  }

  function dismissImportWarning(id: number) {
    options.importWarnings.value = options.importWarnings.value.filter(
      (warning) => warning.id !== id,
    );
  }

  function removeMockDraft(index: number) {
    options.store.removeMockDraft(index);
  }

  async function deleteMockApi(entry: MockApiDraft) {
    const id = entry.id;
    if (!id || id.startsWith("draft-")) {
      const index = options.store.mockDraft.findIndex((item) => item.id === id);
      if (index >= 0) options.store.removeMockDraft(index);
      return true;
    }

    await options.apiClient.deleteMockApi(id);
    options.store.mockDraft = options.store.mockDraft.filter((item) => item.id !== id);
    await options.loadCanvas();
    return true;
  }

  function addHeaderTemplate() {
    const template = {
      id: `draft-${crypto.randomUUID()}`,
      name: "",
      headers: [{ name: "", value: "" }],
      pendingCreate: true,
    };
    options.store.headerTemplates.push(template);
    return template;
  }

  async function removeHeaderTemplate(
    template: (typeof options.store.headerTemplates)[number],
    confirmDelete: (message: string) => boolean,
  ) {
    const affected = [
      ...options.store.mockApis.filter((api) => api.headerTemplateId === template.id),
      ...options.store.mockDraft.filter((api) => api.headerTemplateId === template.id),
    ];
    const names = [...new Set(affected.map(({ name }) => name || "Untitled API"))];
    const detail = names.length ? ` It is used by: ${names.join(", ")}.` : "";
    if (!confirmDelete(`Delete header template ${template.name || "Untitled"}?${detail}`))
      return false;
    if (template.pendingCreate || template.id.startsWith("draft-")) {
      for (const api of options.store.mockDraft)
        if (api.headerTemplateId === template.id) api.headerTemplateId = null;
      options.store.headerTemplates = options.store.headerTemplates.filter(
        ({ id }) => id !== template.id,
      );
      return true;
    }
    const pendingHeaders = options.store.headerTemplates.filter(
      (item) => item.pendingCreate && item.id !== template.id,
    );
    const pendingAuthorization = options.store.authorizationTemplates.filter(
      (item) => item.pendingCreate,
    );
    const nextHeaders = options.store.savedHeaderTemplates.filter(({ id }) => id !== template.id);
    const nextApis = savedMockApiPayload().map((api) =>
      api.headerTemplateId === template.id ? { ...api, headerTemplateId: null } : api,
    );
    await saveTemplateSettings(nextHeaders, options.store.savedAuthorizationTemplates, nextApis);
    for (const api of options.store.mockDraft)
      if (api.headerTemplateId === template.id) api.headerTemplateId = null;
    await options.loadCanvas();
    options.store.headerTemplates.push(...pendingHeaders);
    options.store.authorizationTemplates.push(...pendingAuthorization);
    return true;
  }

  function addAuthorizationTemplate() {
    const template: AuthorizationTemplateDraft = {
      id: `draft-${crypto.randomUUID()}`,
      name: "",
      type: "bearer",
      token: "",
      pendingCreate: true,
    };
    options.store.authorizationTemplates.push(template);
    return template;
  }

  async function removeAuthorizationTemplate(
    template: AuthorizationTemplateDraft,
    confirmDelete: (message: string) => boolean,
  ) {
    const affected = [
      ...options.store.mockApis.filter((api) => api.authorizationTemplateId === template.id),
      ...options.store.mockDraft.filter((api) => api.authorizationTemplateId === template.id),
    ];
    const names = [...new Set(affected.map(({ name }) => name || "Untitled API"))];
    const detail = names.length ? ` It is used by: ${names.join(", ")}.` : "";
    if (!confirmDelete(`Delete authorization template ${template.name || "Untitled"}?${detail}`))
      return false;
    if (template.pendingCreate || template.id.startsWith("draft-")) {
      for (const api of options.store.mockDraft)
        if (api.authorizationTemplateId === template.id) api.authorizationTemplateId = null;
      options.store.authorizationTemplates = options.store.authorizationTemplates.filter(
        ({ id }) => id !== template.id,
      );
      return true;
    }
    const pendingHeaders = options.store.headerTemplates.filter((item) => item.pendingCreate);
    const pendingAuthorization = options.store.authorizationTemplates.filter(
      (item) => item.pendingCreate && item.id !== template.id,
    );
    const nextAuthorization = options.store.savedAuthorizationTemplates.filter(
      ({ id }) => id !== template.id,
    );
    const nextApis = savedMockApiPayload().map((api) =>
      api.authorizationTemplateId === template.id ? { ...api, authorizationTemplateId: null } : api,
    );
    await saveTemplateSettings(options.store.savedHeaderTemplates, nextAuthorization, nextApis);
    for (const api of options.store.mockDraft)
      if (api.authorizationTemplateId === template.id) api.authorizationTemplateId = null;
    await options.loadCanvas();
    options.store.headerTemplates.push(...pendingHeaders);
    options.store.authorizationTemplates.push(...pendingAuthorization);
    return true;
  }

  function discardMockSettings() {
    options.store.restoreHeaderTemplates();
    options.store.restoreAuthorizationTemplates();
    options.store.setEnvironmentVariables(
      options.store.savedEnvironmentVariableIds.flatMap((id) => {
        const saved = options.store.savedEnvironmentVariableValues[id];
        return saved ? [{ id, ...saved }] : [];
      }),
    );
    options.store.setMockDraft(
      options.store.mockApis.map((entry) => ({
        ...entry,
        pathParameters: { ...entry.pathParameters },
        customHeaders: [...entry.customHeaders],
        requestJson:
          entry.apiType === "WEBSOCKET"
            ? websocketMessageValue(entry.requestJson)
            : JSON.stringify(entry.requestJson ?? {}, null, 2),
      })),
    );
    resetEnvironmentCardEdit();
    options.closeSettings();
  }

  async function openPanel(focusMockApiId?: string) {
    if (focusMockApiId) options.registeredApisOpen.value = true;
    options.store.setMockDraft(
      options.store.mockApis.map((entry) => ({
        ...entry,
        pathParameters: { ...entry.pathParameters },
        requestJson:
          entry.apiType === "WEBSOCKET"
            ? websocketMessageValue(entry.requestJson)
            : JSON.stringify(entry.requestJson ?? {}, null, 2),
      })),
    );
    resetEnvironmentCardEdit();
    options.environmentVariablesLoading.value = true;
    options.panelOpen.value = true;
    try {
      const items = await options.apiClient.listEnvironmentVariables();
      options.store.setEnvironmentVariables(items);
      options.store.setSavedEnvironmentVariableIds(items.map(({ id }) => id));
      options.store.setSavedEnvironmentVariableValues(
        Object.fromEntries(items.map(({ id, name, value }) => [id, { name, value }])),
      );
      retryUnmatchedImports();
    } catch (cause) {
      options.onError(cause instanceof Error ? cause.message : "Could not load shared variables");
    } finally {
      options.environmentVariablesLoading.value = false;
    }
  }

  function editEnvironmentVariable(variable: EnvironmentVariable) {
    options.expandedEnvironmentVariableId.value = variable.id;
    options.editingEnvironmentVariableId.value = variable.id;
    options.environmentCardDraft.value = { name: variable.name, value: variable.value };
  }

  function resetEnvironmentCardEdit() {
    options.expandedEnvironmentVariableId.value = null;
    options.editingEnvironmentVariableId.value = null;
    options.environmentCardDraft.value = { name: "", value: "" };
  }

  function openEnvironmentVariable(variable: EnvironmentVariable) {
    editEnvironmentVariable(variable);
  }

  function closeEnvironmentVariable(variable: EnvironmentVariable) {
    if (options.editingEnvironmentVariableId.value === variable.id) resetEnvironmentCardEdit();
  }

  async function updateEnvironmentVariable() {
    try {
      const id = options.editingEnvironmentVariableId.value;
      if (!id) return true;
      const name = options.environmentCardDraft.value.name.trim();
      if (!/^[A-Za-z_]\w{0,254}$/.test(name))
        throw new Error(
          "Variable name must start with a letter or underscore and contain only letters, numbers, or underscores",
        );
      if (options.store.environmentVariables.some((item) => item.name === name && item.id !== id))
        throw new Error(`Variable "${name}" already exists`);
      const variable = options.store.environmentVariables.find((item) => item.id === id);
      if (!variable) throw new Error("Environment variable no longer exists");
      const value = options.environmentCardDraft.value.value;
      const saved = options.store.savedEnvironmentVariableValues[id];
      const changed = saved?.name !== name || saved?.value !== value;
      if (changed && !variable.pendingCreate)
        await options.apiClient.updateEnvironmentVariable(id, { name, value });
      Object.assign(variable, { name, value });
      options.store.savedEnvironmentVariableValues[id] = { name, value };
      resetEnvironmentCardEdit();
      return true;
    } catch (cause) {
      options.onError(cause instanceof Error ? cause.message : "Could not update variable");
      return false;
    }
  }

  async function addEnvironmentVariable() {
    if (options.editingEnvironmentVariableId.value && !(await updateEnvironmentVariable())) return;
    options.variablesOpen.value = true;
    const variable: EnvironmentVariable = {
      id: `draft-${crypto.randomUUID()}`,
      name: "",
      value: "",
      pendingCreate: true,
    };
    options.store.environmentVariables.push(variable);
    editEnvironmentVariable(variable);
  }

  async function saveEnvironmentVariable(
    id: string | null,
    draft: { name: string; value: string },
  ) {
    const name = draft.name.trim();
    if (!/^[A-Za-z_]\w{0,254}$/.test(name))
      throw new Error(
        "Variable name must start with a letter or underscore and contain only letters, numbers, or underscores",
      );
    if (options.store.environmentVariables.some((item) => item.name === name && item.id !== id))
      throw new Error(`Variable "${name}" already exists`);

    const created = !id || id.startsWith("draft-");
    const result = created
      ? await options.apiClient.createEnvironmentVariable({ name, value: draft.value })
      : await options.apiClient.updateEnvironmentVariable(id, { name, value: draft.value });
    const savedId = created ? result.id : id;
    const saved: EnvironmentVariable = { id: savedId, name, value: draft.value };
    const current = options.store.environmentVariables.findIndex(({ id: itemId }) => itemId === id);
    if (current >= 0) options.store.environmentVariables.splice(current, 1, saved);
    else options.store.environmentVariables.push(saved);
    options.store.savedEnvironmentVariableIds = [
      ...new Set([
        ...options.store.savedEnvironmentVariableIds.filter((itemId) => itemId !== id),
        savedId,
      ]),
    ];
    delete options.store.savedEnvironmentVariableValues[id ?? ""];
    options.store.savedEnvironmentVariableValues[savedId] = { name, value: draft.value };
    retryUnmatchedImports();
    return saved;
  }

  async function deleteEnvironmentVariable(variable: EnvironmentVariable) {
    if (!variable.pendingCreate && !variable.id.startsWith("draft-"))
      await options.apiClient.deleteEnvironmentVariable(variable.id);
    options.store.deleteEnvironmentVariable(variable.id);
    options.store.savedEnvironmentVariableIds = options.store.savedEnvironmentVariableIds.filter(
      (id) => id !== variable.id,
    );
    delete options.store.savedEnvironmentVariableValues[variable.id];
    retryUnmatchedImports();
    if (!variable.pendingCreate && !variable.id.startsWith("draft-")) await options.loadCanvas();
    return true;
  }

  function savedVariablePayload() {
    return options.store.savedEnvironmentVariableIds.flatMap((id) => {
      const saved = options.store.savedEnvironmentVariableValues[id];
      return saved ? [{ id, ...saved }] : [];
    });
  }

  function savedMockApiPayload() {
    return options.store.mockApis.map((entry) => ({
      id: entry.id,
      name: entry.name,
      apiType: entry.apiType,
      targetEndpointId: entry.targetEndpointId,
      headerTemplateId: entry.headerTemplateId,
      authorizationTemplateId: entry.authorizationTemplateId,
      customHeaders: entry.customHeaders,
      active: entry.active,
      description: entry.description,
      requestJson: entry.requestJson,
      pathParameters: entry.pathParameters,
      importMethod: entry.importMethod,
      importUrl: entry.importUrl,
      matchUrl: entry.matchUrl,
    }));
  }

  async function saveTemplateSettings(
    nextHeaders: HeaderTemplateDraft[],
    nextAuthorization: AuthorizationTemplateDraft[],
    mockApis = savedMockApiPayload(),
  ) {
    return options.apiClient.saveMockApiSettings({
      environmentVariables: savedVariablePayload(),
      headerTemplates: nextHeaders.map(({ id, name, headers }) => ({ id, name, headers })),
      authorizationTemplates: nextAuthorization.map(
        ({ pendingCreate: _pending, ...template }) => template,
      ),
      mockApis,
    });
  }

  async function saveHeaderTemplate(template: HeaderTemplateDraft) {
    const next = options.store.savedHeaderTemplates.map((item) =>
      item.id === template.id ? template : item,
    );
    if (!next.some(({ id }) => id === template.id)) next.push(template);
    const result = await saveTemplateSettings(next, options.store.savedAuthorizationTemplates);
    const id = result.idMap.headerTemplates[template.id] ?? template.id;
    const saved = { ...template, id, pendingCreate: false };
    options.store.setHeaderTemplates(
      next.map((item) => (item.id === template.id ? saved : { ...item, pendingCreate: false })),
    );
    await options.loadCanvas();
    return saved;
  }

  async function saveAuthorizationTemplate(template: AuthorizationTemplateDraft) {
    const next = options.store.savedAuthorizationTemplates.map((item) =>
      item.id === template.id ? template : item,
    );
    if (!next.some(({ id }) => id === template.id)) next.push(template);
    const result = await saveTemplateSettings(options.store.savedHeaderTemplates, next);
    const id = result.idMap.authorizationTemplates[template.id] ?? template.id;
    const saved = { ...template, id, pendingCreate: false };
    options.store.setAuthorizationTemplates(
      next.map((item) => (item.id === template.id ? saved : { ...item, pendingCreate: false })),
    );
    await options.loadCanvas();
    return saved;
  }

  async function saveMockApi(id: string | null, entry: MockApiDraft) {
    const parsed = parseMockDrafts([entry])[0]!;
    const sourceId = id ?? entry.id ?? null;
    const persistedId = sourceId && !sourceId.startsWith("draft-") ? sourceId : null;
    const input = {
      name: parsed.name,
      apiType: parsed.apiType ?? "HTTP",
      targetEndpointId: parsed.targetEndpointId,
      headerTemplateId: parsed.headerTemplateId ?? null,
      authorizationTemplateId: parsed.authorizationTemplateId ?? null,
      customHeaders: parsed.customHeaders ?? [],
      active: parsed.active ?? false,
      description: parsed.description,
      requestJson: parsed.requestJson,
      pathParameters: parsed.pathParameters,
      importMethod: parsed.importMethod ?? null,
      importUrl: parsed.importUrl ?? null,
      matchUrl: parsed.matchUrl ?? null,
    };
    const result = persistedId
      ? await options.apiClient.updateMockApi(persistedId, input)
      : await options.apiClient.createMockApi(input);
    const saved = { ...parsed, id: result.id };
    const draftIndex = options.store.mockDraft.findIndex(({ id: draftId }) => draftId === sourceId);
    if (draftIndex >= 0) options.store.mockDraft.splice(draftIndex, 1, saved);
    else options.store.mockDraft.push(saved);
    await options.loadCanvas();
    return saved;
  }

  function parseMockDrafts(drafts = options.store.mockDraft) {
    return drafts.map((entry) => {
      try {
        const requestJson =
          entry.apiType === "WEBSOCKET"
            ? websocketMessageValue(entry.requestJson)
            : typeof entry.requestJson === "string"
              ? JSON.parse(entry.requestJson.trim() || "{}")
              : (entry.requestJson ?? {});
        return { ...entry, requestJson };
      } catch {
        throw new Error(`Request for ${entry.name || "mock API"} must be valid JSON`);
      }
    });
  }

  async function saveMockDraft() {
    try {
      if (options.editingEnvironmentVariableId.value && !(await updateEnvironmentVariable()))
        return;
      const entries = parseMockDrafts();
      const templates = options.store.headerTemplates;
      const authTemplates = options.store.authorizationTemplates;
      const variables = options.store.environmentVariables.map(({ id, name, value }) => ({
        id,
        name,
        value,
      }));
      const result = await options.apiClient.saveMockApiSettings({
        environmentVariables: variables,
        headerTemplates: templates.map(({ id, name, headers }) => ({ id, name, headers })),
        authorizationTemplates: authTemplates.map(
          ({ pendingCreate: _pending, ...template }) => template,
        ),
        mockApis: entries.map((entry) => ({
          ...entry,
          headerTemplateId: entry.headerTemplateId ?? null,
          customHeaders: entry.customHeaders ?? [],
          active: entry.active ?? true,
          importMethod: entry.importMethod ?? null,
          importUrl: entry.importUrl ?? null,
          matchUrl: entry.matchUrl ?? null,
        })),
      });
      for (const entry of options.store.mockDraft) {
        if (entry.id) entry.id = result.idMap.mockApis[entry.id] ?? entry.id;
        if (entry.headerTemplateId)
          entry.headerTemplateId =
            result.idMap.headerTemplates[entry.headerTemplateId] ?? entry.headerTemplateId;
        if (entry.authorizationTemplateId)
          entry.authorizationTemplateId =
            result.idMap.authorizationTemplates[entry.authorizationTemplateId] ??
            entry.authorizationTemplateId;
      }
      for (const variable of options.store.environmentVariables) {
        variable.id = result.idMap.environmentVariables[variable.id] ?? variable.id;
        delete variable.pendingCreate;
      }
      options.store.savedEnvironmentVariableIds = options.store.environmentVariables.map(
        ({ id }) => id,
      );
      options.store.savedEnvironmentVariableValues = Object.fromEntries(
        options.store.environmentVariables.map(({ id, name, value }) => [id, { name, value }]),
      );
      options.store.setHeaderTemplates(
        templates.map((template) => ({
          ...template,
          id: result.idMap.headerTemplates[template.id] ?? template.id,
          pendingCreate: false,
        })),
      );
      options.store.setAuthorizationTemplates(
        authTemplates.map((template) => ({
          ...template,
          id: result.idMap.authorizationTemplates[template.id] ?? template.id,
          pendingCreate: false,
        })),
      );
      options.closeSettings();
      await options.loadCanvas();
    } catch (cause) {
      options.onError(cause instanceof Error ? cause.message : "Could not save mock APIs");
    }
  }

  return {
    endpointPathParameterNames,
    setMockEndpoint,
    formatRequestJson,
    addMockDraft,
    importCollection,
    importEnvironment,
    dismissImportWarning,
    removeMockDraft,
    addHeaderTemplate,
    removeHeaderTemplate,
    addAuthorizationTemplate,
    removeAuthorizationTemplate,
    deleteMockApi,
    saveEnvironmentVariable,
    saveHeaderTemplate,
    saveAuthorizationTemplate,
    saveMockApi,
    discardMockSettings,
    openPanel,
    editEnvironmentVariable,
    resetEnvironmentCardEdit,
    openEnvironmentVariable,
    closeEnvironmentVariable,
    updateEnvironmentVariable,
    addEnvironmentVariable,
    deleteEnvironmentVariable,
    saveMockDraft,
  };
}
