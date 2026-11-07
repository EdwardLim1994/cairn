<script setup lang="ts">
import { computed, watch } from "vue";
import {
  VueFlow,
  useVueFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type EdgeUpdateEvent,
  type Node,
} from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import { MiniMap } from "@vue-flow/minimap";
import MockApiTriggerNode from "./MockApiTriggerNode.vue";
import ServiceGraphNode from "./ServiceGraphNode.vue";
import MessageQueueNode from "./MessageQueueNode.vue";
import type { GraphMockApi } from "../../models/graph";

const props = defineProps<{ nodes: Node[]; edges: Edge[]; dark: boolean; nodesLocked: boolean }>();
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
  toggleServiceEndpoints: [serviceId: string];
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
const { fitView, screenToFlowCoordinate, setViewport, updateNodeInternals } = useVueFlow();

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

defineExpose({ fitView, screenToFlowCoordinate, setViewport, updateNodeInternals });
</script>

<template>
  <VueFlow
    v-model:nodes="modelNodes"
    v-model:edges="modelEdges"
    class="app__graph-flow"
    :select-nodes-on-drag="false"
    :elements-selectable="true"
    :nodes-draggable="!nodesLocked"
    :snap-to-grid="true"
    :snap-grid="[22, 22]"
    :min-zoom="0.2"
    :max-zoom="1.8"
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
    <Controls />
    <template #node-service="{ data }">
      <ServiceGraphNode
        :data="data"
        @toggle-endpoints="emit('toggleServiceEndpoints', $event)"
        @open-endpoint="emit('openServiceEndpoint', $event)"
      />
    </template>
    <template #node-mockApiTrigger="{ data }">
      <MockApiTriggerNode
        :data="data"
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
      <MessageQueueNode :data="data" />
    </template>
  </VueFlow>
</template>
