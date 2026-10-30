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
  <article class="app__graph-node--mock app__graph-node">
    <div class="app__node-header app__node-header--mock">
      <div class="app__mock-icon">API</div>
      <div class="app__node-heading">
        <strong>Mock APIs</strong><span>Reusable REST calls</span>
      </div>
      <button
        type="button"
        class="app__collapse-connections nodrag"
        :aria-label="collapsed ? 'Show outgoing connections' : 'Hide outgoing connections'"
        :title="collapsed ? 'Show outgoing connections' : 'Hide outgoing connections'"
        @click.stop="emit('toggleConnections')"
      >
        <svg class="app__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path v-if="collapsed" d="M12 5v14m-7-7h14" />
          <path v-else d="M5 12h14" />
        </svg>
      </button>
    </div>
    <div v-if="!entries.length" class="app__empty-endpoints">Add a mock API to trigger calls</div>
    <div v-if="collapsed && entries.length" class="app__mock-collapsed-summary">
      {{ entries.length }} mock API{{ entries.length === 1 ? "" : "s" }} · outgoing calls bundled
    </div>
    <div
      v-for="entry in entries"
      :key="entry.id"
      class="app__mock-row"
      :class="{
        'app__mock-row--running': runningMockId === entry.id,
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
      <div class="app__mock-copy">
        <strong>{{ entry.name }}</strong>
        <button
          type="button"
          class="app__mock-endpoint-link"
          @click.stop="entry.id && emit('open', entry.id)"
        >
          <span
            v-if="entry.endpoint"
            class="app__method-tag"
            :class="`app__method-tag--${entry.endpoint.method.toLowerCase()}`"
            >{{ entry.endpoint.method }}</span
          >
          <span v-else class="app__mock-no-endpoint">No endpoint</span>
          {{ entry.endpoint?.url ?? "Select a service endpoint" }}
        </button>
      </div>
      <span v-if="entry.status" class="app__run-state" :class="`app__run-state--${entry.status}`">
        {{ entry.status }}
      </span>
      <button
        class="app__run-button nodrag"
        :disabled="!!runningMockId"
        :aria-label="entry.running ? `Running ${entry.name}` : `Run ${entry.name}`"
        :title="entry.running ? `Running ${entry.name}` : `Run ${entry.name}`"
        @click.stop="emit('run', entry)"
      >
        <svg
          v-if="entry.running"
          class="app__icon app__run-spinner"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="8" />
        </svg>
        <svg v-else class="app__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>
    </div>
  </article>
</template>
