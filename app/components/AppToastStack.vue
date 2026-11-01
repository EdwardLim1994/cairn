<script setup lang="ts">
defineProps<{ errorMessage: string; warnings: { id: number; message: string }[] }>();
const emit = defineEmits<{ dismissError: []; dismissWarning: [id: number] }>();
</script>

<template>
  <div
    v-if="errorMessage || warnings.length"
    class="absolute right-[18px] top-[88px] z-[80] flex max-h-[60vh] w-[min(520px,calc(100vw-36px))] flex-col gap-2 overflow-y-auto"
  >
    <UAlert
      v-if="errorMessage"
      :title="errorMessage"
      color="error"
      variant="soft"
      :close="{ 'aria-label': 'Dismiss error' }"
      class="flex justify-between gap-3 rounded-lg bg-[var(--danger-soft)] p-3 text-xs text-[var(--danger)] shadow-[var(--shadow)]"
      :ui="{ close: 'border-0 bg-transparent text-inherit text-[17px]' }"
      role="alert"
      @update:open="(open) => !open && emit('dismissError')"
    />
    <output
      v-for="warning in warnings"
      :key="warning.id"
      class="flex justify-between gap-3 rounded-lg bg-[var(--warning-soft)] p-3 text-xs text-[var(--warning)] shadow-[var(--shadow)]"
      aria-live="polite"
    >
      <UAlert
        :title="warning.message"
        color="warning"
        variant="soft"
        :close="{ 'aria-label': 'Dismiss import warning' }"
        class="w-full"
        :ui="{ close: 'border-0 bg-transparent text-inherit text-[17px]' }"
        @update:open="(open) => !open && emit('dismissWarning', warning.id)"
      />
    </output>
  </div>
</template>
