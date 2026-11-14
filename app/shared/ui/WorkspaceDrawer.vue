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
      <div
        :class="drawerUi.header"
        class="flex w-full items-center justify-between gap-2 px-2 pb-3 pl-4 pt-3"
      >
        <slot name="back" />
        <div class="flex min-w-0 flex-1 flex-col" data-slot="wrapper">
          <DialogTitle
            data-slot="title"
            class="m-0 truncate text-[15px] font-semibold text-foreground"
            ><slot name="title"
          /></DialogTitle>
          <DialogDescription data-slot="description" class="mt-0.5 text-xs leading-[1.4] text-muted"
            ><slot name="description"
          /></DialogDescription>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <slot name="actions" />
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            class="grid size-8 place-items-center rounded-md p-0 text-[var(--muted)] hover:bg-[var(--panel2)] hover:text-[var(--text)]"
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
    "absolute z-[71] !right-3 !bottom-3 !top-[96px] flex !h-[calc(100dvh-108px)] !max-h-[calc(100dvh-108px)] w-[33.333vw] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-xl border border-border bg-surface text-foreground shadow-[var(--shadow-lg)] max-[720px]:!right-2 max-[720px]:!bottom-2 max-[720px]:!left-2 max-[720px]:!top-[80px] max-[720px]:!h-[calc(100dvh-88px)] max-[720px]:!max-h-[calc(100dvh-88px)] max-[720px]:w-auto max-[720px]:max-w-none",
    props.ui.content,
  ],
  header: [
    "flex min-h-[58px] items-center justify-between border-b border-border px-2 pb-3 pl-4 pt-3",
    props.ui.header,
  ],
  body: [
    "flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-4 pb-[18px] pt-[14px]",
    props.ui.body,
  ],
  footer: ["flex items-center gap-2 border-t border-border px-4 py-2.5", props.ui.footer],
}));
</script>
