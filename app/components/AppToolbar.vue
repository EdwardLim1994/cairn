<script setup lang="ts">
withDefaults(
  defineProps<{
    dark: boolean;
    logsOpen: boolean;
    projectId?: string;
    manageNodesOpen?: boolean;
    mockApisOpen?: boolean;
    historyOpen?: boolean;
    authEnabled?: boolean;
  }>(),
  {
    manageNodesOpen: false,
    mockApisOpen: false,
    historyOpen: false,
    authEnabled: true,
  },
);
const emit = defineEmits<{
  toggleTheme: [];
  openMockApis: [];
  openManageNodes: [];
  openLogs: [];
  openAccessTokens: [];
  openHistory: [];
  signOut: [];
}>();
</script>

<template>
  <header
    class="app__surface absolute left-3 right-3 top-3 z-[80] flex h-14 items-center gap-3 rounded-xl px-3 max-[720px]:left-2 max-[720px]:right-2 max-[720px]:top-2 max-[720px]:h-12 max-[720px]:gap-2 max-[720px]:px-2"
  >
    <div class="app__toolbar-brand flex min-w-0 shrink-0 items-center gap-2.5">
      <svg
        class="size-6 shrink-0 text-[var(--accent)]"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <ellipse cx="12" cy="19" rx="8.5" ry="3.2" opacity=".55" />
        <ellipse cx="12.5" cy="12.5" rx="5.8" ry="2.7" opacity=".75" />
        <ellipse cx="11.5" cy="6.5" rx="3.4" ry="2.1" />
      </svg>
      <strong class="text-[15px] leading-none">Cairn</strong>
      <span
        v-if="projectId"
        class="flex max-w-48 items-center gap-1.5 truncate rounded-md bg-[var(--panel2)] px-2 py-1 text-xs text-[var(--muted)]"
        :title="projectId"
        aria-label="Project ID"
      >
        <span class="shrink-0">Project</span>
        <span class="truncate font-mono">{{ projectId }}</span>
      </span>
    </div>
    <nav
      class="ml-auto flex min-w-0 items-center max-[720px]:overflow-x-auto"
      aria-label="Workspace"
    >
      <fieldset class="app__toolbar-group m-0 min-w-0 border-0">
        <legend class="sr-only">Nodes</legend>
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          class="app__toolbar-button"
          :aria-pressed="manageNodesOpen"
          aria-label="Manage nodes"
          title="Manage nodes"
          @click.stop="emit('openManageNodes')"
        >
          <UIcon name="i-lucide-network" class="size-4" aria-hidden="true" />
        </UButton>
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          class="app__toolbar-button"
          :aria-pressed="mockApisOpen"
          aria-label="Mock APIs"
          title="Mock APIs"
          @click.stop="emit('openMockApis')"
        >
          <UIcon name="i-lucide-play" class="size-4" aria-hidden="true" />
        </UButton>
      </fieldset>
      <fieldset class="app__toolbar-group m-0 min-w-0 border-0">
        <legend class="sr-only">Observe</legend>
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          class="app__toolbar-button"
          :aria-pressed="historyOpen"
          aria-label="Run history"
          title="Run history"
          @click.stop="emit('openHistory')"
        >
          <UIcon name="i-lucide-history" class="size-4" aria-hidden="true" />
        </UButton>
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          class="app__toolbar-button"
          :aria-pressed="logsOpen"
          aria-label="Logs"
          title="Logs"
          @click.stop="emit('openLogs')"
        >
          <UIcon name="i-lucide-list" class="size-4" aria-hidden="true" />
        </UButton>
      </fieldset>
      <fieldset class="app__toolbar-group m-0 min-w-0 border-0">
        <legend class="sr-only">Settings</legend>
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          class="app__toolbar-button"
          aria-label="Manage access tokens"
          title="Access tokens"
          @click.stop="emit('openAccessTokens')"
        >
          <UIcon name="i-lucide-key-round" class="size-4" aria-hidden="true" />
        </UButton>
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          class="app__toolbar-button"
          :aria-label="dark ? 'Use light theme' : 'Use dark theme'"
          :title="dark ? 'Use light theme' : 'Use dark theme'"
          @click.stop="emit('toggleTheme')"
        >
          <UIcon
            :name="dark ? 'i-lucide-sun' : 'i-lucide-moon'"
            class="size-4"
            aria-hidden="true"
          />
        </UButton>
      </fieldset>
      <fieldset
        v-if="authEnabled"
        class="app__toolbar-group app__toolbar-group--account m-0 min-w-0 border-0"
      >
        <legend class="sr-only">Account</legend>
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          class="app__toolbar-button app__toolbar-button--account"
          aria-label="Sign out"
          title="Sign out"
          @click.stop="emit('signOut')"
        >
          <UIcon name="i-lucide-log-out" class="size-4" aria-hidden="true" />
        </UButton>
      </fieldset>
    </nav>
  </header>
</template>
