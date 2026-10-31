// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";
import MockApiGraphNode from "./MockApiGraphNode.vue";

const entry = {
  id: "mock-1",
  name: "List orders",
  targetEndpointId: "endpoint-1",
  description: "",
  requestJson: {},
  pathParameters: {},
  endpoint: { method: "GET", url: "/orders" },
  status: "ready" as const,
  readinessStatus: "ready" as const,
  active: true,
  running: false,
};

describe("MockApiGraphNode", () => {
  it("renders mock APIs and their endpoint method", () => {
    const wrapper = mount(MockApiGraphNode, {
      props: { entries: [entry], collapsed: false, runningMockId: null },
      global: { stubs: { Handle: true } },
    });

    expect(wrapper.text()).toContain("List orders");
    expect(wrapper.text()).toContain("GET");
    expect(wrapper.text()).toContain("/orders");
  });

  it("emits run, open, and collapse actions", async () => {
    const wrapper = mount(MockApiGraphNode, {
      props: { entries: [entry], collapsed: false, runningMockId: null },
      global: { stubs: { Handle: true } },
    });

    await wrapper.get(".app__run-button").trigger("click");
    await wrapper.get(".app__mock-endpoint-link").trigger("click");
    await wrapper.get(".app__collapse-connections").trigger("click");

    expect(wrapper.emitted("run")?.[0]?.[0]).toMatchObject(entry);
    expect(wrapper.emitted("open")).toEqual([["mock-1"]]);
    expect(wrapper.emitted("toggleConnections")).toEqual([[]]);
  });

  it("disables trigger buttons for inactive and draft APIs", () => {
    const wrapper = mount(MockApiGraphNode, {
      props: {
        entries: [
          { ...entry, active: false, readinessStatus: "inactive" },
          { ...entry, id: "draft", active: false, readinessStatus: "draft" },
        ],
        collapsed: false,
        runningMockId: null,
      },
      global: { stubs: { Handle: true } },
    });
    expect(
      wrapper
        .findAll(".app__run-button")
        .every((button) => button.attributes("disabled") !== undefined),
    ).toBe(true);
  });
});
