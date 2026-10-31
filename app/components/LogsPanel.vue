<script setup lang="ts">
import { computed } from "vue";
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

const serviceNames = computed(() =>
  [...new Set(props.services.map((service) => service.name))].sort(),
);
const serviceFilterItems = computed(() => [
  [
    {
      label: "All services",
      class: serviceFilter.value.length ? "" : "app__filter-option--selected",
      onSelect: (event: Event) => {
        event.preventDefault();
        serviceFilter.value = [];
      },
    },
    ...serviceNames.value.map((name) => ({
      label: name,
      class: serviceFilter.value.includes(name) ? "app__filter-option--selected" : "",
      onSelect: (event: Event) => {
        event.preventDefault();
        serviceFilter.value = toggleFilter(serviceFilter.value, name);
      },
    })),
  ],
]);
const severityFilterItems = computed(() => [
  [
    {
      label: "All levels",
      class: severityFilter.value.length ? "" : "app__filter-option--selected",
      onSelect: (event: Event) => {
        event.preventDefault();
        severityFilter.value = [];
      },
    },
    ...["ERROR", "WARN", "INFO", "DEBUG"].map((level) => ({
      label: level,
      class: severityFilter.value.includes(level) ? "app__filter-option--selected" : "",
      onSelect: (event: Event) => {
        event.preventDefault();
        severityFilter.value = toggleFilter(severityFilter.value, level);
      },
    })),
  ],
]);
</script>

<template>
  <UButton
    v-if="!open"
    type="button"
    color="neutral"
    variant="outline"
    class="app__logs-toggle app__surface"
    :class="{ 'app__logs-toggle--active': open }"
    @click.stop="open = true"
  >
    <svg class="app__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h10" /></svg
    ><b>Logs</b>
  </UButton>
  <section
    v-if="open"
    id="logs-panel"
    class="app__logs-panel app__surface"
    :style="{ '--logs-panel-height': `${props.height}px` }"
  >
    <div
      class="app__logs-resize-handle"
      role="slider"
      aria-label="Resize logs panel"
      aria-orientation="vertical"
      tabindex="0"
      aria-controls="logs-panel"
      aria-valuetext="Panel height in pixels"
      :aria-valuenow="props.height"
      aria-valuemin="160"
      aria-valuemax="1200"
      @pointerdown.prevent="emit('resize', $event)"
      @keydown.up.prevent="emit('adjustHeight', 24)"
      @keydown.down.prevent="emit('adjustHeight', -24)"
    />
    <div class="app__logs-toolbar">
      <div class="app__logs-title"><strong>Logs</strong></div>
      <UInput
        v-model="search"
        :ui="{ base: 'app__control app__control--search' }"
        placeholder="Search log messages..."
        aria-label="Search log messages"
      />
      <UDropdownMenu
        :items="serviceFilterItems"
        :ui="{
          content: 'app__log-service-options app__log-service-options--service',
          item: 'app__filter-option',
        }"
      >
        <UButton
          type="button"
          color="neutral"
          variant="outline"
          class="app__control"
          aria-label="Filter by service"
        >
          {{ serviceFilter.length ? `${serviceFilter.length} selected` : "All services" }}
        </UButton>
      </UDropdownMenu>
      <UDropdownMenu
        :items="severityFilterItems"
        :ui="{
          content: 'app__log-service-options app__log-service-options--severity',
          item: 'app__filter-option',
        }"
      >
        <UButton
          type="button"
          color="neutral"
          variant="outline"
          class="app__control"
          aria-label="Filter by severity"
        >
          {{ severityFilter.length ? `${severityFilter.length} selected` : "All levels" }}
        </UButton>
      </UDropdownMenu>
      <UButton
        type="button"
        color="neutral"
        variant="outline"
        class="app__icon-button"
        aria-label="Refresh logs"
        @click="emit('refresh')"
      >
        <svg class="app__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 7v5h-5M20 12a8 8 0 1 1-2.34-5.66L20 7" />
        </svg>
      </UButton>
      <UButton
        type="button"
        color="neutral"
        variant="outline"
        class="app__icon-button"
        aria-label="Close logs"
        @click="open = false"
      >
        <svg class="app__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </UButton>
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
