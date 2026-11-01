<script setup lang="ts">
import { computed } from "vue";
import { VueFlow, useVueFlow, type Connection, type Edge, type Node } from "@vue-flow/core";
import { Background, BackgroundVariant } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import { MiniMap } from "@vue-flow/minimap";
import MockApiGraphNode, { type MockApiGraphEntry } from "./MockApiGraphNode.vue";
import ServiceGraphNode from "./ServiceGraphNode.vue";

const props = defineProps<{ nodes: Node[]; edges: Edge[]; dark: boolean }>();
const emit = defineEmits<{
  "update:nodes": [nodes: Node[]];
  "update:edges": [edges: Edge[]];
  connect: [connection: Connection];
  nodeClick: [event: { node: { id: string } }];
  paneContextMenu: [event: MouseEvent];
  moveEnd: [viewport: { x: number; y: number; zoom: number }];
  nodeDragStop: [];
  toggleServiceEndpoints: [serviceId: string];
  openServiceEndpoint: [endpointId: string | undefined];
  toggleMockConnections: [];
  openMockApi: [id: string];
  runMockApi: [entry: MockApiGraphEntry];
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

defineExpose({ fitView, screenToFlowCoordinate, setViewport, updateNodeInternals });
</script>

<template>
  <VueFlow
    v-model:nodes="modelNodes"
    v-model:edges="modelEdges"
    class="app__graph-flow"
    :select-nodes-on-drag="false"
    :elements-selectable="true"
    :min-zoom="0.2"
    :max-zoom="1.8"
    fit-view-on-init
    @connect="emit('connect', $event)"
    @node-click="emit('nodeClick', $event)"
    @pane-context-menu="emit('paneContextMenu', $event)"
    @move-end="emit('moveEnd', $event.flowTransform)"
    @node-drag-stop="emit('nodeDragStop')"
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
      <ServiceGraphNode
        :data="data"
        @toggle-endpoints="emit('toggleServiceEndpoints', $event)"
        @open-endpoint="emit('openServiceEndpoint', $event)"
      />
    </template>
    <template #node-mockApis="{ data }">
      <MockApiGraphNode
        :entries="data.entries"
        :collapsed="data.collapsed"
        :running-mock-id="data.runningMockId"
        @toggle-connections="emit('toggleMockConnections')"
        @open="emit('openMockApi', $event)"
        @run="emit('runMockApi', $event)"
      />
    </template>
  </VueFlow>
</template>
