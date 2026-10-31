<script setup lang="ts">
import { ref, watchEffect } from "vue";
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
  <dialog
    open
    class="app__dialog-backdrop"
    aria-modal="true"
    aria-label="Mock API settings"
    @keydown.esc.prevent="emit('discard')"
  >
    <section class="app__side-dialog app__surface">
      <header class="app__dialog-header">
        <div>
          <strong>Mock APIs</strong><span>Calls linked to registered service endpoints</span>
        </div>
      </header>
      <div class="app__dialog-body">
        <section class="app__environment-variable-section">
          <div class="app__section-title">
            <strong>Shareable header templates</strong>
            <UButton
              type="button"
              class="app__button app__button--secondary app__button--small"
              @click="emit('addHeaderTemplate')"
              >New template</UButton
            >
          </div>
          <SettingsAccordionCard
            v-for="template in headerTemplates"
            :key="template.id"
            :title="template.name || 'New header template'"
            :delete-label="`Delete ${template.name || 'header template'}`"
            @delete="emit('deleteHeaderTemplate', template)"
          >
            <label :for="`header-template-name-${template.id}`" class="app__field">
              <span>Name</span>
              <UInput
                :id="`header-template-name-${template.id}`"
                v-model="template.name"
                :ui="{ base: 'app__control' }"
              />
            </label>
            <div v-for="(header, row) in template.headers" :key="row" class="app__header-row">
              <UInput
                v-model="header.name"
                aria-label="Header name"
                placeholder="Header"
                :ui="{ base: 'app__control' }"
              />
              <UInput
                v-model="header.value"
                aria-label="Header value"
                placeholder="Value or {{variable}}"
                :ui="{ base: 'app__control' }"
              />
              <UButton
                type="button"
                aria-label="Remove header row"
                class="app__button app__button--secondary app__button--small"
                @click="removeHeaderRow(template.headers, row)"
                >Remove</UButton
              >
            </div>
            <UButton
              type="button"
              class="app__button app__button--secondary app__button--small"
              @click="addHeaderRow(template.headers)"
              >Add header</UButton
            >
          </SettingsAccordionCard>
        </section>
        <section class="app__environment-variable-section">
          <div class="app__section-title app__environment-variable-header">
            <UAccordion
              id="shared-environment-variables-toggle"
              class="app__settings-section-accordion"
              :items="variableSectionItems"
              type="single"
              collapsible
              :unmount-on-hide="false"
              :model-value="variablesOpen ? 'variables' : undefined"
              :ui="{
                root: 'app__settings-section-accordion',
                item: 'app__settings-section-accordion-item',
                trigger: 'app__settings-accordion-toggle',
                trailingIcon: 'app__settings-accordion-chevron',
                content: 'app__settings-accordion-content',
                body: 'app__settings-accordion-body',
              }"
              @update:model-value="variablesOpen = $event === 'variables'"
            >
              <template #default><strong>Shared environment variables</strong></template>
              <template #body>
                <div class="flex gap-2">
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
                    class="app__button app__button--secondary app__button--small"
                    @click="environmentFileInput?.click()"
                    >Import environment</UButton
                  >
                  <UButton
                    type="button"
                    color="neutral"
                    variant="outline"
                    class="app__button app__button--secondary app__button--small"
                    :disabled="props.environmentVariablesLoading"
                    @click="emit('addVariable')"
                    >New variable</UButton
                  >
                </div>
                <div id="shared-environment-variables-content">
                  <div v-if="environmentVariables.length" class="app__environment-variable-list">
                    <SettingsAccordionCard
                      v-for="variable in environmentVariables"
                      :key="variable.id"
                      :id="`environment-variable-${variable.id}`"
                      :title="variable.name || 'New variable'"
                      :delete-label="`Delete ${variable.name || 'variable'}`"
                      :open="props.expandedEnvironmentVariableId === variable.id"
                      @expand="emit('openVariable', variable)"
                      @collapse="emit('closeVariable', variable)"
                      @delete="emit('deleteVariable', variable)"
                    >
                      <template v-if="props.editingEnvironmentVariableId === variable.id">
                        <label :for="`environment-variable-name-${variable.id}`" class="app__field">
                          <span>Name</span>
                          <UInput
                            :id="`environment-variable-name-${variable.id}`"
                            v-model="variableDraft.name"
                            :ui="{ base: 'app__control' }"
                          />
                        </label>
                        <label
                          :for="`environment-variable-value-${variable.id}`"
                          class="app__field"
                        >
                          <span>Value</span>
                          <UTextarea
                            :id="`environment-variable-value-${variable.id}`"
                            v-model="variableDraft.value"
                            :ui="{ base: 'app__control' }"
                            :rows="2"
                          />
                        </label>
                        <footer class="app__environment-variable-card-footer">
                          <UButton
                            type="button"
                            color="primary"
                            class="app__button app__button--primary app__button--small"
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
        <div class="app__section-title app__registered-mock-api-header">
          <UAccordion
            id="registered-mock-apis-toggle"
            class="app__settings-section-accordion"
            :items="mockApiSectionItems"
            type="single"
            collapsible
            :unmount-on-hide="false"
            :model-value="apisOpen ? 'apis' : undefined"
            :ui="{
              root: 'app__settings-section-accordion',
              item: 'app__settings-section-accordion-item',
              trigger: 'app__settings-accordion-toggle',
              trailingIcon: 'app__settings-accordion-chevron',
              content: 'app__settings-accordion-content',
              body: 'app__settings-accordion-body',
            }"
            @update:model-value="apisOpen = $event === 'apis'"
          >
            <template #default><strong>Registered mock APIs</strong></template>
            <template #body>
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
                  @delete="emit('removeMockApi', index)"
                >
                  <label :for="`mock-api-name-${entry.id || index}`" class="app__field">
                    <span>Name</span>
                    <UInput
                      :id="`mock-api-name-${entry.id || index}`"
                      v-model="entry.name"
                      :ui="{ base: 'app__control' }"
                      placeholder="e.g. Create order"
                    />
                  </label>
                  <label :for="`mock-api-endpoint-${entry.id || index}`" class="app__field">
                    <span>Service endpoint</span>
                    <USelect
                      :id="`mock-api-endpoint-${entry.id || index}`"
                      v-model="entry.targetEndpointId"
                      :items="endpointOptions()"
                      :ui="{ base: 'app__control' }"
                      @update:model-value="emit('setMockEndpoint', entry)"
                    />
                  </label>
                  <label
                    v-for="name in props.endpointPathParameterNames(entry)"
                    :key="name"
                    :for="`mock-api-path-${entry.id || index}-${name}`"
                    class="app__field"
                  >
                    <span>Path parameter: {{ name }}</span>
                    <UInput
                      :id="`mock-api-path-${entry.id || index}-${name}`"
                      v-model="entry.pathParameters[name]"
                      :ui="{ base: 'app__control' }"
                      :placeholder="`Value or {{${name}}}`"
                    />
                  </label>
                  <label :for="`mock-api-template-${entry.id || index}`" class="app__field">
                    <span>Header template</span>
                    <USelect
                      :id="`mock-api-template-${entry.id || index}`"
                      v-model="entry.headerTemplateId"
                      :items="templateOptions()"
                      :ui="{ base: 'app__control' }"
                    />
                  </label>
                  <div class="app__field">
                    <span>Custom headers</span>
                    <div
                      v-for="(header, row) in entry.customHeaders ??= []"
                      :key="row"
                      class="app__header-row"
                    >
                      <UInput
                        v-model="header.name"
                        aria-label="Custom header name"
                        placeholder="Header"
                        :ui="{ base: 'app__control' }"
                      />
                      <UInput
                        v-model="header.value"
                        aria-label="Custom header value"
                        placeholder="Value or {{variable}}"
                        :ui="{ base: 'app__control' }"
                      />
                      <UButton
                        type="button"
                        aria-label="Remove custom header row"
                        class="app__button app__button--secondary app__button--small"
                        @click="removeHeaderRow(entry.customHeaders!, row)"
                        >Remove</UButton
                      >
                    </div>
                    <UButton
                      type="button"
                      class="app__button app__button--secondary app__button--small"
                      @click="addHeaderRow((entry.customHeaders ??= []))"
                      >Add header</UButton
                    >
                  </div>
                  <div class="app__field">
                    <UCheckbox v-model="entry.active" label="Active" />
                    <span v-if="entry.status">Status: {{ entry.status }}</span>
                    <ul v-if="entry.readinessReasons?.length" class="app__readiness-reasons">
                      <li
                        v-for="reason in entry.readinessReasons"
                        :key="reason.code + reason.message"
                      >
                        {{ reason.message }}
                      </li>
                    </ul>
                  </div>
                  <fieldset class="app__field app__request-fieldset">
                    <legend>Request (JSON)</legend>
                    <div class="flex justify-end">
                      <UButton
                        type="button"
                        color="neutral"
                        variant="outline"
                        class="app__button app__button--secondary app__button--small"
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
                  <label :for="`mock-api-description-${entry.id || index}`" class="app__field">
                    <span>Description</span>
                    <UInput
                      :id="`mock-api-description-${entry.id || index}`"
                      v-model="entry.description"
                      :ui="{ base: 'app__control' }"
                      placeholder="Optional note"
                    />
                  </label>
                </SettingsAccordionCard>
                <div v-if="!mockDraft.length" class="app__empty-logs">
                  No mock API rows yet. Add one to get started.
                </div>
              </div>
            </template>
          </UAccordion>
          <div class="flex gap-2">
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
              class="app__button app__button--secondary app__button--small"
              @click="fileInput?.click()"
            >
              Import APIs
            </UButton>
            <UButton
              type="button"
              color="neutral"
              variant="outline"
              class="app__button app__button--secondary app__button--small"
              @click="emit('addMockApi')"
            >
              + New API
            </UButton>
          </div>
        </div>
      </div>
      <footer class="app__dialog-footer">
        <UButton
          type="button"
          color="neutral"
          variant="outline"
          class="app__button app__button--secondary"
          @click="emit('discard')"
          >Discard</UButton
        >
        <UButton
          type="button"
          class="app__button app__button--primary"
          :disabled="props.environmentVariablesLoading"
          @click="emit('save')"
        >
          Save
        </UButton>
      </footer>
    </section>
  </dialog>
</template>
