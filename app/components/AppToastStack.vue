<script setup lang="ts">
defineProps<{ errorMessage: string; warnings: { id: number; message: string }[] }>();
const emit = defineEmits<{ dismissError: []; dismissWarning: [id: number] }>();
</script>

<template>
  <div v-if="errorMessage || warnings.length" class="app__toast-stack">
    <div v-if="errorMessage" class="app__toast app__toast--error" role="alert">
      <span>{{ errorMessage }}</span>
      <button aria-label="Dismiss error" @click="emit('dismissError')">
        <svg class="app__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
    <div
      v-for="warning in warnings"
      :key="warning.id"
      class="app__toast app__toast--warning"
      role="status"
    >
      <span>{{ warning.message }}</span>
      <button aria-label="Dismiss import warning" @click="emit('dismissWarning', warning.id)">
        <svg class="app__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 6 12 12M18 18 6 6" />
        </svg>
      </button>
    </div>
  </div>
</template>
