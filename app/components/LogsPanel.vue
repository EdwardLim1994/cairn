<script setup lang="ts">
import type { LogListResponse } from "#shared/api/observability";

const open = defineModel<boolean>("open", { required: true });
const search = defineModel<string>("search", { required: true });
const serviceFilter = defineModel<string[]>("serviceFilter", { required: true });
const severityFilter = defineModel<string[]>("severityFilter", { required: true });
const props = defineProps<{
  logs: LogListResponse;
  services: { name: string }[];
  height: number;
  formatTime: (value: string) => string;
}>();
const emit = defineEmits<{
  refresh: [];
  resize: [event: PointerEvent];
  adjustHeight: [delta: number];
}>();

function toggleFilter(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}
</script>

<template>
  <button
    v-if="!open"
    class="app__logs-toggle app__surface"
    :class="{ 'app__logs-toggle--active': open }"
    @click.stop="open = true"
  >
    <svg class="app__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h10" /></svg
    ><b>Logs</b>
  </button>
  <section
    v-if="open"
    class="app__logs-panel app__surface"
    :style="{ '--logs-panel-height': `${props.height}px` }"
  >
    <div
      class="app__logs-resize-handle"
      role="separator"
      aria-label="Resize logs panel"
      aria-orientation="horizontal"
      tabindex="0"
      @pointerdown.prevent="emit('resize', $event)"
      @keydown.up.prevent="emit('adjustHeight', 24)"
      @keydown.down.prevent="emit('adjustHeight', -24)"
    />
    <div class="app__logs-toolbar">
      <div class="app__logs-title"><strong>Logs</strong></div>
      <input
        v-model="search"
        class="app__control app__control--search"
        placeholder="Search log messages..."
        aria-label="Search log messages"
      />
      <details class="app__log-service-filter">
        <summary class="app__control" aria-label="Filter by service">
          {{ serviceFilter.length ? `${serviceFilter.length} selected` : "All services" }}
        </summary>
        <div class="app__log-service-options">
          <button
            type="button"
            class="app__filter-option"
            :class="{ 'app__filter-option--selected': !serviceFilter.length }"
            :aria-pressed="!serviceFilter.length"
            @click="serviceFilter = []"
          >
            All services
          </button>
          <button
            v-for="name in [...new Set(props.services.map((service) => service.name))].sort()"
            :key="name"
            type="button"
            class="app__filter-option"
            :class="{ 'app__filter-option--selected': serviceFilter.includes(name) }"
            :aria-pressed="serviceFilter.includes(name)"
            @click="serviceFilter = toggleFilter(serviceFilter, name)"
          >
            {{ name }}
          </button>
        </div>
      </details>
      <details class="app__log-service-filter">
        <summary class="app__control" aria-label="Filter by severity">
          {{ severityFilter.length ? `${severityFilter.length} selected` : "All levels" }}
        </summary>
        <div class="app__log-service-options">
          <button
            type="button"
            class="app__filter-option"
            :class="{ 'app__filter-option--selected': !severityFilter.length }"
            :aria-pressed="!severityFilter.length"
            @click="severityFilter = []"
          >
            All levels
          </button>
          <button
            v-for="level in ['ERROR', 'WARN', 'INFO', 'DEBUG']"
            :key="level"
            type="button"
            class="app__filter-option"
            :class="{ 'app__filter-option--selected': severityFilter.includes(level) }"
            :aria-pressed="severityFilter.includes(level)"
            @click="severityFilter = toggleFilter(severityFilter, level)"
          >
            {{ level }}
          </button>
        </div>
      </details>
      <button class="app__icon-button" aria-label="Refresh logs" @click="emit('refresh')">
        <svg class="app__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 7v5h-5M20 12a8 8 0 1 1-2.34-5.66L20 7" />
        </svg>
      </button>
      <button class="app__icon-button" aria-label="Close logs" @click="open = false">
        <svg class="app__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
    <div class="app__logs-list">
      <div v-if="!props.logs.length" class="app__empty-logs">No logs match these filters.</div>
      <div
        v-for="log in props.logs"
        :key="log.id"
        class="app__log-row"
        :class="{ 'app__log-row--error': log.severity === 'ERROR' }"
      >
        <time>{{ props.formatTime(log.timestamp) }}</time>
        <span class="app__severity" :class="`app__severity--${log.severity.toLowerCase()}`">{{
          log.severity
        }}</span>
        <strong>{{ log.serviceName }}</strong>
        <span
          class="app__log-message"
          :class="{ 'app__log-message--error': log.severity === 'ERROR' }"
          >{{ log.message }}</span
        >
      </div>
    </div>
  </section>
</template>
