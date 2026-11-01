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
    :portal="false"
    :ui="{
      content: 'app__surface fixed z-[60] min-w-[180px] rounded-xl p-1',
      item: 'w-full rounded-lg px-2.5 py-2 text-left text-xs text-[var(--text)] hover:bg-[var(--panel2)] data-[highlighted]:bg-[var(--panel2)]',
      itemLeadingIcon: 'text-[var(--muted)]',
    }"
  >
    <slot />
  </UContextMenu>
</template>
