// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";
import { Position, getSmoothStepPath, type EdgeProps } from "@vue-flow/core";
import SquareEdge from "../ui/SquareEdge.vue";

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
  it("renders a square step path and places the label near its outbound connection", () => {
    const wrapper = mount(SquareEdge, {
      props,
      global: {
        stubs: {
          BaseEdge: {
            name: "BaseEdge",
            props: ["id", "path", "style"],
            template: '<div data-testid="base-edge" />',
          },
          EdgeLabelRenderer: { template: "<div><slot /></div>" },
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

    expect(wrapper.get(".app__edge-label").text()).toBe("275 ms");
    expect(baseEdge.props("path")).toBe(expectedPath[0]);
    expect(wrapper.get(".app__edge-label-wrap").attributes("style")).toContain(
      `left: ${props.sourceX + 48}px`,
    );
    expect(wrapper.get(".app__edge-label-wrap").attributes("style")).toContain(
      `top: ${props.sourceY}px`,
    );
  });

  it.each([
    {
      direction: "source",
      toLevel: 2,
      x1: "100",
      y1: "80",
      x2: "400",
      y2: "180",
      startColor: "var(--accent)",
      endColor: "color-mix(in srgb, var(--accent) 58%, var(--panel))",
    },
    {
      direction: "target",
      toLevel: 2,
      x1: "400",
      y1: "180",
      x2: "100",
      y2: "80",
      startColor: "var(--accent)",
      endColor: "color-mix(in srgb, var(--accent) 58%, var(--panel))",
    },
    {
      direction: "source",
      toLevel: 3,
      x1: "100",
      y1: "80",
      x2: "400",
      y2: "180",
      startColor: "color-mix(in srgb, var(--accent) 58%, var(--panel))",
      endColor: "color-mix(in srgb, var(--accent) 38%, var(--panel))",
    },
  ] as const)(
    "fades a connection from its lower-level endpoint ($direction) toward level $toLevel",
    ({ direction, toLevel, startColor, endColor, ...coords }) => {
      const wrapper = mount(SquareEdge, {
        props: {
          ...props,
          data: { relationshipGradient: { from: direction, toLevel } },
        },
        global: {
          stubs: {
            BaseEdge: {
              name: "BaseEdge",
              props: ["id", "path", "style"],
              template: '<div data-testid="base-edge" />',
            },
            EdgeLabelRenderer: { template: "<div><slot /></div>" },
          },
        },
      });
      const gradient = wrapper.get("linearGradient");
      const baseEdge = wrapper.getComponent({ name: "BaseEdge" });
      const stops = gradient.findAll("stop");

      expect(gradient.attributes()).toMatchObject({
        x1: coords.x1,
        y1: coords.y1,
        x2: coords.x2,
        y2: coords.y2,
      });
      expect(stops).toHaveLength(2);
      expect(stops[0]?.attributes("stop-color")).toBe(startColor);
      expect(stops[1]?.attributes("stop-color")).toBe(endColor);
      expect(baseEdge.props("style")).toEqual({
        stroke: "url(#relationship-gradient-edge-0)",
      });
    },
  );

  it("removes the relationship gradient when the edge is reset", async () => {
    const wrapper = mount(SquareEdge, {
      props: {
        ...props,
        data: { relationshipGradient: { from: "source", toLevel: 2 } },
      },
      global: {
        stubs: {
          BaseEdge: {
            name: "BaseEdge",
            props: ["id", "path", "style"],
            template: '<div data-testid="base-edge" />',
          },
          EdgeLabelRenderer: { template: "<div><slot /></div>" },
        },
      },
    });
    const baseEdge = wrapper.getComponent({ name: "BaseEdge" });
    expect(baseEdge.props("style")).toEqual({ stroke: "url(#relationship-gradient-edge-0)" });

    await wrapper.setProps({ data: {} } as never);

    expect(wrapper.find("linearGradient").exists()).toBe(false);
    expect(baseEdge.props("style")).toBeUndefined();
  });
});
