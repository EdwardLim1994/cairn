// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";
import { defineComponent, h } from "vue";
import type { MockApiCallHistoryEntry } from "#shared/api/mock-api-call-history";
import MockApiCallHistoryPanel from "../MockApiCallHistoryPanel.vue";

const components = {
  USlideover: defineComponent({
    props: { content: Object, ui: Object },
    setup(props, { slots }) {
      return () =>
        h("aside", { ...props.content, class: props.ui?.content }, [
          h("header", [...(slots.header?.() ?? [])]),
          ...(slots.body?.() ?? []),
        ]);
    },
  }),
  UButton: defineComponent({
    inheritAttrs: false,
    props: { type: String },
    setup(props, { attrs, slots }) {
      return () => h("button", { ...attrs, type: props.type ?? "button" }, slots.default?.());
    },
  }),
  UIcon: defineComponent({
    setup: () => () => h("span", { "aria-hidden": "true" }),
  }),
};

const entry: MockApiCallHistoryEntry = {
  id: "history-1",
  projectId: "project-1",
  runId: "run-1",
  mockApiId: "mock-1",
  mockApiName: "Create order",
  method: "POST",
  url: "http://orders.test/orders/42",
  requestBody: { id: 42 },
  traceId: "a".repeat(32),
  status: "completed",
  triggeredAt: "2026-11-02T08:00:00.000Z",
  responseStatus: 201,
  responseHeaders: {},
  responseBody: "created",
  error: null,
};

describe("MockApiCallHistoryPanel", () => {
  it("renders newest-first history card fields and closes on request", async () => {
    const wrapper = mount(MockApiCallHistoryPanel, {
      props: { open: true, entries: [entry], loading: false, replaying: false },
      global: { components, stubs: { DialogTitle: true, DialogDescription: true } },
    });
    expect(wrapper.get("aside").attributes("aria-label")).toBe("Mock API call history");
    expect(wrapper.text()).toContain("Create order");
    expect(wrapper.text()).toContain("POST");
    expect(wrapper.text()).toContain("http://orders.test/orders/42");
    expect(wrapper.text()).toContain("completed");
    const replayButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("Replay"));
    await replayButton!.trigger("click");
    expect(wrapper.emitted("replayEntry")).toEqual([[entry]]);
    expect(wrapper.find("time").attributes("datetime")).toBe(entry.triggeredAt);
    await wrapper.get('button[aria-expanded="false"]').trigger("click");
    expect(wrapper.text()).toContain("Request body");
    expect(wrapper.text()).toContain('"id": 42');
    expect(wrapper.text()).toContain("HTTP 201");
    expect(wrapper.text()).toContain("created");
    const removeButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("Remove from history"));
    await removeButton!.trigger("click");
    expect(wrapper.emitted("removeEntry")).toEqual([["history-1"]]);
    await wrapper.get('[aria-label="Close panel"]').trigger("click");
    expect(wrapper.emitted("update:open")).toEqual([[false]]);
  });

  it("shows loading and empty states", () => {
    const wrapper = mount(MockApiCallHistoryPanel, {
      props: { open: true, entries: [], loading: true, replaying: false },
      global: { components, stubs: { DialogTitle: true, DialogDescription: true } },
    });
    expect(wrapper.text()).toContain("Loading call history...");
    const empty = mount(MockApiCallHistoryPanel, {
      props: { open: true, entries: [], loading: false, replaying: false },
      global: { components, stubs: { DialogTitle: true, DialogDescription: true } },
    });
    expect(empty.text()).toContain("No mock API calls recorded yet.");
  });

  it("emits a clear-all intent while entries exist", async () => {
    const wrapper = mount(MockApiCallHistoryPanel, {
      props: { open: true, entries: [entry], loading: false, replaying: false },
      global: { components, stubs: { DialogTitle: true, DialogDescription: true } },
    });
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("clearHistory")).toEqual([[]]);
  });

  it("keeps the shared drawer layout during replay and can stop replay", async () => {
    const wrapper = mount(MockApiCallHistoryPanel, {
      props: { open: true, entries: [entry], loading: false, replaying: true },
      global: { components, stubs: { DialogTitle: true, DialogDescription: true } },
    });
    expect(wrapper.get("aside").classes()).not.toContain("translate-x-[80%]");
    await wrapper.get('[aria-label="Stop replay and restore history"]').trigger("click");
    expect(wrapper.emitted("stopReplay")).toEqual([[]]);
  });
});
