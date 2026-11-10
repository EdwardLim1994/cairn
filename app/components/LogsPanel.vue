<script setup lang="ts">
import { computed } from "vue";
import type { LogListResponse } from "#shared/api/observability";

const open = defineModel<boolean>("open", { required: true });
const search = defineModel<string>("search", { required: true });
const severityFilter = defineModel<string[]>("severityFilter", { required: true });
const activeTraceOnly = defineModel<boolean>("activeTraceOnly", { required: true });
const props = defineProps<{
  logs: LogListResponse;
  height: number;
  formatTime: (value: string) => string;
  activeTraceId: string | null;
}>();
const emit = defineEmits<{
  resize: [event: PointerEvent];
  adjustHeight: [delta: number];
}>();

const filteredLogs = computed(() =>
  props.logs.filter((log) => {
    if (activeTraceOnly.value && props.activeTraceId && log.traceId !== props.activeTraceId)
      return false;
    return true;
  }),
);
const severityPresets = [
  { value: "all", label: "All" },
  { value: "info", label: "Info+" },
  { value: "warn", label: "Warn+" },
] as const;

function selectSeverityPreset(preset: "all" | "info" | "warn") {
  severityFilter.value =
    preset === "all" ? [] : preset === "info" ? ["INFO", "WARN", "ERROR"] : ["WARN", "ERROR"];
}

function isSeverityPresetActive(preset: "all" | "info" | "warn") {
  const expected =
    preset === "all" ? [] : preset === "info" ? ["INFO", "WARN", "ERROR"] : ["WARN", "ERROR"];
  return (
    expected.length === severityFilter.value.length &&
    expected.every((item) => severityFilter.value.includes(item))
  );
}
</script>

<template>
  <section
    v-if="open"
    id="logs-panel"
    class="app__surface absolute bottom-3 left-3 right-3 z-[35] flex h-[var(--logs-panel-height)] flex-col overflow-hidden rounded-xl max-h-[calc(100vh-24px)] max-[720px]:bottom-2 max-[720px]:left-2 max-[720px]:right-2"
    :style="{ '--logs-panel-height': `${props.height}px` }"
  >
    <div class="flex h-3 shrink-0 justify-center">
      <button
        type="button"
        class="flex w-16 cursor-row-resize touch-none items-center justify-center rounded-full outline-none hover:bg-[var(--panel2)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        aria-label="Resize logs panel"
        title="Use the up and down arrow keys to adjust height"
        aria-controls="logs-panel"
        @pointerdown.prevent="emit('resize', $event)"
        @keydown.up.prevent="emit('adjustHeight', 24)"
        @keydown.down.prevent="emit('adjustHeight', -24)"
      >
        <span class="h-1 w-10 rounded-full bg-[var(--muted)]" aria-hidden="true"></span>
      </button>
    </div>
    <div
      class="flex min-h-[54px] flex-wrap items-center gap-2.5 border-b border-[var(--border)] px-3.5 py-2"
    >
      <h2 class="text-[13.5px] font-semibold">Logs</h2>
      <span
        class="inline-flex h-[18px] min-w-5 items-center justify-center rounded-full bg-[var(--panel2)] px-1.5 text-[11px] font-semibold text-[var(--muted)]"
        >{{ filteredLogs.length }}</span
      >
      <label class="flex items-center gap-1.5 text-xs text-[var(--muted)]">
        <input
          v-model="activeTraceOnly"
          type="checkbox"
          :disabled="!activeTraceId"
          class="accent-[var(--accent)]"
        />
        Active trace only
      </label>
      <span
        v-if="activeTraceId"
        class="max-w-40 truncate rounded-md bg-[var(--panel2)] px-2 py-1 font-mono text-[10.5px] text-[var(--muted)]"
        :title="activeTraceId"
        >{{ activeTraceId.slice(0, 12) }}â€¦</span
      >
      <div
        class="inline-flex gap-0.5 rounded-lg bg-[var(--panel2)] p-0.5"
        role="group"
        aria-label="Log level"
      >
        <button
          v-for="preset in severityPresets"
          :key="preset.value"
          type="button"
          class="h-[26px] rounded-md px-2.5 text-xs font-medium text-[var(--muted)]"
          :class="
            isSeverityPresetActive(preset.value)
              ? 'bg-[var(--panel)] text-[var(--text)] shadow-[var(--shadow-sm)] font-semibold'
              : ''
          "
          :aria-pressed="isSeverityPresetActive(preset.value)"
          @click="selectSeverityPreset(preset.value)"
        >
          {{ preset.label }}
        </button>
      </div>
      <span class="flex-1" aria-hidden="true"></span>
      <UInput
        v-model="search"
        :ui="{
          base: 'h-[30px] w-[min(220px,26vw)] rounded-[7px] border border-[var(--border)] bg-[var(--panel)] px-2.5 text-[12.5px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)] max-[720px]:w-full',
        }"
        placeholder="Filter by service or text"
        aria-label="Filter logs by service or text"
      />
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
      <div v-if="!filteredLogs.length" class="p-5 text-center text-[11px] text-[var(--muted)]">
        No logs match these filters.
      </div>
      <div
        v-for="log in filteredLogs"
        :key="log.id"
        class="grid min-h-[30px] grid-cols-[96px_58px_150px_minmax(0,1fr)_100px] items-baseline gap-3 border-b border-[var(--border)] px-3.5 py-[5px] font-mono text-[11.5px] hover:bg-[var(--panel2)] max-[720px]:grid-cols-[55px_45px_minmax(80px,1fr)_minmax(0,2fr)] max-[720px]:gap-1.5 max-[720px]:text-[9px]"
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
        <span class="truncate text-[10px] text-[var(--muted)] max-[720px]:hidden">{{
          log.traceId?.slice(0, 12) ?? "—"
        }}</span>
      </div>
    </div>
  </section>
</template>
