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
  entry: GraphMockApi;
};

defineProps<{ data: MockApiTriggerNodeData }>();

const emit = defineEmits<{ trigger: [id: string] }>();
</script>

<template>
  <article
    class="app__graph-node--mock-trigger app__graph-node relative flex min-h-[58px] w-max min-w-[200px] items-center gap-2 rounded-xl px-3"
  >
    <Handle
      id="trigger-out"
      type="source"
      :position="Position.Right"
      :connectable="false"
      class="app__service-source"
    />
    <strong class="whitespace-nowrap text-xs font-semibold">{{ data.name }}</strong>
    <button
      type="button"
      class="nodrag inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)] disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="!data.active || !data.ready || data.busy"
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
  </article>
</template>
