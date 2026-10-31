<script setup lang="ts">
defineProps<{ errorMessage: string; warnings: { id: number; message: string }[] }>();
const emit = defineEmits<{ dismissError: []; dismissWarning: [id: number] }>();
</script>

<template>
  <div v-if="errorMessage || warnings.length" class="app__toast-stack">
    <UAlert
      v-if="errorMessage"
      :title="errorMessage"
      color="error"
      variant="soft"
      :close="{ 'aria-label': 'Dismiss error' }"
      class="app__toast app__toast--error"
      role="alert"
      @update:open="(open) => !open && emit('dismissError')"
    />
    <output
      v-for="warning in warnings"
      :key="warning.id"
      class="app__toast app__toast--warning"
      aria-live="polite"
    >
      <UAlert
        :title="warning.message"
        color="warning"
        variant="soft"
        :close="{ 'aria-label': 'Dismiss import warning' }"
        class="w-full"
        @update:open="(open) => !open && emit('dismissWarning', warning.id)"
      />
    </output>
  </div>
</template>
