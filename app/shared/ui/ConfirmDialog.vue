<script setup lang="ts">
defineProps<{
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
}>();

const emit = defineEmits<{ confirm: []; cancel: [] }>();
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    :description="description"
    @update:open="(value: boolean) => !value && emit('cancel')"
  >
    <template #footer>
      <UButton type="button" color="neutral" variant="outline" @click="emit('cancel')">
        Cancel
      </UButton>
      <UButton type="button" :color="destructive ? 'error' : 'primary'" @click="emit('confirm')">
        {{ confirmLabel }}
      </UButton>
    </template>
  </UModal>
</template>
