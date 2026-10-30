<script setup lang="ts">
defineProps<{
  id?: string;
  title: string;
  subtitle?: string;
  deleteLabel: string;
  open?: boolean;
}>();

const emit = defineEmits<{
  delete: [];
  toggle: [open: boolean];
}>();
</script>

<template>
  <details
    :id="id"
    class="app__endpoint-form-card"
    :open="open"
    @toggle="emit('toggle', ($event.currentTarget as HTMLDetailsElement).open)"
  >
    <summary class="app__endpoint-form-head app__endpoint-form-summary">
      <div class="app__endpoint-summary-title">
        <button
          type="button"
          class="app__endpoint-delete-button"
          :aria-label="deleteLabel"
          :title="deleteLabel"
          @click.stop.prevent="emit('delete')"
        >
          <svg class="app__icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" />
          </svg>
        </button>
        <div class="app__endpoint-summary-copy">
          <strong>{{ title }}</strong>
          <span v-if="subtitle">{{ subtitle }}</span>
        </div>
      </div>
    </summary>
    <slot />
  </details>
</template>
