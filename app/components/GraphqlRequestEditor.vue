<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Codemirror } from "vue-codemirror";
import { graphql } from "cm6-graphql";
import { EditorView } from "@codemirror/view";
import RequestJsonEditor from "./RequestJsonEditor.vue";

type GraphqlRequest = { query: string; variables: unknown; operationName?: string };
const props = defineProps<{ modelValue: string; variables: Array<{ name: string }> }>();
const emit = defineEmits<{ "update:modelValue": [value: string] }>();
const query = ref("");
const variablesText = ref("{}");
const operationName = ref("");
let updating = false;

function readRequest(value: string): GraphqlRequest {
  try {
    const parsed = JSON.parse(value) as Partial<GraphqlRequest>;
    return {
      query: typeof parsed.query === "string" ? parsed.query : "",
      variables: parsed.variables ?? {},
      ...(typeof parsed.operationName === "string" && parsed.operationName
        ? { operationName: parsed.operationName }
        : {}),
    };
  } catch {
    return { query: "", variables: {} };
  }
}

watch(
  () => props.modelValue,
  (value) => {
    updating = true;
    const request = readRequest(value);
    query.value = request.query;
    variablesText.value =
      typeof request.variables === "string"
        ? request.variables
        : JSON.stringify(request.variables, null, 2);
    operationName.value = request.operationName ?? "";
    updating = false;
  },
  { immediate: true },
);

function update() {
  if (updating) return;
  let variables: unknown;
  try {
    variables = JSON.parse(variablesText.value || "{}");
  } catch {
    variables = variablesText.value;
  }
  const request: GraphqlRequest = {
    query: query.value,
    variables,
    ...(operationName.value.trim() ? { operationName: operationName.value.trim() } : {}),
  };
  emit("update:modelValue", JSON.stringify(request, null, 2));
}

watch([query, operationName], () => update());
const queryExtensions = computed(() => [graphql(), EditorView.lineWrapping]);
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex flex-col gap-1 text-[10px] font-medium text-[var(--muted)]">
      Query
      <Codemirror
        v-model="query"
        :extensions="queryExtensions"
        :autofocus="false"
        placeholder="query { ... }"
        aria-label="GraphQL query"
      />
    </div>
    <label class="flex flex-col gap-1 text-[10px] font-medium text-[var(--muted)]">
      Operation name (optional)
      <input
        v-model="operationName"
        class="rounded border border-[var(--border)] px-2 py-1 text-xs"
      />
    </label>
    <fieldset class="m-0 flex flex-col gap-1 border-0 p-0">
      <legend class="text-[10px] font-medium text-[var(--muted)]">Variables (JSON)</legend>
      <RequestJsonEditor
        :model-value="variablesText"
        :variables="variables"
        @update:model-value="
          (value) => {
            variablesText = value;
            update();
          }
        "
      />
    </fieldset>
  </div>
</template>
