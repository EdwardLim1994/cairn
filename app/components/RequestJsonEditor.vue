<script setup lang="ts">
import { computed } from "vue";
import { Codemirror } from "vue-codemirror";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { autocompletion, type CompletionContext } from "@codemirror/autocomplete";
import { linter } from "@codemirror/lint";
import { EditorView } from "@codemirror/view";
import { variableCompletions, variablePlaceholderExtension } from "../utils/request-editor";

const props = defineProps<{ modelValue: string; variables: Array<{ name: string }> }>();
const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const extensions = computed(() => [
  json(),
  linter(jsonParseLinter()),
  autocompletion({
    override: [(context: CompletionContext) => variableCompletions(context, props.variables)],
  }),
  variablePlaceholderExtension,
  EditorView.lineWrapping,
  EditorView.theme({
    "&": { minHeight: "120px", maxHeight: "260px" },
    ".cm-scroller": { overflow: "auto" },
  }),
]);
</script>

<template>
  <Codemirror
    :model-value="props.modelValue"
    :extensions="extensions"
    :autofocus="false"
    :placeholder="'{}'"
    aria-label="Mock API request JSON"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
