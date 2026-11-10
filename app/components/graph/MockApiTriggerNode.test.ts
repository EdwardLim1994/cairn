// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";
import type { GraphMockApi } from "../../models/graph";
import MockApiTriggerNode from "./MockApiTriggerNode.vue";

const entry: GraphMockApi = {
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

const data = {
  id: "mock-1",
  name: "List orders",
  active: true,
  ready: true,
  running: false,
  busy: false,
  entry,
};

const websocketData = {
  ...data,
  entry: { ...entry, apiType: "WEBSOCKET" as const, requestJson: "hello" },
  websocketState: "disconnected" as const,
  responseOpen: false,
  unread: false,
  messages: [],
};

describe("MockApiTriggerNode", () => {
  it("shows the API name and emits its identity when triggered", async () => {
    const wrapper = mount(MockApiTriggerNode, {
      props: { data },
      global: { stubs: { Handle: true, UIcon: true } },
    });

    expect(wrapper.text()).toContain("List orders");
    expect(wrapper.text()).not.toContain("Trigger");
    expect(wrapper.get('[aria-label="Trigger List orders"]').attributes("aria-label")).toBe(
      "Trigger List orders",
    );
    await wrapper.get('[aria-label="Trigger List orders"]').trigger("click");

    expect(wrapper.emitted("trigger")).toEqual([["mock-1"]]);
  });

  it("emits its identity from the edit action without triggering the API", async () => {
    const wrapper = mount(MockApiTriggerNode, {
      props: { data },
      global: { stubs: { Handle: true, UIcon: true } },
    });

    await wrapper.get('[aria-label="Edit List orders"]').trigger("click");

    expect(wrapper.emitted("edit")).toEqual([["mock-1"]]);
    expect(wrapper.emitted("trigger")).toBeUndefined();
  });

  it("does not emit a trigger while inactive or while another API is running", async () => {
    const wrapper = mount(MockApiTriggerNode, {
      props: {
        data: { ...data, active: false },
      },
      global: { stubs: { Handle: true, UIcon: true } },
    });
    const inactiveButton = wrapper.get('[aria-label="Trigger List orders"]');
    expect(inactiveButton.attributes("disabled")).toBeDefined();
    await inactiveButton.trigger("click");

    const busyWrapper = mount(MockApiTriggerNode, {
      props: { data: { ...data, busy: true } },
      global: { stubs: { Handle: true, UIcon: true } },
    });
    const busyButton = busyWrapper.get('[aria-label="Trigger List orders"]');
    expect(busyButton.attributes("disabled")).toBeDefined();
    await busyButton.trigger("click");

    expect(wrapper.emitted("trigger")).toBeUndefined();
    expect(busyWrapper.emitted("trigger")).toBeUndefined();
  });

  it("requires a connection before triggering and emits connection actions", async () => {
    const wrapper = mount(MockApiTriggerNode, {
      props: { data: websocketData },
      global: { stubs: { Handle: true, UIcon: true } },
    });
    expect(wrapper.get('[aria-label="Trigger List orders"]').attributes("disabled")).toBeDefined();
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("Connect"))!
      .trigger("click");
    expect(wrapper.emitted("connect")).toEqual([["mock-1"]]);

    const connectedWrapper = mount(MockApiTriggerNode, {
      props: { data: { ...websocketData, websocketState: "connected" } },
      global: { stubs: { Handle: true, UIcon: true } },
    });
    expect(
      connectedWrapper.get('[aria-label="Trigger List orders"]').attributes("disabled"),
    ).toBeUndefined();
    await connectedWrapper
      .findAll("button")
      .find((button) => button.text().includes("Disconnect"))!
      .trigger("click");
    await connectedWrapper.get('[aria-label="Trigger List orders"]').trigger("click");
    expect(connectedWrapper.emitted("disconnect")).toEqual([["mock-1"]]);
    expect(connectedWrapper.emitted("trigger")).toEqual([["mock-1"]]);
  });

  it("shows incoming responses and the unread indicator", () => {
    const wrapper = mount(MockApiTriggerNode, {
      props: {
        data: {
          ...websocketData,
          responseOpen: true,
          unread: true,
          messages: [{ id: 1, data: "connected", receivedAt: "now" }],
        },
      },
      global: { stubs: { Handle: true, UIcon: true } },
    });
    expect(wrapper.text()).toContain("Latest response");
    expect(wrapper.text()).toContain("connected");
    expect(wrapper.find('[aria-label="New response"]').exists()).toBe(true);
  });

  it("shows the latest HTTP response in a panel beside the node", async () => {
    const wrapper = mount(MockApiTriggerNode, {
      props: {
        data: {
          ...data,
          responseOpen: true,
          latestResponse: {
            status: "completed",
            responseStatus: 200,
            responseBody: '{"ok":true}',
            error: null,
            traceId: "trace-1",
          },
        },
      },
      global: { stubs: { Handle: true, UIcon: true } },
    });
    expect(wrapper.text()).toContain("Latest response");
    expect(wrapper.text()).toContain('"ok": true');
    expect(wrapper.find("aside").classes()).toContain("right-full");
    expect(wrapper.find("aside").classes()).toContain("app__mock-response-panel");
    await wrapper.get('[aria-label="Hide latest response"]').trigger("click");
    expect(wrapper.emitted("toggleResponse")).toEqual([["mock-1"]]);
  });
});
