<script setup lang="ts">
import { ref } from "vue";
import type { MockApiCallHistoryEntry } from "#shared/api/mock-api-call-history";
import { WorkspaceDrawer } from "../shared/ui";

defineProps<{
  open: boolean;
  entries: MockApiCallHistoryEntry[];
  loading: boolean;
  replaying: boolean;
}>();
const emit = defineEmits<{
  "update:open": [value: boolean];
  removeEntry: [id: string];
  clearHistory: [];
  replayEntry: [entry: MockApiCallHistoryEntry];
  stopReplay: [];
}>();
const expandedEntryId = ref<string | null>(null);

function formatTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatJson(value: unknown) {
  if (value === null) return "No body";
  try {
    return JSON.stringify(value, null, 2) ?? "Unable to format JSON";
  } catch {
    return "Unable to format JSON";
  }
}

function formatResponse(value: string | null) {
  if (!value) return "No response body";
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function toggleEntry(id: string) {
  expandedEntryId.value = expandedEntryId.value === id ? null : id;
}
</script>

<template>
  <WorkspaceDrawer
    :open="open"
    :content="{ 'aria-label': 'Mock API call history' }"
    @update:open="emit('update:open', $event)"
  >
    <template #title>Run history</template>
    <template #description
      >Replaying highlights the graph from the run's observed telemetry</template
    >
    <template #actions>
      <UButton
        v-if="entries.length"
        type="button"
        color="neutral"
        variant="ghost"
        class="rounded-lg px-2 py-1 text-xs text-[var(--danger)] hover:bg-[var(--danger-soft)]"
        @click="emit('clearHistory')"
      >
        Clear all
      </UButton>
    </template>
    <template #body>
      <output v-if="loading" class="block p-4 text-sm text-[var(--muted)]">
        Loading call history...
      </output>
      <div v-else-if="entries.length === 0" class="p-4 text-sm text-[var(--muted)]">
        No mock API calls recorded yet.
      </div>
      <ol v-else class="flex-1 overflow-hidden rounded-[9px] border border-[var(--border)]">
        <li
          v-for="entry in entries"
          :key="entry.id"
          class="border-b border-[var(--border)] last:border-b-0"
        >
          <article class="bg-[var(--panel)]">
            <button
              type="button"
              class="block w-full p-3 text-left"
              :aria-expanded="expandedEntryId === entry.id"
              @click="toggleEntry(entry.id)"
            >
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <h3 class="truncate text-[12.5px] font-semibold">{{ entry.mockApiName }}</h3>
                  <time
                    class="block truncate font-mono text-[11.5px] text-[var(--muted)]"
                    :datetime="entry.triggeredAt"
                  >
                    {{ formatTime(entry.triggeredAt) }}
                  </time>
                </div>
                <span
                  class="shrink-0 rounded-full bg-[var(--panel2)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide"
                  :class="{
                    'app__run-state--completed': entry.status === 'completed',
                    'app__run-state--failed': entry.status === 'failed',
                  }"
                >
                  {{ entry.status }}
                </span>
              </div>
              <div class="mt-2 flex min-w-0 items-center gap-2">
                <span
                  class="shrink-0 rounded bg-[var(--panel2)] px-1.5 py-1 font-mono text-[10px] font-semibold"
                >
                  {{ entry.method }}
                </span>
                <span class="truncate font-mono text-xs text-[var(--muted)]">{{ entry.url }}</span>
              </div>
              <span class="mt-2 block truncate font-mono text-[10px] text-[var(--muted)]"
                >Trace {{ entry.traceId.slice(0, 8) }}</span
              >
            </button>
            <div class="px-3 pb-2">
              <UButton
                type="button"
                color="neutral"
                variant="ghost"
                class="rounded-lg px-2 py-1 text-xs text-[var(--accent)] hover:bg-[var(--panel2)]"
                :disabled="entry.status === 'running'"
                @click.stop="emit('replayEntry', entry)"
              >
                Replay
              </UButton>
            </div>
            <div
              v-if="expandedEntryId === entry.id"
              class="space-y-3 border-t border-[var(--border)] p-3"
            >
              <section aria-label="Saved request">
                <h4 class="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Request body
                </h4>
                <pre
                  class="max-h-48 overflow-auto rounded-lg bg-[var(--panel2)] p-2 font-mono text-xs"
                  >{{ formatJson(entry.requestBody) }}</pre>
              </section>
              <section aria-label="Saved response">
                <h4 class="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Response
                </h4>
                <p class="mb-2 text-xs text-[var(--muted)]">
                  {{
                    entry.grpcStatusName
                      ? `gRPC ${entry.grpcStatusName}`
                      : entry.responseStatus === null
                        ? "No HTTP status"
                        : `HTTP ${entry.responseStatus}`
                  }}
                </p>
                <pre
                  class="max-h-48 overflow-auto rounded-lg bg-[var(--panel2)] p-2 font-mono text-xs"
                  >{{ formatResponse(entry.responseBody) }}</pre>
                <p v-if="entry.error" class="mt-2 text-xs text-[var(--danger)]">
                  {{ entry.error }}
                </p>
              </section>
              <UButton
                type="button"
                color="neutral"
                variant="ghost"
                class="rounded-lg px-2 py-1 text-xs text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                @click="emit('removeEntry', entry.id)"
              >
                Remove from history
              </UButton>
            </div>
          </article>
        </li>
      </ol>
    </template>
  </WorkspaceDrawer>
  <UButton
    v-if="open && replaying"
    type="button"
    color="neutral"
    variant="solid"
    class="app__surface absolute right-6 top-[92px] z-50 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold"
    aria-label="Stop replay and restore history"
    @click="emit('stopReplay')"
  >
    <UIcon name="i-lucide-panel-right-open" class="size-4" aria-hidden="true" />
    Stop replay
  </UButton>
</template>
