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
const { mockApis, mockDraft, environmentVariables, headerTemplates, runningMockId, runResults } =
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
async function importPostmanEnvironment(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;

  errorMessage.value = "";
  try {
    mockApiViewModel.importEnvironment(await file.text());
  } catch (cause) {
    errorMessage.value =
      cause instanceof Error ? cause.message : "Could not import Postman environment";
  }
}
function removeMockDraft(index: number) {
  mockApiViewModel.removeMockDraft(index);
}

function deleteHeaderTemplate(template: (typeof headerTemplates.value)[number]) {
  mockApiViewModel.removeHeaderTemplate(template, (message) => window.confirm(message));
}

function saveMockDraft() {
  return mockApiViewModel.saveMockDraft();
}

function discardMockSettings() {
  mockApiViewModel.discardMockSettings();
}

function addHeaderTemplate() {
  mockApiViewModel.addHeaderTemplate();
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
const endpointDetails = computed(() =>
  services.value.flatMap((service) => service.endpoints.map(({ id, url }) => ({ id, url }))),
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
    :class="{ 'app--dark': dark }"
  >
    <AppToolbar
      :service-count="services.length"
      :all-nodes-collapsed="allNodesCollapsed"
      :dark="dark"
      @toggle-all="toggleAllNodes"
      @toggle-theme="dark = !dark"
    />

    <section class="absolute inset-0" @contextmenu="handleCanvasContextMenu">
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
      <div
        v-if="loading"
        class="app__surface absolute left-1/2 top-[86px] -translate-x-1/2 rounded-lg px-3 py-2 text-[11px] text-[var(--muted)]"
      >
        Loading saved graph...
      </div>
      <AppToastStack
        :error-message="errorMessage"
        :warnings="importWarnings"
        @dismiss-error="errorMessage = ''"
        @dismiss-warning="dismissImportWarning"
      />
      <div
        class="app__surface pointer-events-none absolute bottom-5 left-[72px] rounded-lg px-3 py-2 text-[10px] text-[var(--muted)] max-[720px]:hidden"
      >
        <kbd class="rounded border border-[var(--border)] px-1 text-[var(--text)]">Right click</kbd>
        to add a service <span class="px-1"> | </span> Drag from a node to an endpoint to connect
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
      v-model:header-templates="headerTemplates"
      v-model:variables-open="sharedEnvironmentVariablesOpen"
      v-model:apis-open="registeredMockApisOpen"
      v-model:variable-draft="environmentCardDraft"
      :environment-variables-loading="environmentVariablesLoading"
      :editing-environment-variable-id="editingEnvironmentVariableId"
      :expanded-environment-variable-id="expandedEnvironmentVariableId"
      :services-for-select="servicesForSelect"
      :endpoint-details="endpointDetails"
      :endpoint-path-parameter-names="endpointPathParameterNames"
      @discard="discardMockSettings"
      @save="saveMockDraft"
      @add-variable="addEnvironmentVariable"
      @open-variable="openEnvironmentVariable"
      @close-variable="closeEnvironmentVariable"
      @update-variable="updateEnvironmentVariable"
      @delete-variable="deleteEnvironmentVariable"
      @import-collection="importPostmanCollection"
      @import-environment="importPostmanEnvironment"
      @add-mock-api="addMockDraft"
      @remove-mock-api="removeMockDraft"
      @set-mock-endpoint="setMockEndpoint"
      @format-request="formatRequestJson"
      @add-header-template="addHeaderTemplate"
      @delete-header-template="deleteHeaderTemplate"
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

.app__status-text {
  color: var(--danger);
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

.app__method-tag--get,
.app__severity--info {
  color: var(--get-fg);
  background: var(--get-bg);
}

.app__method-tag--post {
  color: var(--post-fg);
  background: var(--post-bg);
}

.app__severity--error,
.app__severity--fatal {
  color: var(--danger);
  background: var(--danger-soft);
}

.app__method-tag--put,
.app__severity--warn {
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

.app__run-state--completed {
  color: #047857;
}

.app__run-state--failed {
  color: var(--danger);
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

.app__logs-resize-control {
  @apply absolute left-0 right-0 top-0 z-10 flex justify-center;
  height: 12px;
}

.app__logs-resize-grip {
  position: absolute;
  top: 4px;
  left: calc(50% - 20px);
  width: 40px;
  height: 4px;
  border-radius: 999px;
  background: var(--muted);
  opacity: 0.55;
  pointer-events: none;
}

.app__logs-resize-handle {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  border: 0;
  padding: 0;
  appearance: none;
  background: transparent;
  opacity: 0;
  cursor: ns-resize;
  touch-action: none;
}

.app__logs-resize-control:focus-within {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
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
  .vue-flow__minimap {
    display: none;
  }
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
