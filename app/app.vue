<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import GraphCanvas from "./components/graph/GraphCanvas.vue";
import ContextMenu from "./components/ContextMenu.vue";
import ServiceSettingsPanel from "./components/ServiceSettingsPanel.vue";
import MockApiSettingsPanel from "./components/MockApiSettingsPanel.vue";
import LogsPanel from "./components/LogsPanel.vue";
import AppToolbar from "./components/AppToolbar.vue";
import AppToastStack from "./components/AppToastStack.vue";
import LatestRunDrawer from "./components/LatestRunDrawer.vue";
import { createApiClient } from "./models/api-client";
import { storeToRefs } from "pinia";
import { useGraphStore } from "./stores/graph";
import { useGraphViewModel } from "./composables/useGraphViewModel";
import { useServiceViewModel, type ServiceDraft } from "./composables/useServiceViewModel";
import { useMockApiStore } from "./stores/mockApis";
import { useObservabilityStore } from "./stores/observability";
import { useMockApiViewModel } from "./composables/useMockApiViewModel";
import { useMockApiRunViewModel } from "./composables/useMockApiRunViewModel";
import { useObservabilityViewModel } from "./composables/useObservabilityViewModel";
import { useCanvasViewModel } from "./composables/useCanvasViewModel";
import { useGraphInteractionViewModel } from "./composables/useGraphInteractionViewModel";
import { useSettingsPanelViewModel } from "./composables/useSettingsPanelViewModel";
import type { MockApiDraft } from "./models/mock-api";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import "@vue-flow/controls/dist/style.css";

const mockApiStore = useMockApiStore();
const { mockApis, mockDraft, environmentVariables, runningMockId, runResults } =
  storeToRefs(mockApiStore);
const graphStore = useGraphStore();
const observabilityStore = useObservabilityStore();
const { logs, logsOpen, logsPanelHeight, logSearch, logService, logSeverity } =
  storeToRefs(observabilityStore);
const {
  nodes,
  edges,
  services,
  collapsedServiceEndpoints,
  serviceHealth,
  serviceEdges,
  viewport,
  mockNodePosition,
  observedErrorServices,
  observedServices,
  observedEdges,
  observedMockApiId,
  mockConnectionsCollapsed,
  selectedNodeId,
  allNodesCollapsed,
} = storeToRefs(graphStore);
const dark = useCookie("cairn-dark-mode", {
  default: () => false,
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax",
});
const loading = ref(true);
const errorMessage = ref("");
const importWarnings = ref<{ id: number; message: string }[]>([]);
const contextMenu = ref<{ x: number; y: number; flowX: number; flowY: number } | null>(null);
const contextMenuOpen = computed({
  get: () => contextMenu.value !== null,
  set: (open: boolean) => {
    if (!open) contextMenu.value = null;
  },
});
const serviceDialog = ref(false);
const editingServiceId = ref<string | null>(null);
const serviceDraft = ref<ServiceDraft>({
  name: "",
  framework: "",
  baseUrl: "http://localhost:3000",
  active: true,
  endpoints: [{ name: "", apiType: "REST", method: "GET", url: "/" }],
});
const frameworkMenuOpen = ref(false);
const mockPanel = ref(false);
const expandedEnvironmentVariableId = ref<string | null>(null);
const registeredMockApisOpen = ref(true);
const sharedEnvironmentVariablesOpen = ref(true);
const environmentVariablesLoading = ref(false);
const editingEnvironmentVariableId = ref<string | null>(null);
const environmentCardDraft = ref({ name: "", value: "" });
let healthTimer: ReturnType<typeof setInterval> | undefined;
const graphCanvas = ref<InstanceType<typeof GraphCanvas> | null>(null);
const apiClient = createApiClient((url, options) => $fetch<unknown>(url, options as never));
const observabilityViewModel = useObservabilityViewModel({ store: observabilityStore, apiClient });
const graphViewModel = useGraphViewModel({
  store: graphStore,
  mockApis: () => mockApis.value,
  runResults: () => runResults.value,
  runningMockId: () => runningMockId.value,
});
const canvasViewModel = useCanvasViewModel({
  apiClient,
  graphStore,
  mockApiStore,
  graphViewModel,
  graphCanvas,
  loading,
  errorMessage,
});
const {
  buildEdges,
  syncNodes,
  toggleMockConnections,
  toggleServiceEndpoints,
  toggleAllNodes,
  loadCanvas,
  loadServiceHealth,
  saveCanvas,
  onMoveEnd,
  onConnect,
} = canvasViewModel;
const { closeSettings, closeSettingsOutside } = useSettingsPanelViewModel({
  serviceDialog,
  mockPanel,
  frameworkMenuOpen,
  graphStore,
  syncNodes,
});
const mockApiViewModel = useMockApiViewModel({
  store: mockApiStore,
  apiClient,
  services: () => services.value,
  environmentCardDraft,
  editingEnvironmentVariableId,
  expandedEnvironmentVariableId,
  variablesOpen: sharedEnvironmentVariablesOpen,
  panelOpen: mockPanel,
  environmentVariablesLoading,
  registeredApisOpen: registeredMockApisOpen,
  importWarnings,
  saveCanvas,
  loadCanvas,
  closeSettings,
  onError: (message) => (errorMessage.value = message),
});
const mockApiRunViewModel = useMockApiRunViewModel({
  apiClient,
  graphStore,
  mockApiStore,
  graphViewModel,
  services: () => services.value,
  logService,
  logSeverity,
  logsOpen,
  saveCanvas,
  loadLogs: observabilityViewModel.loadLogs,
});
const latestRunResult = computed(() => Object.values(runResults.value).at(-1));
type MockApi = MockApiDraft;
const resetEnvironmentCardEdit = mockApiViewModel.resetEnvironmentCardEdit;
const dismissImportWarning = mockApiViewModel.dismissImportWarning;
const openEnvironmentVariable = mockApiViewModel.openEnvironmentVariable;
const closeEnvironmentVariable = mockApiViewModel.closeEnvironmentVariable;
const updateEnvironmentVariable = mockApiViewModel.updateEnvironmentVariable;
const addEnvironmentVariable = mockApiViewModel.addEnvironmentVariable;
const deleteEnvironmentVariable = mockApiViewModel.deleteEnvironmentVariable;
const loadLogs = observabilityViewModel.loadLogs;

let logTimer: ReturnType<typeof setTimeout>;
watch([logSearch, () => logService.value.join("\0"), () => logSeverity.value.join("\0")], () => {
  clearTimeout(logTimer);
  logTimer = setTimeout(loadLogs, 180);
});
watch(logsOpen, (open) => {
  if (open) void loadLogs();
});

function beginAddService() {
  if (!contextMenu.value) return;
  serviceViewModel.beginAddService({ x: contextMenu.value.flowX, y: contextMenu.value.flowY });
  contextMenu.value = null;
}

const addPosition = ref({ x: 160, y: 120 });
const serviceViewModel = useServiceViewModel({
  apiClient,
  draft: serviceDraft,
  editingServiceId,
  dialogOpen: serviceDialog,
  frameworkMenuOpen,
  addPosition,
  services: () => services.value,
  saveCanvas,
  loadCanvas,
  closeSettings,
  frameworkLabel: graphViewModel.frameworkLabel,
  onError: (message) => (errorMessage.value = message),
  onImportWarnings: (warnings) => {
    importWarnings.value = warnings.map((message, id) => ({ id, message }));
  },
});
const graphInteractionViewModel = useGraphInteractionViewModel({
  store: graphStore,
  contextMenu,
  graphCanvas,
  syncNodes,
  openMockPanel,
  editService: (id) => editService(id),
});
const handleCanvasContextMenu = graphInteractionViewModel.handleCanvasContextMenu;

function editService(id: string, focusEndpointId?: string) {
  if (!serviceViewModel.editService(id)) return;
  if (focusEndpointId)
    void nextTick(() => {
      const card = document.getElementById(`service-endpoint-${focusEndpointId}`);
      if (card instanceof HTMLDetailsElement) card.open = true;
      card?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
}

function openServiceEndpoint(endpointId: string) {
  const serviceId = serviceViewModel.openServiceEndpoint(endpointId);
  if (serviceId) editService(serviceId, endpointId);
}

function onNodeClick(event: { node: { id: string } }) {
  graphInteractionViewModel.onNodeClick(event.node.id);
}

function addEndpoint() {
  serviceViewModel.addEndpoint();
}

function removeEndpoint(index: number) {
  serviceViewModel.removeEndpoint(index);
}

function saveService() {
  return serviceViewModel.saveService();
}

async function handleServiceDelete(id: string) {
  await serviceViewModel.deleteService(id, () =>
    confirm("Remove this service and its endpoints from the graph?"),
  );
  closeSettings();
}

async function openMockPanel(focusMockApiId?: string) {
  await mockApiViewModel.openPanel(focusMockApiId);
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
  mockApiViewModel.addMockDraft();
}
function endpointPathParameterNames(entry: MockApi) {
  return mockApiViewModel.endpointPathParameterNames(entry);
}
function setMockEndpoint(entry: MockApi) {
  mockApiViewModel.setMockEndpoint(entry);
}
function formatRequestJson(entry: MockApi) {
  mockApiViewModel.formatRequestJson(entry);
}
async function importPostmanCollection(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;

  errorMessage.value = "";
  try {
    const content = await file.text();
    mockApiViewModel.importCollection(content);
  } catch (cause) {
    errorMessage.value =
      cause instanceof Error ? cause.message : "Could not import Postman collection";
  }
}
function removeMockDraft(index: number) {
  mockApiViewModel.removeMockDraft(index);
}

function saveMockDraft() {
  return mockApiViewModel.saveMockDraft();
}

function runMock(entry: MockApi) {
  return mockApiRunViewModel.runMock(entry);
}

function prettyResponse(value: string | null) {
  if (!value) return "No response body";
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function resizeLogsPanel(event: PointerEvent) {
  const startY = event.clientY;
  const startHeight = logsPanelHeight.value;
  const update = (move: PointerEvent) => {
    observabilityViewModel.resizePanel(startY, startHeight, move.clientY, window.innerHeight);
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
  observabilityViewModel.adjustPanelHeight(delta, window.innerHeight);
}

const servicesForSelect = computed(() => graphViewModel.serviceEndpointOptions());

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
    :class="{ 'app--dark': dark, 'app--logs-open': logsOpen }"
  >
    <AppToolbar
      :service-count="services.length"
      :all-nodes-collapsed="allNodesCollapsed"
      :dark="dark"
      @toggle-all="toggleAllNodes"
      @toggle-theme="dark = !dark"
    />

    <section class="app__canvas-shell" @contextmenu="handleCanvasContextMenu">
      <ContextMenu v-model:open="contextMenuOpen" @add-service="beginAddService">
        <GraphCanvas
          ref="graphCanvas"
          v-model:nodes="nodes"
          v-model:edges="edges"
          :dark="dark"
          @connect="onConnect"
          @node-click="onNodeClick"
          @move-end="onMoveEnd"
          @node-drag-stop="saveCanvas"
          @toggle-service-endpoints="toggleServiceEndpoints"
          @open-service-endpoint="openServiceEndpoint"
          @toggle-mock-connections="toggleMockConnections"
          @open-mock-api="openMockPanel"
          @run-mock-api="runMock"
        />
      </ContextMenu>
      <div v-if="loading" class="app__loading-banner app__surface">Loading saved graph...</div>
      <AppToastStack
        :error-message="errorMessage"
        :warnings="importWarnings"
        @dismiss-error="errorMessage = ''"
        @dismiss-warning="dismissImportWarning"
      />
      <div class="app__canvas-hint app__surface">
        <kbd>Right click</kbd> to add a service <span> | </span> Drag from a node to an endpoint to
        connect
      </div>
    </section>

    <LogsPanel
      v-model:open="logsOpen"
      v-model:search="logSearch"
      v-model:service-filter="logService"
      v-model:severity-filter="logSeverity"
      :logs="logs"
      :services="services"
      :height="logsPanelHeight"
      :format-time="observabilityViewModel.formatTime"
      @refresh="loadLogs"
      @resize="resizeLogsPanel"
      @adjust-height="adjustLogsPanelHeight"
    />

    <ServiceSettingsPanel
      v-if="serviceDialog"
      v-model:draft="serviceDraft"
      v-model:framework-menu-open="frameworkMenuOpen"
      :editing-service-id="editingServiceId"
      @add-endpoint="addEndpoint"
      @remove-endpoint="removeEndpoint"
      @import-open-api="serviceViewModel.importOpenApiFile"
      @save="saveService"
      @discard="closeSettings"
      @remove-service="handleServiceDelete"
    />

    <MockApiSettingsPanel
      v-if="mockPanel"
      v-model:mock-draft="mockDraft"
      v-model:environment-variables="environmentVariables"
      v-model:variables-open="sharedEnvironmentVariablesOpen"
      v-model:apis-open="registeredMockApisOpen"
      v-model:variable-draft="environmentCardDraft"
      :environment-variables-loading="environmentVariablesLoading"
      :editing-environment-variable-id="editingEnvironmentVariableId"
      :expanded-environment-variable-id="expandedEnvironmentVariableId"
      :services-for-select="servicesForSelect"
      :endpoint-path-parameter-names="endpointPathParameterNames"
      @discard="closeSettings"
      @save="saveMockDraft"
      @add-variable="addEnvironmentVariable"
      @open-variable="openEnvironmentVariable"
      @close-variable="closeEnvironmentVariable"
      @update-variable="updateEnvironmentVariable"
      @delete-variable="deleteEnvironmentVariable"
      @import-collection="importPostmanCollection"
      @add-mock-api="addMockDraft"
      @remove-mock-api="removeMockDraft"
      @set-mock-endpoint="setMockEndpoint"
      @format-request="formatRequestJson"
    />

    <LatestRunDrawer
      :result="latestRunResult"
      :running="Boolean(runningMockId)"
      @close="mockApiStore.clearRunResults"
    />
  </main>
</template>

<style>
@import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap");
@import "tailwindcss";
@import "@nuxt/ui";
@reference "tailwindcss";

:root {
  font-family: "IBM Plex Sans", system-ui, sans-serif;
  color-scheme: light;
  --spacing: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
  --radius-2xl: 1rem;
  --text-xs: 0.75rem;
  --text-xs--line-height: calc(1 / 0.75);
  --text-sm: 0.875rem;
  --text-sm--line-height: calc(1.25 / 0.875);
  --text-base: 1rem;
  --text-base--line-height: calc(1.5 / 1);
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --tracking-widest: 0.1em;
  --default-transition-duration: 150ms;
  --default-transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  --default-font-family: "IBM Plex Sans", system-ui, sans-serif;
  --default-mono-font-family: "IBM Plex Mono", monospace;
  --bg: #f2f2ee;
  --dots: #c2c2b8;
  --panel: #fff;
  --panel2: #f3f3ef;
  --border: #d6d6ce;
  --text: #1a1c1e;
  --muted: #585e64;
  --accent: #0f766e;
  --accent-ink: #fff;
  --accent-soft: #d6efeb;
  --danger: #b42318;
  --danger-soft: #fbe4e1;
  --warning: #855b00;
  --warning-soft: #fff0c2;
  --shadow: 0 8px 28px rgba(20, 24, 28, 0.12), 0 1px 2px rgba(20, 24, 28, 0.08);
  --edge: #8a9097;
  --get-fg: #1d4ed8;
  --get-bg: #e3ebfd;
  --post-fg: #047857;
  --post-bg: #daf3e8;
  --put-fg: #9a4a06;
  --put-bg: #fbebd3;
  --patch-fg: #6d28d9;
  --patch-bg: #ece4fb;
  --delete-fg: #b91c1c;
  --delete-bg: #fbe0e0;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

.app {
  background: var(--bg);
  color: var(--text);
}

.app.app--dark {
  color-scheme: dark;
  --bg: #101214;
  --dots: #2b3036;
  --panel: #1a1d20;
  --panel2: #22262a;
  --border: #32373d;
  --text: #e7e9eb;
  --muted: #9ba2a9;
  --accent: #2dd4bf;
  --accent-ink: #06201c;
  --accent-soft: #12312d;
  --danger: #ff8a80;
  --danger-soft: #43211f;
  --warning: #f2c66d;
  --warning-soft: #413518;
  --shadow: 0 10px 32px rgba(0, 0, 0, 0.5);
  --edge: #5c646c;
  --get-fg: #8ab4ff;
  --get-bg: #1c2a47;
  --post-fg: #5ee0a9;
  --post-bg: #123528;
  --put-fg: #f5b861;
  --put-bg: #3c2a12;
  --patch-fg: #bfa2ff;
  --patch-bg: #2e2150;
  --delete-fg: #ff8f8f;
  --delete-bg: #422020;
}

.app button,
.app input,
.app select,
.app textarea {
  font: inherit;
  color: inherit;
}

.app button {
  cursor: pointer;
}

.app__surface,
.app__graph-node {
  background: var(--panel);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
}

.app__topbar {
  @apply absolute z-30 flex items-center gap-3 rounded-2xl px-3.5;
  left: 16px;
  right: 16px;
  top: 14px;
  height: 62px;
}

.app__brand-mark,
.app__framework-icon,
.app__mock-icon {
  @apply grid place-items-center rounded-lg;
  width: 34px;
  height: 34px;
  background: var(--accent);
  color: var(--accent-ink);
  font:
    600 12px "IBM Plex Mono",
    monospace;
}

.app__brand {
  @apply flex flex-col;
  line-height: 1.1;
}

.app__brand strong {
  @apply text-sm;
}

.app__brand span {
  @apply mt-1 text-[9px] tracking-widest;
  color: var(--muted);
}

.app__top-actions {
  @apply ml-auto flex items-center gap-2;
}

.app__project-label {
  @apply px-2 text-xs;
  color: var(--muted);
}

.app__project-label i {
  @apply mr-1.5 inline-block rounded-full;
  width: 7px;
  height: 7px;
  background: #15966f;
}

.app__button {
  @apply rounded-lg border px-3 py-2 text-xs font-medium;
  border-color: var(--border);
  background: var(--panel);

  &.app__button--primary {
    background: var(--accent);
    color: var(--accent-ink);
    border-color: var(--accent);
  }

  &.app__button--small {
    @apply px-2 py-1.5 text-[11px];
  }

  &.app__button--danger-outline {
    color: var(--danger);
    border-color: var(--danger);
  }

  &.app__button--primary:disabled {
    @apply opacity-60;
  }
}

.app__button:hover,
.app__icon-button:hover,
.app__context-menu [role="menuitem"]:hover,
.app__context-menu [role="menuitem"][data-highlighted],
.app__log-row:hover {
  background: var(--panel2);
}

.app__icon-button {
  @apply inline-grid place-items-center rounded-lg border;
  width: 34px;
  height: 34px;
  padding: 0;
  border-color: var(--border);
  background: var(--panel);
  line-height: 1;

  &.app__icon-button--danger {
    color: var(--danger);
  }

  &.app__icon-button--danger:hover {
    background: var(--danger-soft);
  }
}

.app__icon {
  display: block;
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}

.app__canvas-shell {
  @apply absolute inset-0;
}

.app__graph-flow {
  background-color: var(--bg);
  background-image: radial-gradient(circle, var(--dots) 1.1px, transparent 1.3px);
  background-size: 22px 22px;
}

.vue-flow__background {
  background-color: transparent;
}

.app .vue-flow__minimap {
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  bottom: 76px;
  right: 16px;
  background: var(--panel);
}

.app .vue-flow__controls {
  bottom: 76px;
  left: 16px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow);
  overflow: hidden;
}

.app .vue-flow__controls-button {
  background: var(--panel);
  color: var(--text);
  border-bottom: 1px solid var(--border);
  fill: var(--text);
}

.vue-flow__controls-button svg,
.vue-flow__controls-button svg path {
  fill: var(--text);
}

.vue-flow__edge-path {
  stroke: var(--edge);
  stroke-width: 2;
}

.vue-flow__edge-text {
  font-size: 10px;
  fill: var(--muted);
}

.vue-flow__edge.app__flow-edge--observed .vue-flow__edge-path,
.vue-flow__edge.app__flow-edge--running .vue-flow__edge-path {
  stroke: var(--accent);
  stroke-width: 2.7;
  stroke-dasharray: 7 5;
}

.vue-flow__edge.app__flow-edge--observed .vue-flow__edge-path {
  animation: dash 0.8s linear infinite;
}

.vue-flow__node {
  width: 288px;
}

.app__graph-node--service,
.app__graph-node--mock {
  @apply relative rounded-2xl;
  width: 288px;
  overflow: visible;
}

.vue-flow__node.app__flow-node--service-observed .app__graph-node--service,
.vue-flow__node.app__flow-node--mock-observed .app__graph-node--mock {
  border-color: var(--accent);
  box-shadow:
    0 0 0 2px var(--accent-soft),
    var(--shadow);
}

.vue-flow__node.app__flow-node--service-error .app__graph-node--service {
  border-color: var(--danger);
  box-shadow:
    0 0 0 2px var(--danger-soft),
    var(--shadow);
}

.vue-flow__node.selected .app__graph-node {
  border-color: var(--accent);
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.app__node-header {
  @apply flex items-center gap-2 border-b px-3;
  height: 58px;
  border-color: var(--border);
}

.app__node-heading {
  @apply flex min-w-0 flex-1 flex-col;
}

.app__node-heading strong {
  @apply truncate font-semibold;
}

.app__node-name-line {
  @apply flex min-w-0 items-center gap-1.5;
}

.app__node-heading span {
  color: var(--muted);
  font-size: 10px;
}

.app__collapse-connections {
  @apply grid shrink-0 place-items-center rounded-md border;
  width: 24px;
  height: 24px;
  border-color: var(--border);
  background: var(--panel2);
  color: var(--muted);
}

.app__collapse-connections:hover {
  color: var(--text);
}

.app__framework-icon,
.app__mock-icon {
  width: 31px;
  height: 31px;
  border-radius: 9px;
  background: #0b7a6c;
  color: white;
  font:
    500 11px "IBM Plex Mono",
    monospace;
}

.app__framework-icon {
  background: transparent;
}

.app__framework-icon img {
  width: 25px;
  height: 25px;
}

.app__mock-icon {
  background: var(--accent);
  color: var(--accent-ink);
}

.app__service-status-dot {
  display: inline-block;
  flex: none;
  width: 9px;
  height: 9px;
  border: 2px solid var(--panel);
  border-radius: 50%;

  &.app__service-status-dot--on {
    background: #15966f;
  }

  &.app__service-status-dot--off {
    background: var(--danger);
  }

  &.app__service-status-dot--checking {
    background: var(--muted);
  }
}

.app__endpoint-heading,
.app__section-title {
  @apply flex items-center justify-between;
}

.app__endpoint-heading {
  @apply px-3;
  height: 35px;
  color: var(--muted);
  font-size: 9px;
  letter-spacing: 0.08em;
}

.app__endpoint-heading--collapsed {
  font-size: 9px;
  letter-spacing: 0;
  white-space: nowrap;
}

.app__text-button {
  border: 0;
  background: transparent;
  color: var(--accent);
  font-size: 11px;
}

.app__text-button.app__text-button--danger,
.app__status-text {
  color: var(--danger);
}

.app__endpoint-row {
  @apply relative flex items-center gap-2 border-t border-dashed px-3;
  height: 47px;
  border-color: var(--border);
  min-width: 0;
}

.app__endpoint-row--collapsed {
  display: none;
}

.app__endpoint-row--collapsed.app__endpoint-row--bundle {
  display: flex;
  position: absolute;
  top: 75px;
  left: 0;
  width: 0;
  height: 0;
  padding: 0;
  border: 0;
  overflow: visible;
}

.app__endpoint-row--bundle > :not(.app__endpoint-handle) {
  display: none;
}

.app__endpoint-row code,
.app__mock-copy span,
.app__method-tag,
.app__run-details pre,
.app__log-row,
.app__canvas-hint kbd {
  font-family: "IBM Plex Mono", monospace;
}

.app__endpoint-row code {
  @apply ml-auto truncate;
  color: var(--muted);
  max-width: 78px;
  font-size: 10px;
}

.app__endpoint-name {
  @apply max-w-24 truncate whitespace-nowrap;
  font-size: 11px;
}

.app__endpoint-link {
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  text-align: left;
}

.app__endpoint-link:hover {
  color: var(--accent);
  text-decoration: underline;
}

.app__method-tag {
  @apply rounded px-1 py-0.5;
  font-size: 9px;
}

.app__method-tag--get,
.app__severity.app__severity--info {
  color: var(--get-fg);
  background: var(--get-bg);
}

.app__method-tag--post {
  color: var(--post-fg);
  background: var(--post-bg);
}

.app__severity.app__severity--error,
.app__severity.app__severity--fatal {
  color: var(--danger);
  background: var(--danger-soft);
}

.app__method-tag--put,
.app__severity.app__severity--warn {
  color: var(--put-fg);
  background: var(--put-bg);
}

.app__method-tag--patch {
  color: var(--patch-fg);
  background: var(--patch-bg);
}

.app__method-tag--delete {
  color: var(--delete-fg);
  background: var(--delete-bg);
}

.app__empty-endpoints,
.app__empty-logs {
  @apply p-5 text-center;
  color: var(--muted);
  font-size: 11px;
}

.app .app__endpoint-handle,
.app .app__mock-handle,
.app .app__service-source {
  width: 10px;
  height: 10px;
  border: 2px solid var(--panel);
  background: var(--edge);
}

.app .app__endpoint-handle {
  left: -5px;
}

.app .app__mock-handle {
  right: -5px;
}

.app .app__service-source {
  right: -5px;
  top: 28px;
}

.app__error-indicator {
  @apply border-t px-3 py-2;
  color: var(--danger);
  border-color: var(--border);
  font-size: 10px;
}

.app__error-mark {
  @apply mr-1 inline-grid h-4 w-4 place-items-center rounded-full;
  background: var(--danger-soft);
  font-weight: 700;
}

.app__mock-row {
  @apply relative flex items-center gap-2 border-b border-dashed px-2 py-2;
  min-height: 62px;
  border-color: var(--border);

  &.app__mock-row--running {
    background: var(--accent-soft);
  }
}

.app__mock-row--collapsed {
  display: none;
}

.app__mock-row--collapsed.app__mock-row--bundle {
  display: flex;
  position: absolute;
  top: 29px;
  right: 0;
  width: 0;
  height: 0;
  min-height: 0;
  padding: 0;
  border: 0;
  overflow: visible;
}

.app__mock-row--collapsed > :not(.app__mock-handle) {
  display: none;
}

.app__mock-collapsed-summary {
  @apply border-b px-3 py-3;
  border-color: var(--border);
  color: var(--muted);
  font-size: 11px;
}

.app .app__run-button {
  @apply flex items-center justify-center rounded-full;
  flex: none;
  width: 34px;
  height: 34px;
  margin-left: auto;
  border: 0;
  background: var(--accent);
  color: var(--accent-ink);
}

.app__run-button:disabled {
  @apply opacity-50;
}

.app__run-spinner {
  fill: none;
  stroke: currentColor;
  stroke-dasharray: 40;
  stroke-dashoffset: 12;
  animation: run-spin 1s linear infinite;
}

@keyframes run-spin {
  to {
    transform: rotate(360deg);
  }
}

.app__mock-copy {
  @apply flex min-w-0 flex-1 flex-col gap-1;
}

.app__mock-copy strong,
.app__mock-copy span {
  @apply truncate whitespace-nowrap;
}

.app__mock-copy strong {
  font-size: 11px;
}

.app__mock-endpoint-link {
  @apply block w-full truncate whitespace-nowrap;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--muted);
  font-size: 9px;
  text-align: left;
}

.app__mock-endpoint-link:hover {
  color: var(--accent);
}

.app__mock-no-endpoint {
  color: var(--muted);
}

.app__run-state {
  @apply uppercase;
  color: var(--muted);
  font-size: 9px;

  &.app__run-state--completed {
    color: #047857;
  }

  &.app__run-state--failed {
    color: var(--danger);
  }
}

.app__canvas-hint {
  @apply absolute rounded-lg px-3 py-2;
  left: 72px;
  bottom: 20px;
  color: var(--muted);
  font-size: 10px;
  pointer-events: none;
}

.app__canvas-hint kbd {
  @apply rounded border px-1;
  border-color: var(--border);
  color: var(--text);
}

.app__canvas-hint span {
  @apply px-1;
}

.app__context-menu {
  @apply fixed z-[60] rounded-xl p-1;
  min-width: 180px;
}

.app__context-menu-item {
  @apply w-full rounded-lg px-2.5 py-2 text-left text-xs;
  color: var(--text);
}

.app__loading-banner {
  @apply absolute rounded-lg px-3 py-2;
  left: 50%;
  top: 86px;
  transform: translateX(-50%);
  color: var(--muted);
  font-size: 11px;
}

.app__toast-stack {
  @apply absolute z-[80] flex max-h-[60vh] flex-col gap-2 overflow-y-auto;
  top: 88px;
  right: 18px;
  width: min(520px, calc(100vw - 36px));
}

.app__toast {
  @apply flex gap-3 rounded-lg p-3 justify-between;
  background: var(--danger-soft);
  color: var(--danger);
  box-shadow: var(--shadow);
  font-size: 12px;
}

.app__toast--warning {
  background: var(--warning-soft);
  color: var(--warning);
}

.app__toast button {
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 17px;
}

.app__logs-toggle {
  @apply absolute z-40 flex items-center gap-2.5 rounded-full px-3.5;
  right: 16px;
  bottom: 16px;
  height: 46px;
  background: var(--panel);
  font-size: 12px;

  &.app__logs-toggle--active {
    border-color: var(--accent);
  }
}

.app__logs-toggle > span:first-child {
  color: var(--accent);
}

.app__logs-toggle em {
  color: var(--muted);
  font-size: 10px;
  font-style: normal;
}

.app__toggle-chevron {
  @apply ml-auto;
  color: var(--muted);
}

.app__logs-panel {
  @apply absolute z-[35] flex flex-col overflow-hidden;
  left: 16px;
  right: 16px;
  bottom: 16px;
  height: var(--logs-panel-height, max(20vh, 200px));
  max-height: calc(100vh - 32px);
  border-radius: 18px;
}

.app__logs-resize-handle {
  @apply absolute left-0 right-0 top-0 z-10 flex justify-center;
  height: 12px;
  margin: 0;
  border: 0;
  padding: 0;
  cursor: ns-resize;
  touch-action: none;
}

.app__logs-resize-handle::after {
  content: "";
  width: 40px;
  height: 4px;
  margin-top: 4px;
  border-radius: 999px;
  background: var(--muted);
  opacity: 0.55;
}

.app__logs-resize-handle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.app__logs-panel .app__logs-toolbar {
  padding-top: 12px;
}

.app--logs-open .app__logs-toggle {
  display: none;
}

.app__logs-toolbar {
  @apply flex flex-wrap items-center gap-2 border-b px-3 py-2;
  min-height: 54px;
  border-color: var(--border);
}

.app__logs-title {
  @apply mr-auto flex items-baseline gap-2;
}

.app__logs-title strong {
  font-size: 14px;
}

.app__logs-title span {
  color: var(--muted);
  font-size: 10px;
}

.app__control {
  @apply w-full rounded-lg border px-2.5 py-2 text-[11px] outline-none;
  border-color: var(--border);
  background: var(--panel);
}

.app__control:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft);
}

.app__control--framework-select {
  min-height: 38px;
}

.app__control--framework-select img {
  width: 19px;
  height: 19px;
  flex: none;
}

.app__logs-toolbar .app__control {
  width: auto;
  min-width: 130px;
  padding: 7px 9px;
}

.app__log-service-options {
  @apply z-20 flex max-h-48 min-w-full flex-col gap-1 overflow-auto rounded-lg border p-1.5 shadow-lg;
  border-color: var(--border);
  background: var(--panel);
}

.app__log-service-options .app__filter-option {
  @apply cursor-pointer whitespace-nowrap rounded px-2 py-1.5 text-left;
  border: 0;
  background: transparent;
  color: var(--text);
  font-size: 11px;
}

.app__log-service-options .app__filter-option:hover,
.app__log-service-options .app__filter-option[data-highlighted] {
  background: var(--panel2);
}

.app__log-service-options .app__filter-option--selected {
  background: var(--accent-soft);
  color: var(--accent);
}

.app__logs-toolbar .app__control--search {
  width: min(250px, 26vw);
}

.app__logs-list {
  @apply flex-1 overflow-auto px-2.5 py-1.5;
}

.app__log-row {
  @apply grid items-center gap-2.5 rounded-lg px-2 py-1;
  min-height: 30px;
  grid-template-columns: 80px 72px 145px minmax(0, 1fr);
  font-size: 10px;
}

.app__log-row time {
  color: var(--muted);
}

.app__log-row strong {
  @apply truncate whitespace-nowrap;
  font-weight: 500;
}

.app__severity {
  @apply justify-self-start rounded px-1 py-0.5;
  font-size: 9px;
}

.app__log-message {
  @apply truncate whitespace-nowrap;

  &.app__log-message--error {
    @apply whitespace-pre-wrap break-words;
    overflow: visible;
    overflow-wrap: anywhere;
    text-overflow: clip;
  }
}

.app__log-row--error {
  align-items: start;
}

.app__dialog-backdrop {
  @apply fixed inset-0 z-[70] flex justify-end;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  margin: 0;
  padding: 0;
  border: 0;
  color: inherit;
  background: rgba(20, 24, 28, 0.4);
}

.app__dialog-backdrop::backdrop {
  background: transparent;
}

.app__side-dialog {
  @apply flex h-full flex-col overflow-hidden;
  width: min(520px, 100vw);
  border-radius: 18px 0 0 18px;
  background: var(--panel);
}

.app__dialog-header {
  @apply flex items-center justify-between border-b px-5 py-4;
  border-color: var(--border);
}

.app__dialog-header > div,
.app__field,
.app__switch-row span {
  @apply flex flex-col;
}

.app__dialog-header strong {
  font-size: 15px;
}

.app__dialog-header span {
  @apply mt-1;
  color: var(--muted);
  font-size: 11px;
}

.app__dialog-body {
  @apply flex flex-1 flex-col gap-3 overflow-auto px-5 py-4;
}

.app__service-config-fields {
  @apply flex flex-col gap-0;
}

.app__dialog-footer {
  @apply flex justify-end gap-2 border-t px-5 py-3;
  border-color: var(--border);
}

.app__field {
  @apply min-w-0 flex-1 gap-1;
}

.app__request-fieldset {
  margin: 0;
  border: 0;
  padding: 0;
}

.app__field > span,
.app__field > legend {
  color: var(--muted);
  font-size: 10px;
  font-weight: 500;
}

.app__field-row {
  @apply flex gap-2.5;
}

.app__switch-row {
  @apply flex items-center justify-between rounded-lg border px-3 py-2.5;
  border-color: var(--border);
}

.app__switch-row strong {
  font-size: 11px;
}

.app__switch-row small {
  color: var(--muted);
  font-size: 10px;
}

.app__switch-row input {
  accent-color: var(--accent);
  width: 16px;
  height: 16px;
}

.app__section-title {
  @apply mt-1 gap-2;
}

.app__endpoint-actions {
  @apply flex items-center gap-2;
}

.app__openapi-file-input {
  display: none;
}

.app__section-title strong {
  font-size: 12px;
}

.app__endpoint-form-card {
  @apply flex flex-col gap-2.5 rounded-xl border p-3;
  position: relative;
  padding-bottom: 0px;
  border-color: var(--border);
  background: var(--panel2);
}

.app__endpoint-accordion,
.app__endpoint-accordion-item {
  width: 100%;
  border: 0;
}

.app__endpoint-form-summary {
  @apply flex w-full cursor-pointer items-center gap-2 text-left;
  min-height: 32px;
  padding-left: 30px;
}

.app__endpoint-summary-title {
  @apply flex min-w-0 flex-1 items-center;
}

.app__endpoint-summary-copy {
  @apply flex min-w-0 flex-1 flex-col;
}

.app__endpoint-summary-copy span {
  @apply truncate;
}

.app__endpoint-delete-button {
  @apply grid shrink-0 place-items-center rounded-md border;
  width: 24px;
  height: 24px;
  border-color: var(--danger);
  background: transparent;
  color: var(--danger);
}

.app__endpoint-card-delete {
  position: absolute;
  z-index: 1;
  top: 12px;
  left: 12px;
  width: 24px;
  height: 24px;
  padding: 0;
}

.app__endpoint-delete-button .app__icon {
  stroke: var(--danger);
}

.app__endpoint-delete-button:hover {
  background: var(--danger-soft);
}

.app__endpoint-form-card[data-open="false"] {
  min-height: 56px;
  justify-content: center;
}

.app__settings-accordion-chevron {
  color: var(--muted);
  transition: transform 0.15s ease;
}

.app__endpoint-accordion-content {
  padding-top: 10px;
}

.app__endpoint-accordion-body {
  @apply flex flex-col gap-2.5;
}

.app__endpoint-form-summary span {
  color: var(--muted);
  font-size: 10px;
}

.app__endpoint-form-actions {
  @apply flex justify-end;
}

.app__code-input {
  font-family: "IBM Plex Mono", monospace;
  font-size: 10px;
  resize: vertical;
}

.app__run-drawer {
  @apply absolute z-30 overflow-hidden rounded-xl;
  right: 16px;
  top: 88px;
  width: min(390px, calc(100vw - 32px));
  max-height: 38vh;
  background: var(--panel);
}

.app__run-drawer > header {
  @apply flex items-center justify-between border-b px-3 py-2;
  border-color: var(--border);
}

.app__run-drawer > header > div {
  @apply flex items-center gap-2.5;
}

.app__run-drawer > header strong {
  font-size: 12px;
}

.app__run-details {
  @apply overflow-auto p-3;
  max-height: calc(38vh - 42px);
}

.app__run-details pre {
  @apply overflow-auto whitespace-pre-wrap;
  margin: 0;
  max-height: 150px;
  overflow-wrap: anywhere;
  font-size: 10px;
}

.app__run-details small {
  @apply mt-2 block;
  color: var(--muted);
  font-size: 9px;
}

.app__status-text.app__status-text--error {
  font-size: 11px;
}

.nodrag {
  pointer-events: all;
}

@keyframes dash {
  to {
    stroke-dashoffset: -24;
  }
}

@media (max-width: 720px) {
  .app__topbar {
    left: 8px;
    right: 8px;
    top: 8px;
    height: 54px;
    padding: 0 9px;
  }

  .app__brand span,
  .app__project-label,
  .app__top-actions .app__button--secondary {
    display: none;
  }

  .app__top-actions {
    gap: 5px;
  }

  .app__button {
    padding: 7px 8px;
    font-size: 10px;
  }

  .app__canvas-hint,
  .vue-flow__minimap {
    display: none;
  }

  .app__logs-panel {
    left: 8px;
    right: 8px;
    bottom: 8px;
  }

  .app__logs-toolbar .app__control--search {
    width: 100%;
  }

  .app__log-row {
    grid-template-columns: 55px 55px 80px minmax(0, 1fr);
    gap: 5px;
    font-size: 9px;
  }

  .app__field-row {
    flex-direction: column;
  }

  .app__side-dialog {
    width: 100%;
    border-radius: 0;
  }
}

.app__environment-variable-section {
  margin-top: 1.5rem;
  padding-top: 1rem;
}

.app__environment-variable-header {
  margin-bottom: 0.5rem;
}

.app__settings-accordion-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
}

.app__settings-section-accordion {
  flex: 1;
  min-width: 0;
}

.app__settings-section-accordion-item {
  border: 0;
}

.app__settings-accordion-content {
  padding-top: 0.75rem;
}

.app__settings-accordion-body {
  width: 100%;
}

.app__environment-variable-list {
  display: grid;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.app__environment-variable-card-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border);
}

.cm-editor {
  width: 100%;
  border: 1px solid var(--border-color, #d4d4d8);
  border-radius: 0.5rem;
  background: var(--panel-bg, white);
  color: inherit;
}

.cm-editor.cm-focused {
  outline: 2px solid var(--accent-color, #6366f1);
  outline-offset: 1px;
}

.cm-gutters {
  background: transparent;
  border: 0;
}

.cm-variable-placeholder {
  color: #7c3aed;
  background: #f1ebfe;
  border-radius: 3px;
}

.app.app--dark .cm-editor {
  background: #18181b;
}

.app.app--dark .cm-variable-placeholder {
  color: #c4b5fd;
  background: #262035;
}
</style>
