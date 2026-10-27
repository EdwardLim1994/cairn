<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
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
const mockApis = ref<MockApi[]>([]);
const serviceEdges = ref<{ id: string; sourceServiceId: string; targetEndpointId: string }[]>([]);
const viewport = ref({ x: 0, y: 0, zoom: 1 });
const mockNodePosition = ref({ x: 560, y: 160 });
const locked = ref(false);
const dark = ref(false);
const loading = ref(true);
const saving = ref(false);
const errorMessage = ref("");
const contextMenu = ref<{ x: number; y: number; flowX: number; flowY: number } | null>(null);
const serviceDialog = ref(false);
const editingServiceId = ref<string | null>(null);
const serviceDraft = ref<ServiceDraft>(newServiceDraft());
const mockPanel = ref(false);
const mockDraft = ref<MockApi[]>([]);
const logsOpen = ref(false);
const logsPanelHeight = ref(280);
const logs = ref<LogEntry[]>([]);
const logSearch = ref("");
const logService = ref("");
const logSeverity = ref("");
const runningMockId = ref<string | null>(null);
const runResults = ref<Record<string, RunResult>>({});
const observedErrorServices = ref<string[]>([]);
const observedEdges = ref<{ sourceService: string; targetService: string }[]>([]);
const { fitView, screenToFlowCoordinate, setViewport } = useVueFlow();

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

function serviceNode(service: Service): Node {
  return {
    id: service.id,
    type: "service",
    position: { x: service.positionX, y: service.positionY },
    data: {
      name: service.name,
      framework: service.framework,
      active: service.active,
      endpoints: service.endpoints,
    },
    class: observedErrorServices.value.includes(service.name) ? "service-error" : "",
  };
}

function mockNode(): Node {
  return {
    id: "mock-apis",
    type: "mockApis",
    position: mockNodePosition.value,
    data: { entries: mockApis.value },
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
        targetHandle: edge.targetEndpointId,
        type: "smoothstep",
        label: "calls",
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
        sourceHandle: entry.id,
        target,
        targetHandle: entry.targetEndpointId,
        type: "smoothstep",
        class: entry.id === runningMockId.value ? "running-edge" : "",
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
        type: "smoothstep",
        class: "observed",
        animated: true,
      },
    ];
  });
  edges.value = [...declared, ...mock, ...observed];
}

function syncNodes() {
  nodes.value = [...services.value.map(serviceNode), mockNode()];
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
  } catch (cause) {
    errorMessage.value = cause instanceof Error ? cause.message : "Could not load the graph";
  } finally {
    loading.value = false;
  }
}

async function loadLogs() {
  const query = new URLSearchParams();
  if (logSearch.value.trim()) query.set("search", logSearch.value.trim());
  if (logService.value) query.set("service", logService.value);
  if (logSeverity.value) query.set("severity", logSeverity.value);
  try {
    logs.value = await api<LogEntry[]>(`/api/logs${query.size ? `?${query}` : ""}`);
  } catch {
    /* keep the visible logs */
  }
}

let logTimer: ReturnType<typeof setTimeout>;
watch([logSearch, logService, logSeverity], () => {
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
  saving.value = true;
  try {
    await api("/api/canvas", { method: "PUT", body: canvasPayload() });
    errorMessage.value = "";
  } catch (cause) {
    errorMessage.value = cause instanceof Error ? cause.message : "Could not save the graph";
  } finally {
    saving.value = false;
  }
}

function onMoveEnd(event: { x: number; y: number; zoom: number }) {
  viewport.value = { x: event.x, y: event.y, zoom: event.zoom };
}

async function onConnect(connection: Connection) {
  if (!connection.source || !connection.target || !connection.targetHandle) return;
  if (connection.source === "mock-apis") {
    const entry = mockApis.value.find((item) => item.id === connection.sourceHandle);
    if (!entry?.id) return;
    try {
      await api(`/api/mock-apis/${entry.id}`, {
        method: "PUT",
        body: { ...entry, targetEndpointId: connection.targetHandle },
      });
      mockApis.value = await api<MockApi[]>("/api/mock-apis");
      syncNodes();
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
  editingServiceId.value = null;
  addPosition.value = { x: contextMenu.value.flowX, y: contextMenu.value.flowY };
  serviceDialog.value = true;
  contextMenu.value = null;
}

const addPosition = ref({ x: 160, y: 120 });

function editService(id: string) {
  const service = services.value.find((item) => item.id === id);
  if (!service) return;
  editingServiceId.value = id;
  serviceDraft.value = {
    name: service.name,
    framework: service.framework,
    baseUrl: service.baseUrl,
    active: service.active,
    endpoints: service.endpoints.map((endpoint) => ({ ...endpoint })),
  };
  serviceDialog.value = true;
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
    const path = editingServiceId.value
      ? `/api/services/${editingServiceId.value}`
      : "/api/services";
    const body = editingServiceId.value
      ? serviceDraft.value
      : { ...serviceDraft.value, positionX: addPosition.value.x, positionY: addPosition.value.y };
    await api(path, { method: editingServiceId.value ? "PUT" : "POST", body });
    serviceDialog.value = false;
    await loadCanvas();
  } catch (cause) {
    errorMessage.value = cause instanceof Error ? cause.message : "Could not save service";
  }
}

async function deleteService(id: string) {
  if (!confirm("Remove this service and its endpoints from the graph?")) return;
  try {
    await api(`/api/services/${id}`, { method: "DELETE" });
    await loadCanvas();
  } catch (cause) {
    errorMessage.value = cause instanceof Error ? cause.message : "Could not remove service";
  }
}

function openMockPanel() {
  mockDraft.value = mockApis.value.map((entry) => ({
    ...entry,
    requestJson: JSON.stringify(entry.requestJson ?? {}, null, 2),
  }));
  mockPanel.value = true;
}
function addMockDraft() {
  const endpoint =
    services.value.flatMap((service) => service.endpoints).find((item) => item.id)?.id ?? "";
  mockDraft.value.push({
    name: "",
    targetEndpointId: endpoint,
    description: "",
    requestJson: "{}",
  });
}
function removeMockDraft(index: number) {
  mockDraft.value.splice(index, 1);
}

async function saveMockDraft() {
  try {
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
    const savedIds = new Set(entries.flatMap((entry) => (entry.id ? [entry.id] : [])));
    for (const entry of mockApis.value)
      if (entry.id && !savedIds.has(entry.id))
        await api(`/api/mock-apis/${entry.id}`, { method: "DELETE" });
    for (const entry of entries) {
      if (entry.id) await api(`/api/mock-apis/${entry.id}`, { method: "PUT", body: entry });
      else await api("/api/mock-apis", { method: "POST", body: entry });
    }
    mockPanel.value = false;
    await loadCanvas();
  } catch (cause) {
    errorMessage.value = cause instanceof Error ? cause.message : "Could not save mock APIs";
  }
}

async function runMock(entry: MockApi) {
  if (!entry.id) return;
  runningMockId.value = entry.id;
  runResults.value[entry.id] = {
    id: "",
    traceId: "",
    status: "running",
    responseStatus: null,
    responseBody: null,
    error: null,
  };
  buildEdges();
  try {
    const result = await api<RunResult>(`/api/mock-apis/${entry.id}/runs`, { method: "POST" });
    runResults.value[entry.id] = result;
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
      runResults.value[entry.id] = { ...result, flow };
      syncNodes();
    }
    if (logsOpen.value) await loadLogs();
  } catch (cause) {
    runResults.value[entry.id] = {
      id: "",
      traceId: "",
      status: "failed",
      responseStatus: null,
      responseBody: null,
      error: cause instanceof Error ? cause.message : "Call failed",
    };
  } finally {
    runningMockId.value = null;
    buildEdges();
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
    160,
    Math.min(window.innerHeight - 32, logsPanelHeight.value + delta),
  );
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
  logsPanelHeight.value = Math.max(
    160,
    Math.round(window.innerHeight * (window.innerWidth <= 720 ? 0.34 : 0.25)),
  );
  await loadCanvas();
  await loadLogs();
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
      <div class="brand"><strong>Service Graph</strong><span>DATA FLOW OBSERVABILITY</span></div>
      <div class="top-actions">
        <span class="project-label"><i></i> {{ services.length }} services</span>
        <button class="button secondary" @click.stop="openMockPanel">Mock API settings</button>
        <button class="button secondary" @click.stop="locked = !locked">
          {{ locked ? "Unlock canvas" : "Lock positions" }}
        </button>
        <button class="button primary" :disabled="saving" @click.stop="saveCanvas">
          {{ saving ? "Saving..." : "Save graph" }}
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
        :nodes-draggable="!locked"
        :nodes-connectable="!locked"
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
                {{
                  String(data.framework || "?")
                    .slice(0, 2)
                    .toUpperCase()
                }}
              </div>
              <div class="node-heading">
                <strong>{{ data.name }}</strong
                ><span>{{ data.framework }} | {{ data.endpoints.length }} endpoints</span>
              </div>
              <span class="service-state" :class="data.active ? 'on' : 'off'"
                ><i></i>{{ data.active ? "Active" : "Inactive" }}</span
              >
            </div>
            <div class="endpoint-heading">
              <span>REGISTERED ENDPOINTS</span>
            </div>
            <div v-for="endpoint in data.endpoints" :key="endpoint.id" class="endpoint-row">
              <Handle
                :id="endpoint.id"
                type="target"
                :position="Position.Left"
                class="endpoint-handle"
              />
              <span class="method-tag" :class="`method-${endpoint.method.toLowerCase()}`">{{
                endpoint.method
              }}</span>
              <span class="endpoint-name">{{ endpoint.name }}</span>
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
            </div>
            <div v-if="!mockApis.length" class="empty-endpoints">
              Add a mock API to trigger calls
            </div>
            <div
              v-for="entry in mockApis"
              :key="entry.id"
              class="mock-row"
              :class="{ running: runningMockId === entry.id }"
            >
              <Handle
                v-if="entry.id"
                :id="entry.id"
                type="source"
                :position="Position.Right"
                class="mock-handle"
              />
              <button
                class="run-button nodrag"
                :disabled="!!runningMockId"
                :title="`Run ${entry.name}`"
                @click.stop="runMock(entry)"
              >
                <svg
                  v-if="runningMockId !== entry.id"
                  class="ui-icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M8 5v14l11-7z" /></svg
                ><span>{{ runningMockId === entry.id ? "Running..." : "Run" }}</span>
              </button>
              <div class="mock-copy">
                <strong>{{ entry.name }}</strong
                ><span
                  ><b>{{ mockEndpoint(entry)?.method ?? "No endpoint" }}</b>
                  {{ mockEndpoint(entry)?.url ?? "Select a service endpoint" }}</span
                >
              </div>
              <span
                v-if="runResults[entry.id || '']"
                class="run-state"
                :class="runResults[entry.id || ''].status"
                >{{ runResults[entry.id || ""].status }}</span
              >
            </div>
            <button class="add-mock nodrag" @click.stop="openMockPanel">+ Manage mock APIs</button>
          </article>
        </template>
      </VueFlow>
      <div v-if="loading" class="loading-banner float">Loading saved graph...</div>
      <div v-if="errorMessage" class="toast error-toast" role="alert">
        <span>{{ errorMessage }}</span
        ><button aria-label="Dismiss error" @click="errorMessage = ''">
          <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
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
        <button @click="beginAddService"><b>+</b> Add service node</button>
      </div>
    </section>

    <button
      class="logs-toggle float"
      :class="{ active: logsOpen }"
      @click.stop="logsOpen = !logsOpen"
    >
      <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 6h16M4 12h16M4 18h10" /></svg
      ><b>Logs</b><em>{{ logs.length }}</em>
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
          <strong>Logs</strong><span>{{ logs.length }} entries</span>
        </div>
        <input
          v-model="logSearch"
          class="control search"
          placeholder="Search log messages..."
          aria-label="Search log messages"
        />
        <select v-model="logService" class="control" aria-label="Filter by service">
          <option value="">All services</option>
          <option
            v-for="name in [...new Set(logs.map((item) => item.serviceName))]"
            :key="name"
            :value="name"
          >
            {{ name }}
          </option>
        </select>
        <select v-model="logSeverity" class="control" aria-label="Filter by severity">
          <option value="">All levels</option>
          <option>ERROR</option>
          <option>WARN</option>
          <option>INFO</option>
          <option>DEBUG</option>
        </select>
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

    <div v-if="serviceDialog" class="dialog-backdrop" @click.self="serviceDialog = false">
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
          <button class="icon-button" aria-label="Close" @click="serviceDialog = false">
            <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        <div class="dialog-body">
          <label class="field"
            ><span>Service name</span
            ><input
              v-model="serviceDraft.name"
              class="control"
              placeholder="e.g. Checkout API"
              required
          /></label>
          <div class="field-row">
            <label class="field"
              ><span>Framework</span
              ><input
                v-model="serviceDraft.framework"
                class="control"
                placeholder="e.g. Nuxt" /></label
            ><label class="field"
              ><span>Base URL</span
              ><input
                v-model="serviceDraft.baseUrl"
                class="control"
                placeholder="http://localhost:4000"
            /></label>
          </div>
          <label class="switch-row"
            ><span
              ><strong>Service active</strong
              ><small>Show this service as available in the graph</small></span
            ><input v-model="serviceDraft.active" type="checkbox"
          /></label>
          <div class="section-title">
            <strong>Available endpoints</strong
            ><button class="button secondary small" @click="addEndpoint">+ Add endpoint</button>
          </div>
          <article
            v-for="(endpoint, index) in serviceDraft.endpoints"
            :key="endpoint.id || index"
            class="endpoint-form-card"
          >
            <div class="endpoint-form-head">
              <strong>Endpoint {{ index + 1 }}</strong
              ><button class="text-button danger-text" @click="removeEndpoint(index)">
                Remove
              </button>
            </div>
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
          </article>
          <button
            v-if="editingServiceId"
            class="button danger-outline delete-service"
            @click="
              deleteService(editingServiceId);
              serviceDialog = false;
            "
          >
            Remove service
          </button>
        </div>
        <footer class="dialog-footer">
          <button class="button secondary" @click="serviceDialog = false">Discard</button
          ><button class="button primary" @click="saveService">Save service</button>
        </footer>
      </section>
    </div>

    <div v-if="mockPanel" class="dialog-backdrop" @click.self="mockPanel = false">
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
          <button class="icon-button" aria-label="Close" @click="mockPanel = false">
            <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        <div class="dialog-body">
          <div class="section-title">
            <strong>Registered mock APIs</strong
            ><button class="button secondary small" @click="addMockDraft">+ Add row</button>
          </div>
          <article
            v-for="(entry, index) in mockDraft"
            :key="entry.id || `new-${index}`"
            class="endpoint-form-card mock-form-card"
          >
            <div class="endpoint-form-head">
              <strong>{{ entry.name || `Mock API ${index + 1}` }}</strong
              ><button class="text-button danger-text" @click="removeMockDraft(index)">
                Remove
              </button>
            </div>
            <label class="field"
              ><span>Name</span
              ><input v-model="entry.name" class="control" placeholder="e.g. Create order"
            /></label>
            <label class="field"
              ><span>Service endpoint</span
              ><select v-model="entry.targetEndpointId" class="control">
                <option value="" disabled>Select endpoint</option>
                <option v-for="option in servicesForSelect" :key="option.id" :value="option.id">
                  {{ option.label }}
                </option>
              </select></label
            >
            <label class="field"
              ><span>Request (JSON)</span
              ><textarea
                v-model="entry.requestJson"
                class="control code-input"
                rows="4"
                placeholder="{}"
              ></textarea>
            </label>
            <label class="field"
              ><span>Description</span
              ><input v-model="entry.description" class="control" placeholder="Optional note"
            /></label>
          </article>
          <div v-if="!mockDraft.length" class="empty-logs">
            No mock API rows yet. Add one to get started.
          </div>
        </div>
        <footer class="dialog-footer">
          <button class="button secondary" @click="mockPanel = false">Discard</button
          ><button class="button primary" @click="saveMockDraft">Save mock APIs</button>
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
