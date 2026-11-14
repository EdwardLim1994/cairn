<script setup lang="ts">
import type { MockApiRunResult } from "../entities/mock-api";

defineProps<{ result?: MockApiRunResult; running: boolean }>();
const emit = defineEmits<{ close: [] }>();

function prettyResponse(value: string | null) {
  if (!value) return "No response body";
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}
</script>

<template>
  <div
    v-if="result?.id && !running"
    class="border border-default bg-default shadow-md absolute right-4 top-[88px] z-30 w-[min(390px,calc(100vw-32px))] max-h-[38vh] overflow-hidden rounded-xl"
  >
    <header class="flex items-center justify-between border-b border-default px-3 py-2">
      <div class="flex items-center gap-2.5">
        <strong class="text-xs">Latest run</strong>
        <span :class="`app__run-state--${result.status}`">
          {{ result.status }} | {{ result.grpcStatusName ?? result.responseStatus ?? "-" }}
        </span>
      </div>
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        aria-label="Close run details"
        @click="emit('close')"
      >
        <UIcon name="i-lucide-x" class="size-4" aria-hidden="true" />
      </UButton>
    </header>
    <div class="max-h-[calc(38vh-42px)] overflow-auto p-3">
      <p v-if="result.error" class="app__status-text app__status-text--error">{{ result.error }}</p>
      <pre
        class="m-0 max-h-[150px] overflow-auto whitespace-pre-wrap [overflow-wrap:anywhere] text-[10px]"
        >{{ prettyResponse(result.responseBody) }}</pre>
      <small v-if="result.traceId" class="mt-2 block text-[9px] text-muted">
        Trace {{ result.traceId }} | flow
        {{ result.flow?.incomplete ? "incomplete" : result.flow?.status || "pending" }}
      </small>
    </div>
  </div>
</template>
