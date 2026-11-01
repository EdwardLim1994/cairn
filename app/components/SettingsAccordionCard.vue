<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  id?: string;
  title: string;
  subtitle?: string;
  deleteLabel: string;
  open?: boolean;
  compact?: boolean;
}>();

const emit = defineEmits<{
  delete: [];
  toggle: [open: boolean];
  expand: [];
  collapse: [];
}>();

const items = computed(() => [{ value: "settings-card", label: props.title }]);

function updateOpen(value: string | string[] | undefined) {
  const open = value === "settings-card";
  emit("toggle", open);
  emit(open ? "expand" : "collapse");
}
</script>

<template>
  <div
    :id="id"
    class="relative flex flex-col rounded-xl border border-[var(--border)] bg-[var(--panel2)]"
    :class="[
      props.compact ? 'gap-0 px-2 py-2' : 'gap-2.5 p-3',
      !props.open && (props.compact ? 'min-h-12 justify-center' : 'min-h-14 justify-center'),
    ]"
  >
    <UButton
      type="button"
      color="error"
      variant="outline"
      class="absolute z-[1] grid size-6 shrink-0 place-items-center rounded-md border border-[var(--danger)] bg-transparent p-0 text-[var(--danger)] hover:bg-[var(--danger-soft)]"
      :class="props.compact ? 'left-2 top-3' : 'left-3 top-4'"
      :aria-label="deleteLabel"
      :title="deleteLabel"
      @click.stop.prevent="emit('delete')"
    >
      <UIcon name="i-lucide-trash" class="size-4" aria-hidden="true" />
    </UButton>
    <UAccordion
      :items="items"
      type="single"
      collapsible
      :unmount-on-hide="false"
      :model-value="props.open ? 'settings-card' : undefined"
      :ui="{
        root: 'w-full',
        item: 'w-full border-0',
        trigger: 'flex min-h-8 w-full cursor-pointer items-center gap-2 !py-0 pl-[30px] text-left',
        label: 'flex min-w-0 flex-1 items-center',
        trailingIcon: 'text-[var(--muted)] transition-transform duration-150',
        content: 'pt-2.5',
        body: 'flex w-full flex-col gap-2.5',
      }"
      @update:model-value="updateOpen"
    >
      <template #default>
        <div class="flex min-w-0 flex-1 flex-col">
          <strong>{{ title }}</strong>
          <span v-if="subtitle" class="truncate text-[10px] text-[var(--muted)]">{{
            subtitle
          }}</span>
        </div>
      </template>
      <template #body>
        <slot />
      </template>
    </UAccordion>
  </div>
</template>
