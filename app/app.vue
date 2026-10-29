<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import {
  Handle,
  Position,
  VueFlow,
  useVueFlow,
  type Connection,
  type Edge,
  type Node,
} from "@vue-flow/core";
import { Background, BackgroundVariant } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import { MiniMap } from "@vue-flow/minimap";
import { parsePostmanCollection } from "./utils/postman-import";
import { Codemirror } from "vue-codemirror";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { autocompletion, type CompletionContext } from "@codemirror/autocomplete";
import { linter } from "@codemirror/lint";
import { EditorView, ViewPlugin, Decoration, type DecorationSet } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import "@vue-flow/controls/dist/style.css";

type Endpoint = {
  id?: string;
  name: string;
  apiType: string;
  method: string;
  url: string;
  requestJson: unknown;
};
type Service = {
  id: string;
  name: string;
  framework: string;
  baseUrl: string;
  active: boolean;
  positionX: number;
  positionY: number;
  endpoints: Endpoint[];
};
type MockApi = {
  id?: string;
  name: string;
  targetEndpointId: string;
  description: string;
  requestJson: unknown;
  pathParameters: Record<string, string>;
};
type EnvironmentVariable = {
  id: string;
  name: string;
  value: string;
  pendingCreate?: boolean;
};
type LogEntry = {
  id: number;
  timestamp: string;
  serviceName: string;
  severity: string;
  message: string;
};

const nodes = ref<Node[]>([]);
const edges = ref<Edge[]>([]);
const services = ref<Service[]>([]);
const collapsedServiceEndpoints = ref<Record<string, boolean>>({});
const serviceHealth = ref<Record<string, boolean | null>>({});
const mockApis = ref<MockApi[]>([]);
const serviceEdges = ref<{ id: string; sourceServiceId: string; targetEndpointId: string }[]>([]);
const viewport = ref({ x: 0, y: 0, zoom: 1 });
const mockNodePosition = ref({ x: 560, y: 160 });
const dark = useCookie("cairn-dark-mode", {
  default: () => false,
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax",
});
const loading = ref(true);
const errorMessage = ref("");
const importWarnings = ref<{ id: number; message: string }[]>([]);
const contextMenu = ref<{ x: number; y: number; flowX: number; flowY: number } | null>(null);
const serviceDialog = ref(false);
const editingServiceId = ref<string | null>(null);
const serviceDraft = ref<ServiceDraft>(newServiceDraft());
const frameworkMenuOpen = ref(false);
const mockPanel = ref(false);
const mockDraft = ref<MockApi[]>([]);
const environmentVariables = ref<EnvironmentVariable[]>([]);
const registeredMockApisOpen = ref(true);
const sharedEnvironmentVariablesOpen = ref(true);
const savedEnvironmentVariableIds = ref<string[]>([]);
const savedEnvironmentVariableValues = ref<Record<string, { name: string; value: string }>>({});
const environmentVariablesLoading = ref(false);
const editingEnvironmentVariableId = ref<string | null>(null);
const environmentCardDraft = ref({ name: "", value: "" });
const postmanFileInput = ref<HTMLInputElement | null>(null);
const logsOpen = ref(false);
const logsPanelHeight = ref(280);
const logs = ref<LogEntry[]>([]);
const logSearch = ref("");
const logService = ref<string[]>([]);
const logSeverity = ref<string[]>([]);
const runningMockId = ref<string | null>(null);
const runResults = ref<Record<string, RunResult>>({});
const observedErrorServices = ref<string[]>([]);
const observedServices = ref<string[]>([]);
const observedEdges = ref<{ sourceService: string; targetService: string }[]>([]);
const observedMockApiId = ref<string | null>(null);
const mockConnectionsCollapsed = ref(false);
const allNodesCollapsed = computed(
  () =>
    mockConnectionsCollapsed.value &&
    services.value
      .filter((service) => service.endpoints.length)
      .every((service) => collapsedServiceEndpoints.value[service.id]),
);
let healthTimer: ReturnType<typeof setInterval> | undefined;
let nextImportWarningId = 0;
const { fitView, screenToFlowCoordinate, setViewport, updateNodeInternals } = useVueFlow();

type ServiceDraft = {
  name: string;
  framework: string;
  baseUrl: string;
  active: boolean;
  endpoints: Endpoint[];
};
type RunResult = {
  id: string;
  status: string;
  responseStatus: number | null;
  responseBody: string | null;
  error: string | null;
  traceId: string;
  flow?: { status: string; incomplete: boolean };
};
const placeholderMark = Decoration.mark({ class: "cm-variable-placeholder" });
const placeholderHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = this.find(view);
    }
    update(update: { docChanged: boolean; viewportChanged: boolean; view: EditorView }) {
      if (update.docChanged || update.viewportChanged) this.decorations = this.find(update.view);
    }
    find(view: EditorView) {
      const builder = new RangeSetBuilder<Decoration>();
      const text = view.state.doc.toString();
      for (const match of text.matchAll(/\{\{[A-Za-z_][A-Za-z0-9_]*\}\}/g))
        builder.add(match.index!, match.index! + match[0].length, placeholderMark);
      return builder.finish();
    }
  },
  { decorations: (plugin) => plugin.decorations },
);
const requestEditorExtensions = [
  json(),
  linter(jsonParseLinter()),
  autocompletion({ override: [(context) => variableCompletions(context)] }),
  placeholderHighlighter,
  EditorView.lineWrapping,
  EditorView.theme({
    "&": { minHeight: "120px", maxHeight: "260px" },
    ".cm-scroller": { overflow: "auto" },
  }),
];
function variableCompletions(context: CompletionContext) {
  const match = context.matchBefore(/\{\{[A-Za-z_0-9]*$/);
  if (!match && !context.explicit) return null;
  return {
    from: match?.from ?? context.pos,
    options: environmentVariables.value.map(({ name }) => ({
      label: `{{${name}}}`,
      apply: `{{${name}}}`,
    })),
  };
}
function formatRequestJson(entry: MockApi) {
  try {
    entry.requestJson = JSON.stringify(JSON.parse(String(entry.requestJson || "{}")), null, 2);
  } catch {
    errorMessage.value = `Request for ${entry.name || "mock API"} must be valid JSON`;
  }
}
function endpointPathParameterNames(entry: MockApi) {
  const endpoint = mockEndpoint(entry);
  return endpoint
    ? [
        ...(endpoint.url.split(/[?#]/, 1)[0] ?? endpoint.url).matchAll(
          /\{([A-Za-z_][\w-]*)(?::[^{}]+)?\}|:([A-Za-z_][\w-]*)/g,
        ),
      ].map((match) => match[1] ?? match[2]!)
    : [];
}
function setMockEndpoint(entry: MockApi) {
  const allowed = new Set(endpointPathParameterNames(entry));
  entry.pathParameters = Object.fromEntries(
    Object.entries(entry.pathParameters ?? {}).filter(([key]) => allowed.has(key)),
  );
  for (const name of allowed) entry.pathParameters[name] ??= "";
}
function editEnvironmentVariable(variable: EnvironmentVariable) {
  editingEnvironmentVariableId.value = variable.id;
  environmentCardDraft.value = { name: variable.name, value: variable.value };
}
function resetEnvironmentCardEdit() {
  editingEnvironmentVariableId.value = null;
  environmentCardDraft.value = { name: "", value: "" };
}
async function updateEnvironmentVariable() {
  try {
    const id = editingEnvironmentVariableId.value;
    if (!id) return true;
    const name = environmentCardDraft.value.name.trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,254}$/.test(name))
      throw new Error(
        "Variable name must start with a letter or underscore and contain only letters, numbers, or underscores",
      );
    if (environmentVariables.value.some((item) => item.name === name && item.id !== id))
      throw new Error(`Variable "${name}" already exists`);
    const variable = environmentVariables.value.find((item) => item.id === id);
    if (!variable) throw new Error("Environment variable no longer exists");
    const value = environmentCardDraft.value.value;
    const saved = savedEnvironmentVariableValues.value[id];
    const changed = !saved || saved.name !== name || saved.value !== value;
    if (changed && !variable.pendingCreate) {
      await api(`/api/environment-variables/${id}`, {
        method: "PUT",
        body: { name, value },
      });
    }
    Object.assign(variable, { name, value });
    savedEnvironmentVariableValues.value[id] = { name, value };
    resetEnvironmentCardEdit();
    return true;
  } catch (cause) {
    errorMessage.value = cause instanceof Error ? cause.message : "Could not update variable";
    return false;
  }
}
async function addEnvironmentVariable() {
  if (editingEnvironmentVariableId.value && !(await updateEnvironmentVariable())) return;
  sharedEnvironmentVariablesOpen.value = true;
  const variable: EnvironmentVariable = {
    id: `draft-${crypto.randomUUID()}`,
    name: "",
    value: "",
    pendingCreate: true,
  };
  environmentVariables.value.push(variable);
  editEnvironmentVariable(variable);
}
function deleteEnvironmentVariable(variable: EnvironmentVariable) {
  environmentVariables.value = environmentVariables.value.filter(({ id }) => id !== variable.id);
  if (editingEnvironmentVariableId.value === variable.id) resetEnvironmentCardEdit();
}
function newServiceDraft(): ServiceDraft {
  return {
    name: "",
    framework: "",
    baseUrl: "http://localhost:3000",
    active: true,
    endpoints: [{ name: "", apiType: "REST", method: "GET", url: "/" }],
  };
}

async function api<T>(path: string, options?: { method?: string; body?: unknown }): Promise<T> {
  return await $fetch<T>(path, options as never);
}

function endpointTarget(endpointId: string) {
  for (const service of services.value) {
    if (service.endpoints.some((endpoint) => endpoint.id === endpointId)) return service.id;
  }
  return undefined;
}

function mockEndpoint(entry: MockApi) {
  return services.value
    .flatMap((service) => service.endpoints)
    .find((item) => item.id === entry.targetEndpointId);
}

function endpointHandle(endpointId: string) {
  const service = services.value.find((item) =>
    item.endpoints.some((endpoint) => endpoint.id === endpointId),
  );
  return service && collapsedServiceEndpoints.value[service.id]
    ? service.endpoints[0]?.id
    : endpointId;
}

function frameworkLabel(framework: string) {
  return framework.toLowerCase().includes(".net") ? ".NET" : framework;
}

function serviceNode(service: Service): Node {
  return {
    id: service.id,
    type: "service",
    position: { x: service.positionX, y: service.positionY },
    data: {
      serviceId: service.id,
      name: service.name,
      framework: frameworkLabel(service.framework),
      online: serviceHealth.value[service.id] ?? null,
      endpoints: service.endpoints,
      endpointsCollapsed: collapsedServiceEndpoints.value[service.id] ?? false,
    },
    class: [
      observedServices.value.includes(service.name) ? "service-observed" : "",
      observedErrorServices.value.includes(service.name) ? "service-error" : "",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function mockNode(): Node {
  return {
    id: "mock-apis",
    type: "mockApis",
    position: mockNodePosition.value,
    data: { entries: mockApis.value },
    class: observedMockApiId.value ? "mock-node-observed" : "",
  };
}

function buildEdges() {
  const declared: Edge[] = serviceEdges.value.flatMap((edge) => {
    const target = endpointTarget(edge.targetEndpointId);
    if (!target) return [];
    return [
      {
        id: edge.id,
        source: edge.sourceServiceId,
        sourceHandle: "service-out",
        target,
        targetHandle: endpointHandle(edge.targetEndpointId),
        type: "default",
        class: observedEdges.value.some(
          (item) =>
            item.sourceService ===
              services.value.find((s) => s.id === edge.sourceServiceId)?.name &&
            item.targetService === services.value.find((s) => s.id === target)?.name,
        )
          ? "observed"
          : "",
      },
    ];
  });
  const mock: Edge[] = mockApis.value.flatMap((entry) => {
    const target = endpointTarget(entry.targetEndpointId);
    if (!entry.id || !target) return [];
    return [
      {
        id: `mock-${entry.id}`,
        source: "mock-apis",
        sourceHandle: mockConnectionsCollapsed.value
          ? mockApis.value.find((item) => item.id)?.id
          : entry.id,
        target,
        targetHandle: endpointHandle(entry.targetEndpointId),
        type: "default",
        class:
          entry.id === runningMockId.value
            ? "running-edge"
            : entry.id === observedMockApiId.value
              ? "observed"
              : "",
      },
    ];
  });
  const observed: Edge[] = observedEdges.value.flatMap((edge, index) => {
    const source = services.value.find((service) => service.name === edge.sourceService)?.id;
    const target = services.value.find((service) => service.name === edge.targetService)?.id;
    if (!source || !target) return [];
    return [
      {
        id: `observed-${index}`,
        source,
        sourceHandle: "service-out",
        target,
        targetHandle: services.value.find((service) => service.id === target)?.endpoints[0]?.id,
        type: "default",
        class: "observed",
        animated: true,
      },
    ];
  });
  edges.value = [...declared, ...mock, ...observed];
}

async function toggleMockConnections() {
  mockConnectionsCollapsed.value = !mockConnectionsCollapsed.value;
  await nextTick();
  updateNodeInternals(["mock-apis"]);
  await nextTick();
  buildEdges();
}

function syncNodes() {
  nodes.value = [...services.value.map(serviceNode), mockNode()];
  buildEdges();
}

async function toggleServiceEndpoints(serviceId: string) {
  collapsedServiceEndpoints.value[serviceId] = !collapsedServiceEndpoints.value[serviceId];
  syncNodes();
  await nextTick();
  updateNodeInternals([serviceId]);
  await nextTick();
  buildEdges();
}

async function toggleAllNodes() {
  const collapsed = !allNodesCollapsed.value;
  collapsedServiceEndpoints.value = Object.fromEntries(
    services.value.map((service) => [service.id, collapsed]),
  );
  mockConnectionsCollapsed.value = collapsed;
  syncNodes();
  await nextTick();
  updateNodeInternals([...services.value.map((service) => service.id), "mock-apis"]);
  await nextTick();
  buildEdges();
}

async function loadCanvas() {
  loading.value = true;
  try {
    const canvas = await api<{
      viewport: typeof viewport.value;
      mockNode: { x: number; y: number };
      services: Service[];
      edges: typeof serviceEdges.value;
      mockApis: MockApi[];
    }>("/api/canvas");
    services.value = canvas.services;
    serviceEdges.value = canvas.edges;
    mockApis.value = canvas.mockApis;
    viewport.value = canvas.viewport;
    mockNodePosition.value = canvas.mockNode;
    syncNodes();
    if (viewport.value.zoom !== 1 || viewport.value.x || viewport.value.y)
      await setViewport(viewport.value);
    await loadServiceHealth();
  } catch (cause) {
    errorMessage.value = cause instanceof Error ? cause.message : "Could not load the graph";
  } finally {
    loading.value = false;
  }
}

async function loadServiceHealth() {
  try {
    const results = await api<{ id: string; online: boolean }[]>("/api/services/health");
    serviceHealth.value = Object.fromEntries(results.map(({ id, online }) => [id, online]));
    syncNodes();
  } catch {
    /* leave the last known health state visible */
  }
}

async function loadLogs() {
  const query = new URLSearchParams();
  if (logSearch.value.trim()) query.set("search", logSearch.value.trim());
  for (const service of logService.value) query.append("service", service);
  for (const severity of logSeverity.value) query.append("severity", severity);
  try {
    logs.value = await api<LogEntry[]>(`/api/logs${query.size ? `?${query}` : ""}`);
  } catch {
    /* keep the visible logs */
  }
}

function toggleLogService(name: string) {
  logService.value = logService.value.includes(name)
    ? logService.value.filter((service) => service !== name)
    : [...logService.value, name];
}

function toggleLogSeverity(severity: string) {
  logSeverity.value = logSeverity.value.includes(severity)
    ? logSeverity.value.filter((level) => level !== severity)
    : [...logSeverity.value, severity];
}

let logTimer: ReturnType<typeof setTimeout>;
watch([logSearch, () => logService.value.join("\0"), () => logSeverity.value.join("\0")], () => {
  clearTimeout(logTimer);
  logTimer = setTimeout(loadLogs, 180);
});
watch(logsOpen, (open) => {
  if (open) void loadLogs();
});

function canvasPayload() {
  const servicePositions = nodes.value
    .filter((node) => node.id !== "mock-apis")
    .map((node) => ({ id: node.id, x: node.position.x, y: node.position.y }));
  const mock = nodes.value.find((node) => node.id === "mock-apis");
  return {
    viewport: viewport.value,
    mockNode: mock ? mock.position : mockNodePosition.value,
    services: servicePositions,
    edges: serviceEdges.value,
  };
}

async function saveCanvas() {
  try {
    await api("/api/canvas", { method: "PUT", body: canvasPayload() });
    for (const node of nodes.value) {
      if (node.id === "mock-apis") mockNodePosition.value = { ...node.position };
      else {
        const service = services.value.find((item) => item.id === node.id);
        if (service) {
          service.positionX = node.position.x;
          service.positionY = node.position.y;
        }
      }
    }
    errorMessage.value = "";
  } catch (cause) {
    errorMessage.value = cause instanceof Error ? cause.message : "Could not save the graph";
  }
}

function onMoveEnd(event: { x: number; y: number; zoom: number }) {
  viewport.value = { x: event.x, y: event.y, zoom: event.zoom };
  void saveCanvas();
}

async function onConnect(connection: Connection) {
  if (!connection.source || !connection.target || !connection.targetHandle) return;
  if (connection.source === "mock-apis") {
    const entry = mockApis.value.find((item) => item.id === connection.sourceHandle);
    if (!entry?.id) return;
    try {
      await saveCanvas();
      await api(`/api/mock-apis/${entry.id}`, {
        method: "PUT",
        body: { ...entry, targetEndpointId: connection.targetHandle },
      });
      mockApis.value = await api<MockApi[]>("/api/mock-apis");
      syncNodes();
      await saveCanvas();
    } catch (cause) {
      errorMessage.value = cause instanceof Error ? cause.message : "Could not connect mock API";
    }
    return;
  }
  if (connection.source === connection.target) return;
  serviceEdges.value = [
    ...serviceEdges.value.filter(
      (item) =>
        !(
          item.sourceServiceId === connection.source &&
          item.targetEndpointId === connection.targetHandle
        ),
    ),
    {
      id: crypto.randomUUID(),
      sourceServiceId: connection.source,
      targetEndpointId: connection.targetHandle,
    },
  ];
  buildEdges();
  await saveCanvas();
}

function handleCanvasContextMenu(event: MouseEvent) {
  if (contextMenu.value) {
    contextMenu.value = null;
    return;
  }
  if (!(event.target instanceof Element) || !event.target.closest(".graph-flow")) return;
  event.preventDefault();
  const point = screenToFlowCoordinate({ x: event.clientX, y: event.clientY });
  contextMenu.value = { x: event.clientX, y: event.clientY, flowX: point.x, flowY: point.y };
}

function beginAddService() {
  if (!contextMenu.value) return;
  serviceDraft.value = newServiceDraft();
  frameworkMenuOpen.value = false;
  editingServiceId.value = null;
  addPosition.value = { x: contextMenu.value.flowX, y: contextMenu.value.flowY };
  serviceDialog.value = true;
  contextMenu.value = null;
}

const addPosition = ref({ x: 160, y: 120 });

function editService(id: string, focusEndpointId?: string) {
  const service = services.value.find((item) => item.id === id);
  if (!service) return;
  frameworkMenuOpen.value = false;
  editingServiceId.value = id;
  serviceDraft.value = {
    name: service.name,
    framework: frameworkLabel(service.framework),
    baseUrl: service.baseUrl,
    active: service.active,
    endpoints: service.endpoints.map((endpoint) => ({ ...endpoint })),
  };
  serviceDialog.value = true;
  if (focusEndpointId)
    void nextTick(() => {
      const card = document.getElementById(`service-endpoint-${focusEndpointId}`);
      if (card instanceof HTMLDetailsElement) card.open = true;
      card?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
}

function openServiceEndpoint(endpointId: string) {
  const service = services.value.find((item) =>
    item.endpoints.some((endpoint) => endpoint.id === endpointId),
  );
  if (service) editService(service.id, endpointId);
}

function onNodeClick(event: { node: { id: string } }) {
  void fitView({ nodes: [event.node.id], padding: 0.45, duration: 300 });
  if (event.node.id === "mock-apis") openMockPanel();
  else editService(event.node.id);
}

function addEndpoint() {
  serviceDraft.value.endpoints.push({
    name: "",
    apiType: "REST",
    method: "GET",
    url: "/",
  });
}

function removeEndpoint(index: number) {
  serviceDraft.value.endpoints.splice(index, 1);
}

async function saveService() {
  try {
    await saveCanvas();
    const path = editingServiceId.value
      ? `/api/services/${editingServiceId.value}`
      : "/api/services";
    const body = editingServiceId.value
      ? serviceDraft.value
      : { ...serviceDraft.value, positionX: addPosition.value.x, positionY: addPosition.value.y };
    await api(path, { method: editingServiceId.value ? "PUT" : "POST", body });
    closeSettings();
    await loadCanvas();
    await saveCanvas();
  } catch (cause) {
    errorMessage.value = cause instanceof Error ? cause.message : "Could not save service";
  }
}

async function deleteService(id: string) {
  if (!confirm("Remove this service and its endpoints from the graph?")) return;
  try {
    await saveCanvas();
    await api(`/api/services/${id}`, { method: "DELETE" });
    await loadCanvas();
    await saveCanvas();
  } catch (cause) {
    errorMessage.value = cause instanceof Error ? cause.message : "Could not remove service";
  }
}

async function openMockPanel(focusMockApiId?: string) {
  if (focusMockApiId) registeredMockApisOpen.value = true;
  mockDraft.value = mockApis.value.map((entry) => ({
    ...entry,
    pathParameters: { ...entry.pathParameters },
    requestJson: JSON.stringify(entry.requestJson ?? {}, null, 2),
  }));
  resetEnvironmentCardEdit();
  environmentVariablesLoading.value = true;
  mockPanel.value = true;
  try {
    const items = await api<EnvironmentVariable[]>("/api/environment-variables");
    environmentVariables.value = items;
    savedEnvironmentVariableIds.value = items.map(({ id }) => id);
    savedEnvironmentVariableValues.value = Object.fromEntries(
      items.map(({ id, name, value }) => [id, { name, value }]),
    );
  } catch (cause) {
    errorMessage.value = cause instanceof Error ? cause.message : "Could not load shared variables";
  } finally {
    environmentVariablesLoading.value = false;
  }
  if (focusMockApiId)
    void nextTick(() => {
      const card = document.getElementById(`mock-api-${focusMockApiId}`);
      if (card instanceof HTMLDetailsElement) card.open = true;
      document
        .getElementById(`mock-endpoint-${focusMockApiId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
}
function addMockDraft() {
  registeredMockApisOpen.value = true;
  const endpoint =
    services.value.flatMap((service) => service.endpoints).find((item) => item.id)?.id ?? "";
  mockDraft.value.push({
    name: "",
    targetEndpointId: endpoint,
    description: "",
    requestJson: "{}",
    pathParameters: {},
  });
  setMockEndpoint(mockDraft.value[mockDraft.value.length - 1]!);
}
async function importPostmanCollection(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;

  importWarnings.value = [];
  errorMessage.value = "";
  try {
    const result = parsePostmanCollection(await file.text(), services.value);
    registeredMockApisOpen.value = true;
    mockDraft.value.push(...result.drafts);
    importWarnings.value = result.warnings.map((message) => ({
      id: nextImportWarningId++,
      message,
    }));
  } catch (cause) {
    errorMessage.value =
      cause instanceof Error ? cause.message : "Could not import Postman collection";
  }
}
function dismissImportWarning(id: number) {
  importWarnings.value = importWarnings.value.filter((warning) => warning.id !== id);
}
function removeMockDraft(index: number) {
  mockDraft.value.splice(index, 1);
}

async function saveMockDraft() {
  try {
    if (editingEnvironmentVariableId.value && !(await updateEnvironmentVariable())) return;
    await saveCanvas();
    const entries = mockDraft.value.map((entry) => {
      let requestJson: unknown;
      try {
        requestJson =
          typeof entry.requestJson === "string"
            ? JSON.parse(entry.requestJson.trim() || "{}")
            : (entry.requestJson ?? {});
      } catch {
        throw new Error(`Request for ${entry.name || "mock API"} must be valid JSON`);
      }
      return { ...entry, requestJson };
    });
    const variableIds = new Set(
      environmentVariables.value.filter(({ pendingCreate }) => !pendingCreate).map(({ id }) => id),
    );
    for (const id of savedEnvironmentVariableIds.value)
      if (!variableIds.has(id)) await api(`/api/environment-variables/${id}`, { method: "DELETE" });
    for (const variable of environmentVariables.value) {
      const { id, name, value, pendingCreate } = variable;
      if (pendingCreate) {
        const created = await api<{ id: string }>("/api/environment-variables", {
          method: "POST",
          body: { name, value },
        });
        delete savedEnvironmentVariableValues.value[id];
        variable.id = created.id;
        delete variable.pendingCreate;
        savedEnvironmentVariableValues.value[created.id] = { name, value };
      } else {
        const saved = savedEnvironmentVariableValues.value[id];
        if (!saved || saved.name !== name || saved.value !== value) {
          await api(`/api/environment-variables/${id}`, {
            method: "PUT",
            body: { name, value },
          });
          savedEnvironmentVariableValues.value[id] = { name, value };
        }
      }
    }
    savedEnvironmentVariableIds.value = environmentVariables.value.map(({ id }) => id);
    const savedIds = new Set(entries.flatMap((entry) => (entry.id ? [entry.id] : [])));
    for (const entry of mockApis.value)
      if (entry.id && !savedIds.has(entry.id))
        await api(`/api/mock-apis/${entry.id}`, { method: "DELETE" });
    for (const entry of entries) {
      if (entry.id) await api(`/api/mock-apis/${entry.id}`, { method: "PUT", body: entry });
      else await api("/api/mock-apis", { method: "POST", body: entry });
    }
    closeSettings();
    await loadCanvas();
    await saveCanvas();
  } catch (cause) {
    errorMessage.value = cause instanceof Error ? cause.message : "Could not save mock APIs";
  }
}

async function runMock(entry: MockApi) {
  if (!entry.id) return;
  await saveCanvas();
  const targetService = services.value.find((service) =>
    service.endpoints.some((endpoint) => endpoint.id === entry.targetEndpointId),
  );
  runningMockId.value = entry.id;
  observedMockApiId.value = entry.id;
  observedEdges.value = [];
  observedErrorServices.value = [];
  observedServices.value = targetService ? [targetService.name] : [];
  runResults.value[entry.id] = {
    id: "",
    traceId: "",
    status: "running",
    responseStatus: null,
    responseBody: null,
    error: null,
  };
  syncNodes();
  try {
    const result = await api<RunResult>(`/api/mock-apis/${entry.id}/runs`, { method: "POST" });
    runResults.value[entry.id] = result;
    if (result.status === "failed") {
      logService.value = targetService ? [targetService.name] : [];
      logSeverity.value = [];
      logsOpen.value = true;
      await loadLogs();
    }
    const deadline = Date.now() + 11_000;
    let flow:
      | {
          status: string;
          incomplete: boolean;
          errorServices: string[];
          edges: { sourceService: string; targetService: string }[];
        }
      | undefined;
    do {
      flow = await api(`/api/runs/${result.id}/flow`);
      if (flow.status === "complete") break;
      await new Promise((resolve) => setTimeout(resolve, 350));
    } while (Date.now() < deadline);
    if (flow) {
      observedErrorServices.value = flow.errorServices;
      observedEdges.value = flow.edges;
      const participants = flow.edges.flatMap((edge) => [edge.sourceService, edge.targetService]);
      if (targetService) participants.push(targetService.name);
      observedServices.value = [...new Set(participants)];
      runResults.value[entry.id] = { ...result, flow };
      syncNodes();
    }
    if (result.status === "failed") {
      if (flow?.errorServices.length) logService.value = flow.errorServices;
      await loadLogs();
    } else if (logsOpen.value) await loadLogs();
  } catch (cause) {
    runResults.value[entry.id] = {
      id: "",
      traceId: "",
      status: "failed",
      responseStatus: null,
      responseBody: null,
      error: cause instanceof Error ? cause.message : "Call failed",
    };
    logService.value = targetService ? [targetService.name] : [];
    logSeverity.value = [];
    logsOpen.value = true;
    await loadLogs();
  } finally {
    runningMockId.value = null;
    buildEdges();
    await saveCanvas();
  }
}

function prettyResponse(value: string | null) {
  if (!value) return "No response body";
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function resizeLogsPanel(event: PointerEvent) {
  const startY = event.clientY;
  const startHeight = logsPanelHeight.value;
  const update = (move: PointerEvent) => {
    logsPanelHeight.value = Math.max(
      160,
      Math.min(window.innerHeight - 32, startHeight + startY - move.clientY),
    );
  };
  const stop = () => {
    window.removeEventListener("pointermove", update);
    window.removeEventListener("pointerup", stop);
    window.removeEventListener("pointercancel", stop);
  };
  window.addEventListener("pointermove", update);
  window.addEventListener("pointerup", stop, { once: true });
  window.addEventListener("pointercancel", stop, { once: true });
}

function adjustLogsPanelHeight(delta: number) {
  logsPanelHeight.value = Math.max(
    200,
    Math.min(window.innerHeight - 32, logsPanelHeight.value + delta),
  );
}

function closeSettings() {
  serviceDialog.value = false;
  mockPanel.value = false;
  frameworkMenuOpen.value = false;
  nodes.value = nodes.value.map((node) => (node.selected ? { ...node, selected: false } : node));
}

function closeSettingsOutside(event: PointerEvent) {
  if (event.target instanceof Element && event.target.closest(".side-dialog")) {
    if (!event.target.closest(".framework-select")) frameworkMenuOpen.value = false;
    return;
  }
  closeSettings();
}

const servicesForSelect = computed(() =>
  services.value.flatMap((service) =>
    service.endpoints.map((endpoint) => ({
      id: endpoint.id!,
      label: `${service.name}  |  ${endpoint.name} (${endpoint.method})`,
    })),
  ),
);

onMounted(async () => {
  document.addEventListener("pointerdown", closeSettingsOutside);
  logsPanelHeight.value = Math.max(
    160,
    Math.round(window.innerHeight * (window.innerWidth <= 720 ? 0.34 : 0.25)),
  );
  await loadCanvas();
  await loadLogs();
  healthTimer = setInterval(() => void loadServiceHealth(), 10000);
});

onUnmounted(() => {
  document.removeEventListener("pointerdown", closeSettingsOutside);
  if (healthTimer) clearInterval(healthTimer);
});
</script>

<template>
  <main
    class="relative h-screen min-h-[620px] overflow-hidden text-sm leading-[1.4] app"
    :class="{ dark, 'logs-open': logsOpen }"
    @click="contextMenu = null"
  >
    <header class="topbar float">
      <div class="brand-mark">SG</div>
      <div class="brand"><strong>Cairn</strong><span>DATA FLOW OBSERVABILITY</span></div>
      <div class="top-actions">
        <span class="project-label"><i></i> {{ services.length }} services</span>
        <button
          class="icon-button"
          :aria-label="allNodesCollapsed ? 'Expand all nodes' : 'Collapse all nodes'"
          :title="allNodesCollapsed ? 'Expand all nodes' : 'Collapse all nodes'"
          @click.stop="toggleAllNodes"
        >
          <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path v-if="allNodesCollapsed" d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />
            <path v-else d="M8 8H3V3m13 5h5V3M3 16h5v5m13-5h-5v5" />
          </svg>
        </button>
        <button
          class="icon-button"
          :aria-label="dark ? 'Use light theme' : 'Use dark theme'"
          @click.stop="dark = !dark"
        >
          <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle v-if="dark" cx="12" cy="12" r="4" />
            <path
              v-if="dark"
              d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"
            />
            <path v-else d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z" />
          </svg>
        </button>
      </div>
    </header>

    <section
      class="canvas-shell"
      @click="contextMenu = null"
      @contextmenu="handleCanvasContextMenu"
    >
      <VueFlow
        v-model:nodes="nodes"
        v-model:edges="edges"
        class="graph-flow"
        :select-nodes-on-drag="false"
        :elements-selectable="true"
        :min-zoom="0.2"
        :max-zoom="1.8"
        fit-view-on-init
        @connect="onConnect"
        @node-click="onNodeClick"
        @move-end="onMoveEnd"
        @node-drag-stop="saveCanvas"
      >
        <Background :variant="BackgroundVariant.Dots" :gap="22" :size="1.2" />
        <MiniMap
          pannable
          zoomable
          :node-color="dark ? '#343a40' : '#c5cbc9'"
          :node-stroke-color="dark ? '#9ba2a9' : '#68706c'"
          :mask-color="dark ? 'rgba(0, 0, 0, 0.58)' : 'rgba(240, 240, 240, 0.6)'"
          :mask-stroke-color="dark ? '#2dd4bf' : '#0f766e'"
        />
        <Controls />
        <template #node-service="{ data }">
          <article class="service-node node-card">
            <Handle
              id="service-out"
              type="source"
              :position="Position.Right"
              class="service-source"
            />
            <div class="node-header">
              <div class="framework-icon">
                <img
                  v-if="String(data.framework).toLowerCase().includes('spring')"
                  src="/icons/spring-boot.svg"
                  alt="Spring Boot"
                />
                <img v-else src="/icons/dotnet.svg" alt=".NET" />
              </div>
              <div class="node-heading">
                <div class="node-name-line">
                  <span
                    class="service-state-dot"
                    :class="
                      data.online === true ? 'on' : data.online === false ? 'off' : 'checking'
                    "
                    :aria-label="
                      data.online === true
                        ? 'Service online'
                        : data.online === false
                          ? 'Service offline'
                          : 'Checking service status'
                    "
                    :title="
                      data.online === true
                        ? 'Online'
                        : data.online === false
                          ? 'Offline'
                          : 'Checking'
                    "
                    role="img"
                  ></span>
                  <strong>{{ data.name }}</strong>
                </div>
                <span>{{ data.framework }} | {{ data.endpoints.length }} endpoints</span>
              </div>
              <button
                v-if="data.endpoints.length"
                type="button"
                class="collapse-connections nodrag"
                :aria-label="
                  data.endpointsCollapsed ? 'Show service endpoints' : 'Collapse service endpoints'
                "
                :title="
                  data.endpointsCollapsed ? 'Show service endpoints' : 'Collapse service endpoints'
                "
                @click.stop="toggleServiceEndpoints(data.serviceId)"
              >
                <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path v-if="data.endpointsCollapsed" d="M12 5v14m-7-7h14" />
                  <path v-else d="M5 12h14" />
                </svg>
              </button>
            </div>
            <div
              class="endpoint-heading"
              :class="{ 'endpoint-heading-collapsed': data.endpointsCollapsed }"
            >
              <span>{{
                data.endpointsCollapsed
                  ? `${data.endpoints.length} endpoints · incoming connections bundled`
                  : "REGISTERED ENDPOINTS"
              }}</span>
            </div>
            <div
              v-for="endpoint in data.endpoints"
              :key="endpoint.id"
              class="endpoint-row"
              :class="{
                'endpoint-row-collapsed': data.endpointsCollapsed,
                'endpoint-row-bundle':
                  data.endpointsCollapsed && endpoint.id === data.endpoints[0]?.id,
              }"
            >
              <Handle
                v-if="
                  endpoint.id && (!data.endpointsCollapsed || endpoint.id === data.endpoints[0]?.id)
                "
                :id="endpoint.id"
                type="target"
                :position="Position.Left"
                class="endpoint-handle"
              />
              <span class="method-tag" :class="`method-${endpoint.method.toLowerCase()}`">{{
                endpoint.method
              }}</span>
              <button
                type="button"
                class="endpoint-name endpoint-link"
                @click.stop="openServiceEndpoint(endpoint.id)"
              >
                {{ endpoint.name }}
              </button>
            </div>
            <div v-if="!data.endpoints.length" class="empty-endpoints">No endpoints registered</div>
            <div v-if="observedErrorServices.includes(data.name)" class="error-indicator">
              <span class="error-mark">!</span> Error reported for this service
            </div>
          </article>
        </template>
        <template #node-mockApis>
          <article class="mock-node node-card">
            <div class="node-header mock-header">
              <div class="mock-icon">API</div>
              <div class="node-heading">
                <strong>Mock APIs</strong><span>Reusable REST calls</span>
              </div>
              <button
                type="button"
                class="collapse-connections nodrag"
                :aria-label="
                  mockConnectionsCollapsed
                    ? 'Show outgoing connections'
                    : 'Hide outgoing connections'
                "
                :title="
                  mockConnectionsCollapsed
                    ? 'Show outgoing connections'
                    : 'Hide outgoing connections'
                "
                @click.stop="toggleMockConnections"
              >
                <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path v-if="mockConnectionsCollapsed" d="M12 5v14m-7-7h14" />
                  <path v-else d="M5 12h14" />
                </svg>
              </button>
            </div>
            <div v-if="!mockApis.length" class="empty-endpoints">
              Add a mock API to trigger calls
            </div>
            <div v-if="mockConnectionsCollapsed && mockApis.length" class="mock-collapsed-summary">
              {{ mockApis.length }} mock API{{ mockApis.length === 1 ? "" : "s" }} · outgoing calls
              bundled
            </div>
            <div
              v-for="entry in mockApis"
              :key="entry.id"
              class="mock-row"
              :class="{
                running: runningMockId === entry.id,
                'mock-row-collapsed': mockConnectionsCollapsed,
                'mock-row-bundle': mockConnectionsCollapsed && entry.id === mockApis[0]?.id,
              }"
            >
              <Handle
                v-if="entry.id && (!mockConnectionsCollapsed || entry.id === mockApis[0]?.id)"
                :id="entry.id"
                type="source"
                :position="Position.Right"
                class="mock-handle"
              />
              <div class="mock-copy">
                <strong>{{ entry.name }}</strong
                ><button
                  type="button"
                  class="mock-endpoint-link"
                  @click.stop="entry.id && openMockPanel(entry.id)"
                >
                  <span
                    v-if="mockEndpoint(entry)"
                    class="method-tag"
                    :class="`method-${mockEndpoint(entry)?.method.toLowerCase()}`"
                    >{{ mockEndpoint(entry)?.method }}</span
                  ><span v-else class="mock-no-endpoint">No endpoint</span>
                  {{ mockEndpoint(entry)?.url ?? "Select a service endpoint" }}
                </button>
              </div>
              <span
                v-if="runResults[entry.id || '']"
                class="run-state"
                :class="runResults[entry.id || ''].status"
                >{{ runResults[entry.id || ""].status }}</span
              >
              <button
                class="run-button nodrag"
                :disabled="!!runningMockId"
                :aria-label="
                  runningMockId === entry.id ? `Running ${entry.name}` : `Run ${entry.name}`
                "
                :title="runningMockId === entry.id ? `Running ${entry.name}` : `Run ${entry.name}`"
                @click.stop="runMock(entry)"
              >
                <svg
                  v-if="runningMockId === entry.id"
                  class="ui-icon run-spinner"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="8" />
                </svg>
                <svg v-else class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
            </div>
          </article>
        </template>
      </VueFlow>
      <div v-if="loading" class="loading-banner float">Loading saved graph...</div>
      <div v-if="errorMessage || importWarnings.length" class="toast-stack">
        <div v-if="errorMessage" class="toast error-toast" role="alert">
          <span>{{ errorMessage }}</span
          ><button aria-label="Dismiss error" @click="errorMessage = ''">
            <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div
          v-for="warning in importWarnings"
          :key="warning.id"
          class="toast warning-toast"
          role="status"
        >
          <span>{{ warning.message }}</span
          ><button aria-label="Dismiss import warning" @click="dismissImportWarning(warning.id)">
            <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      </div>
      <div class="canvas-hint float">
        <kbd>Right click</kbd> to add a service <span> | </span> Drag from a node to an endpoint to
        connect
      </div>
      <div
        v-if="contextMenu"
        class="context-menu float"
        :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
        @click.stop
      >
        <button @click="beginAddService"><b>+</b> Add new service</button>
      </div>
    </section>

    <button
      class="logs-toggle float"
      :class="{ active: logsOpen }"
      @click.stop="logsOpen = !logsOpen"
    >
      <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 6h16M4 12h16M4 18h10" /></svg
      ><b>Logs</b>
    </button>
    <section
      v-if="logsOpen"
      class="logs-panel float"
      :style="{ '--logs-panel-height': `${logsPanelHeight}px` }"
    >
      <div
        class="logs-resize-handle"
        role="separator"
        aria-label="Resize logs panel"
        aria-orientation="horizontal"
        tabindex="0"
        @pointerdown.prevent="resizeLogsPanel"
        @keydown.up.prevent="adjustLogsPanelHeight(24)"
        @keydown.down.prevent="adjustLogsPanelHeight(-24)"
      ></div>
      <div class="logs-toolbar">
        <div class="logs-title">
          <strong>Logs</strong>
        </div>
        <input
          v-model="logSearch"
          class="control search"
          placeholder="Search log messages..."
          aria-label="Search log messages"
        />
        <details class="log-service-filter">
          <summary class="control" aria-label="Filter by service">
            {{ logService.length ? `${logService.length} selected` : "All services" }}
          </summary>
          <div class="log-service-options">
            <button
              type="button"
              :class="{ selected: !logService.length }"
              :aria-pressed="!logService.length"
              @click="logService = []"
            >
              All services
            </button>
            <button
              v-for="name in [...new Set(services.map((service) => service.name))].sort()"
              :key="name"
              type="button"
              :class="{ selected: logService.includes(name) }"
              :aria-pressed="logService.includes(name)"
              @click="toggleLogService(name)"
            >
              {{ name }}
            </button>
          </div>
        </details>
        <details class="log-service-filter">
          <summary class="control" aria-label="Filter by severity">
            {{ logSeverity.length ? `${logSeverity.length} selected` : "All levels" }}
          </summary>
          <div class="log-service-options">
            <button
              type="button"
              :class="{ selected: !logSeverity.length }"
              :aria-pressed="!logSeverity.length"
              @click="logSeverity = []"
            >
              All levels
            </button>
            <button
              v-for="level in ['ERROR', 'WARN', 'INFO', 'DEBUG']"
              :key="level"
              type="button"
              :class="{ selected: logSeverity.includes(level) }"
              :aria-pressed="logSeverity.includes(level)"
              @click="toggleLogSeverity(level)"
            >
              {{ level }}
            </button>
          </div>
        </details>
        <button class="icon-button" aria-label="Refresh logs" @click="loadLogs">
          <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 7v5h-5M20 12a8 8 0 1 1-2.34-5.66L20 7" />
          </svg>
        </button>
        <button class="icon-button" aria-label="Close logs" @click="logsOpen = false">
          <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <div class="logs-list">
        <div v-if="!logs.length" class="empty-logs">No logs match these filters.</div>
        <div
          v-for="log in logs"
          :key="log.id"
          class="log-row"
          :class="{ 'log-row-error': log.severity === 'ERROR' }"
        >
          <time>{{ formatTime(log.timestamp) }}</time
          ><span class="severity" :class="log.severity.toLowerCase()">{{ log.severity }}</span
          ><strong>{{ log.serviceName }}</strong
          ><span class="log-message" :class="{ 'log-error-message': log.severity === 'ERROR' }">{{
            log.message
          }}</span>
        </div>
      </div>
    </section>

    <div v-if="serviceDialog" class="dialog-backdrop" @click.self="closeSettings">
      <section
        class="side-dialog float"
        role="dialog"
        aria-modal="true"
        aria-label="Service settings"
      >
        <header class="dialog-header">
          <div>
            <strong>{{ editingServiceId ? "Service settings" : "Add service node" }}</strong
            ><span>Configure the service and its endpoints</span>
          </div>
          <button
            v-if="editingServiceId"
            class="icon-button danger-icon"
            aria-label="Remove service"
            title="Remove service"
            @click="
              deleteService(editingServiceId);
              closeSettings();
            "
          >
            <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" />
            </svg>
          </button>
        </header>
        <div class="dialog-body">
          <div class="service-config-fields">
            <label class="field"
              ><span>Service name</span
              ><input
                v-model="serviceDraft.name"
                class="control"
                placeholder="e.g. Checkout API"
                required
            /></label>
            <div class="field-row">
              <div class="field">
                <span>Framework</span>
                <div class="framework-select">
                  <button
                    type="button"
                    class="control framework-select-trigger"
                    role="combobox"
                    aria-haspopup="listbox"
                    :aria-expanded="frameworkMenuOpen"
                    :aria-label="`Framework: ${serviceDraft.framework || 'Select framework'}`"
                    @click.stop="frameworkMenuOpen = !frameworkMenuOpen"
                  >
                    <img
                      v-if="serviceDraft.framework"
                      :src="
                        serviceDraft.framework.toLowerCase().includes('spring')
                          ? '/icons/spring-boot.svg'
                          : '/icons/dotnet.svg'
                      "
                      alt=""
                      aria-hidden="true"
                    />
                    <span>{{ serviceDraft.framework || "Select framework" }}</span>
                    <svg class="ui-icon framework-chevron" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  <div v-if="frameworkMenuOpen" class="framework-options" role="listbox">
                    <button
                      type="button"
                      role="option"
                      :aria-selected="serviceDraft.framework === 'Spring Boot'"
                      @click.stop="
                        serviceDraft.framework = 'Spring Boot';
                        frameworkMenuOpen = false;
                      "
                    >
                      <img src="/icons/spring-boot.svg" alt="" aria-hidden="true" />
                      Spring Boot
                    </button>
                    <button
                      type="button"
                      role="option"
                      :aria-selected="serviceDraft.framework === '.NET'"
                      @click.stop="
                        serviceDraft.framework = '.NET';
                        frameworkMenuOpen = false;
                      "
                    >
                      <img src="/icons/dotnet.svg" alt="" aria-hidden="true" />
                      .NET
                    </button>
                  </div>
                </div>
              </div>
              <label class="field"
                ><span>Base URL</span
                ><input
                  v-model="serviceDraft.baseUrl"
                  class="control"
                  placeholder="http://localhost:4000"
              /></label>
            </div>
          </div>
          <div class="section-title">
            <strong>Available endpoints</strong
            ><button class="button secondary small" @click="addEndpoint">+ New endpoint</button>
          </div>
          <details
            v-for="(endpoint, index) in serviceDraft.endpoints"
            :key="endpoint.id || index"
            class="endpoint-form-card"
            :id="endpoint.id ? `service-endpoint-${endpoint.id}` : undefined"
          >
            <summary class="endpoint-form-head endpoint-form-summary">
              <div class="endpoint-summary-title">
                <button
                  type="button"
                  class="endpoint-delete-button"
                  :aria-label="`Remove ${endpoint.name || `Endpoint ${index + 1}`}`"
                  :title="`Remove ${endpoint.name || `Endpoint ${index + 1}`}`"
                  @click.stop.prevent="removeEndpoint(index)"
                >
                  <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" />
                  </svg>
                </button>
                <div class="endpoint-summary-copy">
                  <strong>{{ endpoint.name || `Endpoint ${index + 1}` }}</strong>
                  <span>{{ endpoint.method }} {{ endpoint.url }}</span>
                </div>
              </div>
            </summary>
            <label class="field"
              ><span>Name</span
              ><input v-model="endpoint.name" class="control" placeholder="e.g. Get order"
            /></label>
            <div class="field-row">
              <label class="field"
                ><span>API type</span
                ><select v-model="endpoint.apiType" class="control">
                  <option>REST</option>
                </select></label
              ><label class="field"
                ><span>Method</span
                ><select v-model="endpoint.method" class="control">
                  <option>GET</option>
                  <option>POST</option>
                  <option>PUT</option>
                  <option>PATCH</option>
                  <option>DELETE</option>
                </select></label
              >
            </div>
            <label class="field"
              ><span>URL</span><input v-model="endpoint.url" class="control" placeholder="/orders"
            /></label>
          </details>
        </div>
        <footer class="dialog-footer">
          <button class="button secondary" @click="closeSettings">Discard</button
          ><button class="button primary" @click="saveService">Save</button>
        </footer>
      </section>
    </div>

    <div v-if="mockPanel" class="dialog-backdrop" @click.self="closeSettings">
      <section
        class="side-dialog float"
        role="dialog"
        aria-modal="true"
        aria-label="Mock API settings"
      >
        <header class="dialog-header">
          <div>
            <strong>Mock APIs</strong><span>Calls linked to registered service endpoints</span>
          </div>
          <button class="icon-button" aria-label="Close" @click="closeSettings">
            <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        <div class="dialog-body">
          <div class="section-title">
            <button
              id="registered-mock-apis-toggle"
              class="settings-accordion-toggle"
              :aria-expanded="registeredMockApisOpen"
              aria-controls="registered-mock-apis-content"
              @click="registeredMockApisOpen = !registeredMockApisOpen"
            >
              <strong>Registered mock APIs</strong>
              <svg
                class="ui-icon settings-accordion-chevron"
                :class="{ collapsed: !registeredMockApisOpen }"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            <div class="flex gap-2">
              <input
                ref="postmanFileInput"
                class="hidden"
                type="file"
                accept="application/json,.json"
                @change="importPostmanCollection"
              />
              <button class="button secondary small" @click="postmanFileInput?.click()">
                Import Postman
              </button>
              <button class="button secondary small" @click="addMockDraft">+ New API</button>
            </div>
          </div>
          <div id="registered-mock-apis-content" v-show="registeredMockApisOpen">
            <details
              v-for="(entry, index) in mockDraft"
              :key="entry.id || `new-${index}`"
              class="endpoint-form-card mock-form-card"
              :id="entry.id ? `mock-api-${entry.id}` : undefined"
            >
              <summary class="endpoint-form-head endpoint-form-summary">
                <div class="endpoint-summary-title">
                  <button
                    type="button"
                    class="endpoint-delete-button"
                    :aria-label="`Remove ${entry.name || `Mock API ${index + 1}`}`"
                    :title="`Remove ${entry.name || `Mock API ${index + 1}`}`"
                    @click.stop.prevent="removeMockDraft(index)"
                  >
                    <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" />
                    </svg>
                  </button>
                  <div class="endpoint-summary-copy">
                    <strong>{{ entry.name || `Mock API ${index + 1}` }}</strong>
                    <span>{{
                      servicesForSelect.find((option) => option.id === entry.targetEndpointId)
                        ?.label ?? "Select service endpoint"
                    }}</span>
                  </div>
                </div>
              </summary>
              <label class="field"
                ><span>Name</span
                ><input v-model="entry.name" class="control" placeholder="e.g. Create order"
              /></label>
              <label class="field"
                ><span>Service endpoint</span
                ><select
                  :id="entry.id ? `mock-endpoint-${entry.id}` : undefined"
                  v-model="entry.targetEndpointId"
                  class="control"
                  @change="setMockEndpoint(entry)"
                >
                  <option value="" disabled>Select endpoint</option>
                  <option v-for="option in servicesForSelect" :key="option.id" :value="option.id">
                    {{ option.label }}
                  </option>
                </select></label
              >
              <label v-for="name in endpointPathParameterNames(entry)" :key="name" class="field">
                <span>Path parameter: {{ name }}</span>
                <input
                  v-model="entry.pathParameters[name]"
                  class="control"
                  :placeholder="`Value or {{${name}}}`"
                />
              </label>
              <label class="field"
                ><span>Request (JSON)</span>
                <div class="flex justify-end">
                  <button
                    class="button secondary small"
                    type="button"
                    @click="formatRequestJson(entry)"
                  >
                    Format JSON
                  </button>
                </div>
                <Codemirror
                  :model-value="String(entry.requestJson ?? '')"
                  :extensions="requestEditorExtensions"
                  :autofocus="false"
                  :placeholder="'{}'"
                  aria-label="Mock API request JSON"
                  @update:model-value="entry.requestJson = $event"
                />
              </label>
              <label class="field"
                ><span>Description</span
                ><input v-model="entry.description" class="control" placeholder="Optional note"
              /></label>
            </details>
            <div v-if="!mockDraft.length" class="empty-logs">
              No mock API rows yet. Add one to get started.
            </div>
          </div>
          <section class="environment-variable-section">
            <div class="section-title environment-variable-header">
              <button
                id="shared-environment-variables-toggle"
                class="settings-accordion-toggle"
                :aria-expanded="sharedEnvironmentVariablesOpen"
                aria-controls="shared-environment-variables-content"
                @click="sharedEnvironmentVariablesOpen = !sharedEnvironmentVariablesOpen"
              >
                <strong>Shared environment variables</strong>
                <svg
                  class="ui-icon settings-accordion-chevron"
                  :class="{ collapsed: !sharedEnvironmentVariablesOpen }"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              <button
                class="button secondary small"
                :disabled="environmentVariablesLoading"
                @click="addEnvironmentVariable"
              >
                New variable
              </button>
            </div>
            <div id="shared-environment-variables-content" v-show="sharedEnvironmentVariablesOpen">
              <div v-if="environmentVariables.length" class="environment-variable-list">
                <article
                  v-for="variable in environmentVariables"
                  :key="variable.id"
                  class="environment-variable-card"
                >
                  <template v-if="editingEnvironmentVariableId === variable.id">
                    <label class="field">
                      <span>Name</span>
                      <input v-model="environmentCardDraft.name" class="control" />
                    </label>
                    <label class="field">
                      <span>Value</span>
                      <textarea v-model="environmentCardDraft.value" class="control" rows="2" />
                    </label>
                    <footer class="environment-variable-card-footer">
                      <button
                        v-if="!variable.pendingCreate"
                        class="button primary small"
                        @click="updateEnvironmentVariable"
                      >
                        Update
                      </button>
                      <button
                        class="button danger-outline small"
                        @click="deleteEnvironmentVariable(variable)"
                      >
                        Delete
                      </button>
                    </footer>
                  </template>
                  <template v-else>
                    <div class="environment-variable-card-view">
                      <div class="environment-variable-card-copy">
                        <strong>{{ variable.name }}</strong>
                        <code>{{ variable.value || "(empty string)" }}</code>
                      </div>
                      <div class="environment-variable-card-actions">
                        <button
                          class="icon-button"
                          :aria-label="`Edit ${variable.name}`"
                          :title="`Edit ${variable.name}`"
                          @click="editEnvironmentVariable(variable)"
                        >
                          <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path
                              d="m15 5 4 4M4 20l4.5-1 10.8-10.8a2.1 2.1 0 0 0-3-3L5.5 16 4 20Z"
                            />
                          </svg>
                        </button>
                        <button
                          class="icon-button danger-icon"
                          :aria-label="`Delete ${variable.name}`"
                          :title="`Delete ${variable.name}`"
                          @click="deleteEnvironmentVariable(variable)"
                        >
                          <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </template>
                </article>
              </div>
            </div>
          </section>
        </div>
        <footer class="dialog-footer">
          <button class="button secondary" @click="closeSettings">Discard</button
          ><button
            class="button primary"
            :disabled="environmentVariablesLoading"
            @click="saveMockDraft"
          >
            Save
          </button>
        </footer>
      </section>
    </div>

    <div
      v-if="Object.values(runResults).some((result) => result.id && result.id !== runningMockId)"
      class="run-drawer float"
    >
      <header>
        <div>
          <strong>Latest run</strong
          ><span
            v-for="result in Object.values(runResults).slice(-1)"
            :key="result.id"
            :class="`run-state ${result.status}`"
            >{{ result.status }} | {{ result.responseStatus ?? "-" }}</span
          >
        </div>
        <button class="icon-button" aria-label="Close run details" @click="runResults = {}">
          <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </header>
      <div
        v-for="result in Object.values(runResults).slice(-1)"
        :key="result.id"
        class="run-details"
      >
        <p v-if="result.error" class="error-text">{{ result.error }}</p>
        <pre>{{ prettyResponse(result.responseBody) }}</pre>
        <small v-if="result.traceId"
          >Trace {{ result.traceId }} | flow
          {{ result.flow?.incomplete ? "incomplete" : result.flow?.status || "pending" }}</small
        >
      </div>
    </div>
  </main>
</template>
