<script setup lang="ts">
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{ addService: [] }>();
const items = [
  [
    {
      label: "Add new service",
      icon: "i-lucide-plus",
      onSelect: () => emit("addService"),
    },
  ],
];
</script>

<template>
  <UContextMenu
    v-model:open="open"
    :items="items"
    :ui="{
      content: 'app__context-menu app__surface',
      item: 'app__context-menu-item',
      itemLeadingIcon: 'app__context-menu-icon',
    }"
  >
    <slot />
  </UContextMenu>
</template>
