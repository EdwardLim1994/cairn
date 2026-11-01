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
const expandedEndpointKey = ref<string | null>(null);
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
  return expandedEndpointKey.value === endpointKey(endpoint, index);
}

function toggleEndpoint(endpoint: EndpointDraft, index: number, open: boolean) {
  const key = endpointKey(endpoint, index);
  if (open) expandedEndpointKey.value = key;
  else if (expandedEndpointKey.value === key) expandedEndpointKey.value = null;
}

function preventOutsideDismiss(event: Event) {
  event.preventDefault();
}

function handleOpenChange(open: boolean) {
  if (!open) emit("discard");
}
</script>

<template>
  <USlideover
    :open="true"
    side="right"
    :portal="false"
    :close="false"
    :content="{
      'aria-label': 'Service settings',
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
    <template #title>
      {{ props.editingServiceId ? "Service settings" : "Add service node" }}
    </template>
    <template #description>Configure the service and its endpoints</template>
    <template #actions>
      <UButton
        v-if="props.editingServiceId"
        type="button"
        color="error"
        variant="outline"
        class="inline-grid size-[34px] place-items-center rounded-lg border border-[var(--danger)] bg-[var(--panel)] p-0 leading-none text-[var(--danger)] hover:bg-[var(--danger-soft)]"
        aria-label="Remove service"
        title="Remove service"
        @click="emit('removeService', props.editingServiceId)"
      >
        <UIcon name="i-lucide-trash" class="size-4" aria-hidden="true" />
      </UButton>
    </template>
    <template #body>
      <div class="flex flex-col gap-0">
        <label for="service-name" class="min-w-0 flex flex-1 flex-col gap-1">
          <span class="text-[10px] font-medium text-[var(--muted)]">Service name</span>
          <UInput
            id="service-name"
            v-model="draft.name"
            :ui="{
              base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
            }"
            placeholder="e.g. Checkout API"
            required
          />
        </label>
        <div class="flex gap-2.5 max-[720px]:flex-col">
          <div class="min-w-0 flex flex-1 flex-col gap-1">
            <span class="text-[10px] font-medium text-[var(--muted)]"
              >Framework <span aria-hidden="true">*</span></span
            >
            <USelect
              v-model="draft.framework"
              v-model:open="frameworkMenuOpen"
              :items="frameworks"
              aria-required="true"
              :aria-label="`Framework: ${draft.framework || 'Select framework'}`"
              placeholder="Select framework"
              class="app__framework-select"
              :ui="{
                base: 'min-h-[38px] w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
                content:
                  'app__framework-select-menu rounded-lg border border-[var(--border)] bg-[var(--panel)] shadow-lg',
              }"
            >
              <template #leading="{ modelValue }">
                <img
                  v-if="modelValue"
                  class="h-[19px] w-[19px] shrink-0"
                  :src="frameworkIconSource(String(modelValue))"
                  alt=""
                  aria-hidden="true"
                />
              </template>
              <template #item-leading="{ item }">
                <img
                  class="h-[19px] w-[19px] shrink-0"
                  :src="frameworkIconSource(String(item.value))"
                  alt=""
                  aria-hidden="true"
                />
              </template>
            </USelect>
          </div>
          <label for="service-base-url" class="min-w-0 flex flex-1 flex-col gap-1">
            <span class="text-[10px] font-medium text-[var(--muted)]">Base URL</span>
            <UInput
              id="service-base-url"
              v-model="draft.baseUrl"
              :ui="{
                base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
              }"
              placeholder="http://localhost:4000"
            />
          </label>
        </div>
      </div>
      <div class="mt-1 flex items-center justify-between gap-2">
        <strong class="text-xs">Available endpoints</strong>
        <div class="flex items-center gap-2">
          <UButton
            type="button"
            color="neutral"
            variant="outline"
            class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[11px] font-medium hover:bg-[var(--panel2)]"
            @click="openApiFileInput?.click()"
          >
            Import OpenAPI
          </UButton>
          <input
            ref="openApiFileInput"
            class="hidden"
            type="file"
            accept=".json,.yaml,.yml,application/json,application/yaml,text/yaml"
            aria-label="Upload OpenAPI schema"
            @change="handleOpenApiFileChange"
          />
          <UButton
            type="button"
            color="neutral"
            variant="outline"
            class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[11px] font-medium hover:bg-[var(--panel2)]"
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
        <label
          :for="`service-endpoint-name-${endpoint.id || index}`"
          class="min-w-0 flex flex-1 flex-col gap-1"
        >
          <span class="text-[10px] font-medium text-[var(--muted)]">Name</span>
          <UInput
            :id="`service-endpoint-name-${endpoint.id || index}`"
            v-model="endpoint.name"
            :ui="{
              base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
            }"
            placeholder="e.g. Get order"
          />
        </label>
        <div class="flex gap-2.5 max-[720px]:flex-col">
          <label
            :for="`service-endpoint-type-${endpoint.id || index}`"
            class="min-w-0 flex flex-1 flex-col gap-1"
          >
            <span class="text-[10px] font-medium text-[var(--muted)]">API type</span>
            <USelect
              :id="`service-endpoint-type-${endpoint.id || index}`"
              v-model="endpoint.apiType"
              :items="apiTypes"
              :ui="{
                base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
              }"
            />
          </label>
          <label
            :for="`service-endpoint-method-${endpoint.id || index}`"
            class="min-w-0 flex flex-1 flex-col gap-1"
          >
            <span class="text-[10px] font-medium text-[var(--muted)]">Method</span>
            <USelect
              :id="`service-endpoint-method-${endpoint.id || index}`"
              v-model="endpoint.method"
              :items="methods"
              :ui="{
                base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
              }"
            />
          </label>
        </div>
        <label
          :for="`service-endpoint-url-${endpoint.id || index}`"
          class="min-w-0 flex flex-1 flex-col gap-1"
        >
          <span class="text-[10px] font-medium text-[var(--muted)]">URL</span>
          <UInput
            :id="`service-endpoint-url-${endpoint.id || index}`"
            v-model="endpoint.url"
            :ui="{
              base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
            }"
            placeholder="/orders"
          />
        </label>
      </SettingsAccordionCard>
    </template>
    <template #footer>
      <UButton
        type="button"
        color="neutral"
        variant="outline"
        class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-xs font-medium hover:bg-[var(--panel2)]"
        @click="emit('discard')"
      >
        Discard
      </UButton>
      <UButton
        type="button"
        class="rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-3 py-2 text-xs font-medium text-[var(--accent-ink)] disabled:opacity-60"
        @click="emit('save')"
      >
        Save
      </UButton>
    </template>
  </USlideover>
</template>
