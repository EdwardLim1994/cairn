<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";

export type MockApiGraphEntry = {
  id?: string;
  name: string;
  requestJson: unknown;
  targetEndpointId: string | null;
  description: string;
  pathParameters: Record<string, string>;
  endpoint?: { method: string; url: string };
  status?: string;
  readinessStatus?: "draft" | "inactive" | "ready";
  active?: boolean;
  running: boolean;
};

defineProps<{ entries: MockApiGraphEntry[]; collapsed: boolean; runningMockId: string | null }>();

const emit = defineEmits<{
  toggleConnections: [];
  open: [id: string];
  run: [entry: MockApiGraphEntry];
}>();
</script>

<template>
  <article class="app__graph-node--mock app__graph-node relative rounded-2xl">
    <div class="flex h-[58px] items-center gap-2 border-b border-[var(--border)] px-3">
      <div
        class="grid size-[31px] shrink-0 place-items-center rounded-[9px] bg-[var(--accent)] font-mono text-[11px] font-medium text-[var(--accent-ink)]"
      >
        API
      </div>
      <div class="flex min-w-0 flex-1 flex-col">
        <strong class="truncate font-semibold">Mock APIs</strong
        ><span class="text-[10px] text-[var(--muted)]">Reusable REST calls</span>
      </div>
      <button
        type="button"
        class="nodrag grid size-6 shrink-0 place-items-center rounded-md border border-[var(--border)] bg-[var(--panel2)] text-[var(--muted)] hover:text-[var(--text)]"
        :aria-label="collapsed ? 'Show outgoing connections' : 'Hide outgoing connections'"
        :title="collapsed ? 'Show outgoing connections' : 'Hide outgoing connections'"
        @click.stop="emit('toggleConnections')"
      >
        <UIcon
          :name="collapsed ? 'i-lucide-plus' : 'i-lucide-minus'"
          class="size-4"
          aria-hidden="true"
        />
      </button>
    </div>
    <div v-if="!entries.length" class="p-5 text-center text-[11px] text-[var(--muted)]">
      Add a mock API to trigger calls
    </div>
    <div
      v-if="collapsed && entries.length"
      class="border-b border-[var(--border)] px-3 py-3 text-[11px] text-[var(--muted)]"
    >
      {{ entries.length }} mock API{{ entries.length === 1 ? "" : "s" }} · outgoing calls bundled
    </div>
    <div
      v-for="entry in entries"
      :key="entry.id"
      class="app__mock-row relative flex min-h-[62px] items-center gap-2 border-b border-dashed border-[var(--border)] px-2 py-2"
      :class="{
        'bg-[var(--accent-soft)]': runningMockId === entry.id,
        'app__mock-row--collapsed': collapsed,
        'app__mock-row--bundle': collapsed && entry.id === entries[0]?.id,
      }"
    >
      <Handle
        v-if="entry.id && (!collapsed || entry.id === entries[0]?.id)"
        :id="entry.id"
        type="source"
        :position="Position.Right"
        class="app__mock-handle"
      />
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <strong class="truncate whitespace-nowrap text-[11px]">{{ entry.name }}</strong>
        <button
          type="button"
          class="block w-full truncate whitespace-nowrap border-0 bg-transparent p-0 text-left text-[9px] text-[var(--muted)] hover:text-[var(--accent)]"
          :aria-label="`Open endpoint for ${entry.name}`"
          @click.stop="entry.id && emit('open', entry.id)"
        >
          <span
            v-if="entry.endpoint"
            class="rounded px-1 py-0.5 font-mono text-[9px]"
            :class="`app__method-tag--${entry.endpoint.method.toLowerCase()}`"
            >{{ entry.endpoint.method }}</span
          >
          <span v-else class="text-[var(--muted)]">No endpoint</span>
          {{ entry.endpoint?.url ?? "Select a service endpoint" }}
        </button>
      </div>
      <span
        v-if="entry.status"
        class="text-[9px] uppercase text-[var(--muted)]"
        :class="`app__run-state--${entry.status}`"
      >
        {{ entry.status }}
      </span>
      <span
        v-if="entry.readinessStatus"
        class="rounded-full border border-[var(--border)] px-2 py-0.5 text-[9px] text-[var(--muted)]"
      >
        {{ entry.readinessStatus }}
      </span>
      <button
        class="nodrag ml-auto flex size-[34px] shrink-0 items-center justify-center rounded-full border-0 bg-[var(--accent)] text-[var(--accent-ink)] disabled:opacity-50"
        :disabled="!!runningMockId || !entry.active || entry.readinessStatus !== 'ready'"
        :aria-label="entry.running ? `Running ${entry.name}` : `Run ${entry.name}`"
        :title="entry.running ? `Running ${entry.name}` : `Run ${entry.name}`"
        @click.stop="emit('run', entry)"
      >
        <UIcon
          v-if="entry.running"
          name="i-lucide-loader-circle"
          class="size-4 app__run-spinner"
          aria-hidden="true"
        />
        <UIcon v-else name="i-lucide-play" class="size-4" aria-hidden="true" />
      </button>
    </div>
  </article>
</template>
