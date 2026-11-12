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
      <div :class="drawerUi.header" class="flex w-full items-center justify-between gap-2">
        <slot name="back" />
        <div class="flex min-w-0 flex-1 flex-col" data-slot="wrapper">
          <DialogTitle data-slot="title" class="truncate"><slot name="title" /></DialogTitle>
          <DialogDescription data-slot="description"><slot name="description" /></DialogDescription>
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

function appendClass(value: unknown, className: string) {
  return [value, className].filter(Boolean);
}

const drawerUi = computed(() => ({
  ...props.ui,
  overlay: appendClass(
    ["fixed inset-0 z-[70] flex justify-end bg-transparent", props.ui.overlay],
    "app__workspace-drawer-overlay",
  ),
  content: appendClass(
    [
      "absolute z-[71] inset-[76px_12px_12px_auto] flex w-[calc(100vw-24px)] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] shadow-[var(--shadow-lg)] sm:w-1/2 lg:w-1/3",
      props.ui.content,
    ],
    "app__workspace-drawer-content",
  ),
  header: appendClass(
    [
      "flex min-h-[58px] items-center justify-between border-b border-[var(--border)]",
      props.ui.header,
    ],
    "app__workspace-drawer-header",
  ),
  body: appendClass(
    ["flex min-h-0 flex-1 flex-col gap-4 overflow-auto", props.ui.body],
    "app__workspace-drawer-body",
  ),
  footer: appendClass(
    ["flex items-center gap-2 border-t border-[var(--border)]", props.ui.footer],
    "app__workspace-drawer-footer",
  ),
}));
</script>
