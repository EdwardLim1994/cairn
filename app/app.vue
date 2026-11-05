<template>
  <NuxtPage />
</template>

<style>
@import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap");
@import "tailwindcss";
@import "@nuxt/ui";

:root {
  font-family: "IBM Plex Sans", system-ui, sans-serif;
  color-scheme: light;
  --bg: #f2f2ee;
  --dots: #c2c2b8;
  --panel: #fff;
  --panel2: #f3f3ef;
  --border: #d6d6ce;
  --text: #1a1c1e;
  --muted: #585e64;
  --accent: #0f766e;
  --accent-ink: #fff;
  --accent-soft: #d6efeb;
  --danger: #b42318;
  --danger-soft: #fbe4e1;
  --warning: #855b00;
  --warning-soft: #fff0c2;
  --shadow: 0 8px 28px rgba(20, 24, 28, 0.12), 0 1px 2px rgba(20, 24, 28, 0.08);
  --edge: #8a9097;
  --get-fg: #1d4ed8;
  --get-bg: #e3ebfd;
  --post-fg: #047857;
  --post-bg: #daf3e8;
  --put-fg: #9a4a06;
  --put-bg: #fbebd3;
  --patch-fg: #6d28d9;
  --patch-bg: #ece4fb;
  --delete-fg: #b91c1c;
  --delete-bg: #fbe0e0;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

.app {
  background: var(--bg);
  color: var(--text);
}

.app.app--dark {
  color-scheme: dark;
  --bg: #101214;
  --dots: #2b3036;
  --panel: #1a1d20;
  --panel2: #22262a;
  --border: #32373d;
  --text: #e7e9eb;
  --muted: #9ba2a9;
  --accent: #2dd4bf;
  --accent-ink: #06201c;
  --accent-soft: #12312d;
  --danger: #ff8a80;
  --danger-soft: #43211f;
  --warning: #f2c66d;
  --warning-soft: #413518;
  --shadow: 0 10px 32px rgba(0, 0, 0, 0.5);
  --edge: #5c646c;
  --get-fg: #8ab4ff;
  --get-bg: #1c2a47;
  --post-fg: #5ee0a9;
  --post-bg: #123528;
  --put-fg: #f5b861;
  --put-bg: #3c2a12;
  --patch-fg: #bfa2ff;
  --patch-bg: #2e2150;
  --delete-fg: #ff8f8f;
  --delete-bg: #422020;
}

.app button,
.app input,
.app select,
.app textarea {
  font: inherit;
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
}

.vue-flow__edge-text {
  fill: var(--muted);
  font-size: 10px;
}

.app__graph-node--service {
  width: 288px;
  overflow: visible;
}

.vue-flow__node.app__flow-node--service-observed .app__graph-node--service {
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

.app__run-state--completed {
  color: #047857;
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
.app .app__endpoint-handle--collapsed,
.app .app__endpoint-source--collapsed {
  top: 75px;
}
.app .app__service-source {
  right: -5px;
  top: 28px;
}
.app .app__service-source--hidden {
  opacity: 0;
  pointer-events: none;
}
</style>
