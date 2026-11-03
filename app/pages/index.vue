<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import ContextMenu from "../components/ContextMenu.vue";
import ServiceSettingsPanel from "../components/ServiceSettingsPanel.vue";
import MockApiSettingsPanel from "../components/MockApiSettingsPanel.vue";
import LogsPanel from "../components/LogsPanel.vue";
import AppToolbar from "../components/AppToolbar.vue";
import OtelAccessTokensDialog from "../components/OtelAccessTokensDialog.vue";
import AppToastStack from "../components/AppToastStack.vue";
import LatestRunDrawer from "../components/LatestRunDrawer.vue";
import MockApiCallHistoryPanel from "../components/MockApiCallHistoryPanel.vue";
import { createApiClient } from "../models/api-client";
import type { MockApiCallHistoryEntry } from "#shared/api/mock-api-call-history";
import { storeToRefs } from "pinia";
import { useGraphStore } from "../stores/graph";
import { useGraphViewModel } from "../composables/useGraphViewModel";
import { useServiceViewModel, type ServiceDraft } from "../composables/useServiceViewModel";
import { useMockApiStore } from "../stores/mockApis";
import { useObservabilityStore } from "../stores/observability";
import { useMockApiViewModel } from "../composables/useMockApiViewModel";
import { useMockApiRunViewModel } from "../composables/useMockApiRunViewModel";
import { useObservabilityViewModel } from "../composables/useObservabilityViewModel";
import { useCanvasViewModel } from "../composables/useCanvasViewModel";
import { useGraphInteractionViewModel } from "../composables/useGraphInteractionViewModel";
import { useSettingsPanelViewModel } from "../composables/useSettingsPanelViewModel";
import type { MockApiDraft } from "../models/mock-api";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import "@vue-flow/controls/dist/style.css";

const GraphCanvas = defineAsyncComponent(() => import("../components/graph/GraphCanvas.vue"));
const authStatus = useState("auth-session-status", () => ({ enabled: true, authenticated: false }));
const route = useRoute();

const mockApiStore = useMockApiStore();
const {
  mockApis,
  mockDraft,
  environmentVariables,
  headerTemplates,
  authorizationTemplates,
  runningMockId,
  runResults,
} = storeToRefs(mockApiStore);
const graphStore = useGraphStore();
const observabilityStore = useObservabilityStore();
const { logs, logsOpen, logsPanelHeight, logSearch, logService, logSeverity } =
  storeToRefs(observabilityStore);
const { nodes, edges, services, allNodesCollapsed, nodesLocked } = storeToRefs(graphStore);
const dark = useCookie("cairn-dark-mode", {
  default: () => false,
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax",
});
useHead({
  htmlAttrs: {
    class: computed(() => (dark.value ? "dark app--dark" : "")),
  },
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
const accessTokensOpen = ref(false);
const historyOpen = ref(false);
const historyReplayEntryId = ref<string | null>(null);
const historyEntries = ref<MockApiCallHistoryEntry[]>([]);
const historyLoading = ref(false);
const editingEnvironmentVariableId = ref<string | null>(null);
const environmentCardDraft = ref({ name: "", value: "" });
let healthTimer: ReturnType<typeof setInterval> | undefined;

async function signOut() {
  try {
    await $fetch("/api/auth/logout", { method: "POST" });
    await navigateTo("/login");
  } catch {
    errorMessage.value = "Could not sign out. Try again.";
  }
}
const graphCanvas = ref<InstanceType<typeof GraphCanvas> | null>(null);
const apiClient = createApiClient(async (url, options) => {
  try {
    return await $fetch<unknown>(url, options as never);
  } catch (cause) {
    const status =
      typeof cause === "object" && cause !== null
        ? (("statusCode" in cause ? cause.statusCode : undefined) ??
          ("status" in cause ? cause.status : undefined))
        : undefined;
    if (status === 401 && authStatus.value.enabled) {
      await navigateTo({ path: "/login", query: { returnTo: route.fullPath } });
    }
    throw cause;
  }
});
const observabilityViewModel = useObservabilityViewModel({ store: observabilityStore, apiClient });
const graphViewModel = useGraphViewModel({
  store: graphStore,
  mockApis: () => mockApis.value,
  runningMockId: () => runningMockId.value,
  runResults: () => runResults.value,
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
  toggleServiceEndpoints,
  toggleAllNodes,
  loadCanvas,
  loadServiceHealth,
  saveCanvas,
  toggleNodesLocked,
  autoArrange,
  onMoveEnd,
  onConnect,
  onEdgeDoubleClick,
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

async function loadMockApiCallHistory() {
  historyLoading.value = true;
  try {
    historyEntries.value = await apiClient.listMockApiCallHistory();
  } catch (cause) {
    errorMessage.value = cause instanceof Error ? cause.message : "Could not load call history";
  } finally {
    historyLoading.value = false;
  }
}

async function removeMockApiCallHistoryEntry(id: string) {
  try {
    await apiClient.deleteMockApiCallHistory(id);
    historyEntries.value = historyEntries.value.filter((entry) => entry.id !== id);
  } catch (cause) {
    errorMessage.value = cause instanceof Error ? cause.message : "Could not remove call history";
  }
}

async function clearMockApiCallHistory() {
  try {
    await apiClient.clearMockApiCallHistory();
    historyEntries.value = [];
  } catch (cause) {
    errorMessage.value = cause instanceof Error ? cause.message : "Could not clear call history";
  }
}

async function replayMockApiCallHistory(entry: MockApiCallHistoryEntry) {
  errorMessage.value = "";
  historyReplayEntryId.value = entry.id;
  try {
    await mockApiRunViewModel.replayHistoryEntry(entry);
  } catch (cause) {
    historyReplayEntryId.value = null;
    errorMessage.value = cause instanceof Error ? cause.message : "Could not replay saved trace";
  }
}

function stopMockApiCallHistoryReplay() {
  mockApiRunViewModel.stopReplay();
  historyReplayEntryId.value = null;
  graphStore.setObservations({ services: [], errorServices: [], edges: [] });
  graphViewModel.syncNodes();
}

let logTimer: ReturnType<typeof setTimeout>;
watch([logSearch, () => logService.value.join("\0"), () => logSeverity.value.join("\0")], () => {
  clearTimeout(logTimer);
  logTimer = setTimeout(loadLogs, 180);
});
watch(logsOpen, (open) => {
  if (open) void loadLogs();
});
watch(historyOpen, (open) => {
  if (open) void loadMockApiCallHistory();
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

function addAuthorizationTemplate() {
  mockApiViewModel.addAuthorizationTemplate();
}

function deleteAuthorizationTemplate(template: (typeof authorizationTemplates.value)[number]) {
  mockApiViewModel.removeAuthorizationTemplate(template, (message) => window.confirm(message));
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

async function runMock(entry: MockApi) {
  const result = await mockApiRunViewModel.runMock(entry);
  if (historyOpen.value) await loadMockApiCallHistory();
  return result;
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
      :all-nodes-collapsed="allNodesCollapsed"
      :dark="dark"
      :nodes-locked="nodesLocked"
      :auth-enabled="authStatus.enabled"
      @toggle-all="toggleAllNodes"
      @auto-arrange="autoArrange"
      @toggle-nodes-locked="toggleNodesLocked"
      @toggle-theme="dark = !dark"
      @open-mock-apis="openMockPanel"
      @open-access-tokens="accessTokensOpen = true"
      @open-history="historyOpen = true"
      @sign-out="signOut"
    />

    <OtelAccessTokensDialog v-model:open="accessTokensOpen" />

    <section class="absolute inset-0">
      <ContextMenu v-model:open="contextMenuOpen" @add-service="beginAddService">
        <GraphCanvas
          ref="graphCanvas"
          v-model:nodes="nodes"
          v-model:edges="edges"
          :dark="dark"
          :nodes-locked="nodesLocked"
          @connect="onConnect"
          @edge-double-click="onEdgeDoubleClick"
          @node-click="onNodeClick"
          @pane-context-menu="handleCanvasContextMenu"
          @move-end="onMoveEnd"
          @node-drag-stop="saveCanvas"
          @toggle-service-endpoints="toggleServiceEndpoints"
          @open-service-endpoint="openServiceEndpoint"
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
      :header-templates="headerTemplates"
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
      v-model:authorization-templates="authorizationTemplates"
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
      @add-authorization-template="addAuthorizationTemplate"
      @delete-authorization-template="deleteAuthorizationTemplate"
    />

    <LatestRunDrawer
      :result="latestRunResult"
      :running="Boolean(runningMockId)"
      @close="mockApiStore.clearRunResults"
    />
    <MockApiCallHistoryPanel
      v-model:open="historyOpen"
      :entries="historyEntries"
      :loading="historyLoading"
      :replaying="Boolean(historyReplayEntryId)"
      @remove-entry="removeMockApiCallHistoryEntry"
      @clear-history="clearMockApiCallHistory"
      @replay-entry="replayMockApiCallHistory"
      @stop-replay="stopMockApiCallHistoryReplay"
    />
  </main>
</template>
