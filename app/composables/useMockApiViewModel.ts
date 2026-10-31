import type { Ref } from "vue";
import type { createApiClient } from "../models/api-client";
import type { useMockApiStore } from "../stores/mockApis";
import type { GraphService } from "../models/graph";
import type { EnvironmentVariable, MockApiDraft } from "../models/mock-api";
import { parsePostmanCollection } from "../utils/postman-import";

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
    const endpointId =
      options
        .services()
        .flatMap((service) => service.endpoints)
        .find((item) => item.id)?.id ?? "";
    const entry: MockApiDraft = {
      name: "",
      targetEndpointId: endpointId,
      description: "",
      requestJson: "{}",
      pathParameters: {},
    };
    setMockEndpoint(entry);
    options.store.addMockDraft(entry);
    return entry;
  }

  function importCollection(content: string) {
    options.importWarnings.value = [];
    const result = parsePostmanCollection(content, options.services());
    options.store.mockDraft.push(...result.drafts);
    options.registeredApisOpen.value = true;
    options.importWarnings.value = result.warnings.map((message) => ({
      id: nextWarningId++,
      message,
    }));
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
      const changed = !saved || saved.name !== name || saved.value !== value;
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

  async function saveEnvironmentVariables() {
    const variableIds = new Set(
      options.store.environmentVariables
        .filter(({ pendingCreate }) => !pendingCreate)
        .map(({ id }) => id),
    );
    for (const id of options.store.savedEnvironmentVariableIds) {
      if (!variableIds.has(id)) await options.apiClient.deleteEnvironmentVariable(id);
    }
    for (const variable of options.store.environmentVariables) {
      const { id, name, value, pendingCreate } = variable;
      if (pendingCreate) {
        const created = await options.apiClient.createEnvironmentVariable({ name, value });
        delete options.store.savedEnvironmentVariableValues[id];
        variable.id = created.id;
        delete variable.pendingCreate;
        options.store.savedEnvironmentVariableValues[created.id] = { name, value };
        continue;
      }
      const saved = options.store.savedEnvironmentVariableValues[id];
      if (!saved || saved.name !== name || saved.value !== value) {
        await options.apiClient.updateEnvironmentVariable(id, { name, value });
        options.store.savedEnvironmentVariableValues[id] = { name, value };
      }
    }
    options.store.savedEnvironmentVariableIds = options.store.environmentVariables.map(
      ({ id }) => id,
    );
  }

  async function saveMockApis(entries: MockApiDraft[]) {
    const savedIds = new Set(entries.flatMap((entry) => (entry.id ? [entry.id] : [])));
    for (const entry of options.store.mockApis) {
      if (entry.id && !savedIds.has(entry.id)) await options.apiClient.deleteMockApi(entry.id);
    }
    for (const entry of entries) {
      if (!entry.targetEndpointId)
        throw new Error(`Select a service endpoint for ${entry.name || "mock API"}`);
      const body = { ...entry, targetEndpointId: entry.targetEndpointId };
      if (entry.id) await options.apiClient.updateMockApi(entry.id, body);
      else await options.apiClient.createMockApi(body);
    }
  }

  async function saveMockDraft() {
    try {
      if (options.editingEnvironmentVariableId.value && !(await updateEnvironmentVariable()))
        return;
      await options.saveCanvas();
      const entries = parseMockDrafts();
      await saveEnvironmentVariables();
      await saveMockApis(entries);
      options.closeSettings();
      await options.loadCanvas();
      await options.saveCanvas();
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
    dismissImportWarning,
    removeMockDraft,
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
