<script setup lang="ts">
defineProps<{ serviceCount: number; allNodesCollapsed: boolean; dark: boolean }>();
const emit = defineEmits<{ toggleAll: []; toggleTheme: [] }>();
</script>

<template>
  <header
    class="app__surface absolute left-4 right-4 top-3.5 z-30 flex h-[62px] items-center gap-3 rounded-2xl px-3.5 max-[720px]:left-2 max-[720px]:right-2 max-[720px]:top-2 max-[720px]:h-[54px] max-[720px]:px-[9px]"
  >
    <div
      class="grid size-[34px] place-items-center rounded-lg bg-[var(--accent)] font-mono text-xs font-semibold text-[var(--accent-ink)]"
    >
      SG
    </div>
    <div class="flex flex-col leading-[1.1]">
      <strong class="text-sm">Cairn</strong
      ><span class="mt-1 text-[9px] tracking-widest text-[var(--muted)] max-[720px]:hidden"
        >DATA FLOW OBSERVABILITY</span
      >
    </div>
    <div class="ml-auto flex items-center gap-2 max-[720px]:gap-[5px]">
      <span class="px-2 text-xs text-[var(--muted)] max-[720px]:hidden"
        ><i class="mr-1.5 inline-block size-[7px] rounded-full bg-[#15966f]"></i>
        {{ serviceCount }} services</span
      >
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        class="inline-grid size-[34px] place-items-center rounded-lg border border-[var(--border)] bg-[var(--panel)] p-0 leading-none hover:bg-[var(--panel2)]"
        :aria-label="allNodesCollapsed ? 'Expand all nodes' : 'Collapse all nodes'"
        :title="allNodesCollapsed ? 'Expand all nodes' : 'Collapse all nodes'"
        @click.stop="emit('toggleAll')"
      >
        <UIcon
          :name="allNodesCollapsed ? 'i-lucide-expand' : 'i-lucide-minimize-2'"
          class="size-4"
          aria-hidden="true"
        />
      </UButton>
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        class="inline-grid size-[34px] place-items-center rounded-lg border border-[var(--border)] bg-[var(--panel)] p-0 leading-none hover:bg-[var(--panel2)]"
        :aria-label="dark ? 'Use light theme' : 'Use dark theme'"
        @click.stop="emit('toggleTheme')"
      >
        <UIcon :name="dark ? 'i-lucide-sun' : 'i-lucide-moon'" class="size-4" aria-hidden="true" />
      </UButton>
    </div>
  </header>
</template>
