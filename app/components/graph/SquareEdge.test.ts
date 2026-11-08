// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";
import { Position, getSmoothStepPath, type EdgeProps } from "@vue-flow/core";
import SquareEdge from "./SquareEdge.vue";

const props = {
  id: "edge-0",
  source: "orders",
  target: "inventory",
  type: "default",
  sourceX: 100,
  sourceY: 80,
  sourcePosition: Position.Right,
  targetX: 400,
  targetY: 180,
  targetPosition: Position.Left,
  sourceNode: {} as EdgeProps["sourceNode"],
  targetNode: {} as EdgeProps["targetNode"],
  data: {},
  events: {},
  markerStart: "",
  markerEnd: "",
  label: "275 ms",
};

describe("SquareEdge", () => {
  it("renders a square step path and lifts the label above it", () => {
    const wrapper = mount(SquareEdge, {
      props,
      global: {
        stubs: {
          BaseEdge: {
            name: "BaseEdge",
            props: ["id", "path", "label", "labelX", "labelY", "labelStyle", "labelBgStyle"],
            template: '<div data-testid="base-edge">{{ label }}</div>',
          },
        },
      },
    });
    const baseEdge = wrapper.getComponent({ name: "BaseEdge" });
    const expectedPath = getSmoothStepPath({
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      sourcePosition: props.sourcePosition,
      targetX: props.targetX,
      targetY: props.targetY,
      targetPosition: props.targetPosition,
      borderRadius: 0,
    });

    expect(wrapper.get('[data-testid="base-edge"]').text()).toBe("275 ms");
    expect(baseEdge.props("path")).toBe(expectedPath[0]);
    expect(baseEdge.props("labelX")).toBe(props.sourceX + 32);
    expect(baseEdge.props("labelY")).toBe(props.sourceY - 12);
    expect(baseEdge.props("labelX")).toBeLessThan(expectedPath[1]);
    expect(baseEdge.props("labelBgStyle")).toEqual({ fill: "var(--panel)", fillOpacity: 0.95 });
  });
});
