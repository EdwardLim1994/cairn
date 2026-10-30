import { beforeEach, describe, expect, it } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { createApiClient, type ApiTransportOptions } from "../models/api-client";
import { useObservabilityStore } from "../stores/observability";
import { useObservabilityViewModel } from "./useObservabilityViewModel";

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

describe("observability view model", () => {
  beforeEach(() => setActivePinia(createPinia()));

  function setup(fail = false) {
    const store = useObservabilityStore();
    const requests: unknown[] = [];
    const apiClient = createApiClient(async (_url: string, options: ApiTransportOptions) => {
      requests.push(options.query);
      if (fail) throw new Error("offline");
      return [log];
    });
    return { store, requests, vm: useObservabilityViewModel({ store, apiClient }) };
  }

  it("loads logs with normalized search and active multi-select filters", async () => {
    const context = setup();
    context.store.setSearch("  order  ");
    context.store.setLogService(["Orders", "Inventory"]);
    context.store.setLogSeverity(["ERROR"]);
    await context.vm.loadLogs();
    expect(context.store.logs).toEqual([log]);
    expect(context.requests).toEqual([
      { search: "order", service: ["Orders", "Inventory"], severity: ["ERROR"] },
    ]);
  });

  it("toggles and clears service and severity filters and updates search", () => {
    const context = setup();
    context.vm.toggleLogService("Orders");
    context.vm.toggleLogService("Orders");
    context.vm.toggleLogSeverity("ERROR");
    context.vm.clearLogService();
    context.vm.clearLogSeverity();
    context.vm.setSearch("payment");
    expect(context.store.logService).toEqual([]);
    expect(context.store.logSeverity).toEqual([]);
    expect(context.store.logSearch).toBe("payment");
  });

  it("loads logs when opening the panel and preserves existing logs on failure", async () => {
    const context = setup(true);
    context.store.setLogs([log]);
    context.vm.setOpen(true);
    await Promise.resolve();
    expect(context.store.logsOpen).toBe(true);
    expect(context.store.logs).toEqual([log]);
    context.vm.setOpen(false);
    expect(context.store.logsOpen).toBe(false);
  });

  it("resizes the logs panel with pointer and keyboard bounds", () => {
    const context = setup();
    context.vm.resizePanel(400, 280, 340, 800);
    expect(context.store.logsPanelHeight).toBe(340);
    context.vm.resizePanel(400, 280, -1000, 500);
    expect(context.store.logsPanelHeight).toBe(468);
    context.vm.adjustPanelHeight(-400, 500);
    expect(context.store.logsPanelHeight).toBe(200);
    context.vm.adjustPanelHeight(500, 500);
    expect(context.store.logsPanelHeight).toBe(468);
  });

  it("formats log timestamps for display", () => {
    const context = setup();
    expect(context.vm.formatTime("2025-01-01T12:34:56.000Z")).toBe(
      new Date("2025-01-01T12:34:56.000Z").toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    );
  });
});
