<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";
import type { GraphEndpoint, GraphMockApi } from "../../models/graph";

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
  endpoint?: GraphEndpoint;
  serviceName?: string;
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
  edit: [id: string];
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

function endpointPath(endpoint?: GraphEndpoint) {
  if (!endpoint) return "Endpoint not configured";
  if (endpoint.rpcMethod) return endpoint.rpcMethod;
  return endpoint.url ?? endpoint.name;
}

function responseLabel(data: MockApiTriggerNodeData) {
  if (data.entry.apiType === "WEBSOCKET") {
    const count = data.messages?.length ?? 0;
    return count ? `${count} message${count === 1 ? "" : "s"}` : "Response";
  }

  const response = data.latestResponse;
  if (!response) return "Response";
  const status = response.grpcStatusName ?? response.responseStatus?.toString() ?? response.status;
  const duration = formatDuration(response.totalDurationMs);
  return duration === "N/A" ? status : `${status} · ${duration}`;
}
</script>

<template>
  <article
    class="app__graph-node--mock-trigger app__graph-node relative w-[296px] overflow-visible rounded-[10px]"
  >
    <header class="relative flex h-11 items-center gap-2 border-b border-[var(--border)] px-3">
      <span
        class="app__trigger-protocol inline-flex h-[18px] min-w-[42px] shrink-0 items-center justify-center rounded px-1 font-mono text-[10px] font-semibold"
        :class="`app__trigger-protocol--${data.entry.apiType.toLowerCase()}`"
      >
        {{
          data.entry.apiType === "HTTP"
            ? "REST"
            : data.entry.apiType === "WEBSOCKET"
              ? "WS"
              : "gRPC"
        }}
      </span>
      <strong class="min-w-0 flex-1 truncate whitespace-nowrap text-[13px] font-semibold">{{
        data.name
      }}</strong>
      <button
        type="button"
        class="nodrag inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--panel)] px-2 text-[11px] font-medium text-[var(--muted)] hover:border-[var(--border-strong)] hover:bg-[var(--panel2)] hover:text-[var(--text)]"
        :aria-label="`Edit ${data.name}`"
        title="Edit mock API"
        @click.stop="emit('edit', data.id)"
      >
        <UIcon name="i-lucide-pencil" class="size-3" aria-hidden="true" />
        Edit
      </button>
      <Handle
        id="trigger-out"
        type="source"
        :position="Position.Right"
        :connectable="false"
        class="app__service-source"
      />
    </header>
    <div class="flex flex-col gap-2.5 px-3 pb-3 pt-2.5">
      <div class="flex min-w-0 items-center gap-1.5 font-mono text-[11px]">
        <span
          v-if="data.entry.apiType === 'HTTP' && data.endpoint?.method"
          class="app__method-tag shrink-0 rounded px-1 py-0.5 text-[10px] font-bold"
          :class="`app__method-tag--${data.endpoint.method.toLowerCase()}`"
          >{{ data.endpoint.method }}</span
        >
        <span class="min-w-0 truncate text-[var(--muted)]">{{ endpointPath(data.endpoint) }}</span>
      </div>
      <div class="flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--muted)]">
        <UIcon name="i-lucide-server" class="size-3 shrink-0" aria-hidden="true" />
        <span class="truncate">{{ data.serviceName ?? "Target service" }}</span>
        <span v-if="data.entry.status !== 'ready'" class="shrink-0 text-[var(--warning)]"
          >· Not ready</span
        >
      </div>
      <div
        v-if="data.entry.apiType === 'WEBSOCKET'"
        class="flex items-center gap-1.5 text-[11px] text-[var(--muted)]"
        role="status"
      >
        <span
          class="size-2 shrink-0 rounded-full"
          :class="{
            'bg-[var(--success)] shadow-[0_0_0_3px_var(--success-soft)]':
              data.websocketState === 'connected',
            'bg-[var(--warning)]': data.websocketState === 'connecting',
            'bg-[var(--muted)]': data.websocketState === 'disconnected',
          }"
        />
        {{
          data.websocketState === "connected"
            ? "Connected"
            : data.websocketState === "connecting"
              ? "Connecting…"
              : "Disconnected"
        }}
      </div>
      <div class="flex flex-nowrap items-center gap-1.5">
        <button
          v-if="data.entry.apiType === 'WEBSOCKET'"
          type="button"
          class="nodrag inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--panel)] px-2.5 text-[11.5px] font-medium hover:bg-[var(--panel2)] disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="data.websocketState === 'connecting' || !data.active || !data.ready"
          @click.stop="
            emit(data.websocketState === 'connected' ? 'disconnect' : 'connect', data.id)
          "
        >
          <UIcon
            :name="data.websocketState === 'connected' ? 'i-lucide-unplug' : 'i-lucide-plug-zap'"
            class="size-3.5"
            aria-hidden="true"
          />
          {{
            data.websocketState === "connected"
              ? "Disconnect"
              : data.websocketState === "connecting"
                ? "Connecting…"
                : "Connect"
          }}
        </button>
        <button
          type="button"
          class="nodrag inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-[var(--accent)] bg-[var(--accent)] px-2.5 text-[11.5px] font-semibold text-[var(--accent-ink)] hover:brightness-105 disabled:cursor-not-allowed disabled:border-dashed disabled:opacity-50"
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
            class="size-3.5 app__run-spinner"
            aria-hidden="true"
          />
          <UIcon v-else name="i-lucide-play" class="size-3" aria-hidden="true" />
          {{
            data.running
              ? data.entry.apiType === "WEBSOCKET"
                ? "Sending…"
                : "Running…"
              : data.entry.apiType === "WEBSOCKET"
                ? "Trigger"
                : "Run"
          }}
        </button>
        <button
          v-if="data.latestResponse || data.messages?.length || data.responseOpen"
          type="button"
          class="nodrag relative inline-flex h-7 min-w-0 flex-1 items-center gap-1.5 truncate rounded-md border border-[var(--border)] bg-[var(--panel2)] px-2 text-[11px] font-medium text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
          :class="{
            'app__trigger-last-chip--failed': data.latestResponse?.status === 'failed',
            'app__trigger-last-chip--completed': data.latestResponse?.status === 'completed',
          }"
          :aria-label="data.responseOpen ? 'Hide latest response' : 'Show latest response'"
          :aria-expanded="Boolean(data.responseOpen)"
          @click.stop="emit('toggleResponse', data.id)"
        >
          <span
            class="size-[7px] shrink-0 rounded-full bg-[var(--success)]"
            :class="{ 'bg-[var(--danger)]': data.latestResponse?.status === 'failed' }"
          />
          <span class="truncate font-mono">{{ responseLabel(data) }}</span>
          <span
            v-if="data.unread"
            class="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-[var(--accent)]"
            aria-label="New response"
          />
        </button>
      </div>
      <button
        v-if="!data.ready"
        type="button"
        class="nodrag inline-flex min-h-[26px] items-center gap-1.5 self-start rounded-md border border-dashed border-[var(--warning)] bg-[var(--warning-soft)] px-2 text-[11px] font-semibold text-[var(--warning)]"
        @click.stop="emit('edit', data.id)"
      >
        <UIcon name="i-lucide-triangle-alert" class="size-3" aria-hidden="true" />
        Not ready · Fix
      </button>
    </div>
    <aside
      v-if="data.responseOpen"
      :data-response-panel="data.id"
      class="app__mock-response-panel app__surface absolute right-full top-0 z-20 mr-3 max-h-[470px] w-[380px] overflow-auto rounded-xl p-3"
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
