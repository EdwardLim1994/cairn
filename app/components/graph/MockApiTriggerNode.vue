<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";
import type { GraphMockApi } from "../../models/graph";

export type MockApiTriggerNodeData = {
  id: string;
  name: string;
  active: boolean;
  ready: boolean;
  running: boolean;
  busy: boolean;
  websocketState?: "connecting" | "connected" | "disconnected";
  responseOpen?: boolean;
  unread?: boolean;
  messages?: Array<{ id: number; data: string; receivedAt: string }>;
  latestResponse?: {
    status: string;
    responseStatus?: number | null;
    grpcStatusName?: string | null;
    responseBody?: string | null;
    error?: string | null;
    traceId?: string;
    totalDurationMs?: number | null;
  };
  entry: GraphMockApi;
};

defineProps<{ data: MockApiTriggerNodeData }>();

const emit = defineEmits<{
  trigger: [id: string];
  connect: [id: string];
  disconnect: [id: string];
  toggleResponse: [id: string];
}>();

function prettyResponse(value: string | null | undefined) {
  if (!value) return "No response body";
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function formatDuration(durationMs: number | null | undefined) {
  if (durationMs == null) return "N/A";
  if (durationMs < 1_000) return `${Math.round(durationMs)} ms`;
  const seconds = durationMs / 1_000;
  return `${Number(seconds.toFixed(seconds < 10 ? 2 : 1))} s`;
}
</script>

<template>
  <article
    class="app__graph-node--mock-trigger app__graph-node relative flex min-h-[58px] w-max min-w-[200px] items-center gap-2 rounded-xl px-3"
  >
    <button
      type="button"
      class="nodrag relative grid size-7 shrink-0 place-items-center rounded-md border border-[var(--border)]"
      :aria-label="data.responseOpen ? 'Hide latest response' : 'Show latest response'"
      :aria-expanded="Boolean(data.responseOpen)"
      @click.stop="emit('toggleResponse', data.id)"
    >
      <span
        v-if="data.unread"
        class="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-[var(--accent)]"
        aria-label="New response"
      />
      <UIcon
        :name="data.responseOpen ? 'i-lucide-chevron-left' : 'i-lucide-chevron-right'"
        class="size-4"
        aria-hidden="true"
      />
    </button>
    <Handle
      id="trigger-out"
      type="source"
      :position="Position.Right"
      :connectable="false"
      class="app__service-source"
    />
    <strong class="max-w-48 truncate whitespace-nowrap text-xs font-semibold">{{
      data.name
    }}</strong>
    <button
      v-if="data.entry.apiType === 'WEBSOCKET'"
      type="button"
      class="nodrag shrink-0 rounded-md border border-[var(--border)] px-2 py-1 text-[10px]"
      :disabled="data.websocketState === 'connecting'"
      @click.stop="emit(data.websocketState === 'connected' ? 'disconnect' : 'connect', data.id)"
    >
      {{
        data.websocketState === "connected"
          ? "Disconnect"
          : data.websocketState === "connecting"
            ? "Connecting..."
            : "Connect"
      }}
    </button>
    <button
      type="button"
      class="nodrag ml-auto inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)] disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="
        !data.active ||
        !data.ready ||
        data.busy ||
        (data.entry.apiType === 'WEBSOCKET' && data.websocketState !== 'connected')
      "
      :aria-label="data.running ? `Running ${data.name}` : `Trigger ${data.name}`"
      :title="data.running ? `Running ${data.name}` : `Trigger ${data.name}`"
      @click.stop="emit('trigger', data.id)"
    >
      <UIcon
        v-if="data.running"
        name="i-lucide-loader-circle"
        class="size-3 app__run-spinner"
        aria-hidden="true"
      />
      <UIcon v-else name="i-lucide-play" class="size-3" aria-hidden="true" />
    </button>
    <aside
      v-if="data.responseOpen"
      :data-response-panel="data.id"
      class="app__surface absolute right-full top-0 z-20 mr-3 max-h-80 w-[320px] overflow-auto rounded-xl p-3 shadow-xl"
    >
      <header class="mb-2 flex items-center justify-between text-xs font-semibold">
        <span>Latest response</span>
        <button
          type="button"
          aria-label="Close latest response"
          @click.stop="emit('toggleResponse', data.id)"
        >
          ×
        </button>
      </header>
      <template v-if="data.entry.apiType === 'WEBSOCKET'">
        <p v-if="!data.messages?.length" class="text-xs text-[var(--muted)]">
          No messages received yet.
        </p>
        <template v-else>
          <small class="mb-2 block text-[10px] text-[var(--muted)]">{{
            data.messages.at(-1)?.receivedAt
          }}</small>
          <pre
            class="whitespace-pre-wrap break-words rounded-md bg-[var(--panel2)] p-2 text-[11px]"
            >{{ data.messages.at(-1)?.data }}</pre>
        </template>
      </template>
      <template v-else-if="data.latestResponse">
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span
            class="inline-flex rounded-full border border-current/20 px-2 py-0.5 text-[10px] font-semibold"
            :class="`app__run-state--${data.latestResponse.status}`"
          >
            {{ data.latestResponse.status }} ·
            {{ data.latestResponse.grpcStatusName ?? data.latestResponse.responseStatus ?? "—" }}
          </span>
          <span class="text-[10px] text-[var(--muted)]">
            Total {{ formatDuration(data.latestResponse.totalDurationMs) }}
          </span>
        </div>
        <p
          v-if="data.latestResponse.traceId"
          class="mb-2 break-all text-[10px] text-[var(--muted)]"
        >
          Trace ID: {{ data.latestResponse.traceId }}
        </p>
        <p v-if="data.latestResponse.error" class="mb-2 text-xs text-[var(--danger)]">
          {{ data.latestResponse.error }}
        </p>
        <pre
          class="whitespace-pre-wrap break-words rounded-md bg-[var(--panel2)] p-2 text-[11px]"
          >{{ prettyResponse(data.latestResponse.responseBody) }}</pre>
      </template>
      <p v-else class="text-xs text-[var(--muted)]">No response yet.</p>
    </aside>
  </article>
</template>
