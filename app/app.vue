<script setup lang="ts">
import type { AuthSessionStatus } from "./utils/auth-route";

const route = useRoute();
const authStatus = useState<AuthSessionStatus>("auth-session-status", () => ({
  enabled: true,
  authenticated: false,
}));
</script>

<template>
  <UApp>
    <NuxtPage v-if="authStatus.authenticated || route.path === '/login'" />
  </UApp>
</template>

<style>
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap");
@import "tailwindcss";
@import "@nuxt/ui";

@theme inline {
  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
  --color-background: var(--bg);
  --color-surface: var(--panel);
  --color-surface-raised: var(--panel2);
  --color-border: var(--border);
  --color-border-strong: var(--border-strong);
  --color-foreground: var(--text);
  --color-muted: var(--muted);
  --color-accent: var(--accent);
  --color-accent-soft: var(--accent-soft);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-danger: var(--danger);
  --color-cairn-bg: var(--bg);
  --color-cairn-panel: var(--panel);
  --color-cairn-panel-2: var(--panel2);
  --color-cairn-border: var(--border);
  --color-cairn-border-strong: var(--border-strong);
  --color-cairn-text: var(--text);
  --color-cairn-muted: var(--muted);
  --color-cairn-accent: var(--accent);
  --color-cairn-accent-soft: var(--accent-soft);
  --color-cairn-success: var(--success);
  --color-cairn-warning: var(--warning);
  --color-cairn-danger: var(--danger);
}

:root {
  font-family: "Inter", system-ui, sans-serif;
  color-scheme: light;
  --bg: #f5f6f8;
  --dots: #c9cfd8;
  --panel: #fff;
  --panel2: #f1f3f6;
  --border: #dce0e6;
  --border-strong: #c3c9d2;
  --text: #151a21;
  --muted: #5d6673;
  --accent: #0a7898;
  --accent-ink: #fff;
  --accent-soft: #e0f1f6;
  --message-edge: #8a5100;
  --danger: #c4282f;
  --danger-soft: #fde8e8;
  --warning: #8a5100;
  --warning-soft: #fcf1dc;
  --success: #146c2e;
  --success-soft: #e3f4e8;
  --runtime-spring-bg: #e3f4e8;
  --runtime-spring-fg: #146c2e;
  --runtime-dotnet-bg: #ede7fb;
  --runtime-dotnet-fg: #5631b8;
  --shadow: 0 1px 2px rgba(16, 24, 40, 0.06), 0 8px 24px rgba(16, 24, 40, 0.08);
  --shadow-sm: 0 1px 2px rgba(16, 24, 40, 0.07);
  --shadow-lg: 0 16px 48px rgba(16, 24, 40, 0.18);
  --edge: #a3abb7;
  --trace: #0a8bb0;
  --trace-soft: rgba(10, 139, 176, 0.18);
  --timing-label-bg: #fff;
  --timing-label-text: #151a21;
  --get-fg: #1d56b0;
  --get-bg: #e5edfa;
  --post-fg: #0b6b5f;
  --post-bg: #dff3ef;
  --put-fg: #8a5100;
  --put-bg: #fbefd9;
  --patch-fg: #9c1f68;
  --patch-bg: #fae6f1;
  --delete-fg: #c4282f;
  --delete-bg: #fde8e8;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

.app {
  --ui-primary: var(--accent);
  --ui-success: var(--success);
  --ui-warning: var(--warning);
  --ui-error: var(--danger);
  --ui-bg: var(--panel);
  --ui-bg-muted: var(--panel2);
  --ui-bg-elevated: var(--panel2);
  --ui-bg-accented: var(--accent-soft);
  --ui-text: var(--text);
  --ui-text-highlighted: var(--text);
  --ui-text-muted: var(--muted);
  --ui-text-toned: var(--muted);
  --ui-text-inverted: var(--accent-ink);
  --ui-border: var(--border);
  --ui-border-muted: var(--border);
  --ui-border-accented: var(--border-strong);
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.4;
  background: var(--bg);
  color: var(--text);
}

.app.app--dark {
  color-scheme: dark;
  --bg: #0d1117;
  --dots: #262d38;
  --panel: #161b22;
  --panel2: #1c232c;
  --border: #29313c;
  --border-strong: #3a4452;
  --text: #e6eaf0;
  --muted: #8f9aa9;
  --accent: #3cc4e6;
  --accent-ink: #04222b;
  --accent-soft: rgba(60, 196, 230, 0.14);
  --message-edge: #e9b565;
  --danger: #ff7b7b;
  --danger-soft: rgba(255, 123, 123, 0.14);
  --warning: #e7b04a;
  --warning-soft: rgba(231, 176, 74, 0.14);
  --success: #5bcb78;
  --success-soft: rgba(91, 203, 120, 0.14);
  --runtime-spring-bg: rgba(116, 209, 142, 0.13);
  --runtime-spring-fg: #74d18e;
  --runtime-dotnet-bg: rgba(185, 164, 255, 0.13);
  --runtime-dotnet-fg: #b9a4ff;
  --shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 8px 24px rgba(0, 0, 0, 0.35);
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.45);
  --shadow-lg: 0 16px 48px rgba(0, 0, 0, 0.55);
  --edge: #4b5563;
  --trace: #3cc4e6;
  --trace-soft: rgba(60, 196, 230, 0.22);
  --timing-label-bg: #161b22;
  --timing-label-text: #e6eaf0;
  --get-fg: #8db8ff;
  --get-bg: rgba(141, 184, 255, 0.13);
  --post-fg: #6ed8c6;
  --post-bg: rgba(110, 216, 198, 0.13);
  --put-fg: #e9b565;
  --put-bg: rgba(233, 181, 101, 0.13);
  --patch-fg: #f59acf;
  --patch-bg: rgba(245, 154, 207, 0.13);
  --delete-fg: #ff7b7b;
  --delete-bg: rgba(255, 123, 123, 0.14);
}

.app button,
.app input,
.app select,
.app textarea {
  font-family: inherit;
  color: inherit;
}

.app button {
  cursor: pointer;
}

.app__surface,
.app__graph-node {
  background: var(--panel);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
}

.app__graph-flow {
  background-color: var(--bg);
  background-image: radial-gradient(circle, var(--dots) 1.1px, transparent 1.3px);
  background-size: 22px 22px;
}

.vue-flow__background {
  background-color: transparent;
}

.app .vue-flow__minimap {
  bottom: 76px;
  right: 16px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--panel);
}

.app .vue-flow__controls {
  bottom: 76px;
  left: 16px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--panel);
  box-shadow: var(--shadow);
}

.app .vue-flow__controls-button {
  border-bottom: 1px solid var(--border);
  background: var(--panel);
  color: var(--text);
  fill: var(--text);
}

.vue-flow__controls-button svg,
.vue-flow__controls-button svg path {
  fill: var(--text);
}

.vue-flow__edge-path {
  stroke: var(--edge);
  stroke-width: 2;
}

.vue-flow__edge.app__flow-edge--observed .vue-flow__edge-path,
.vue-flow__edge.app__flow-edge--running .vue-flow__edge-path {
  stroke: var(--accent);
  stroke-width: 3.5;
}
.vue-flow__edge.app__flow-edge--message.app__flow-edge--observed .vue-flow__edge-path {
  stroke: var(--message-edge);
}

.vue-flow__edge-text {
  fill: var(--timing-label-text);
  font-size: 10px;
}

.vue-flow__edge-textbg {
  fill: var(--timing-label-bg);
}

.app__graph-node--service {
  width: 264px;
  overflow: visible;
}

.app__graph-node {
  box-shadow: var(--shadow-sm);
}

.app__toolbar-group {
  display: flex;
  flex: none;
  align-items: center;
  gap: 2px;
  padding: 0 4px;
  border-left: 1px solid var(--border);
}

.app__toolbar-group:first-child {
  border-left: 0;
}

.app__toolbar-button {
  display: inline-grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 8px;
  color: var(--muted);
}

.app__toolbar-button:hover,
.app__toolbar-button[aria-pressed="true"] {
  background: var(--panel2);
  color: var(--text);
}

.app__toolbar-button[aria-pressed="true"] {
  color: var(--accent);
}

.app__toolbar-group--account {
  margin-left: 2px;
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
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--panel);
  padding: 0 12px;
  box-shadow: var(--shadow);
  color: var(--muted);
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
  border-top: 1.5px solid var(--edge);
}

.app__legend-line--message {
  border-top-style: dashed;
}

.app__legend-line--observed {
  border-top: 2.25px solid var(--trace);
}

.app__legend-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: var(--trace);
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
  border: 1.5px solid var(--trace);
  border-radius: 11px;
  background: var(--panel);
  padding: 0 8px;
  box-shadow: var(--shadow-sm);
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  cursor: help;
}

.app__edge-label-count {
  color: var(--muted);
  font-weight: 500;
}

.app__edge-label--unavailable {
  border-style: dashed;
  border-color: var(--warning);
  color: var(--warning);
}

.app__edge-label-popover {
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  display: none;
  width: 230px;
  padding: 10px 12px;
  transform: translateX(-50%);
  border: 1px solid var(--border-strong);
  border-radius: 9px;
  background: var(--panel);
  box-shadow: var(--shadow-lg);
  color: var(--text);
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
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 11.5px;
}

.app__edge-label-popover-row .font-mono {
  color: var(--text);
  font-weight: 500;
}

.app__edge-label-note {
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.45;
}

.app__trigger-protocol--http {
  color: #1d56b0;
  background: #e5edfa;
}

.app__trigger-protocol--grpc {
  color: #146c62;
  background: #dff3ef;
}

.app__trigger-protocol--websocket {
  color: #6842ad;
  background: #eee8fb;
}

.app.app--dark .app__trigger-protocol--http {
  color: #8db8ff;
  background: #26344a;
}

.app.app--dark .app__trigger-protocol--grpc {
  color: #6ed8c6;
  background: #213b38;
}

.app.app--dark .app__trigger-protocol--websocket {
  color: #bca4ff;
  background: #332d4a;
}

.app__trigger-last-chip--completed {
  color: var(--success);
}

.app__trigger-last-chip--failed {
  color: var(--danger);
}

.app__mock-response-panel {
  box-shadow: var(--shadow-lg);
}

@media (max-width: 899px) {
  .app__graph-legend-panel {
    display: none;
  }
}

.app.app--dark .app__message-queue-kafka-icon {
  filter: brightness(0) invert(1);
}

.vue-flow__node.app__flow-node--service-observed .app__graph-node {
  border-color: var(--accent);
  box-shadow:
    0 0 0 2px var(--accent-soft),
    var(--shadow);
}

.vue-flow__node.app__flow-node--service-error .app__graph-node--service {
  border-color: var(--danger);
  box-shadow:
    0 0 0 2px var(--danger-soft),
    var(--shadow);
}

.vue-flow__node.selected .app__graph-node {
  border-color: var(--accent);
  outline: 2px solid var(--accent);
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
  color: var(--get-fg);
  background: var(--get-bg);
}

.app__method-tag--post {
  color: var(--post-fg);
  background: var(--post-bg);
}

.app__method-tag--put {
  color: var(--put-fg);
  background: var(--put-bg);
}

.app__method-tag--patch {
  color: var(--patch-fg);
  background: var(--patch-bg);
}

.app__method-tag--delete {
  color: var(--delete-fg);
  background: var(--delete-bg);
}

.app__status-text,
.app__run-state--failed {
  color: var(--danger);
}

.app__run-state--failed {
  background: var(--danger-soft);
}

.app__run-state--completed {
  color: var(--success);
  background: var(--success-soft);
}

.app__run-state--running {
  color: var(--warning);
  background: var(--warning-soft);
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
  border: 2px solid var(--panel);
  background: var(--edge);
}

.app .app__endpoint-handle {
  left: -5px;
}
.app .app__endpoint-source {
  right: -5px;
}
.app .app__endpoint-source--connected {
  background: var(--edge);
}
.app .app__endpoint-source--message {
  background: var(--edge);
}
.app .app__endpoint-source--authoring {
  border-color: var(--edge);
  background: var(--panel);
}
.app .app__endpoint-handle--observed,
.app .app__endpoint-source--observed {
  background: var(--accent);
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
</style>
