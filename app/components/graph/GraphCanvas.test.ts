// @vitest-environment happy-dom
import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";
import type { Edge, Node } from "@vue-flow/core";
import type { GraphMockApi } from "../../models/graph";
import GraphCanvas from "./GraphCanvas.vue";

const mockApi: GraphMockApi = {
  id: "mock-1",
  projectId: "project-1",
  name: "List orders",
  apiType: "HTTP",
  targetEndpointId: "endpoint-1",
  headerTemplateId: null,
  customHeaders: [],
  active: true,
  status: "ready",
  readinessReasons: [],
  importMethod: null,
  importUrl: null,
  matchUrl: null,
  pathParameters: {},
  requestJson: {},
  description: "",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const VueFlowStub = defineComponent({
  props: [
    "nodes",
    "edges",
    "nodesDraggable",
    "snapToGrid",
    "snapGrid",
    "selectNodesOnDrag",
    "elementsSelectable",
    "minZoom",
    "maxZoom",
  ],
  emits: [
    "update:nodes",
    "update:edges",
    "connect",
    "edge-double-click",
    "node-click",
    "move-end",
    "node-drag-stop",
  ],
  template: `
    <div data-testid="vue-flow">
      <slot name="node-service" :data="{ name: 'Orders' }" />
      <slot name="node-mockApiTrigger" :data="{ id: 'mock-1', entry: mockApi }" />
      <button data-testid="connect" @click="$emit('connect', { source: 'service-1', target: 'service-2' })" />
      <button data-testid="edge-double-click" @click="$emit('edge-double-click', { edge: { id: 'edge-1' } })" />
      <button data-testid="node-click" @click="$emit('node-click', { node: { id: 'service-1' } })" />
      <button data-testid="move-end" @click="$emit('move-end', { event: {}, flowTransform: { x: 8, y: 9, zoom: 1.5 } })" />
      <button data-testid="drag-stop" @click="$emit('node-drag-stop')" />
    </div>
  `,
  setup() {
    return { mockApi };
  },
});

const ServiceNodeStub = defineComponent({
  props: ["data"],
  template: "<div data-testid='service-node'>{{ data.name }}</div>",
});
const MockTriggerNodeStub = defineComponent({
  props: ["data"],
  emits: ["trigger"],
  template:
    "<div data-testid='mock-trigger-node'><button @click='$emit(\"trigger\", data.id)' /></div>",
});

describe("GraphCanvas", () => {
  it("renders service and mock API trigger node slots with Vue Flow", () => {
    const wrapper = mount(GraphCanvas, {
      props: { nodes: [] as Node[], edges: [] as Edge[], dark: true, nodesLocked: false },
      global: {
        stubs: {
          VueFlow: VueFlowStub,
          Background: true,
          MiniMap: true,
          Controls: true,
          ServiceGraphNode: ServiceNodeStub,
          MockApiTriggerNode: MockTriggerNodeStub,
        },
      },
    });

    expect(wrapper.get('[data-testid="vue-flow"]').element).toBeTruthy();
    expect(wrapper.get('[data-testid="service-node"]').text()).toBe("Orders");
    expect(wrapper.get('[data-testid="mock-trigger-node"]').element).toBeTruthy();
  });

  it("forwards a trigger intent with the saved mock API to the run handler", async () => {
    const wrapper = mount(GraphCanvas, {
      props: { nodes: [] as Node[], edges: [] as Edge[], dark: false, nodesLocked: true },
      global: {
        stubs: {
          VueFlow: VueFlowStub,
          Background: true,
          MiniMap: true,
          Controls: true,
          ServiceGraphNode: ServiceNodeStub,
          MockApiTriggerNode: MockTriggerNodeStub,
        },
      },
    });

    await wrapper.get('[data-testid="mock-trigger-node"] button').trigger("click");

    expect(wrapper.emitted("runMockApi")).toEqual([[mockApi]]);
  });

  it("forwards Vue Flow connection, selection, viewport, and drag events", async () => {
    const wrapper = mount(GraphCanvas, {
      props: { nodes: [] as Node[], edges: [] as Edge[], dark: false, nodesLocked: true },
      global: {
        stubs: {
          VueFlow: VueFlowStub,
          Background: true,
          MiniMap: true,
          Controls: true,
          ServiceGraphNode: ServiceNodeStub,
          MockApiTriggerNode: MockTriggerNodeStub,
        },
      },
    });

    await wrapper.get('[data-testid="connect"]').trigger("click");
    await wrapper.get('[data-testid="edge-double-click"]').trigger("click");
    await wrapper.get('[data-testid="node-click"]').trigger("click");
    await wrapper.get('[data-testid="move-end"]').trigger("click");
    await wrapper.get('[data-testid="drag-stop"]').trigger("click");

    expect(wrapper.emitted("connect")).toEqual([[{ source: "service-1", target: "service-2" }]]);
    expect(wrapper.emitted("edgeDoubleClick")).toEqual([[{ edge: { id: "edge-1" } }]]);
    expect(wrapper.emitted("nodeClick")).toEqual([[{ node: { id: "service-1" } }]]);
    expect(wrapper.getComponent(VueFlowStub).props("nodesDraggable")).toBe(false);
    expect(wrapper.getComponent(VueFlowStub).props("snapToGrid")).toBe(true);
    expect(wrapper.getComponent(VueFlowStub).props("snapGrid")).toEqual([22, 22]);
    expect(wrapper.emitted("moveEnd")).toEqual([[{ x: 8, y: 9, zoom: 1.5 }]]);
    expect(wrapper.emitted("nodeDragStop")).toEqual([[]]);
  });
});
