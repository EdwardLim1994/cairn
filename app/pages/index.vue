<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import ContextMenu from "../components/ContextMenu.vue";
import ServiceSettingsPanel from "../components/ServiceSettingsPanel.vue";
import MockApiSettingsPanel from "../components/MockApiSettingsPanel.vue";
import LogsPanel from "../components/LogsPanel.vue";
import AppToolbar from "../components/AppToolbar.vue";
import GraphAsCodePanel from "../components/GraphAsCodePanel.vue";
import OtelAccessTokensDialog from "../components/OtelAccessTokensDialog.vue";
import AppToastStack from "../components/AppToastStack.vue";
import MockApiCallHistoryPanel from "../components/MockApiCallHistoryPanel.vue";
import MessageQueueSettingsPanel from "../components/MessageQueueSettingsPanel.vue";
import ManageNodesPanel from "../components/ManageNodesPanel.vue";
import { createApiClient } from "../models/api-client";
import type { MockApiCallHistoryEntry } from "#shared/api/mock-api-call-history";
import type { GraphCodeManifest } from "#shared/api/graph-code";
import type { CanvasGetResponse } from "#shared/api/canvas";
import { storeToRefs } from "pinia";
import { useGraphStore } from "../stores/graph";
import { useGraphViewModel } from "../composables/useGraphViewModel";
import { useServiceViewModel, type ServiceDraft } from "../composables/useServiceViewModel";
import { useMockApiStore } from "../stores/mockApis";
import { useObservabilityStore } from "../stores/observability";
import { useMockApiViewModel } from "../composables/useMockApiViewModel";
import { useMockApiRunViewModel } from "../composables/useMockApiRunViewModel";
import { useWebSocketMockApiStreams } from "../composables/useWebSocketMockApiStreams";
import { useObservabilityViewModel } from "../composables/useObservabilityViewModel";
import { useCanvasViewModel } from "../composables/useCanvasViewModel";
import { useGraphInteractionViewModel } from "../composables/useGraphInteractionViewModel";
import { useSettingsPanelViewModel } from "../composables/useSettingsPanelViewModel";
import { serializeGraphCode } from "../utils/graph-code";
import { useWorkspaceDrawerState } from "../composables/useWorkspaceDrawerState";
import { useServiceHealthPolling } from "../composables/useServiceHealthPolling";
import type { MockApiDraft } from "../models/mock-api";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import "@vue-flow/controls/dist/style.css";

const GraphCanvas = defineAsyncComponent(() => import("../components/graph/GraphCanvas.vue"));
const authStatus = useState("auth-session-status", () => ({ enabled: true, authenticated: false }));
const route = useRoute();
const runtimeConfig = useRuntimeConfig();

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
const { nodes, edges, services, serviceEdges, allNodesCollapsed } = storeToRefs(graphStore);
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
const lastServiceHealthCheckAt = ref<Record<string, string>>({});
const importWarnings = ref<{ id: number; message: string }[]>([]);
const contextMenu = ref<{ x: number; y: number; flowX: number; flowY: number } | null>(null);
const contextMenuOpen = computed({
  get: () => contextMenu.value !== null,
  set: (open: boolean) => {
    if (!open) contextMenu.value = null;
  },
});
const { model: drawerModel } = useWorkspaceDrawerState();
const serviceDialog = drawerModel("service");
const messageQueuePanel = drawerModel("message-queue");
const editingMessageDestinationId = ref<string | null>(null);
const newMessageQueuePosition = ref({ x: 160, y: 120 });
const editingServiceId = ref<string | null>(null);
const serviceReturnsToManageNodes = ref(false);
const activeObservedTrace = ref<{
  traceId: string;
  apiName: string;
  status: "completed" | "failed";
  totalDurationMs: number | null;
  connectionCount: number;
} | null>(null);
const editingServiceLastHealthCheckAt = computed(() =>
  editingServiceId.value ? (lastServiceHealthCheckAt.value[editingServiceId.value] ?? null) : null,
);
type SubscriberDraft = {
  id: string;
  destinationId: string;
  consumerGroup?: string;
  bindingKey?: string;
};
type SavedSubscriber = Extract<
  CanvasGetResponse["messageConnections"][number],
  { type: "subscribe" }
>;
const editingServiceSubscriptions = computed(() =>
  graphStore.messageConnections.filter(
    (connection): connection is SavedSubscriber =>
      connection.type === "subscribe" && connection.serviceId === editingServiceId.value,
  ),
);
const serviceDraft = ref<ServiceDraft>({
  name: "",
  apiType: "REST",
  framework: "",
  baseUrl: "http://localhost:3000",
  grpcTls: false,
  protoContent: null,
  protoFileName: null,
  clearProto: false,
  active: true,
  endpoints: [{ name: "", method: "GET", url: "/" }],
});
const frameworkMenuOpen = ref(false);
const mockPanel = drawerModel("mock-apis");
const focusedMockApiId = ref<string | null>(null);
const focusMockApiRequest = ref(0);
const expandedEnvironmentVariableId = ref<string | null>(null);
const registeredMockApisOpen = ref(true);
const sharedEnvironmentVariablesOpen = ref(true);
const environmentVariablesLoading = ref(false);
const accessTokensOpen = drawerModel("access-tokens");
const historyOpen = drawerModel("history");
const historyReplayEntryId = ref<string | null>(null);
const historyEntries = ref<MockApiCallHistoryEntry[]>([]);
const historyLoading = ref(false);
const graphCodeOpen = drawerModel("graph-code");
const manageNodesOpen = drawerModel("manage-nodes");
const graphCodeInitial = ref("");
const graphCodeApplying = ref(false);
const followActiveTraceInLogs = ref(true);
const editingEnvironmentVariableId = ref<string | null>(null);
const environmentCardDraft = ref({ name: "", value: "" });

async function signOut() {
  try {
    await $fetch("/api/auth/logout", { method: "POST" });
    await navigateTo("/login");
  } catch {
    errorMessage.value = "Could not sign out. Try again.";
  }
}
const graphCanvas = ref<InstanceType<typeof GraphCanvas> | null>(null);

function fetchErrorStatus(cause: unknown) {
  if (typeof cause !== "object" || cause === null) return undefined;
  if ("statusCode" in cause && cause.statusCode !== undefined) return cause.statusCode;
  if ("status" in cause) return cause.status;
  return undefined;
}

const apiClient = createApiClient(async (url, options) => {
  try {
    return await $fetch<unknown>(url, options as never);
  } catch (cause) {
    const status = fetchErrorStatus(cause);
    if (status === 401 && authStatus.value.enabled) {
      await navigateTo({ path: "/login", query: { returnTo: route.fullPath } });
    }
    throw cause;
  }
});
const observabilityViewModel = useObservabilityViewModel({ store: observabilityStore, apiClient });
let syncWebSocketGraph = () => {};
const websocketStreams = useWebSocketMockApiStreams({
  connect: apiClient.connectWebSocketMockApi,
  disconnect: apiClient.disconnectWebSocketMockApi,
  trigger: apiClient.triggerWebSocketMockApi,
  syncNodes: () => syncWebSocketGraph(),
  onError: (message) => (errorMessage.value = message),
});
const {
  websocketStates,
  websocketMessages,
  websocketUnread,
  responsePanelOpenId,
  connectWebSocket,
  disconnectWebSocket,
  triggerWebSocket,
  toggleResponsePanel,
} = websocketStreams;
const graphViewModel = useGraphViewModel({
  store: graphStore,
  mockApis: () => mockApis.value,
  runningMockId: () => runningMockId.value,
  runResults: () => runResults.value,
  websocketState: (id) => websocketStates.value[id] ?? "disconnected",
  responsePanelOpenId: () => responsePanelOpenId.value,
  websocketUnread: (id) => websocketUnread.value[id] ?? false,
  websocketMessages: (id) => websocketMessages.value[id] ?? [],
});
syncWebSocketGraph = () => graphViewModel.syncNodes();
const canvasViewModel = useCanvasViewModel({
  apiClient,
  graphStore,
  mockApiStore,
  graphViewModel,
  graphCanvas,
  loading,
  errorMessage,
  onServiceHealthCompleted: (serviceIds, checkedAt) => {
    lastServiceHealthCheckAt.value = {
      ...lastServiceHealthCheckAt.value,
      ...Object.fromEntries(serviceIds.map((id) => [id, checkedAt])),
    };
  },
});
const {
  buildEdges,
  syncNodes,
  toggleServiceEndpoints,
  toggleAllNodes,
  loadCanvas,
  loadServiceHealth,
  loadMessageDestinationHealth,
  saveCanvas,
  autoArrange,
  onMoveEnd,
  onConnect,
  onEdgeDoubleClick,
  onEdgeUpdate,
  onEdgesChange,
  setOutboundCall: saveOutboundCall,
  removeServiceCall,
} = canvasViewModel;
const serviceHealthPolling = useServiceHealthPolling(() => {
  void loadServiceHealth();
  void loadMessageDestinationHealth();
});
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
  openResponsePanel: websocketStreams.openResponsePanel,
  focusResponsePanel: (id) => graphCanvas.value?.focusResponsePanel(id),
  saveCanvas,
  loadLogs: observabilityViewModel.loadLogs,
  onFlowCollected: ({ flow, apiName, status, totalDurationMs }) => {
    activeObservedTrace.value = {
      traceId: flow.traceId,
      apiName,
      status,
      totalDurationMs,
      connectionCount: flow.edges.length + flow.observedMessageConnectionIds.length,
    };
  },
});
type MockApi = MockApiDraft;
const resetEnvironmentCardEdit = mockApiViewModel.resetEnvironmentCardEdit;
const dismissImportWarning = mockApiViewModel.dismissImportWarning;
const deleteEnvironmentVariable = mockApiViewModel.deleteEnvironmentVariable;
const saveEnvironmentVariable = mockApiViewModel.saveEnvironmentVariable;
const saveHeaderTemplate = mockApiViewModel.saveHeaderTemplate;
const saveAuthorizationTemplate = mockApiViewModel.saveAuthorizationTemplate;
const saveMockApi = mockApiViewModel.saveMockApi;
const deleteMockApi = mockApiViewModel.deleteMockApi;
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
  serviceReturnsToManageNodes.value = false;
  serviceViewModel.beginAddService({ x: contextMenu.value.flowX, y: contextMenu.value.flowY });
  contextMenu.value = null;
}

function beginAddMessageDestination() {
  if (!contextMenu.value) return;
  editingMessageDestinationId.value = null;
  newMessageQueuePosition.value = {
    x: contextMenu.value.flowX,
    y: contextMenu.value.flowY,
  };
  messageQueuePanel.value = true;
  contextMenu.value = null;
}

function openMessageQueuePanel(destinationId: string) {
  editingMessageDestinationId.value = destinationId;
  messageQueuePanel.value = true;
}

function addServiceFromManager() {
  serviceReturnsToManageNodes.value = true;
  manageNodesOpen.value = false;
  serviceViewModel.beginAddService({ x: 160, y: 120 });
}

function returnToManageNodes() {
  serviceReturnsToManageNodes.value = false;
  serviceDialog.value = false;
  manageNodesOpen.value = true;
}

function addQueueFromManager() {
  manageNodesOpen.value = false;
  editingMessageDestinationId.value = null;
  newMessageQueuePosition.value = { x: 160, y: 120 };
  messageQueuePanel.value = true;
}

function editDestinationFromManager(destinationId: string) {
  const destination = graphStore.messageDestinations.find(({ id }) => id === destinationId);
  if (destination) {
    manageNodesOpen.value = false;
    openMessageQueuePanel(destinationId);
  }
}

const editingMessageDestination = computed(
  () =>
    graphStore.messageDestinations.find(({ id }) => id === editingMessageDestinationId.value) ??
    null,
);

async function saveMessageQueue(destination: CanvasGetResponse["messageDestinations"][number]) {
  const exists = graphStore.messageDestinations.some(({ id }) => id === destination.id);
  graphStore.setMessageDestinations(
    exists
      ? graphStore.messageDestinations.map((item) =>
          item.id === destination.id ? destination : item,
        )
      : [...graphStore.messageDestinations, destination],
  );
  syncNodes();
  if (!(await saveCanvas())) {
    await loadCanvas();
    return;
  }
  messageQueuePanel.value = false;
}

async function removeMessageQueue(destinationId: string) {
  const destination = graphStore.messageDestinations.find(({ id }) => id === destinationId);
  if (!destination) return;
  if (!confirm(`Remove ${destination.name} and its producer and consumer connections?`)) return;
  graphStore.setMessageDestinations(
    graphStore.messageDestinations.filter(({ id }) => id !== destinationId),
  );
  graphStore.setMessageConnections(
    graphStore.messageConnections.filter(
      (connection) => connection.destinationId !== destinationId,
    ),
  );
  syncNodes();
  if (!(await saveCanvas())) {
    await loadCanvas();
    return;
  }
  messageQueuePanel.value = false;
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
  editMessageDestination: openMessageQueuePanel,
  editMessageQueue: openMessageQueuePanel,
  editMockApi: (id) => openMockPanel(id),
});
const handleCanvasContextMenu = graphInteractionViewModel.handleCanvasContextMenu;

function editService(id: string, focusEndpointId?: string) {
  manageNodesOpen.value = false;
  serviceReturnsToManageNodes.value = false;
  if (!serviceViewModel.editService(id)) return;
  if (focusEndpointId)
    void nextTick(() => {
      const card = document.getElementById(`service-endpoint-${focusEndpointId}`);
      if (card instanceof HTMLDetailsElement) card.open = true;
      card?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
}

function editServiceFromManager(id: string) {
  editService(id);
  serviceReturnsToManageNodes.value = serviceDialog.value;
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

async function setOutboundCall(sourceId: string, connectionId: string | undefined, target: string) {
  await saveOutboundCall(sourceId, connectionId, target);
}

async function removeOutboundCall(edgeId: string) {
  await removeServiceCall(edgeId);
}

function saveService(subscriptions: SubscriberDraft[] = []) {
  if (editingServiceId.value) {
    const retainedSubscriptionIds = new Set(subscriptions.map(({ id }) => id));
    const removedSubscriptionIds = new Set(
      editingServiceSubscriptions.value
        .map(({ id }) => id)
        .filter((id) => !retainedSubscriptionIds.has(id)),
    );
    if (removedSubscriptionIds.size) {
      graphStore.setServiceEdges(
        graphStore.serviceEdges.filter(
          (edge) =>
            !edge.sourceSubscriptionId || !removedSubscriptionIds.has(edge.sourceSubscriptionId),
        ),
      );
    }
    graphStore.setMessageConnections([
      ...graphStore.messageConnections.filter((connection) => {
        if (connection.type === "subscribe" && connection.serviceId === editingServiceId.value)
          return false;
        return !(
          "subscriptionId" in connection &&
          connection.subscriptionId &&
          removedSubscriptionIds.has(connection.subscriptionId)
        );
      }),
      ...subscriptions.map((subscription) => ({
        ...subscription,
        serviceId: editingServiceId.value!,
      })),
    ]);
    graphViewModel.syncNodes();
  }
  return serviceViewModel.saveService();
}

async function handleServiceDelete(id: string) {
  const deleted = await serviceViewModel.deleteService(id, () =>
    confirm("Remove this service and its endpoints from the graph?"),
  );
  if (!deleted) return;
  if (serviceReturnsToManageNodes.value) returnToManageNodes();
  else closeSettings();
}

async function openMockPanel(focusMockApiId?: string) {
  focusedMockApiId.value = focusMockApiId ?? null;
  if (focusMockApiId) focusMockApiRequest.value++;
  await mockApiViewModel.openPanel(focusMockApiId);
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
function deleteHeaderTemplate(template: (typeof headerTemplates.value)[number]) {
  return mockApiViewModel.removeHeaderTemplate(template, (message) => window.confirm(message));
}

function deleteAuthorizationTemplate(template: (typeof authorizationTemplates.value)[number]) {
  return mockApiViewModel.removeAuthorizationTemplate(template, (message) =>
    window.confirm(message),
  );
}

function saveMockDraft() {
  return mockApiViewModel.saveMockDraft();
}

function discardMockSettings() {
  mockApiViewModel.discardMockSettings();
}

async function runMock(entry: MockApi) {
  activeObservedTrace.value = null;
  const result = await mockApiRunViewModel.runMock(entry);
  if (historyOpen.value) await loadMockApiCallHistory();
  return result;
}

onUnmounted(() => {
  websocketStreams.dispose();
});

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
  services.value.flatMap((service) =>
    service.endpoints.map(({ id, url }) => ({ id, url, apiType: service.apiType })),
  ),
);

function openGraphAsCode() {
  graphCodeInitial.value = serializeGraphCode(
    services.value,
    serviceEdges.value,
    graphStore.messageDestinations,
    graphStore.messageConnections,
    mockApis.value,
  );
  graphCodeOpen.value = true;
}

function toggleGraphAsCode() {
  if (graphCodeOpen.value) graphCodeOpen.value = false;
  else openGraphAsCode();
}

function toggleMockApis() {
  if (mockPanel.value) closeSettings();
  else void openMockPanel();
}

function showActiveTraceLogs() {
  followActiveTraceInLogs.value = true;
  logSearch.value = "";
  logService.value = [];
  logSeverity.value = [];
  logsOpen.value = true;
  void loadLogs();
}

async function applyGraphCode(manifest: GraphCodeManifest) {
  graphCodeApplying.value = true;
  errorMessage.value = "";
  try {
    await apiClient.applyGraphCode(manifest);
    await loadCanvas();
    await nextTick();
    await graphCanvas.value?.fitView({ padding: 0.2, duration: 300 });
    graphCodeOpen.value = false;
  } catch (cause) {
    errorMessage.value = cause instanceof Error ? cause.message : "Could not apply graph code";
  } finally {
    graphCodeApplying.value = false;
  }
}

onMounted(async () => {
  document.addEventListener("pointerdown", closeSettingsOutside);
  logsPanelHeight.value = Math.max(
    160,
    Math.round(window.innerHeight * (window.innerWidth <= 720 ? 0.34 : 0.25)),
  );
  await loadCanvas();
  await loadLogs();
  serviceHealthPolling.start();
});

onUnmounted(() => {
  document.removeEventListener("pointerdown", closeSettingsOutside);
});
</script>

<template>
  <main
    class="relative h-screen min-h-[620px] overflow-hidden text-[13px] leading-[1.4] app"
    :class="{ 'app--dark': dark }"
  >
    <AppToolbar
      :dark="dark"
      :logs-open="logsOpen"
      :project-id="runtimeConfig.public.projectId"
      :manage-nodes-open="manageNodesOpen"
      :mock-apis-open="mockPanel"
      :history-open="historyOpen"
      :graph-code-open="graphCodeOpen"
      @toggle-theme="dark = !dark"
      @open-mock-apis="toggleMockApis"
      @open-manage-nodes="manageNodesOpen = !manageNodesOpen"
      @open-logs="logsOpen = !logsOpen"
      @open-graph-as-code="toggleGraphAsCode"
      @open-access-tokens="accessTokensOpen = true"
      @open-history="historyOpen = !historyOpen"
      @sign-out="signOut"
    />

    <section
      v-if="activeObservedTrace"
      class="app__surface absolute left-3 top-[82px] z-20 flex min-h-12 max-w-[calc(100vw-24px)] flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3.5 py-1.5 text-[12px] shadow-[var(--shadow)] max-[720px]:left-2 max-[720px]:top-[66px]"
      aria-label="Active observed trace"
      role="status"
    >
      <span class="text-[11px] font-medium text-[var(--muted)]">Active observed trace</span>
      <span class="max-w-48 truncate font-mono font-medium" :title="activeObservedTrace.traceId">
        {{ activeObservedTrace.traceId }}
      </span>
      <span
        class="rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
        :class="
          activeObservedTrace.status === 'completed'
            ? 'app__run-state--completed'
            : 'app__run-state--failed'
        "
        >{{ activeObservedTrace.status }}</span
      >
      <span class="font-semibold">
        {{
          activeObservedTrace.totalDurationMs == null
            ? "N/A"
            : `${activeObservedTrace.totalDurationMs} ms`
        }}
      </span>
      <span class="text-[var(--muted)]">
        {{ activeObservedTrace.connectionCount }} connections
      </span>
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        size="sm"
        class="h-7 px-2 text-[11.5px]"
        @click="showActiveTraceLogs"
        >Logs</UButton
      >
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        size="sm"
        class="h-7 px-2 text-[11.5px]"
        aria-label="Clear active observed trace"
        @click="activeObservedTrace = null"
        ><UIcon name="i-lucide-x" class="size-3.5" aria-hidden="true"
      /></UButton>
    </section>

    <OtelAccessTokensDialog v-model:open="accessTokensOpen" />
    <GraphAsCodePanel
      v-model:open="graphCodeOpen"
      :initial-code="graphCodeInitial"
      :applying="graphCodeApplying"
      @apply="applyGraphCode"
    />
    <MessageQueueSettingsPanel
      v-model:open="messageQueuePanel"
      :destination="editingMessageDestination"
      :position="newMessageQueuePosition"
      :project-id="runtimeConfig.public.projectId"
      @save="saveMessageQueue"
      @remove="removeMessageQueue"
    />
    <ManageNodesPanel
      :open="manageNodesOpen"
      :services="services"
      :service-health="graphStore.serviceHealth"
      :destinations="graphStore.messageDestinations"
      @update:open="manageNodesOpen = $event"
      @edit-service="editServiceFromManager"
      @edit-destination="editDestinationFromManager"
      @add-service="addServiceFromManager"
      @add-queue="addQueueFromManager"
    />

    <section class="absolute inset-0">
      <ContextMenu
        v-model:open="contextMenuOpen"
        @add-service="beginAddService"
        @add-message-queue="beginAddMessageDestination"
      >
        <GraphCanvas
          ref="graphCanvas"
          v-model:nodes="nodes"
          v-model:edges="edges"
          :dark="dark"
          :all-nodes-collapsed="allNodesCollapsed"
          @auto-arrange="autoArrange"
          @toggle-all="toggleAllNodes"
          @connect="onConnect"
          @edge-double-click="onEdgeDoubleClick"
          @edge-update="onEdgeUpdate"
          @edges-change="onEdgesChange"
          @node-click="onNodeClick"
          @pane-context-menu="handleCanvasContextMenu"
          @move-end="onMoveEnd"
          @node-drag-stop="saveCanvas"
          @toggle-service-endpoints="toggleServiceEndpoints"
          @edit-service="editService"
          @edit-message-queue="editDestinationFromManager"
          @edit-mock-api="openMockPanel"
          @open-service-endpoint="openServiceEndpoint"
          @run-mock-api="runMock"
          @connect-web-socket="connectWebSocket"
          @disconnect-web-socket="disconnectWebSocket"
          @trigger-web-socket="triggerWebSocket"
          @toggle-response-panel="toggleResponsePanel"
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
      v-model:severity-filter="logSeverity"
      v-model:active-trace-only="followActiveTraceInLogs"
      :logs="logs"
      :active-trace-id="activeObservedTrace?.traceId ?? null"
      :height="logsPanelHeight"
      :format-time="observabilityViewModel.formatTime"
      @resize="resizeLogsPanel"
      @adjust-height="adjustLogsPanelHeight"
    />

    <ServiceSettingsPanel
      v-if="serviceDialog"
      v-model:draft="serviceDraft"
      v-model:framework-menu-open="frameworkMenuOpen"
      :editing-service-id="editingServiceId"
      :return-to-manage-nodes="serviceReturnsToManageNodes"
      :last-health-check-at="editingServiceLastHealthCheckAt"
      :header-templates="headerTemplates"
      :outbound-call-edges="serviceEdges"
      :endpoint-options="servicesForSelect"
      :message-destinations="graphStore.messageDestinations"
      :message-subscriptions="editingServiceSubscriptions"
      :message-connections="graphStore.messageConnections"
      @add-endpoint="addEndpoint"
      @remove-endpoint="removeEndpoint"
      @set-outbound-call="setOutboundCall"
      @remove-outbound-call="removeOutboundCall"
      @import-open-api="serviceViewModel.importOpenApiFile"
      @import-proto="serviceViewModel.importProtoFile"
      @remove-proto="serviceViewModel.removeProtoFile"
      @save="saveService"
      @discard="closeSettings"
      @back-to-manage-nodes="returnToManageNodes"
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
      :environment-variables-loading="environmentVariablesLoading"
      :focus-mock-api-id="focusedMockApiId"
      :focus-mock-api-request="focusMockApiRequest"
      :services-for-select="servicesForSelect"
      :endpoint-details="endpointDetails"
      :endpoint-path-parameter-names="endpointPathParameterNames"
      :save-environment-variable="saveEnvironmentVariable"
      :save-header-template="saveHeaderTemplate"
      :save-authorization-template="saveAuthorizationTemplate"
      :save-mock-api="saveMockApi"
      :delete-environment-variable="deleteEnvironmentVariable"
      :delete-header-template="deleteHeaderTemplate"
      :delete-authorization-template="deleteAuthorizationTemplate"
      :delete-mock-api="deleteMockApi"
      @discard="discardMockSettings"
      @save="saveMockDraft"
      @import-collection="importPostmanCollection"
      @import-environment="importPostmanEnvironment"
      @set-mock-endpoint="setMockEndpoint"
      @format-request="formatRequestJson"
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
