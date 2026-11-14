<template>
  <USlideover
    v-bind="$attrs"
    :open="open"
    side="right"
    :portal="false"
    :close="false"
    :modal="false"
    :ui="drawerUi"
    class="w-1/3"
    @update:open="emit('update:open', $event)"
  >
    <template #header>
      <div class="flex w-full items-center justify-between gap-1.5">
        <slot name="back" />
        <div class="flex min-w-0 flex-1 flex-col" data-slot="wrapper">
          <DialogTitle data-slot="title" class="truncate font-semibold text-highlighted"
            ><slot name="title"
          /></DialogTitle>
          <DialogDescription data-slot="description" class="mt-1 text-sm text-muted"
            ><slot name="description"
          /></DialogDescription>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <slot name="actions" />
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            aria-label="Close panel"
            @click="emit('update:open', false)"
          >
            <UIcon name="i-lucide-x" class="size-4" aria-hidden="true" />
          </UButton>
        </div>
      </div>
    </template>
    <template #body>
      <slot name="body" />
    </template>
    <template #footer>
      <slot name="footer" />
    </template>
  </USlideover>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { DialogDescription, DialogTitle } from "reka-ui";

const props = withDefaults(
  defineProps<{
    open: boolean;
    ui?: Record<string, unknown>;
  }>(),
  { ui: () => ({}) },
);
const emit = defineEmits<{ "update:open": [open: boolean] }>();

const drawerUi = computed(() => ({
  ...props.ui,
  overlay: [
    "fixed inset-0 z-[70] flex items-start justify-end bg-transparent p-0",
    props.ui.overlay,
  ],
  content: [
    "absolute z-[71] !right-3 !bottom-3 !top-[96px] flex !h-[calc(100dvh-108px)] !max-h-[calc(100dvh-108px)] w-[33.333vw] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-lg max-[720px]:!right-2 max-[720px]:!bottom-2 max-[720px]:!left-2 max-[720px]:!top-[80px] max-[720px]:!h-[calc(100dvh-88px)] max-[720px]:!max-h-[calc(100dvh-88px)] max-[720px]:w-auto max-[720px]:max-w-none",
    props.ui.content,
  ],
  header: ["", props.ui.header],
  body: ["flex min-h-0 flex-1 flex-col gap-4", props.ui.body],
  footer: ["", props.ui.footer],
}));
</script>
