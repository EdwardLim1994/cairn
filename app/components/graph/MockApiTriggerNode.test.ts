// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";
import type { GraphMockApi } from "../../models/graph";
import MockApiTriggerNode from "./MockApiTriggerNode.vue";

const entry: GraphMockApi = {
  id: "mock-1",
  projectId: "project-1",
  name: "List orders",
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

const data = {
  id: "mock-1",
  name: "List orders",
  active: true,
  ready: true,
  running: false,
  busy: false,
  entry,
};

describe("MockApiTriggerNode", () => {
  it("shows the API name and emits its identity when triggered", async () => {
    const wrapper = mount(MockApiTriggerNode, {
      props: { data },
      global: { stubs: { Handle: true, UIcon: true } },
    });

    expect(wrapper.text()).toContain("List orders");
    expect(wrapper.text()).not.toContain("Trigger");
    expect(wrapper.get("button").attributes("aria-label")).toBe("Trigger List orders");
    await wrapper.get('[aria-label="Trigger List orders"]').trigger("click");

    expect(wrapper.emitted("trigger")).toEqual([["mock-1"]]);
  });

  it("does not emit a trigger while inactive or while another API is running", async () => {
    const wrapper = mount(MockApiTriggerNode, {
      props: {
        data: { ...data, active: false },
      },
      global: { stubs: { Handle: true, UIcon: true } },
    });
    const inactiveButton = wrapper.get("button");
    expect(inactiveButton.attributes("disabled")).toBeDefined();
    await inactiveButton.trigger("click");

    const busyWrapper = mount(MockApiTriggerNode, {
      props: { data: { ...data, busy: true } },
      global: { stubs: { Handle: true, UIcon: true } },
    });
    const busyButton = busyWrapper.get("button");
    expect(busyButton.attributes("disabled")).toBeDefined();
    await busyButton.trigger("click");

    expect(wrapper.emitted("trigger")).toBeUndefined();
    expect(busyWrapper.emitted("trigger")).toBeUndefined();
  });
});
