<script setup lang="ts">
defineProps<{ serviceCount: number; allNodesCollapsed: boolean; dark: boolean }>();
const emit = defineEmits<{ toggleAll: []; toggleTheme: [] }>();
</script>

<template>
  <header class="app__topbar app__surface">
    <div class="app__brand-mark">SG</div>
    <div class="app__brand"><strong>Cairn</strong><span>DATA FLOW OBSERVABILITY</span></div>
    <div class="app__top-actions">
      <span class="app__project-label"><i></i> {{ serviceCount }} services</span>
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        class="app__icon-button"
        :aria-label="allNodesCollapsed ? 'Expand all nodes' : 'Collapse all nodes'"
        :title="allNodesCollapsed ? 'Expand all nodes' : 'Collapse all nodes'"
        @click.stop="emit('toggleAll')"
      >
        <svg class="app__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path v-if="allNodesCollapsed" d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />
          <path v-else d="M8 8H3V3m13 5h5V3M3 16h5v5m13-5h-5v5" />
        </svg>
      </UButton>
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        class="app__icon-button"
        :aria-label="dark ? 'Use light theme' : 'Use dark theme'"
        @click.stop="emit('toggleTheme')"
      >
        <svg class="app__icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle v-if="dark" cx="12" cy="12" r="4" />
          <path
            v-if="dark"
            d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"
          />
          <path v-else d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z" />
        </svg>
      </UButton>
    </div>
  </header>
</template>
