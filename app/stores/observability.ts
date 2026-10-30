import { ref } from "vue";
import { defineStore } from "pinia";
import type { LogListResponse } from "#shared/api/observability";

export const useObservabilityStore = defineStore("observability", () => {
  const logs = ref<LogListResponse>([]);
  const logsOpen = ref(false);
  const logsPanelHeight = ref(280);
  const logSearch = ref("");
  const logService = ref<string[]>([]);
  const logSeverity = ref<string[]>([]);

  function setLogs(value: LogListResponse) {
    logs.value = value;
  }
  function setLogsOpen(value: boolean) {
    logsOpen.value = value;
  }
  function setPanelHeight(value: number) {
    logsPanelHeight.value = value;
  }
  function setSearch(value: string) {
    logSearch.value = value;
  }
  function setLogService(value: string[]) {
    logService.value = value;
  }
  function setLogSeverity(value: string[]) {
    logSeverity.value = value;
  }
  function toggleLogService(name: string) {
    logService.value = logService.value.includes(name)
      ? logService.value.filter((service) => service !== name)
      : [...logService.value, name];
  }
  function toggleLogSeverity(severity: string) {
    logSeverity.value = logSeverity.value.includes(severity)
      ? logSeverity.value.filter((level) => level !== severity)
      : [...logSeverity.value, severity];
  }

  return {
    logs,
    logsOpen,
    logsPanelHeight,
    logSearch,
    logService,
    logSeverity,
    setLogs,
    setLogsOpen,
    setPanelHeight,
    setSearch,
    setLogService,
    setLogSeverity,
    toggleLogService,
    toggleLogSeverity,
  };
});
