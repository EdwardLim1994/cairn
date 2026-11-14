<script setup lang="ts">
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{ addService: []; addMessageQueue: [] }>();
const items = [
  [
    {
      label: "Add new service",
      icon: "i-lucide-plus",
      onSelect: () => emit("addService"),
    },
    {
      label: "Add message queue",
      icon: "i-lucide-radio-tower",
      onSelect: () => emit("addMessageQueue"),
    },
  ],
];
</script>

<template>
  <UContextMenu
    v-model:open="open"
    :items="items"
    :portal="false"
    :ui="{ content: 'fixed z-[60]' }"
  >
    <slot />
  </UContextMenu>
</template>
