// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";
import LogsPanel from "./LogsPanel.vue";

const log = {
  id: 1,
  projectId: "project-1",
  traceId: "trace-1",
  serviceName: "Orders",
  severity: "ERROR",
  timestamp: "2025-01-01T00:00:00.000Z",
  message: "Rejected order",
  attributes: {},
  receivedAt: "2025-01-01T00:00:00.000Z",
};

describe("LogsPanel", () => {
  it("renders log rows and opens from its toolbar button", async () => {
    const wrapper = mount(LogsPanel, {
      props: {
        open: false,
        search: "",
        serviceFilter: [],
        severityFilter: [],
        logs: [log],
        services: [{ name: "Orders" }],
        height: 280,
        formatTime: () => "12:00:00",
      },
    });
    await wrapper.get(".app__logs-toggle").trigger("click");
    expect(wrapper.emitted("update:open")).toEqual([[true]]);
    expect(wrapper.text()).toContain("Logs");
  });

  it("renders entries, filters, refresh, close, and adjustable resize controls", async () => {
    const wrapper = mount(LogsPanel, {
      props: {
        open: true,
        search: "",
        serviceFilter: [],
        severityFilter: [],
        logs: [log],
        services: [{ name: "Orders" }, { name: "Inventory" }],
        height: 320,
        formatTime: () => "12:00:00",
      },
    });
    expect(wrapper.text()).toContain("Rejected order");
    await wrapper.get('[aria-label="Filter by service"]').trigger("click");
    await wrapper
      .findAll("details")[0]!
      .get(".app__log-service-options button:nth-child(3)")
      .trigger("click");
    await wrapper.get('[aria-label="Filter by severity"]').trigger("click");
    await wrapper
      .findAll("details")[1]!
      .get(".app__log-service-options button:nth-child(2)")
      .trigger("click");
    await wrapper.get('[aria-label="Refresh logs"]').trigger("click");
    await wrapper.get('[aria-label="Resize logs panel"]').trigger("keydown", { key: "ArrowUp" });
    await wrapper.get('[aria-label="Close logs"]').trigger("click");

    expect(wrapper.emitted("update:serviceFilter")?.at(-1)?.[0]).toEqual(["Orders"]);
    expect(wrapper.emitted("update:severityFilter")?.at(-1)?.[0]).toEqual(["ERROR"]);
    expect(wrapper.emitted("refresh")).toEqual([[]]);
    expect(wrapper.emitted("adjustHeight")).toEqual([[24]]);
    expect(wrapper.emitted("update:open")?.at(-1)?.[0]).toBe(false);
  });
});
