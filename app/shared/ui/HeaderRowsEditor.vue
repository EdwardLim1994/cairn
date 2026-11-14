<script setup lang="ts">
const rows = defineModel<Array<{ name: string; value: string }> | undefined>({ required: true });
const props = withDefaults(defineProps<{ label?: string; ariaPrefix?: string }>(), {
  label: "Custom headers",
  ariaPrefix: "Custom header",
});

function addRow() {
  rows.value ??= [];
  rows.value.push({ name: "", value: "" });
}
</script>

<template>
  <div
    class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[10px] [&>span]:font-medium [&>span]:text-muted"
  >
    <div class="flex items-center justify-between">
      <span>{{ props.label }}</span>
      <UButton type="button" @click="addRow">Add header</UButton>
    </div>
    <div
      v-for="(header, row) in rows"
      :key="row"
      class="grid grid-cols-[1fr_1fr_auto] items-center gap-2"
    >
      <UInput v-model="header.name" :aria-label="`${props.ariaPrefix} name`" placeholder="Header" />
      <UInput
        v-model="header.value"
        :aria-label="`${props.ariaPrefix} value`"
        placeholder="Value or {{variable}}"
      />
      <UButton
        type="button"
        :aria-label="`Remove ${props.ariaPrefix.toLowerCase()} row`"
        @click="rows?.splice(row, 1)"
        >Remove</UButton
      >
    </div>
  </div>
</template>
