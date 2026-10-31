<script setup lang="ts">
import { ref } from "vue";
import SettingsAccordionCard from "./SettingsAccordionCard.vue";

type EndpointDraft = {
  id?: string;
  name: string;
  apiType: "REST";
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  requestJson?: unknown;
};
type ServiceDraft = {
  name: string;
  framework: string;
  baseUrl: string;
  active: boolean;
  endpoints: EndpointDraft[];
};

const draft = defineModel<ServiceDraft>("draft", { required: true });
const frameworkMenuOpen = defineModel<boolean>("frameworkMenuOpen", { required: true });
const props = defineProps<{ editingServiceId: string | null }>();
const openApiFileInput = ref<HTMLInputElement | null>(null);
const expandedEndpointKeys = ref<string[]>([]);
const frameworks = [
  { label: "Spring Boot", value: "Spring Boot" },
  { label: ".NET", value: ".NET" },
];
const apiTypes = ["REST"];
const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const emit = defineEmits<{
  addEndpoint: [];
  removeEndpoint: [index: number];
  importOpenApi: [file: File];
  save: [];
  discard: [];
  removeService: [id: string];
}>();

function handleOpenApiFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) emit("importOpenApi", file);
  input.value = "";
}

function frameworkIconSource(framework: string) {
  return framework.toLowerCase().includes("spring")
    ? "/icons/spring-boot.svg"
    : "/icons/dotnet.svg";
}

function endpointKey(endpoint: EndpointDraft, index: number) {
  return endpoint.id || `endpoint-${index}`;
}

function isEndpointOpen(endpoint: EndpointDraft, index: number) {
  return expandedEndpointKeys.value.includes(endpointKey(endpoint, index));
}

function toggleEndpoint(endpoint: EndpointDraft, index: number, open: boolean) {
  const key = endpointKey(endpoint, index);
  expandedEndpointKeys.value = open
    ? [...new Set([...expandedEndpointKeys.value, key])]
    : expandedEndpointKeys.value.filter((expandedKey) => expandedKey !== key);
}
</script>

<template>
  <dialog
    open
    class="app__dialog-backdrop"
    aria-modal="true"
    aria-label="Service settings"
    @keydown.esc.prevent="emit('discard')"
  >
    <section class="app__side-dialog app__surface">
      <header class="app__dialog-header">
        <div>
          <strong>{{ props.editingServiceId ? "Service settings" : "Add service node" }}</strong>
          <span>Configure the service and its endpoints</span>
        </div>
        <UButton
          v-if="props.editingServiceId"
          type="button"
          color="error"
          variant="outline"
          class="app__icon-button app__icon-button--danger"
          aria-label="Remove service"
          title="Remove service"
          @click="emit('removeService', props.editingServiceId)"
        >
          <svg class="app__icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" />
          </svg>
        </UButton>
      </header>
      <div class="app__dialog-body">
        <div class="app__service-config-fields">
          <label for="service-name" class="app__field">
            <span>Service name</span>
            <UInput
              id="service-name"
              v-model="draft.name"
              :ui="{ base: 'app__control' }"
              placeholder="e.g. Checkout API"
              required
            />
          </label>
          <div class="app__field-row">
            <div class="app__field">
              <span>Framework <span aria-hidden="true">*</span></span>
              <USelect
                v-model="draft.framework"
                v-model:open="frameworkMenuOpen"
                :items="frameworks"
                aria-required="true"
                :aria-label="`Framework: ${draft.framework || 'Select framework'}`"
                placeholder="Select framework"
                class="app__framework-select"
                :ui="{
                  base: 'app__control app__control--framework-select',
                  content: 'app__framework-select-menu',
                }"
              >
                <template #leading="{ modelValue }">
                  <img
                    v-if="modelValue"
                    :src="frameworkIconSource(String(modelValue))"
                    alt=""
                    aria-hidden="true"
                  />
                </template>
                <template #item-leading="{ item }">
                  <img :src="frameworkIconSource(String(item.value))" alt="" aria-hidden="true" />
                </template>
              </USelect>
            </div>
            <label for="service-base-url" class="app__field">
              <span>Base URL</span>
              <UInput
                id="service-base-url"
                v-model="draft.baseUrl"
                :ui="{ base: 'app__control' }"
                placeholder="http://localhost:4000"
              />
            </label>
          </div>
        </div>
        <div class="app__section-title">
          <strong>Available endpoints</strong>
          <div class="app__endpoint-actions">
            <UButton
              type="button"
              color="neutral"
              variant="outline"
              class="app__button app__button--secondary app__button--small"
              @click="openApiFileInput?.click()"
            >
              Import OpenAPI
            </UButton>
            <input
              ref="openApiFileInput"
              class="app__openapi-file-input"
              type="file"
              accept=".json,.yaml,.yml,application/json,application/yaml,text/yaml"
              aria-label="Upload OpenAPI schema"
              @change="handleOpenApiFileChange"
            />
            <UButton
              type="button"
              color="neutral"
              variant="outline"
              class="app__button app__button--secondary app__button--small"
              @click="emit('addEndpoint')"
            >
              + New endpoint
            </UButton>
          </div>
        </div>
        <SettingsAccordionCard
          v-for="(endpoint, index) in draft.endpoints"
          :id="endpoint.id ? `service-endpoint-${endpoint.id}` : undefined"
          :key="endpoint.id || index"
          :title="endpoint.name || `Endpoint ${index + 1}`"
          :subtitle="`${endpoint.method} ${endpoint.url}`"
          :delete-label="`Remove ${endpoint.name || `Endpoint ${index + 1}`}`"
          :open="isEndpointOpen(endpoint, index)"
          @toggle="toggleEndpoint(endpoint, index, $event)"
          @delete="emit('removeEndpoint', index)"
        >
          <label :for="`service-endpoint-name-${endpoint.id || index}`" class="app__field">
            <span>Name</span>
            <UInput
              :id="`service-endpoint-name-${endpoint.id || index}`"
              v-model="endpoint.name"
              :ui="{ base: 'app__control' }"
              placeholder="e.g. Get order"
            />
          </label>
          <div class="app__field-row">
            <label :for="`service-endpoint-type-${endpoint.id || index}`" class="app__field">
              <span>API type</span>
              <USelect
                :id="`service-endpoint-type-${endpoint.id || index}`"
                v-model="endpoint.apiType"
                :items="apiTypes"
                :ui="{ base: 'app__control' }"
              />
            </label>
            <label :for="`service-endpoint-method-${endpoint.id || index}`" class="app__field">
              <span>Method</span>
              <USelect
                :id="`service-endpoint-method-${endpoint.id || index}`"
                v-model="endpoint.method"
                :items="methods"
                :ui="{ base: 'app__control' }"
              />
            </label>
          </div>
          <label :for="`service-endpoint-url-${endpoint.id || index}`" class="app__field">
            <span>URL</span>
            <UInput
              :id="`service-endpoint-url-${endpoint.id || index}`"
              v-model="endpoint.url"
              :ui="{ base: 'app__control' }"
              placeholder="/orders"
            />
          </label>
        </SettingsAccordionCard>
      </div>
      <footer class="app__dialog-footer">
        <UButton
          type="button"
          color="neutral"
          variant="outline"
          class="app__button app__button--secondary"
          @click="emit('discard')"
        >
          Discard
        </UButton>
        <UButton type="button" class="app__button app__button--primary" @click="emit('save')">
          Save
        </UButton>
      </footer>
    </section>
  </dialog>
</template>
