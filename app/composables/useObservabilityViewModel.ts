import type { createApiClient } from "../models/api-client";
import type { useObservabilityStore } from "../stores/observability";

type Store = ReturnType<typeof useObservabilityStore>;

export function useObservabilityViewModel(options: {
  store: Store;
  apiClient: ReturnType<typeof createApiClient>;
}) {
  async function loadLogs() {
    try {
      options.store.setLogs(
        await options.apiClient.listLogs({
          search: options.store.logSearch.trim() || undefined,
          service: options.store.logService,
          severity: options.store.logSeverity,
        }),
      );
    } catch {
      // Keep the visible logs when a refresh fails.
    }
  }

  function toggleLogService(name: string) {
    options.store.toggleLogService(name);
  }
  function toggleLogSeverity(severity: string) {
    options.store.toggleLogSeverity(severity);
  }
  function clearLogService() {
    options.store.setLogService([]);
  }
  function clearLogSeverity() {
    options.store.setLogSeverity([]);
  }
  function setSearch(value: string) {
    options.store.setSearch(value);
  }
  function formatTime(value: string) {
    return new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
  function setOpen(value: boolean) {
    options.store.setLogsOpen(value);
    if (value) void loadLogs();
  }
  function resizePanel(
    startY: number,
    startHeight: number,
    currentY: number,
    viewportHeight: number,
  ) {
    options.store.setPanelHeight(
      Math.max(160, Math.min(viewportHeight - 32, startHeight + startY - currentY)),
    );
  }
  function adjustPanelHeight(delta: number, viewportHeight: number) {
    options.store.setPanelHeight(
      Math.max(200, Math.min(viewportHeight - 32, options.store.logsPanelHeight + delta)),
    );
  }

  return {
    loadLogs,
    toggleLogService,
    toggleLogSeverity,
    clearLogService,
    clearLogSeverity,
    setSearch,
    formatTime,
    setOpen,
    resizePanel,
    adjustPanelHeight,
  };
}
