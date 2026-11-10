<script setup lang="ts">
import { yaml } from "@codemirror/lang-yaml";
import { autocompletion } from "@codemirror/autocomplete";
import { Codemirror } from "vue-codemirror";
import { computed, ref, watch } from "vue";
import { parse } from "yaml";
import { graphCodeManifestSchema, type GraphCodeManifest } from "#shared/api/graph-code";
import { graphCodeCompletions } from "../utils/graph-code-editor";
import WorkspaceDrawer from "./WorkspaceDrawer.vue";

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
const copyError = ref("");
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
    copyError.value = "";
  },
);
watch(
  draft,
  () => {
    if (skipNextDraftWatch) {
      skipNextDraftWatch = false;
      return;
    }
    copyError.value = "";
    validate();
  },
  { flush: "sync" },
);

const extensions = [yaml(), autocompletion({ override: [graphCodeCompletions] })];

function validate() {
  error.value = "";
  let value: unknown;
  try {
    value = parse(draft.value);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Invalid YAML";
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
const manifestSummary = computed(() => {
  const manifest = validate();
  if (!manifest) return "Invalid graph YAML";
  const topicCount = manifest.version === 2 ? manifest.destinations.length : 0;
  const mockApiCount = manifest.version === 2 ? (manifest.mockApis?.length ?? 0) : 0;
  return `cairn.graph.yaml · ${manifest.services.length} services · ${topicCount} topics · ${mockApiCount} mock APIs`;
});

async function copyCode() {
  try {
    await navigator.clipboard.writeText(draft.value);
    copyError.value = "";
  } catch {
    copyError.value = "Could not copy graph YAML to the clipboard";
  }
}

function downloadCode() {
  const blobUrl = URL.createObjectURL(new Blob([draft.value], { type: "application/yaml" }));
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = "cairn.graph.yaml";
  anchor.click();
  URL.revokeObjectURL(blobUrl);
}
</script>

<template>
  <WorkspaceDrawer :open="open" @update:open="(value: boolean) => !value && discard()">
    <template #title>Graph as code</template>
    <template #description>{{ manifestSummary }}</template>
    <template #body>
      <div class="flex items-center gap-2">
        <span
          class="rounded-full px-2 py-1 text-[10px] font-semibold"
          :class="
            errors.length
              ? 'bg-[var(--danger-soft)] text-[var(--danger)]'
              : 'bg-[var(--success-soft)] text-[var(--success)]'
          "
        >
          {{ errors.length ? "Invalid" : "Valid" }}
        </span>
        <p class="text-xs text-[var(--muted)]">
          In sync with the canvas. Edits here replace the graph when applied.
        </p>
      </div>
      <div class="flex items-center justify-between gap-3">
        <p class="text-xs text-[var(--muted)]">
          YAML contains services, endpoints, and outbound calls. Existing JSON files are supported.
        </p>
        <UButton type="button" color="neutral" variant="outline" @click="importInput?.click()">
          Import
        </UButton>
        <input
          ref="importInput"
          class="hidden"
          type="file"
          accept="application/yaml,.yaml,.yml,application/json,.json"
          aria-label="Import graph YAML or JSON"
          @change="importFile"
        />
      </div>
      <Codemirror
        v-model="draft"
        :extensions="extensions"
        :tab-size="2"
        class="min-h-0 flex-1 overflow-auto rounded-lg border border-[var(--border)] text-xs"
        aria-label="Service graph YAML"
      />
      <div
        v-if="errors.length"
        class="rounded-lg border border-[var(--danger)] p-3 text-xs text-[var(--danger)]"
        role="alert"
      >
        <p v-for="message in errors" :key="message">{{ message }}</p>
      </div>
      <p v-if="copyError" class="text-xs text-[var(--danger)]" role="status">
        {{ copyError }}
      </p>
    </template>
    <template #footer>
      <UButton type="button" :disabled="applying" @click="apply">
        {{ applying ? "Applying..." : "Apply changes" }}
      </UButton>
      <UButton type="button" color="neutral" variant="outline" @click="copyCode">Copy</UButton>
      <UButton type="button" color="neutral" variant="ghost" @click="downloadCode"
        >Download .yaml</UButton
      >
    </template>
  </WorkspaceDrawer>
</template>
