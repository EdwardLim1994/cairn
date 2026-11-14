import type { createApiClient } from "../shared/api";
import type { useObservabilityStore } from "../stores/observability";
import { getCurrentScope, onScopeDispose, watch } from "vue";

type Store = ReturnType<typeof useObservabilityStore>;

function formatTime(value: string) {
  return new Date(value).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function useObservabilityViewModel(options: {
  store: Store;
  apiClient: ReturnType<typeof createApiClient>;
}) {
  let logTimer: ReturnType<typeof setTimeout> | undefined;
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
  function setOpen(value: boolean) {
    options.store.setLogsOpen(value);
  }
  watch(
    () => options.store.logsOpen,
    (open) => {
      if (open) void loadLogs();
    },
    { flush: "sync" },
  );
  watch(
    () => [
      options.store.logSearch,
      options.store.logService.join("\0"),
      options.store.logSeverity.join("\0"),
    ],
    () => {
      if (!options.store.logsOpen) return;
      clearTimeout(logTimer);
      logTimer = setTimeout(loadLogs, 180);
    },
    { flush: "sync" },
  );
  if (getCurrentScope()) onScopeDispose(() => clearTimeout(logTimer));
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
