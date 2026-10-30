<script setup lang="ts">
import type { MockApiRunResult } from "../models/mock-api";

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
  <div v-if="result?.id && !running" class="app__run-drawer app__surface">
    <header>
      <div>
        <strong>Latest run</strong>
        <span :class="`app__run-state app__run-state--${result.status}`">
          {{ result.status }} | {{ result.responseStatus ?? "-" }}
        </span>
      </div>
      <button class="app__icon-button" aria-label="Close run details" @click="emit('close')">
        <svg class="app__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 6 12 12M18 18 6 6" />
        </svg>
      </button>
    </header>
    <div class="app__run-details">
      <p v-if="result.error" class="app__status-text app__status-text--error">{{ result.error }}</p>
      <pre>{{ prettyResponse(result.responseBody) }}</pre>
      <small v-if="result.traceId">
        Trace {{ result.traceId }} | flow
        {{ result.flow?.incomplete ? "incomplete" : result.flow?.status || "pending" }}
      </small>
    </div>
  </div>
</template>
