<script setup lang="ts">
import { computed } from "vue";
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from "@vue-flow/core";

type EdgeTiming = {
  title: string;
  available: boolean;
  callDurationsMs: number[];
  unavailableReason?: string;
};

const props = defineProps<{
  id: string;
  sourceX: number;
  sourceY: number;
  sourcePosition: "left" | "right" | "top" | "bottom";
  targetX: number;
  targetY: number;
  targetPosition: "left" | "right" | "top" | "bottom";
  label?: string;
  markerStart?: string;
  markerEnd?: string;
  interactionWidth?: number;
  data?: { timing?: EdgeTiming };
}>();

const pathLayout = computed(() =>
  getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
    borderRadius: 0,
  }),
);
const durationCount = computed(() => props.data?.timing?.callDurationsMs.length ?? 0);

function formatDuration(durationMs: number) {
  if (durationMs < 1_000) return `${Math.round(durationMs)} ms`;
  const seconds = durationMs / 1_000;
  return `${Number(seconds.toFixed(seconds < 10 ? 2 : 1))} s`;
}
</script>

<template>
  <BaseEdge
    :id="id"
    :path="pathLayout[0]"
    :marker-start="markerStart"
    :marker-end="markerEnd"
    :interaction-width="interactionWidth"
  />
  <EdgeLabelRenderer v-if="label">
    <div
      class="app__edge-label-wrap nodrag nopan"
      :style="{ left: `${pathLayout[1]}px`, top: `${pathLayout[2]}px` }"
    >
      <button
        type="button"
        class="app__edge-label"
        :class="{ 'app__edge-label--unavailable': !data?.timing?.available }"
        :aria-label="`${data?.timing?.title ?? 'Observed service call'}: ${label}`"
        :title="data?.timing?.title"
      >
        <UIcon
          v-if="!data?.timing?.available"
          name="i-lucide-triangle-alert"
          class="size-3"
          aria-hidden="true"
        />
        {{ label }}
        <span v-if="data?.timing?.available && durationCount > 1" class="app__edge-label-count">
          ×{{ durationCount }}
        </span>
      </button>
      <div class="app__edge-label-popover" role="tooltip">
        <div class="app__edge-label-popover-title">
          {{ data?.timing?.available ? data.timing.title : "Timing unavailable" }}
        </div>
        <template v-if="data?.timing?.available">
          <div
            v-for="(duration, index) in data.timing.callDurationsMs"
            :key="index"
            class="app__edge-label-popover-row"
          >
            <span>Call {{ index + 1 }}</span>
            <span class="font-mono">{{ formatDuration(duration) }}</span>
          </div>
          <div class="app__edge-label-popover-row">
            <span>Sum of observed calls</span>
            <span class="font-mono">{{ label }}</span>
          </div>
        </template>
        <p v-else class="app__edge-label-note">
          {{ data?.timing?.unavailableReason ?? "No usable client-span duration was found." }}
        </p>
      </div>
    </div>
  </EdgeLabelRenderer>
</template>
