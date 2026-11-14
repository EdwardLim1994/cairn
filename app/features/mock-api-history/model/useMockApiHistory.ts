import { ref, watch, type Ref } from "vue";
import type { MockApiCallHistoryEntry } from "#shared/api/mock-api-call-history";
import type { createApiClient } from "../../../shared/api";

export function useMockApiHistory(options: {
  open: Ref<boolean>;
  apiClient: ReturnType<typeof createApiClient>;
  replay: (entry: MockApiCallHistoryEntry) => Promise<void>;
  stopReplay: () => void;
  clearObservations: () => void;
  onError: (message: string) => void;
}) {
  const entries = ref<MockApiCallHistoryEntry[]>([]);
  const loading = ref(false);
  const replayEntryId = ref<string | null>(null);

  async function load() {
    loading.value = true;
    try {
      entries.value = await options.apiClient.listMockApiCallHistory();
    } catch (cause) {
      options.onError(cause instanceof Error ? cause.message : "Could not load call history");
    } finally {
      loading.value = false;
    }
  }

  async function removeEntry(id: string) {
    try {
      await options.apiClient.deleteMockApiCallHistory(id);
      entries.value = entries.value.filter((entry) => entry.id !== id);
    } catch (cause) {
      options.onError(cause instanceof Error ? cause.message : "Could not remove call history");
    }
  }

  async function clear() {
    try {
      await options.apiClient.clearMockApiCallHistory();
      entries.value = [];
    } catch (cause) {
      options.onError(cause instanceof Error ? cause.message : "Could not clear call history");
    }
  }

  async function replayEntry(entry: MockApiCallHistoryEntry) {
    replayEntryId.value = entry.id;
    try {
      await options.replay(entry);
    } catch (cause) {
      replayEntryId.value = null;
      options.onError(cause instanceof Error ? cause.message : "Could not replay saved trace");
    }
  }

  function stop() {
    options.stopReplay();
    replayEntryId.value = null;
    options.clearObservations();
  }

  watch(options.open, (open) => {
    if (open) void load();
  });

  return { entries, loading, replayEntryId, load, removeEntry, clear, replayEntry, stop };
}
