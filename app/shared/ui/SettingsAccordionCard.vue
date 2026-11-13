<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  id?: string;
  title: string;
  subtitle?: string;
  deleteLabel: string;
  open?: boolean;
  compact?: boolean;
  navigation?: boolean;
  hideDelete?: boolean;
}>();

const emit = defineEmits<{
  delete: [];
  toggle: [open: boolean];
  select: [];
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
    v-if="props.navigation"
    :id="id"
    class="flex items-center overflow-hidden rounded-[9px] border border-[var(--border)] bg-[var(--panel)]"
  >
    <button
      type="button"
      class="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2.5 text-left hover:bg-[var(--panel2)]"
      :aria-label="`Edit ${title}`"
      @click="emit('select')"
    >
      <slot name="leading" />
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="truncate font-mono text-[12.5px] font-semibold">{{ title }}</span>
        <span v-if="subtitle" class="truncate text-[11.5px] text-[var(--muted)]">{{
          subtitle
        }}</span>
      </span>
      <slot name="summary" />
      <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-[var(--muted)]" />
    </button>
    <div
      v-if="!props.hideDelete || $slots.actions"
      class="flex shrink-0 items-center gap-1.5 px-2"
      @click.stop
      @keydown.stop
    >
      <slot name="actions" />
      <UButton
        v-if="!props.hideDelete"
        type="button"
        color="error"
        variant="outline"
        class="grid size-6 shrink-0 place-items-center rounded-md border border-[var(--danger)] bg-transparent p-0 text-[var(--danger)] hover:bg-[var(--danger-soft)]"
        :aria-label="deleteLabel"
        :title="deleteLabel"
        @click.stop.prevent="emit('delete')"
      >
        <UIcon name="i-lucide-trash" class="size-4" aria-hidden="true" />
      </UButton>
    </div>
  </div>
  <div
    v-else
    :id="id"
    class="relative flex flex-col rounded-xl border border-[var(--border)] bg-[var(--panel2)]"
    :class="[
      props.compact ? 'gap-0 px-2 py-2' : 'gap-2.5 p-3',
      !props.open && (props.compact ? 'min-h-12 justify-center' : 'min-h-14 justify-center'),
    ]"
  >
    <UAccordion
      :items="items"
      type="single"
      collapsible
      :unmount-on-hide="false"
      :model-value="props.open ? 'settings-card' : undefined"
      :ui="{
        root: 'w-full',
        item: 'w-full border-0',
        trigger: $slots.actions
          ? 'flex min-h-8 w-full cursor-pointer items-center gap-2 !py-0 pl-1 !pr-20 text-left'
          : 'flex min-h-8 w-full cursor-pointer items-center gap-2 !py-0 pl-1 !pr-10 text-left',
        label: 'flex min-w-0 flex-1 items-center',
        trailingIcon: 'order-first text-[var(--muted)] transition-transform duration-150',
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
    <div
      class="absolute right-2 z-[2] flex items-center gap-1.5"
      :class="props.compact ? 'top-3.5' : 'top-4'"
      @click.stop
      @keydown.stop
    >
      <slot name="actions" />
      <UButton
        v-if="!props.hideDelete"
        type="button"
        color="error"
        variant="outline"
        class="grid size-6 shrink-0 place-items-center rounded-md border border-[var(--danger)] bg-transparent p-0 text-[var(--danger)] hover:bg-[var(--danger-soft)]"
        :aria-label="deleteLabel"
        :title="deleteLabel"
        @click.stop.prevent="emit('delete')"
      >
        <UIcon name="i-lucide-trash" class="size-4" aria-hidden="true" />
      </UButton>
    </div>
  </div>
</template>
