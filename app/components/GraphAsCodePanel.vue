<script setup lang="ts">
import { json } from "@codemirror/lang-json";
import { autocompletion } from "@codemirror/autocomplete";
import { Codemirror } from "vue-codemirror";
import { computed, ref, watch } from "vue";
import { graphCodeManifestSchema, type GraphCodeManifest } from "#shared/api/graph-code";
import { graphCodeCompletions } from "../utils/graph-code-editor";

const props = defineProps<{
  open: boolean;
  initialCode: string;
  applying?: boolean;
}>();
const emit = defineEmits<{
  "update:open": [open: boolean];
  apply: [manifest: GraphCodeManifest];
}>();
const draft = ref("");
const baseline = ref("");
const importInput = ref<HTMLInputElement | null>(null);
const error = ref("");
let skipNextDraftWatch = false;
watch(
  () => props.open,
  (open) => {
    if (!open) return;
    if (draft.value !== props.initialCode) {
      skipNextDraftWatch = true;
      draft.value = props.initialCode;
    }
    baseline.value = props.initialCode;
    error.value = "";
  },
);
watch(
  draft,
  () => {
    if (skipNextDraftWatch) {
      skipNextDraftWatch = false;
      return;
    }
    validate();
  },
  { flush: "sync" },
);

const extensions = [json(), autocompletion({ override: [graphCodeCompletions] })];

function validate() {
  error.value = "";
  let value: unknown;
  try {
    value = JSON.parse(draft.value);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Invalid JSON";
    return undefined;
  }
  const result = graphCodeManifestSchema.safeParse(value);
  if (!result.success) {
    error.value = result.error.issues
      .map((issue) => `${issue.path.join(".") || "manifest"}: ${issue.message}`)
      .join("\n");
    return undefined;
  }
  return result.data;
}

async function importFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    draft.value = await file.text();
  } catch {
    error.value = "Could not read the selected file";
    return;
  }
  validate();
  input.value = "";
}

function discard() {
  draft.value = baseline.value;
  error.value = "";
  emit("update:open", false);
}

function apply() {
  const manifest = validate();
  if (manifest) emit("apply", manifest);
}

const errors = computed(() => error.value.split("\n").filter(Boolean));
</script>

<template>
  <USlideover
    :open="open"
    side="right"
    :portal="false"
    :close="false"
    :ui="{
      overlay:
        'fixed inset-0 z-[70] flex h-full w-full max-h-none max-w-none justify-end m-0 border-0 bg-[rgba(20,24,28,0.4)] p-0 text-inherit',
      content:
        'z-[71] flex h-full w-[min(680px,100vw)] flex-col overflow-hidden rounded-l-[18px] bg-[var(--panel)] text-inherit max-[720px]:w-full max-[720px]:rounded-none',
      header: 'flex items-center justify-between border-b border-[var(--border)] px-5 py-4',
      body: 'flex flex-1 flex-col gap-3 overflow-auto px-5 py-4',
      footer: 'flex justify-end gap-2 border-t border-[var(--border)] px-5 py-3',
    }"
    @update:open="(value: boolean) => !value && discard()"
  >
    <template #title>Graph as code</template>
    <template #description>Edit and apply a versioned service graph manifest</template>
    <template #body>
      <div class="flex items-center justify-between gap-3">
        <p class="text-xs text-[var(--muted)]">
          JSON contains services, endpoints, and outbound calls.
        </p>
        <UButton type="button" color="neutral" variant="outline" @click="importInput?.click()">
          Import
        </UButton>
        <input
          ref="importInput"
          class="hidden"
          type="file"
          accept="application/json,.json"
          aria-label="Import graph JSON"
          @change="importFile"
        />
      </div>
      <Codemirror
        v-model="draft"
        :extensions="extensions"
        :tab-size="2"
        class="min-h-0 flex-1 overflow-auto rounded-lg border border-[var(--border)] text-xs"
        aria-label="Service graph JSON"
      />
      <div
        v-if="errors.length"
        class="rounded-lg border border-[var(--danger)] p-3 text-xs text-[var(--danger)]"
        role="alert"
      >
        <p v-for="message in errors" :key="message">{{ message }}</p>
      </div>
    </template>
    <template #footer>
      <UButton type="button" color="neutral" variant="outline" @click="discard">Discard</UButton>
      <UButton type="button" :disabled="applying" @click="apply">
        {{ applying ? "Applying..." : "Apply" }}
      </UButton>
    </template>
  </USlideover>
</template>
