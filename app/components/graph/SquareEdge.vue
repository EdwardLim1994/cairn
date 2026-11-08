<script setup lang="ts">
import { computed } from "vue";
import { BaseEdge, getSmoothStepPath } from "@vue-flow/core";

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
}>();
const edgePath = computed(() =>
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
const labelX = computed(() => {
  const sourceDirection = props.sourcePosition === "right" ? 1 : -1;
  return props.sourceX + sourceDirection * 32;
});
const labelY = computed(() => props.sourceY + (props.sourcePosition === "bottom" ? 32 : -12));
</script>

<template>
  <BaseEdge
    :id="id"
    :path="edgePath[0]"
    :label="label"
    :label-x="labelX"
    :label-y="labelY"
    :label-style="{ fill: 'var(--text)', fontSize: '10px' }"
    :label-show-bg="true"
    :label-bg-style="{ fill: 'var(--panel)', fillOpacity: 0.95 }"
    :label-bg-padding="[4, 2]"
    :label-bg-border-radius="4"
    :marker-start="markerStart"
    :marker-end="markerEnd"
    :interaction-width="interactionWidth"
  />
</template>
