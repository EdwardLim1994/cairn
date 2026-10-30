import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { useObservabilityStore } from "./observability";

describe("observability store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("stores logs, panel state, height, and filters", () => {
    const store = useObservabilityStore();
    store.setLogs([]);
    store.setLogsOpen(true);
    store.setPanelHeight(400);
    store.setSearch("order");
    store.setLogService(["Orders"]);
    store.setLogSeverity(["ERROR"]);
    expect(store.logs).toEqual([]);
    expect(store.logsOpen).toBe(true);
    expect(store.logsPanelHeight).toBe(400);
    expect(store.logSearch).toBe("order");
    expect(store.logService).toEqual(["Orders"]);
    expect(store.logSeverity).toEqual(["ERROR"]);
  });

  it("toggles services and severity values on and off", () => {
    const store = useObservabilityStore();
    store.toggleLogService("Orders");
    store.toggleLogService("Payments");
    store.toggleLogService("Orders");
    store.toggleLogSeverity("ERROR");
    store.toggleLogSeverity("WARN");
    store.toggleLogSeverity("ERROR");
    expect(store.logService).toEqual(["Payments"]);
    expect(store.logSeverity).toEqual(["WARN"]);
  });
});
