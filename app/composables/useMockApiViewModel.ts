import { watch, type Ref } from "vue";
import type { createApiClient } from "../models/api-client";
import type { useMockApiStore } from "../stores/mockApis";
import type { GraphService } from "../models/graph";
import type { EnvironmentVariable, MockApiDraft } from "../models/mock-api";
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
  function retryUnmatchedImports() {
    const previous = options.store.mockDraft;
    const retried = retryUnmatchedPostmanDrafts(
      options.store.mockDraft,
      options.services(),
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
          service.endpoints.map(({ id, url, method, apiType }) => ({
            id,
            url,
            method,
            apiType,
            baseUrl: service.baseUrl,
          })),
        ),
        variables: options.store.environmentVariables.map(({ name, value }) => ({ name, value })),
      }),
    retryUnmatchedImports,
  );
  function endpointPathParameterNames(entry: MockApiDraft) {
    const endpoint = options
      .services()
      .flatMap((service) => service.endpoints)
      .find((item) => item.id === entry.targetEndpointId);
    return endpoint
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

  function addMockDraft() {
    const endpointId = options
      .services()
      .flatMap((service) => service.endpoints)
      .find((item) => item.id)?.id;
    const entry: MockApiDraft = {
      id: `draft-${crypto.randomUUID()}`,
      name: "",
      targetEndpointId: endpointId ?? null,
      description: "",
      requestJson: "{}",
      pathParameters: {},
      customHeaders: [],
      active: Boolean(endpointId),
    };
    setMockEndpoint(entry);
    options.store.addMockDraft(entry);
    return entry;
  }

  function importCollection(content: string) {
    const result = parsePostmanCollection(
      content,
      options.services(),
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

  function removeHeaderTemplate(
    template: (typeof options.store.headerTemplates)[number],
    confirmDelete: (message: string) => boolean,
  ) {
    const affected = options.store.mockDraft.filter((api) => api.headerTemplateId === template.id);
    const names = affected.map(({ name }) => name || "Untitled API");
    const detail = names.length ? ` It is used by: ${names.join(", ")}.` : "";
    if (!confirmDelete(`Delete header template ${template.name || "Untitled"}?${detail}`))
      return false;
    for (const api of affected) api.headerTemplateId = null;
    options.store.headerTemplates = options.store.headerTemplates.filter(
      ({ id }) => id !== template.id,
    );
    return true;
  }

  function discardMockSettings() {
    options.store.restoreHeaderTemplates();
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
        requestJson: JSON.stringify(entry.requestJson ?? {}, null, 2),
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
        requestJson: JSON.stringify(entry.requestJson ?? {}, null, 2),
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

  function deleteEnvironmentVariable(variable: EnvironmentVariable) {
    options.store.deleteEnvironmentVariable(variable.id);
    if (options.editingEnvironmentVariableId.value === variable.id) resetEnvironmentCardEdit();
  }

  function parseMockDrafts() {
    return options.store.mockDraft.map((entry) => {
      try {
        const requestJson =
          typeof entry.requestJson === "string"
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
      const variables = options.store.environmentVariables.map(({ id, name, value }) => ({
        id,
        name,
        value,
      }));
      const result = await options.apiClient.saveMockApiSettings({
        environmentVariables: variables,
        headerTemplates: templates.map(({ id, name, headers }) => ({ id, name, headers })),
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
