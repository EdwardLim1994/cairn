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
      class: serviceFilter.value.length ? "" : "bg-[var(--accent-soft)] text-[var(--accent)]",
      onSelect: (event: Event) => {
        event.preventDefault();
        serviceFilter.value = [];
      },
    },
    ...serviceNames.value.map((name) => ({
      label: name,
      class: serviceFilter.value.includes(name)
        ? "bg-[var(--accent-soft)] text-[var(--accent)]"
        : "",
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
      class: severityFilter.value.length ? "" : "bg-[var(--accent-soft)] text-[var(--accent)]",
      onSelect: (event: Event) => {
        event.preventDefault();
        severityFilter.value = [];
      },
    },
    ...["ERROR", "WARN", "INFO", "DEBUG"].map((level) => ({
      label: level,
      class: severityFilter.value.includes(level)
        ? "bg-[var(--accent-soft)] text-[var(--accent)]"
        : "",
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
    class="app__surface absolute bottom-4 right-4 z-40 flex h-[46px] items-center gap-2.5 rounded-full border-[var(--accent)] bg-[var(--panel)] px-3.5 text-xs"
    @click.stop="open = true"
  >
    <UIcon name="i-lucide-menu" class="size-4" aria-hidden="true" />
    <b>Logs</b>
  </UButton>
  <section
    v-if="open"
    id="logs-panel"
    class="app__surface absolute bottom-4 left-4 right-4 z-[35] flex h-[var(--logs-panel-height)] flex-col overflow-hidden rounded-[18px] max-h-[calc(100vh-32px)] max-[720px]:bottom-2 max-[720px]:left-2 max-[720px]:right-2"
    :style="{ '--logs-panel-height': `${props.height}px` }"
  >
    <div class="app__logs-resize-control">
      <span class="app__logs-resize-grip" aria-hidden="true"></span>
      <input
        type="range"
        class="app__logs-resize-handle"
        aria-label="Resize logs panel"
        aria-orientation="vertical"
        aria-controls="logs-panel"
        aria-valuetext="Panel height in pixels"
        :value="props.height"
        min="160"
        max="1200"
        step="24"
        @pointerdown.prevent="emit('resize', $event)"
        @keydown.up.prevent="emit('adjustHeight', 24)"
        @keydown.down.prevent="emit('adjustHeight', -24)"
      />
    </div>
    <div
      class="flex min-h-[54px] flex-wrap items-center gap-2 border-b border-[var(--border)] px-3 pb-2 pt-3"
    >
      <div class="mr-auto flex items-baseline gap-2"><strong class="text-sm">Logs</strong></div>
      <UInput
        v-model="search"
        :ui="{
          base: 'w-[min(250px,26vw)] rounded-lg border border-[var(--border)] bg-[var(--panel)] px-[9px] py-[7px] text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)] max-[720px]:w-full',
        }"
        placeholder="Search log messages..."
        aria-label="Search log messages"
      />
      <UDropdownMenu
        :items="serviceFilterItems"
        :ui="{
          content:
            'z-20 flex max-h-48 min-w-full flex-col gap-1 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--panel)] p-1.5 shadow-lg',
          item: 'cursor-pointer whitespace-nowrap rounded px-2 py-1.5 text-left text-[11px] text-[var(--text)] hover:bg-[var(--panel2)] data-[highlighted]:bg-[var(--panel2)]',
        }"
      >
        <UButton
          type="button"
          color="neutral"
          variant="outline"
          class="min-w-[130px] rounded-lg border border-[var(--border)] bg-[var(--panel)] px-[9px] py-[7px] text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]"
          aria-label="Filter by service"
        >
          {{ serviceFilter.length ? `${serviceFilter.length} selected` : "All services" }}
        </UButton>
      </UDropdownMenu>
      <UDropdownMenu
        :items="severityFilterItems"
        :ui="{
          content:
            'z-20 flex max-h-48 min-w-full flex-col gap-1 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--panel)] p-1.5 shadow-lg',
          item: 'cursor-pointer whitespace-nowrap rounded px-2 py-1.5 text-left text-[11px] text-[var(--text)] hover:bg-[var(--panel2)] data-[highlighted]:bg-[var(--panel2)]',
        }"
      >
        <UButton
          type="button"
          color="neutral"
          variant="outline"
          class="min-w-[130px] rounded-lg border border-[var(--border)] bg-[var(--panel)] px-[9px] py-[7px] text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]"
          aria-label="Filter by severity"
        >
          {{ severityFilter.length ? `${severityFilter.length} selected` : "All levels" }}
        </UButton>
      </UDropdownMenu>
      <UButton
        type="button"
        color="neutral"
        variant="outline"
        class="inline-grid size-[34px] place-items-center rounded-lg border border-[var(--border)] bg-[var(--panel)] p-0 leading-none hover:bg-[var(--panel2)]"
        aria-label="Refresh logs"
        @click="emit('refresh')"
      >
        <UIcon name="i-lucide-refresh-cw" class="size-4" aria-hidden="true" />
      </UButton>
      <UButton
        type="button"
        color="neutral"
        variant="outline"
        class="inline-grid size-[34px] place-items-center rounded-lg border border-[var(--border)] bg-[var(--panel)] p-0 leading-none hover:bg-[var(--panel2)]"
        aria-label="Close logs"
        @click="open = false"
      >
        <UIcon name="i-lucide-x" class="size-4" aria-hidden="true" />
      </UButton>
    </div>
    <div class="flex-1 overflow-auto px-2.5 py-1.5">
      <div v-if="!props.logs.length" class="p-5 text-center text-[11px] text-[var(--muted)]">
        No logs match these filters.
      </div>
      <div
        v-for="log in props.logs"
        :key="log.id"
        class="grid min-h-[30px] grid-cols-[80px_72px_145px_minmax(0,1fr)] items-center gap-2.5 rounded-lg px-2 py-1 font-mono text-[10px] hover:bg-[var(--panel2)] max-[720px]:grid-cols-[55px_55px_80px_minmax(0,1fr)] max-[720px]:gap-[5px] max-[720px]:text-[9px]"
        :class="{ 'items-start': log.severity === 'ERROR' }"
      >
        <time class="text-[var(--muted)]">{{ props.formatTime(log.timestamp) }}</time>
        <span
          class="justify-self-start rounded px-1 py-0.5 text-[9px]"
          :class="`app__severity--${log.severity.toLowerCase()}`"
          >{{ log.severity }}</span
        >
        <strong class="truncate whitespace-nowrap font-medium">{{ log.serviceName }}</strong>
        <span
          class="truncate whitespace-nowrap"
          :class="
            log.severity === 'ERROR' &&
            'whitespace-pre-wrap break-words [overflow-wrap:anywhere] [overflow:visible] [text-overflow:clip]'
          "
          >{{ log.message }}</span
        >
      </div>
    </div>
  </section>
</template>
