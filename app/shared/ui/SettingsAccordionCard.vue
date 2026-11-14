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
    class="flex items-center overflow-hidden rounded-[9px] border border-default bg-default"
  >
    <UButton
      color="neutral"
      variant="ghost"
      type="button"
      class="min-w-0 flex-1 text-left"
      :aria-label="`Edit ${title}`"
      @click="emit('select')"
    >
      <slot name="leading" />
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="truncate font-mono text-[12.5px] font-semibold">{{ title }}</span>
        <span v-if="subtitle" class="truncate text-[11.5px] text-muted">{{ subtitle }}</span>
      </span>
      <slot name="summary" />
      <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-muted" />
    </UButton>
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
        class="shrink-0"
        :aria-label="deleteLabel"
        :title="deleteLabel"
        @click.stop.prevent="emit('delete')"
      >
        <UIcon name="i-lucide-trash" class="size-4" aria-hidden="true" />
      </UButton>
    </div>
  </div>
  <div v-else :id="id" class="relative flex flex-col">
    <UAccordion
      :items="items"
      type="single"
      collapsible
      :unmount-on-hide="false"
      :model-value="props.open ? 'settings-card' : undefined"
      :ui="{ trigger: 'pr-20', body: 'flex flex-col gap-4' }"
      @update:model-value="updateOpen"
    >
      <template #default>
        <div class="flex min-w-0 flex-1 flex-col">
          <strong>{{ title }}</strong>
          <span v-if="subtitle" class="truncate text-[10px] text-muted">{{ subtitle }}</span>
        </div>
      </template>
      <template #body>
        <slot />
      </template>
    </UAccordion>
    <div class="absolute right-2 top-4 z-[2] flex items-center gap-1.5" @click.stop @keydown.stop>
      <slot name="actions" />
      <UButton
        v-if="!props.hideDelete"
        type="button"
        color="error"
        variant="outline"
        class="shrink-0"
        :aria-label="deleteLabel"
        :title="deleteLabel"
        @click.stop.prevent="emit('delete')"
      >
        <UIcon name="i-lucide-trash" class="size-4" aria-hidden="true" />
      </UButton>
    </div>
  </div>
</template>
