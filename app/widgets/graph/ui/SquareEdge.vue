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
  data?: {
    timing?: EdgeTiming;
    relationshipGradient?: { from: "source" | "target"; toLevel: number };
  };
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
const relationshipGradient = computed(() => {
  const gradient = props.data?.relationshipGradient;
  if (!gradient) return null;
  const fromSource = gradient.from === "source";
  const fromLevel = gradient.toLevel - 1;
  const accentColor = (level: number) => {
    if (level <= 1) return "var(--ui-primary)";
    const accentPercent = level === 2 ? 58 : 38;
    return `color-mix(in srgb, var(--ui-primary) ${accentPercent}%, var(--ui-bg))`;
  };
  return {
    id: `relationship-gradient-${props.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
    x1: fromSource ? props.sourceX : props.targetX,
    y1: fromSource ? props.sourceY : props.targetY,
    x2: fromSource ? props.targetX : props.sourceX,
    y2: fromSource ? props.targetY : props.sourceY,
    startColor: accentColor(fromLevel),
    endColor: accentColor(gradient.toLevel),
  };
});
const edgeStyle = computed(() =>
  relationshipGradient.value ? { stroke: `url(#${relationshipGradient.value.id})` } : undefined,
);
const durationCount = computed(() => props.data?.timing?.callDurationsMs.length ?? 0);
const labelPosition = computed(() => {
  const offset = 48;
  switch (props.sourcePosition) {
    case "left":
      return { x: props.sourceX - offset, y: props.sourceY };
    case "top":
      return { x: props.sourceX, y: props.sourceY - offset };
    case "bottom":
      return { x: props.sourceX, y: props.sourceY + offset };
    default:
      return { x: props.sourceX + offset, y: props.sourceY };
  }
});

function formatDuration(durationMs: number) {
  if (durationMs < 1_000) return `${Math.round(durationMs)} ms`;
  const seconds = durationMs / 1_000;
  return `${Number(seconds.toFixed(seconds < 10 ? 2 : 1))} s`;
}
</script>

<template>
  <defs v-if="relationshipGradient">
    <linearGradient
      :id="relationshipGradient.id"
      data-relationship-gradient
      gradientUnits="userSpaceOnUse"
      :x1="relationshipGradient.x1"
      :y1="relationshipGradient.y1"
      :x2="relationshipGradient.x2"
      :y2="relationshipGradient.y2"
    >
      <stop offset="0%" :stop-color="relationshipGradient.startColor" />
      <stop offset="100%" :stop-color="relationshipGradient.endColor" />
    </linearGradient>
  </defs>
  <BaseEdge
    :id="id"
    :path="pathLayout[0]"
    :style="edgeStyle"
    :marker-start="markerStart"
    :marker-end="markerEnd"
    :interaction-width="interactionWidth"
  />
  <EdgeLabelRenderer v-if="label">
    <div
      class="app__edge-label-wrap nodrag nopan"
      :style="{ left: `${labelPosition.x}px`, top: `${labelPosition.y}px` }"
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
