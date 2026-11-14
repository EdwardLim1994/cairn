<script setup lang="ts">
import type { AuthSessionStatus } from "./utils/auth-route";

const route = useRoute();
const authStatus = useState<AuthSessionStatus>("auth-session-status", () => ({
  enabled: true,
  authenticated: false,
}));
</script>

<template>
  <UApp class="font-sans text-default bg-default">
    <NuxtPage v-if="authStatus.authenticated || route.path === '/login'" />
  </UApp>
</template>

<style>
@import "tailwindcss";
@import "@nuxt/ui";

.app__graph-node {
  background: var(--ui-bg);
  border: 1px solid var(--ui-border);
  box-shadow: var(--shadow-md);
}

.app__graph-flow {
  font-size: 13px;
  line-height: 1.4;
  background-color: var(--ui-bg);
  background-image: radial-gradient(circle, var(--ui-border) 1.1px, transparent 1.3px);
  background-size: 22px 22px;
}

.vue-flow__background {
  background-color: transparent;
}

.app .vue-flow__minimap {
  bottom: 76px;
  right: 16px;
  overflow: hidden;
  border: 1px solid var(--ui-border);
  border-radius: 10px;
  background: var(--ui-bg);
}

.app .vue-flow__controls {
  bottom: 76px;
  left: 16px;
  overflow: hidden;
  border: 1px solid var(--ui-border);
  border-radius: 10px;
  background: var(--ui-bg);
  box-shadow: var(--shadow-md);
}

.app .vue-flow__controls-button {
  border-bottom: 1px solid var(--ui-border);
  background: var(--ui-bg);
  color: var(--ui-text);
  fill: var(--ui-text);
}

.vue-flow__controls-button svg,
.vue-flow__controls-button svg path {
  fill: var(--ui-text);
}

.vue-flow__edge-path {
  stroke: var(--ui-text-dimmed);
  stroke-width: 2;
}

.vue-flow__edge.app__flow-edge--observed .vue-flow__edge-path,
.vue-flow__edge.app__flow-edge--running .vue-flow__edge-path {
  stroke: var(--ui-primary);
  stroke-width: 3.5;
}
.vue-flow__edge.app__flow-edge--message.app__flow-edge--observed .vue-flow__edge-path {
  stroke: var(--ui-warning);
}

.vue-flow__edge-text {
  fill: var(--ui-text);
  font-size: 10px;
}

.vue-flow__edge-textbg {
  fill: var(--ui-bg);
}

.app__graph-node--service {
  width: 264px;
  overflow: visible;
}

.app__graph-node {
  box-shadow: var(--shadow-sm);
}

.app__graph-legend-panel {
  top: 82px;
  right: 12px;
  z-index: 12;
}

.app__graph-legend {
  display: flex;
  min-height: 36px;
  align-items: center;
  gap: 14px;
  border: 1px solid var(--ui-border);
  border-radius: 10px;
  background: var(--ui-bg);
  padding: 0 12px;
  box-shadow: var(--shadow-md);
  color: var(--ui-text-muted);
  font-size: 11px;
}

.app__graph-legend > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.app__legend-line {
  width: 24px;
  border-top: 1.5px solid var(--ui-text-dimmed);
}

.app__legend-line--message {
  border-top-style: dashed;
}

.app__legend-line--observed {
  border-top: 2.25px solid var(--ui-primary);
}

.app__legend-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: var(--ui-primary);
}

.app__edge-label-wrap {
  position: absolute;
  z-index: 3;
  transform: translate(-50%, -50%);
  pointer-events: all;
}

.app__edge-label-wrap:hover,
.app__edge-label-wrap:focus-within {
  z-index: 30;
}

.app__edge-label {
  display: inline-flex;
  height: 22px;
  align-items: center;
  gap: 5px;
  border: 1.5px solid var(--ui-primary);
  border-radius: 11px;
  background: var(--ui-bg);
  padding: 0 8px;
  box-shadow: var(--shadow-sm);
  color: var(--ui-primary);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  cursor: help;
}

.app__edge-label-count {
  color: var(--ui-text-muted);
  font-weight: 500;
}

.app__edge-label--unavailable {
  border-style: dashed;
  border-color: var(--ui-warning);
  color: var(--ui-warning);
}

.app__edge-label-popover {
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  display: none;
  width: 230px;
  padding: 10px 12px;
  transform: translateX(-50%);
  border: 1px solid var(--ui-border-accented);
  border-radius: 9px;
  background: var(--ui-bg);
  box-shadow: var(--shadow-lg);
  color: var(--ui-text);
  font-size: 12px;
  text-align: left;
}

.app__edge-label-wrap:hover .app__edge-label-popover,
.app__edge-label-wrap:focus-within .app__edge-label-popover {
  display: block;
}

.app__edge-label-popover-title {
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
}

.app__edge-label-popover-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 3px 0;
  border-top: 1px solid var(--ui-border);
  color: var(--ui-text-muted);
  font-size: 11.5px;
}

.app__edge-label-popover-row .font-mono {
  color: var(--ui-text);
  font-weight: 500;
}

.app__edge-label-note {
  color: var(--ui-text-muted);
  font-size: 11.5px;
  line-height: 1.45;
}

.app__trigger-protocol--http {
  color: var(--ui-info);
  background: color-mix(in srgb, var(--ui-info) 10%, transparent);
}

.app__trigger-protocol--grpc {
  color: var(--ui-success);
  background: color-mix(in srgb, var(--ui-success) 10%, transparent);
}

.app__trigger-protocol--websocket {
  color: var(--ui-secondary);
  background: color-mix(in srgb, var(--ui-secondary) 10%, transparent);
}

.app__trigger-last-chip--completed {
  color: var(--ui-success);
}

.app__trigger-last-chip--failed {
  color: var(--ui-error);
}

.app__mock-response-panel {
  box-shadow: var(--shadow-lg);
}

@media (max-width: 899px) {
  .app__graph-legend-panel {
    display: none;
  }
}

.dark .app__message-queue-kafka-icon {
  filter: brightness(0) invert(1);
}

.vue-flow__node.app__flow-node--service-observed .app__graph-node {
  border-color: var(--ui-primary);
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--ui-primary) 10%, transparent),
    var(--shadow-md);
}

.vue-flow__node.app__flow-node--service-error .app__graph-node--service {
  border-color: var(--ui-error);
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--ui-error) 10%, transparent),
    var(--shadow-md);
}

.vue-flow__node.selected .app__graph-node {
  border-color: var(--ui-primary);
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}

.app__endpoint-row--collapsed {
  display: none;
}

.app__endpoint-row--collapsed.app__endpoint-row--bundle {
  position: absolute;
  top: 75px;
  left: 0;
  display: flex;
  width: 0;
  height: 0;
  overflow: visible;
  border: 0;
  padding: 0;
}

.app__endpoint-row--bundle > :not(.app__endpoint-handle) {
  display: none;
}

.app__method-tag--get {
  color: var(--ui-info);
  background: color-mix(in srgb, var(--ui-info) 10%, transparent);
}

.app__method-tag--post {
  color: var(--ui-success);
  background: color-mix(in srgb, var(--ui-success) 10%, transparent);
}

.app__method-tag--put {
  color: var(--ui-warning);
  background: color-mix(in srgb, var(--ui-warning) 10%, transparent);
}

.app__method-tag--patch {
  color: var(--ui-secondary);
  background: color-mix(in srgb, var(--ui-secondary) 10%, transparent);
}

.app__method-tag--delete {
  color: var(--ui-error);
  background: color-mix(in srgb, var(--ui-error) 10%, transparent);
}

.app__status-text,
.app__run-state--failed {
  color: var(--ui-error);
}

.app__run-state--failed {
  background: color-mix(in srgb, var(--ui-error) 10%, transparent);
}

.app__run-state--completed {
  color: var(--ui-success);
  background: color-mix(in srgb, var(--ui-success) 10%, transparent);
}

.app__run-state--running {
  color: var(--ui-warning);
  background: color-mix(in srgb, var(--ui-warning) 10%, transparent);
}

.app__run-spinner {
  fill: none;
  stroke: currentColor;
  stroke-dasharray: 40;
  stroke-dashoffset: 12;
  animation: run-spin 1s linear infinite;
}

@keyframes run-spin {
  to {
    transform: rotate(360deg);
  }
}

.app .app__endpoint-handle,
.app .app__endpoint-source,
.app .app__service-source {
  width: 10px;
  height: 10px;
  border: 2px solid var(--ui-bg);
  background: var(--ui-text-dimmed);
}

.app .app__endpoint-handle {
  left: -5px;
}
.app .app__endpoint-source {
  right: -5px;
}
.app .app__endpoint-source--connected {
  background: var(--ui-text-dimmed);
}
.app .app__endpoint-source--message {
  background: var(--ui-text-dimmed);
}
.app .app__endpoint-source--authoring {
  border-color: var(--ui-text-dimmed);
  background: var(--ui-bg);
}
.app .app__endpoint-handle--observed,
.app .app__endpoint-source--observed {
  background: var(--ui-primary);
}
.app .app__endpoint-handle--collapsed,
.app .app__endpoint-source--collapsed {
  top: 75px;
}
.app .app__service-handle--collapsed {
  top: 29px;
}
.app .app__message-queue-handle--collapsed {
  top: 81px;
}
.app .app__service-source {
  right: -5px;
  top: 28px;
}
.app .app__flow-edge--message .vue-flow__edge-path {
  stroke-dasharray: 5 3;
}

.vue-flow__node.app__flow-node--relationship-1 {
  opacity: 1;
}

.vue-flow__node.app__flow-node--relationship-1 .app__graph-node--service {
  border-color: var(--ui-primary);
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--ui-primary) 10%, transparent),
    var(--shadow-md);
}

.vue-flow__node.app__flow-node--relationship-2 {
  opacity: 0.9;
}

.vue-flow__node.app__flow-node--relationship-2 .app__graph-node--service {
  border-color: color-mix(in srgb, var(--ui-primary) 58%, var(--ui-bg));
  outline: 2px solid color-mix(in srgb, var(--ui-primary) 58%, transparent);
  outline-offset: 2px;
  box-shadow:
    0 0 0 1px
      color-mix(in srgb, color-mix(in srgb, var(--ui-primary) 10%, transparent) 58%, transparent),
    var(--shadow-md);
}

.vue-flow__node.app__flow-node--relationship-dimmed {
  opacity: 0.18;
}

.vue-flow__edge.app__flow-edge--relationship-1 .vue-flow__edge-path {
  opacity: 0.92;
}

.vue-flow__edge.app__flow-edge--relationship-3 .vue-flow__edge-path {
  opacity: 0.75;
}

.vue-flow__edge.app__flow-edge--relationship-dimmed .vue-flow__edge-path {
  opacity: 0.12;
}

.vue-flow__edge.app__flow-edge--relationship-1:not(.app__flow-edge--observed):not(
    .app__flow-edge--running
  )
  .vue-flow__edge-path {
  stroke: var(--ui-primary);
  stroke-width: 2.5;
}

.vue-flow__edge.app__flow-edge--relationship-2:not(.app__flow-edge--observed):not(
    .app__flow-edge--running
  )
  .vue-flow__edge-path {
  stroke: color-mix(in srgb, var(--ui-primary) 58%, var(--ui-bg));
  stroke-width: 2.5;
}

.vue-flow__edge.app__flow-edge--relationship-3:not(.app__flow-edge--observed):not(
    .app__flow-edge--running
  )
  .vue-flow__edge-path {
  stroke: color-mix(in srgb, var(--ui-primary) 38%, var(--ui-bg));
  stroke-width: 2.5;
}
</style>
