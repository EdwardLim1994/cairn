<script setup lang="ts">
import { ref, watch, watchEffect } from "vue";
import SettingsAccordionCard from "./SettingsAccordionCard.vue";
import RequestJsonEditor from "./RequestJsonEditor.vue";
import type { EnvironmentVariable, HeaderTemplateDraft, MockApiDraft } from "../models/mock-api";
import { evaluateMockApiReadiness } from "#shared/utils/mock-api-readiness";

const mockDraft = defineModel<MockApiDraft[]>("mockDraft", { required: true });
const environmentVariables = defineModel<EnvironmentVariable[]>("environmentVariables", {
  required: true,
});
const headerTemplates = defineModel<HeaderTemplateDraft[]>("headerTemplates", { required: true });
const variablesOpen = defineModel<boolean>("variablesOpen", { required: true });
const apisOpen = defineModel<boolean>("apisOpen", { required: true });
const variableDraft = defineModel<{ name: string; value: string }>("variableDraft", {
  required: true,
});
const props = defineProps<{
  environmentVariablesLoading: boolean;
  editingEnvironmentVariableId: string | null;
  expandedEnvironmentVariableId: string | null;
  servicesForSelect: { id: string; label: string }[];
  endpointPathParameterNames: (entry: MockApiDraft) => string[];
  endpointDetails: { id: string; url: string }[];
}>();
const emit = defineEmits<{
  discard: [];
  save: [];
  addVariable: [];
  openVariable: [variable: EnvironmentVariable];
  closeVariable: [variable: EnvironmentVariable];
  updateVariable: [];
  deleteVariable: [variable: EnvironmentVariable];
  importCollection: [event: Event];
  importEnvironment: [event: Event];
  addHeaderTemplate: [];
  deleteHeaderTemplate: [template: HeaderTemplateDraft];
  addMockApi: [];
  removeMockApi: [index: number];
  setMockEndpoint: [entry: MockApiDraft];
  formatRequest: [entry: MockApiDraft];
}>();
const fileInput = ref<HTMLInputElement | null>(null);
const environmentFileInput = ref<HTMLInputElement | null>(null);
const variableSectionItems = [{ value: "variables", label: "Shared environment variables" }];
const mockApiSectionItems = [{ value: "apis", label: "Registered mock APIs" }];
const expandedCardId = ref<string | null>(null);

function expandCard(id: string) {
  const expandedVariableId = props.expandedEnvironmentVariableId;
  if (expandedVariableId && id !== `variable:${expandedVariableId}`) {
    const variable = environmentVariables.value.find(({ id }) => id === expandedVariableId);
    if (variable) emit("closeVariable", variable);
  }
  expandedCardId.value = id;
}

function collapseCard(id: string) {
  if (expandedCardId.value === id) expandedCardId.value = null;
}

function setCardOpen(id: string, open: boolean) {
  if (open) expandCard(id);
  else collapseCard(id);
}

function mockApiKey(entry: MockApiDraft, index: number) {
  return entry.id || `mock-api-${index}`;
}

watch(
  () => props.expandedEnvironmentVariableId,
  (id) => {
    if (id) expandedCardId.value = `variable:${id}`;
    else if (expandedCardId.value?.startsWith("variable:")) expandedCardId.value = null;
  },
  { immediate: true },
);

function endpointOptions() {
  return [
    { label: "Select endpoint", value: "" },
    ...props.servicesForSelect.map(({ id, label }) => ({ label, value: id })),
  ];
}

function templateOptions() {
  return [
    { label: "No template", value: "" },
    ...headerTemplates.value.map(({ id, name }) => ({
      label: name || "Untitled template",
      value: id,
    })),
  ];
}

function addHeaderRow(rows: { name: string; value: string }[]) {
  rows.push({ name: "", value: "" });
}

function removeHeaderRow(rows: { name: string; value: string }[], index: number) {
  rows.splice(index, 1);
}

function preventOutsideDismiss(event: Event) {
  event.preventDefault();
}

function handleOpenChange(open: boolean) {
  if (!open) emit("discard");
}

watchEffect(() => {
  const variables = new Map(environmentVariables.value.map(({ name, value }) => [name, value]));
  for (const entry of mockDraft.value) {
    const template = headerTemplates.value.find(({ id }) => id === entry.headerTemplateId);
    const endpointUrl =
      props.endpointDetails.find(({ id }) => id === entry.targetEndpointId)?.url ?? null;
    const readiness = evaluateMockApiReadiness(
      {
        ...entry,
        headerTemplateExists: !entry.headerTemplateId || Boolean(template),
        customHeaders: entry.customHeaders ?? [],
        active: entry.active ?? false,
      },
      endpointUrl,
      template?.headers ?? [],
      variables,
    );
    if (readiness.status === "draft") entry.active = false;
    entry.status = readiness.status;
    entry.readinessReasons = readiness.reasons;
  }
});
</script>

<template>
  <USlideover
    :open="true"
    side="right"
    :portal="false"
    :close="false"
    :content="{
      'aria-label': 'Mock API settings',
      onInteractOutside: preventOutsideDismiss,
    }"
    :ui="{
      overlay:
        'fixed inset-0 z-[70] flex h-full w-full max-h-none max-w-none justify-end m-0 border-0 bg-[rgba(20,24,28,0.4)] p-0 text-inherit',
      content:
        'z-[71] flex h-full w-[min(520px,100vw)] flex-col overflow-hidden rounded-l-[18px] bg-[var(--panel)] text-inherit max-[720px]:w-full max-[720px]:rounded-none',
      header: 'flex items-center justify-between border-b border-[var(--border)] px-5 py-4',
      body: 'flex flex-1 flex-col gap-3 overflow-auto px-5 py-4',
      footer: 'flex justify-end gap-2 border-t border-[var(--border)] px-5 py-3',
    }"
    @update:open="handleOpenChange"
  >
    <template #title>Mock APIs</template>
    <template #description>Calls linked to registered service endpoints</template>
    <template #body>
      <section class="mt-5">
        <div class="mt-1 flex items-center justify-between gap-2">
          <strong>Shareable header templates</strong>
          <UButton
            type="button"
            class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[11px] font-medium hover:bg-[var(--panel2)]"
            @click="emit('addHeaderTemplate')"
            >New template</UButton
          >
        </div>
        <SettingsAccordionCard
          v-for="template in headerTemplates"
          :key="template.id"
          :title="template.name || 'New header template'"
          :delete-label="`Delete ${template.name || 'header template'}`"
          :open="expandedCardId === `template:${template.id}`"
          @toggle="setCardOpen(`template:${template.id}`, $event)"
          @delete="emit('deleteHeaderTemplate', template)"
        >
          <label
            :for="`header-template-name-${template.id}`"
            class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[10px] [&>span]:font-medium [&>span]:text-[var(--muted)] [&>legend]:text-[10px] [&>legend]:font-medium [&>legend]:text-[var(--muted)]"
          >
            <span>Name</span>
            <UInput
              :id="`header-template-name-${template.id}`"
              v-model="template.name"
              :ui="{
                base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
              }"
            />
          </label>
          <div
            v-for="(header, row) in template.headers"
            :key="row"
            class="grid grid-cols-[1fr_1fr_auto] items-center gap-2"
          >
            <UInput
              v-model="header.name"
              aria-label="Header name"
              placeholder="Header"
              :ui="{
                base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
              }"
            />
            <UInput
              v-model="header.value"
              aria-label="Header value"
              placeholder="Value or {{variable}}"
              :ui="{
                base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
              }"
            />
            <UButton
              type="button"
              aria-label="Remove header row"
              class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[11px] font-medium hover:bg-[var(--panel2)]"
              @click="removeHeaderRow(template.headers, row)"
              >Remove</UButton
            >
          </div>
          <UButton
            type="button"
            class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[11px] font-medium hover:bg-[var(--panel2)]"
            @click="addHeaderRow(template.headers)"
            >Add header</UButton
          >
        </SettingsAccordionCard>
      </section>
      <section class="mt-5">
        <div class="text-xs">
          <UAccordion
            id="shared-environment-variables-toggle"
            class="w-full min-w-0"
            :items="variableSectionItems"
            type="single"
            collapsible
            :unmount-on-hide="false"
            :model-value="variablesOpen ? 'variables' : undefined"
            :ui="{
              root: 'w-full min-w-0',
              item: 'border-0',
              trigger:
                'flex w-full items-center justify-between gap-2 !border-0 !bg-transparent !p-0 text-left text-inherit',
              trailingIcon: 'text-[var(--muted)] transition-transform duration-150',
              content: 'pt-3',
              body: 'w-full',
            }"
            @update:model-value="variablesOpen = $event === 'variables'"
          >
            <template #default><strong>Shared environment variables</strong></template>
            <template #body>
              <div class="mb-3 flex justify-end gap-2">
                <input
                  ref="environmentFileInput"
                  id="postman-environment-file"
                  class="hidden"
                  type="file"
                  accept="application/json,.json"
                  aria-label="Postman environment JSON"
                  @change="emit('importEnvironment', $event)"
                />
                <UButton
                  type="button"
                  color="neutral"
                  variant="outline"
                  class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[11px] font-medium hover:bg-[var(--panel2)]"
                  @click="environmentFileInput?.click()"
                  >Import environment</UButton
                >
                <UButton
                  type="button"
                  color="neutral"
                  variant="outline"
                  class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[11px] font-medium hover:bg-[var(--panel2)]"
                  :disabled="props.environmentVariablesLoading"
                  @click="emit('addVariable')"
                  >New variable</UButton
                >
              </div>
              <div id="shared-environment-variables-content">
                <div v-if="environmentVariables.length" class="grid gap-2">
                  <SettingsAccordionCard
                    v-for="variable in environmentVariables"
                    :key="variable.id"
                    :id="`environment-variable-${variable.id}`"
                    :title="variable.name || 'New variable'"
                    :delete-label="`Delete ${variable.name || 'variable'}`"
                    :open="expandedCardId === `variable:${variable.id}`"
                    @toggle="setCardOpen(`variable:${variable.id}`, $event)"
                    @expand="emit('openVariable', variable)"
                    @collapse="emit('closeVariable', variable)"
                    @delete="emit('deleteVariable', variable)"
                  >
                    <template v-if="props.editingEnvironmentVariableId === variable.id">
                      <label
                        :for="`environment-variable-name-${variable.id}`"
                        class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[10px] [&>span]:font-medium [&>span]:text-[var(--muted)] [&>legend]:text-[10px] [&>legend]:font-medium [&>legend]:text-[var(--muted)]"
                      >
                        <span>Name</span>
                        <UInput
                          :id="`environment-variable-name-${variable.id}`"
                          v-model="variableDraft.name"
                          :ui="{
                            base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
                          }"
                        />
                      </label>
                      <label
                        :for="`environment-variable-value-${variable.id}`"
                        class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[10px] [&>span]:font-medium [&>span]:text-[var(--muted)] [&>legend]:text-[10px] [&>legend]:font-medium [&>legend]:text-[var(--muted)]"
                      >
                        <span>Value</span>
                        <UTextarea
                          :id="`environment-variable-value-${variable.id}`"
                          v-model="variableDraft.value"
                          :ui="{
                            base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
                          }"
                          :rows="2"
                        />
                      </label>
                      <footer
                        class="flex items-center justify-end gap-2 border-t border-[var(--border)] pt-3"
                      >
                        <UButton
                          type="button"
                          color="primary"
                          class="rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-2 py-1.5 text-[11px] font-medium text-[var(--accent-ink)] disabled:opacity-60"
                          v-if="!variable.pendingCreate"
                          @click="emit('updateVariable')"
                        >
                          Update
                        </UButton>
                      </footer>
                    </template>
                  </SettingsAccordionCard>
                </div>
              </div>
            </template>
          </UAccordion>
        </div>
      </section>
      <section class="mt-5">
        <div class="text-xs">
          <UAccordion
            id="registered-mock-apis-toggle"
            class="w-full min-w-0"
            :items="mockApiSectionItems"
            type="single"
            collapsible
            :unmount-on-hide="false"
            :model-value="apisOpen ? 'apis' : undefined"
            :ui="{
              root: 'w-full min-w-0',
              item: 'border-0',
              trigger:
                'flex w-full items-center justify-between gap-2 !border-0 !bg-transparent !p-0 text-left text-inherit',
              trailingIcon: 'text-[var(--muted)] transition-transform duration-150',
              content: 'pt-3',
              body: 'w-full',
            }"
            @update:model-value="apisOpen = $event === 'apis'"
          >
            <template #default><strong>Registered mock APIs</strong></template>
            <template #body>
              <div class="mb-3 flex justify-end gap-2">
                <input
                  ref="fileInput"
                  id="postman-collection-file"
                  class="hidden"
                  type="file"
                  accept="application/json,.json"
                  aria-label="Postman collection JSON"
                  @change="emit('importCollection', $event)"
                />
                <UButton
                  type="button"
                  color="neutral"
                  variant="outline"
                  class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[11px] font-medium hover:bg-[var(--panel2)]"
                  @click="fileInput?.click()"
                >
                  Import APIs
                </UButton>
                <UButton
                  type="button"
                  color="neutral"
                  variant="outline"
                  class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[11px] font-medium hover:bg-[var(--panel2)]"
                  @click="emit('addMockApi')"
                >
                  + New API
                </UButton>
              </div>
              <div id="registered-mock-apis-content" class="flex flex-col gap-y-3">
                <SettingsAccordionCard
                  v-for="(entry, index) in mockDraft"
                  :key="entry.id || `new-${index}`"
                  :id="entry.id ? `mock-api-${entry.id}` : undefined"
                  :title="entry.name || `Mock API ${index + 1}`"
                  :subtitle="
                    servicesForSelect.find((option) => option.id === entry.targetEndpointId)
                      ?.label ?? 'Select service endpoint'
                  "
                  :delete-label="`Remove ${entry.name || `Mock API ${index + 1}`}`"
                  :open="expandedCardId === `mock:${mockApiKey(entry, index)}`"
                  compact
                  @toggle="setCardOpen(`mock:${mockApiKey(entry, index)}`, $event)"
                  @delete="emit('removeMockApi', index)"
                >
                  <template #actions>
                    <div class="flex items-center" @click.stop>
                      <USwitch
                        v-model="entry.active"
                        :aria-label="`${entry.active ? 'Deactivate' : 'Activate'} ${entry.name || `Mock API ${index + 1}`}`"
                        :disabled="entry.status === 'draft'"
                        size="sm"
                      />
                    </div>
                  </template>
                  <label
                    :for="`mock-api-name-${entry.id || index}`"
                    class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[10px] [&>span]:font-medium [&>span]:text-[var(--muted)] [&>legend]:text-[10px] [&>legend]:font-medium [&>legend]:text-[var(--muted)]"
                  >
                    <span>Name</span>
                    <UInput
                      :id="`mock-api-name-${entry.id || index}`"
                      v-model="entry.name"
                      :ui="{
                        base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
                      }"
                      placeholder="e.g. Create order"
                    />
                  </label>
                  <label
                    :for="`mock-api-endpoint-${entry.id || index}`"
                    class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[10px] [&>span]:font-medium [&>span]:text-[var(--muted)] [&>legend]:text-[10px] [&>legend]:font-medium [&>legend]:text-[var(--muted)]"
                  >
                    <span>Service endpoint</span>
                    <USelect
                      :id="`mock-api-endpoint-${entry.id || index}`"
                      v-model="entry.targetEndpointId"
                      :items="endpointOptions()"
                      :ui="{
                        base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
                      }"
                      @update:model-value="emit('setMockEndpoint', entry)"
                    />
                  </label>
                  <label
                    v-for="name in props.endpointPathParameterNames(entry)"
                    :key="name"
                    :for="`mock-api-path-${entry.id || index}-${name}`"
                    class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[10px] [&>span]:font-medium [&>span]:text-[var(--muted)] [&>legend]:text-[10px] [&>legend]:font-medium [&>legend]:text-[var(--muted)]"
                  >
                    <span>Path parameter: {{ name }}</span>
                    <UInput
                      :id="`mock-api-path-${entry.id || index}-${name}`"
                      v-model="entry.pathParameters[name]"
                      :ui="{
                        base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
                      }"
                      :placeholder="`Value or {{${name}}}`"
                    />
                  </label>
                  <label
                    :for="`mock-api-template-${entry.id || index}`"
                    class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[10px] [&>span]:font-medium [&>span]:text-[var(--muted)] [&>legend]:text-[10px] [&>legend]:font-medium [&>legend]:text-[var(--muted)]"
                  >
                    <span>Header template</span>
                    <USelect
                      :id="`mock-api-template-${entry.id || index}`"
                      v-model="entry.headerTemplateId"
                      :items="templateOptions()"
                      :ui="{
                        base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
                      }"
                    />
                  </label>
                  <div
                    class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[10px] [&>span]:font-medium [&>span]:text-[var(--muted)] [&>legend]:text-[10px] [&>legend]:font-medium [&>legend]:text-[var(--muted)]"
                  >
                    <span>Custom headers</span>
                    <div
                      v-for="(header, row) in entry.customHeaders ??= []"
                      :key="row"
                      class="grid grid-cols-[1fr_1fr_auto] items-center gap-2"
                    >
                      <UInput
                        v-model="header.name"
                        aria-label="Custom header name"
                        placeholder="Header"
                        :ui="{
                          base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
                        }"
                      />
                      <UInput
                        v-model="header.value"
                        aria-label="Custom header value"
                        placeholder="Value or {{variable}}"
                        :ui="{
                          base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
                        }"
                      />
                      <UButton
                        type="button"
                        aria-label="Remove custom header row"
                        class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[11px] font-medium hover:bg-[var(--panel2)]"
                        @click="removeHeaderRow(entry.customHeaders!, row)"
                        >Remove</UButton
                      >
                    </div>
                    <UButton
                      type="button"
                      class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[11px] font-medium hover:bg-[var(--panel2)]"
                      @click="addHeaderRow((entry.customHeaders ??= []))"
                      >Add header</UButton
                    >
                  </div>
                  <div
                    class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[10px] [&>span]:font-medium [&>span]:text-[var(--muted)] [&>legend]:text-[10px] [&>legend]:font-medium [&>legend]:text-[var(--muted)]"
                  >
                    <span v-if="entry.status">Status: {{ entry.status }}</span>
                    <ul
                      v-if="entry.readinessReasons?.length"
                      class="list-disc pl-4 text-[10px] text-[var(--muted)]"
                    >
                      <li
                        v-for="reason in entry.readinessReasons"
                        :key="reason.code + reason.message"
                      >
                        {{ reason.message }}
                      </li>
                    </ul>
                  </div>
                  <fieldset
                    class="min-w-0 flex flex-1 flex-col gap-1 m-0 border-0 p-0 [&>legend]:text-[10px] [&>legend]:font-medium [&>legend]:text-[var(--muted)]"
                  >
                    <legend>Request (JSON)</legend>
                    <div class="flex justify-end">
                      <UButton
                        type="button"
                        color="neutral"
                        variant="outline"
                        class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[11px] font-medium hover:bg-[var(--panel2)]"
                        @click="emit('formatRequest', entry)"
                      >
                        Format JSON
                      </UButton>
                    </div>
                    <RequestJsonEditor
                      :model-value="String(entry.requestJson ?? '')"
                      :variables="environmentVariables"
                      @update:model-value="entry.requestJson = $event"
                    />
                  </fieldset>
                  <label
                    :for="`mock-api-description-${entry.id || index}`"
                    class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[10px] [&>span]:font-medium [&>span]:text-[var(--muted)] [&>legend]:text-[10px] [&>legend]:font-medium [&>legend]:text-[var(--muted)]"
                  >
                    <span>Description</span>
                    <UInput
                      :id="`mock-api-description-${entry.id || index}`"
                      v-model="entry.description"
                      :ui="{
                        base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
                      }"
                      placeholder="Optional note"
                    />
                  </label>
                </SettingsAccordionCard>
                <div
                  v-if="!mockDraft.length"
                  class="rounded-lg border border-dashed border-[var(--border)] p-3 text-[11px] text-[var(--muted)]"
                >
                  No mock API rows yet. Add one to get started.
                </div>
              </div>
            </template>
          </UAccordion>
        </div>
      </section>
    </template>
    <template #footer>
      <UButton
        type="button"
        color="neutral"
        variant="outline"
        class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-xs font-medium hover:bg-[var(--panel2)]"
        @click="emit('discard')"
        >Discard</UButton
      >
      <UButton
        type="button"
        class="rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-3 py-2 text-xs font-medium text-[var(--accent-ink)] disabled:opacity-60"
        :disabled="props.environmentVariablesLoading"
        @click="emit('save')"
      >
        Save
      </UButton>
    </template>
  </USlideover>
</template>
