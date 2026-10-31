<script setup lang="ts">
import { ref } from "vue";
import SettingsAccordionCard from "./SettingsAccordionCard.vue";
import RequestJsonEditor from "./RequestJsonEditor.vue";
import type { EnvironmentVariable, MockApiDraft } from "../models/mock-api";

const mockDraft = defineModel<MockApiDraft[]>("mockDraft", { required: true });
const environmentVariables = defineModel<EnvironmentVariable[]>("environmentVariables", {
  required: true,
});
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
  addMockApi: [];
  removeMockApi: [index: number];
  setMockEndpoint: [entry: MockApiDraft];
  formatRequest: [entry: MockApiDraft];
}>();
const fileInput = ref<HTMLInputElement | null>(null);
const variableSectionItems = [{ value: "variables", label: "Shared environment variables" }];
const mockApiSectionItems = [{ value: "apis", label: "Registered mock APIs" }];

function endpointOptions() {
  return [
    { label: "Select endpoint", value: "" },
    ...props.servicesForSelect.map(({ id, label }) => ({ label, value: id })),
  ];
}
</script>

<template>
  <dialog
    open
    class="app__dialog-backdrop"
    aria-modal="true"
    aria-label="Mock API settings"
    @click.self="emit('discard')"
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
                        <label class="app__field">
                          <span>Name</span>
                          <UInput v-model="variableDraft.name" :ui="{ base: 'app__control' }" />
                        </label>
                        <label class="app__field">
                          <span>Value</span>
                          <UTextarea
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
            <UButton
              type="button"
              color="neutral"
              variant="outline"
              class="app__button app__button--secondary app__button--small"
              :disabled="props.environmentVariablesLoading"
              @click="emit('addVariable')"
            >
              New variable
            </UButton>
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
                  <label class="app__field">
                    <span>Name</span>
                    <UInput
                      v-model="entry.name"
                      :ui="{ base: 'app__control' }"
                      placeholder="e.g. Create order"
                    />
                  </label>
                  <label class="app__field">
                    <span>Service endpoint</span>
                    <USelect
                      :id="entry.id ? `mock-endpoint-${entry.id}` : undefined"
                      v-model="entry.targetEndpointId"
                      :items="endpointOptions()"
                      :ui="{ base: 'app__control' }"
                      @update:model-value="emit('setMockEndpoint', entry)"
                    />
                  </label>
                  <label
                    v-for="name in props.endpointPathParameterNames(entry)"
                    :key="name"
                    class="app__field"
                  >
                    <span>Path parameter: {{ name }}</span>
                    <UInput
                      v-model="entry.pathParameters[name]"
                      :ui="{ base: 'app__control' }"
                      :placeholder="`Value or {{${name}}}`"
                    />
                  </label>
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
                  <label class="app__field">
                    <span>Description</span>
                    <UInput
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
              Import Postman
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
