<script setup lang="ts">
import { computed, nextTick, watch } from "vue";
import {
  VueFlow,
  useVueFlow,
  Panel,
  ConnectionLineType,
  type Connection,
  type Edge,
  type EdgeChange,
  type EdgeUpdateEvent,
  type Node,
} from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { ControlButton, Controls } from "@vue-flow/controls";
import { MiniMap } from "@vue-flow/minimap";
import MockApiTriggerNode from "./MockApiTriggerNode.vue";
import ServiceGraphNode from "./ServiceGraphNode.vue";
import MessageQueueNode from "./MessageQueueNode.vue";
import SquareEdge from "./SquareEdge.vue";
import type { GraphMockApi } from "../../models/graph";

const props = withDefaults(
  defineProps<{
    nodes: Node[];
    edges: Edge[];
    dark: boolean;
    allNodesCollapsed?: boolean;
  }>(),
  { allNodesCollapsed: false },
);
const edgeTypes = { default: SquareEdge };
const emit = defineEmits<{
  "update:nodes": [nodes: Node[]];
  "update:edges": [edges: Edge[]];
  connect: [connection: Connection];
  edgeDoubleClick: [event: { edge: { id: string } }];
  edgeUpdate: [event: EdgeUpdateEvent];
  edgesChange: [changes: EdgeChange[]];
  nodeClick: [event: { node: { id: string } }];
  paneContextMenu: [event: MouseEvent];
  moveEnd: [viewport: { x: number; y: number; zoom: number }];
  nodeDragStop: [];
  autoArrange: [];
  toggleAll: [];
  toggleServiceEndpoints: [serviceId: string];
  editService: [serviceId: string];
  editMessageQueue: [queueId: string];
  editMockApi: [mockApiId: string];
  openServiceEndpoint: [endpointId: string | undefined];
  runMockApi: [entry: GraphMockApi];
  connectWebSocket: [id: string];
  disconnectWebSocket: [id: string];
  triggerWebSocket: [id: string];
  toggleResponsePanel: [id: string];
}>();

const modelNodes = computed({
  get: () => props.nodes,
  set: (value: Node[]) => emit("update:nodes", value),
});
const modelEdges = computed({
  get: () => props.edges,
  set: (value: Edge[]) => emit("update:edges", value),
});
const { fitView, screenToFlowCoordinate, setCenter, setViewport, updateNodeInternals } =
  useVueFlow();

async function focusResponsePanel(mockApiId: string) {
  await nextTick();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  const responsePanel = Array.from(
    document.querySelectorAll<HTMLElement>("[data-response-panel]"),
  ).find((element) => element.dataset.responsePanel === mockApiId);
  if (!responsePanel) return;

  const panelRect = responsePanel.getBoundingClientRect();
  const triggerNode = responsePanel.closest<HTMLElement>(".vue-flow__node");
  const triggerRect = triggerNode?.getBoundingClientRect();
  const bounds = triggerRect
    ? {
        left: Math.min(panelRect.left, triggerRect.left),
        top: Math.min(panelRect.top, triggerRect.top),
        right: Math.max(panelRect.right, triggerRect.right),
        bottom: Math.max(panelRect.bottom, triggerRect.bottom),
      }
    : panelRect;
  const flowTopLeft = screenToFlowCoordinate({ x: bounds.left, y: bounds.top });
  const flowBottomRight = screenToFlowCoordinate({ x: bounds.right, y: bounds.bottom });
  const canvasRect = responsePanel.closest<HTMLElement>(".vue-flow")?.getBoundingClientRect();
  if (!canvasRect || !flowTopLeft || !flowBottomRight) return;

  const width = flowBottomRight.x - flowTopLeft.x;
  const height = flowBottomRight.y - flowTopLeft.y;
  const zoom = Math.min(1.15, (canvasRect.width - 128) / width, (canvasRect.height - 128) / height);
  await setCenter(
    (flowTopLeft.x + flowBottomRight.x) / 2,
    (flowTopLeft.y + flowBottomRight.y) / 2,
    { zoom, duration: 350 },
  );
}

function handleLayoutSignature(node: Node) {
  const data = node.data as {
    endpoints?: { id: string }[];
    subscriptions?: { id: string }[];
    outboundCalls?: {
      id: string;
      kind?: "api" | "message";
      sourceEndpointId?: string;
      sourceSubscriptionId?: string;
    }[];
    hasMessagePublisher?: boolean;
    endpointsCollapsed?: boolean;
    destinations?: { id: string }[];
    topicsCollapsed?: boolean;
  };
  if (node.type === "service")
    return JSON.stringify([
      data.endpoints?.map((item) => item.id),
      data.subscriptions?.map((item) => item.id),
      data.outboundCalls?.map((item) => [
        item.id,
        item.kind,
        item.sourceEndpointId,
        item.sourceSubscriptionId,
        item.targetServiceId,
        item.targetEndpointLabel,
      ]),
      data.hasMessagePublisher,
      data.endpointsCollapsed,
    ]);
  if (node.type === "messageQueue")
    return JSON.stringify([data.destinations?.map((item) => item.id), data.topicsCollapsed]);
  return "";
}

watch(
  () => props.nodes.map((node) => [node.id, handleLayoutSignature(node)] as const),
  (current, previous) => {
    const previousSignatures = new Map(previous.map(([id, signature]) => [id, signature]));
    const changedNodeIds = current
      .filter(([id, signature]) => previousSignatures.get(id) !== signature)
      .map(([id]) => id);
    if (changedNodeIds.length) updateNodeInternals(changedNodeIds);
  },
  { flush: "post" },
);

defineExpose({
  fitView,
  focusResponsePanel,
  screenToFlowCoordinate,
  setViewport,
  updateNodeInternals,
});
</script>

<template>
  <VueFlow
    v-model:nodes="modelNodes"
    v-model:edges="modelEdges"
    :edge-types="edgeTypes"
    :connection-line-type="ConnectionLineType.Step"
    class="app__graph-flow"
    :select-nodes-on-drag="false"
    :elements-selectable="true"
    :snap-to-grid="true"
    :snap-grid="[22, 22]"
    :min-zoom="0.2"
    :max-zoom="3"
    fit-view-on-init
    @connect="emit('connect', $event)"
    @edge-double-click="emit('edgeDoubleClick', $event)"
    @edge-update="emit('edgeUpdate', $event)"
    @edges-change="emit('edgesChange', $event)"
    @node-click="emit('nodeClick', $event)"
    @pane-context-menu="emit('paneContextMenu', $event)"
    @move-end="emit('moveEnd', $event.flowTransform)"
    @node-drag-stop="emit('nodeDragStop')"
  >
    <Background variant="dots" :gap="22" :size="1.2" />
    <MiniMap
      pannable
      zoomable
      :node-color="dark ? '#343a40' : '#c5cbc9'"
      :node-stroke-color="dark ? '#9ba2a9' : '#68706c'"
      :mask-color="dark ? 'rgba(0, 0, 0, 0.58)' : 'rgba(240, 240, 240, 0.6)'"
      :mask-stroke-color="dark ? '#2dd4bf' : '#0f766e'"
    />
    <Controls position="bottom-left">
      <div class="mt-1 flex flex-col border-t border-[var(--border)] pt-1">
        <ControlButton
          aria-label="Auto arrange"
          title="Auto arrange"
          @click.stop="emit('autoArrange')"
        >
          <UIcon name="i-lucide-layout-grid" class="size-4" aria-hidden="true" />
        </ControlButton>
        <ControlButton
          :aria-label="allNodesCollapsed ? 'Expand all nodes' : 'Collapse all nodes'"
          :title="allNodesCollapsed ? 'Expand all nodes' : 'Collapse all nodes'"
          @click.stop="emit('toggleAll')"
        >
          <UIcon
            :name="allNodesCollapsed ? 'i-lucide-expand' : 'i-lucide-minimize-2'"
            class="size-4"
            aria-hidden="true"
          />
        </ControlButton>
      </div>
    </Controls>
    <Panel position="bottom-left" class="app__graph-legend-panel">
      <div class="app__graph-legend" aria-label="Graph legend">
        <span><i class="app__legend-line" aria-hidden="true" />Call</span>
        <span
          ><i class="app__legend-line app__legend-line--message" aria-hidden="true" />Message</span
        >
        <span
          ><i
            class="app__legend-line app__legend-line--observed"
            aria-hidden="true"
          />Observed</span
        >
        <span><i class="app__legend-dot" aria-hidden="true" />Endpoint in trace</span>
      </div>
    </Panel>
    <template #node-service="{ data }">
      <ServiceGraphNode
        :data="data"
        @toggle-endpoints="emit('toggleServiceEndpoints', $event)"
        @edit="emit('editService', $event)"
        @open-endpoint="emit('openServiceEndpoint', $event)"
      />
    </template>
    <template #node-mockApiTrigger="{ data }">
      <MockApiTriggerNode
        :data="data"
        @edit="emit('editMockApi', $event)"
        @trigger="
          data.entry.apiType === 'WEBSOCKET'
            ? emit('triggerWebSocket', $event)
            : emit('runMockApi', data.entry)
        "
        @connect="emit('connectWebSocket', $event)"
        @disconnect="emit('disconnectWebSocket', $event)"
        @toggle-response="emit('toggleResponsePanel', $event)"
      />
    </template>
    <template #node-messageQueue="{ data }">
      <MessageQueueNode :data="data" @edit="emit('editMessageQueue', $event)" />
    </template>
  </VueFlow>
</template>
