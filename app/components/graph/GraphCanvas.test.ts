// @vitest-environment happy-dom
import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";
import type { Edge, Node } from "@vue-flow/core";
import GraphCanvas from "./GraphCanvas.vue";

const VueFlowStub = defineComponent({
  props: ["nodes", "edges", "selectNodesOnDrag", "elementsSelectable", "minZoom", "maxZoom"],
  emits: ["update:nodes", "update:edges", "connect", "node-click", "move-end", "node-drag-stop"],
  template: `
    <div data-testid="vue-flow">
      <slot name="node-service" :data="{ name: 'Orders' }" />
      <slot name="node-mockApis" :data="{ entries: [], collapsed: false, runningMockId: null }" />
      <button data-testid="connect" @click="$emit('connect', { source: 'service-1', target: 'service-2' })" />
      <button data-testid="node-click" @click="$emit('node-click', { node: { id: 'service-1' } })" />
      <button data-testid="move-end" @click="$emit('move-end', { event: {}, flowTransform: { x: 8, y: 9, zoom: 1.5 } })" />
      <button data-testid="drag-stop" @click="$emit('node-drag-stop')" />
    </div>
  `,
});

const ServiceNodeStub = defineComponent({
  props: ["data"],
  template: "<div data-testid='service-node'>{{ data.name }}</div>",
});
const MockNodeStub = defineComponent({
  props: ["entries", "collapsed", "runningMockId"],
  template: "<div data-testid='mock-node'>Mock API node</div>",
});

describe("GraphCanvas", () => {
  it("renders service and mock API node slots with Vue Flow", () => {
    const wrapper = mount(GraphCanvas, {
      props: { nodes: [] as Node[], edges: [] as Edge[], dark: true },
      global: {
        stubs: {
          VueFlow: VueFlowStub,
          Background: true,
          MiniMap: true,
          Controls: true,
          ServiceGraphNode: ServiceNodeStub,
          MockApiGraphNode: MockNodeStub,
        },
      },
    });

    expect(wrapper.get('[data-testid="vue-flow"]').element).toBeTruthy();
    expect(wrapper.get('[data-testid="service-node"]').text()).toBe("Orders");
    expect(wrapper.get('[data-testid="mock-node"]').element).toBeTruthy();
  });

  it("forwards Vue Flow connection, selection, viewport, and drag events", async () => {
    const wrapper = mount(GraphCanvas, {
      props: { nodes: [] as Node[], edges: [] as Edge[], dark: false },
      global: {
        stubs: {
          VueFlow: VueFlowStub,
          Background: true,
          MiniMap: true,
          Controls: true,
          ServiceGraphNode: ServiceNodeStub,
          MockApiGraphNode: MockNodeStub,
        },
      },
    });

    await wrapper.get('[data-testid="connect"]').trigger("click");
    await wrapper.get('[data-testid="node-click"]').trigger("click");
    await wrapper.get('[data-testid="move-end"]').trigger("click");
    await wrapper.get('[data-testid="drag-stop"]').trigger("click");

    expect(wrapper.emitted("connect")).toEqual([[{ source: "service-1", target: "service-2" }]]);
    expect(wrapper.emitted("nodeClick")).toEqual([[{ node: { id: "service-1" } }]]);
    expect(wrapper.emitted("moveEnd")).toEqual([[{ x: 8, y: 9, zoom: 1.5 }]]);
    expect(wrapper.emitted("nodeDragStop")).toEqual([[]]);
  });
});
