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
  toggleVariable: [variable: EnvironmentVariable, open: boolean];
  updateVariable: [];
  deleteVariable: [variable: EnvironmentVariable];
  importCollection: [event: Event];
  addMockApi: [];
  removeMockApi: [index: number];
  setMockEndpoint: [entry: MockApiDraft];
  formatRequest: [entry: MockApiDraft];
}>();
const fileInput = ref<HTMLInputElement | null>(null);
</script>

<template>
  <div class="app__dialog-backdrop" @click.self="emit('discard')">
    <section
      class="app__side-dialog app__surface"
      role="dialog"
      aria-modal="true"
      aria-label="Mock API settings"
    >
      <header class="app__dialog-header">
        <div>
          <strong>Mock APIs</strong><span>Calls linked to registered service endpoints</span>
        </div>
      </header>
      <div class="app__dialog-body">
        <section class="app__environment-variable-section">
          <div class="app__section-title app__environment-variable-header">
            <button
              id="shared-environment-variables-toggle"
              class="app__settings-accordion-toggle"
              :aria-expanded="variablesOpen"
              aria-controls="shared-environment-variables-content"
              @click="variablesOpen = !variablesOpen"
            >
              <strong>Shared environment variables</strong>
              <svg
                class="app__icon app__settings-accordion-chevron"
                :class="{ 'app__settings-accordion-chevron--collapsed': !variablesOpen }"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            <button
              class="app__button app__button--secondary app__button--small"
              :disabled="props.environmentVariablesLoading"
              @click="emit('addVariable')"
            >
              New variable
            </button>
          </div>
          <div id="shared-environment-variables-content" v-show="variablesOpen">
            <div v-if="environmentVariables.length" class="app__environment-variable-list">
              <SettingsAccordionCard
                v-for="variable in environmentVariables"
                :key="variable.id"
                :id="`environment-variable-${variable.id}`"
                :title="variable.name || 'New variable'"
                :delete-label="`Delete ${variable.name || 'variable'}`"
                :open="props.expandedEnvironmentVariableId === variable.id"
                @toggle="emit('toggleVariable', variable, $event)"
                @delete="emit('deleteVariable', variable)"
              >
                <template v-if="props.editingEnvironmentVariableId === variable.id">
                  <label class="app__field">
                    <span>Name</span><input v-model="variableDraft.name" class="app__control" />
                  </label>
                  <label class="app__field">
                    <span>Value</span
                    ><textarea v-model="variableDraft.value" class="app__control" rows="2" />
                  </label>
                  <footer class="app__environment-variable-card-footer">
                    <button
                      v-if="!variable.pendingCreate"
                      class="app__button app__button--primary app__button--small"
                      @click="emit('updateVariable')"
                    >
                      Update
                    </button>
                  </footer>
                </template>
              </SettingsAccordionCard>
            </div>
          </div>
        </section>
        <div class="app__section-title">
          <button
            id="registered-mock-apis-toggle"
            class="app__settings-accordion-toggle"
            :aria-expanded="apisOpen"
            aria-controls="registered-mock-apis-content"
            @click="apisOpen = !apisOpen"
          >
            <strong>Registered mock APIs</strong>
            <svg
              class="app__icon app__settings-accordion-chevron"
              :class="{ 'app__settings-accordion-chevron--collapsed': !apisOpen }"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <div class="flex gap-2">
            <input
              ref="fileInput"
              class="hidden"
              type="file"
              accept="application/json,.json"
              @change="emit('importCollection', $event)"
            />
            <button
              class="app__button app__button--secondary app__button--small"
              @click="fileInput?.click()"
            >
              Import Postman
            </button>
            <button
              class="app__button app__button--secondary app__button--small"
              @click="emit('addMockApi')"
            >
              + New API
            </button>
          </div>
        </div>
        <div id="registered-mock-apis-content" class="flex flex-col gap-y-3" v-show="apisOpen">
          <SettingsAccordionCard
            v-for="(entry, index) in mockDraft"
            :key="entry.id || `new-${index}`"
            :id="entry.id ? `mock-api-${entry.id}` : undefined"
            :title="entry.name || `Mock API ${index + 1}`"
            :subtitle="
              servicesForSelect.find((option) => option.id === entry.targetEndpointId)?.label ??
              'Select service endpoint'
            "
            :delete-label="`Remove ${entry.name || `Mock API ${index + 1}`}`"
            @delete="emit('removeMockApi', index)"
          >
            <label class="app__field">
              <span>Name</span
              ><input v-model="entry.name" class="app__control" placeholder="e.g. Create order" />
            </label>
            <label class="app__field">
              <span>Service endpoint</span>
              <select
                :id="entry.id ? `mock-endpoint-${entry.id}` : undefined"
                v-model="entry.targetEndpointId"
                class="app__control"
                @change="emit('setMockEndpoint', entry)"
              >
                <option value="" disabled>Select endpoint</option>
                <option v-for="option in servicesForSelect" :key="option.id" :value="option.id">
                  {{ option.label }}
                </option>
              </select>
            </label>
            <label
              v-for="name in props.endpointPathParameterNames(entry)"
              :key="name"
              class="app__field"
            >
              <span>Path parameter: {{ name }}</span>
              <input
                v-model="entry.pathParameters[name]"
                class="app__control"
                :placeholder="`Value or {{${name}}}`"
              />
            </label>
            <label class="app__field">
              <span>Request (JSON)</span>
              <div class="flex justify-end">
                <button
                  class="app__button app__button--secondary app__button--small"
                  type="button"
                  @click="emit('formatRequest', entry)"
                >
                  Format JSON
                </button>
              </div>
              <RequestJsonEditor
                :model-value="String(entry.requestJson ?? '')"
                :variables="environmentVariables"
                @update:model-value="entry.requestJson = $event"
              />
            </label>
            <label class="app__field">
              <span>Description</span
              ><input
                v-model="entry.description"
                class="app__control"
                placeholder="Optional note"
              />
            </label>
          </SettingsAccordionCard>
          <div v-if="!mockDraft.length" class="app__empty-logs">
            No mock API rows yet. Add one to get started.
          </div>
        </div>
      </div>
      <footer class="app__dialog-footer">
        <button class="app__button app__button--secondary" @click="emit('discard')">Discard</button>
        <button
          class="app__button app__button--primary"
          :disabled="props.environmentVariablesLoading"
          @click="emit('save')"
        >
          Save
        </button>
      </footer>
    </section>
  </div>
</template>
