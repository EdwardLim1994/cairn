<script setup lang="ts">
import { ref } from "vue";
import SettingsAccordionCard from "./SettingsAccordionCard.vue";
import HeaderRowsEditor from "./HeaderRowsEditor.vue";
import type { HeaderTemplateDraft } from "../models/mock-api";

type EndpointDraft = {
  id?: string;
  name: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | null;
  url?: string | null;
  rpcMethod?: string | null;
  requestJson?: unknown;
};
type ServiceDraft = {
  name: string;
  apiType: "REST" | "GRPC";
  framework: string;
  baseUrl: string;
  grpcTls: boolean;
  protoContent: string | null;
  protoFileName: string | null;
  clearProto: boolean;
  healthCheckUrl: string | null;
  healthCheckHeaderTemplateId: string | null;
  healthCheckCustomHeaders: Array<{ name: string; value: string }>;
  active: boolean;
  endpoints: EndpointDraft[];
};
type OutboundCall = { id: string; sourceEndpointId: string | null; targetEndpointId: string };
type EndpointOption = { id: string; serviceId: string; label: string };

const draft = defineModel<ServiceDraft>("draft", { required: true });
const frameworkMenuOpen = defineModel<boolean>("frameworkMenuOpen", { required: true });
const props = withDefaults(
  defineProps<{
    editingServiceId: string | null;
    headerTemplates: HeaderTemplateDraft[];
    outboundCallEdges?: OutboundCall[];
    endpointOptions?: EndpointOption[];
  }>(),
  {
    outboundCallEdges: () => [],
    endpointOptions: () => [],
  },
);
const openApiFileInput = ref<HTMLInputElement | null>(null);
const protoUpload = ref<File | undefined>(undefined);
const expandedEndpointKey = ref<string | null>(null);
const frameworks = [
  { label: "Spring Boot", value: "Spring Boot" },
  { label: ".NET", value: ".NET" },
  { label: "Other", value: "Other" },
];
const apiTypes = [
  { label: "REST", value: "REST" },
  { label: "gRPC", value: "GRPC" },
];
const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const emit = defineEmits<{
  addEndpoint: [];
  removeEndpoint: [index: number];
  importOpenApi: [file: File];
  importProto: [file: File];
  removeProto: [];
  save: [];
  discard: [];
  removeService: [id: string];
  addOutboundCall: [sourceEndpointId: string, targetEndpointId: string];
  removeOutboundCall: [edgeId: string];
}>();

function callsFrom(endpointId: string | undefined) {
  return endpointId
    ? props.outboundCallEdges.filter((edge) => edge.sourceEndpointId === endpointId)
    : [];
}

function availableTargets(endpointId: string | undefined) {
  const existingTargets = new Set(callsFrom(endpointId).map((edge) => edge.targetEndpointId));
  return props.endpointOptions
    .filter(
      (option) => option.serviceId !== props.editingServiceId && !existingTargets.has(option.id),
    )
    .map(({ id, label }) => ({ label, value: id }));
}

function targetLabel(endpointId: string) {
  return props.endpointOptions.find((option) => option.id === endpointId)?.label ?? endpointId;
}

function confirmRemoveCall(call: OutboundCall) {
  const target = targetLabel(call.targetEndpointId);
  if (window.confirm(`Remove outbound call to ${target}?`)) emit("removeOutboundCall", call.id);
}

function handleOpenApiFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) emit("importOpenApi", file);
  input.value = "";
}

function removeProto() {
  protoUpload.value = undefined;
  emit("removeProto");
}

function endpointSubtitle(endpoint: EndpointDraft) {
  return draft.value.apiType === "REST"
    ? `${endpoint.method ?? ""} ${endpoint.url ?? ""}`.trim()
    : (endpoint.rpcMethod ?? "RPC method");
}

function frameworkIconSource(framework: string) {
  if (framework.toLowerCase().includes("spring")) return "/icons/spring-boot.svg";
  if (framework.toLowerCase().includes(".net")) return "/icons/dotnet.svg";
  return "";
}

function healthTemplateOptions() {
  return [
    { label: "No template", value: "" },
    ...props.headerTemplates.map(({ id, name }) => ({
      label: name || "Untitled template",
      value: id,
    })),
  ];
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
        <label for="service-api-type" class="mt-2 flex flex-col gap-1">
          <span class="text-[10px] font-medium text-[var(--muted)]">API type</span>
          <USelect
            id="service-api-type"
            v-model="draft.apiType"
            :items="apiTypes"
            :ui="{
              base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
            }"
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
                  v-if="modelValue && frameworkIconSource(String(modelValue))"
                  class="h-[19px] w-[19px] shrink-0"
                  :src="frameworkIconSource(String(modelValue))"
                  alt=""
                  aria-hidden="true"
                />
              </template>
              <template #item-leading="{ item }">
                <img
                  v-if="frameworkIconSource(String(item.value))"
                  class="h-[19px] w-[19px] shrink-0"
                  :src="frameworkIconSource(String(item.value))"
                  alt=""
                  aria-hidden="true"
                />
              </template>
            </USelect>
          </div>
          <label for="service-base-url" class="min-w-0 flex flex-1 flex-col gap-1">
            <span class="text-[10px] font-medium text-[var(--muted)]">{{
              draft.apiType === "REST" ? "Base URL" : "Target address"
            }}</span>
            <UInput
              id="service-base-url"
              v-model="draft.baseUrl"
              :ui="{
                base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
              }"
              :placeholder="draft.apiType === 'REST' ? 'http://localhost:4000' : 'localhost:50051'"
            />
          </label>
        </div>
        <label v-if="draft.apiType === 'GRPC'" class="mt-2 flex items-center gap-2 text-[11px]">
          <UCheckbox v-model="draft.grpcTls" aria-label="Use TLS for gRPC calls" />
          <span>Use TLS</span>
        </label>
        <div v-if="draft.apiType === 'GRPC'" class="mt-3">
          <div
            v-if="draft.protoFileName"
            class="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel2)] p-3"
          >
            <div class="flex min-w-0 items-center gap-2">
              <UIcon
                name="i-lucide-file-code-2"
                class="size-5 shrink-0 text-[var(--accent)]"
                aria-hidden="true"
              />
              <div class="min-w-0">
                <p class="truncate text-xs font-medium">{{ draft.protoFileName }}</p>
                <p class="text-[10px] text-[var(--muted)]">Proto definition</p>
              </div>
            </div>
            <UButton
              type="button"
              color="error"
              variant="ghost"
              aria-label="Remove proto file"
              @click="removeProto"
            >
              <UIcon name="i-lucide-trash-2" class="size-4" aria-hidden="true" />
              Remove
            </UButton>
          </div>
          <UFileUpload
            v-else
            v-model="protoUpload"
            accept=".proto,text/plain"
            :multiple="false"
            :dropzone="true"
            label="Drop your proto file here"
            description="Self-contained .proto, up to 1 MB"
            class="w-full"
            @update:model-value="(file: File | undefined) => file && emit('importProto', file)"
          />
        </div>
      </div>
      <section class="flex flex-col gap-2 rounded-xl border border-[var(--border)] p-3">
        <strong class="text-xs">Health check</strong>
        <label for="service-health-check-url" class="flex flex-col gap-1">
          <span class="text-[10px] font-medium text-[var(--muted)]">Health-check URL override</span>
          <UInput
            id="service-health-check-url"
            v-model="draft.healthCheckUrl"
            placeholder="Leave blank to use the framework default"
            :ui="{
              base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
            }"
          />
          <span class="text-[10px] text-[var(--muted)]">
            Spring Boot defaults to Actuator readiness; use an absolute URL when the health endpoint
            uses a different host or port.
          </span>
        </label>
        <label for="service-health-header-template" class="flex flex-col gap-1">
          <span class="text-[10px] font-medium text-[var(--muted)]">Header template</span>
          <USelect
            id="service-health-header-template"
            v-model="draft.healthCheckHeaderTemplateId"
            :items="healthTemplateOptions()"
            :ui="{
              base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
            }"
          />
        </label>
        <HeaderRowsEditor
          v-model="draft.healthCheckCustomHeaders"
          label="Custom headers"
          aria-prefix="Health-check header"
        />
      </section>
      <div class="mt-1 flex items-center justify-between gap-2">
        <strong class="text-xs">Available endpoints</strong>
        <div class="flex items-center gap-2">
          <UButton
            v-if="draft.apiType === 'REST'"
            type="button"
            color="neutral"
            variant="outline"
            class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[11px] font-medium hover:bg-[var(--panel2)]"
            @click="openApiFileInput?.click()"
          >
            Import OpenAPI
          </UButton>
          <input
            v-if="draft.apiType === 'REST'"
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
        :subtitle="endpointSubtitle(endpoint)"
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
            v-if="draft.apiType === 'REST'"
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
          v-if="draft.apiType === 'REST'"
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
        <label
          v-if="draft.apiType === 'GRPC'"
          :for="`service-endpoint-rpc-${endpoint.id || index}`"
          class="min-w-0 flex flex-1 flex-col gap-1"
        >
          <span class="text-[10px] font-medium text-[var(--muted)]"
            >Fully qualified RPC method</span
          >
          <UInput
            :id="`service-endpoint-rpc-${endpoint.id || index}`"
            v-model="endpoint.rpcMethod"
            :ui="{
              base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
            }"
            placeholder="/example.v1.Orders/GetOrder"
          />
        </label>
        <section class="flex flex-col gap-2 border-t border-[var(--border)] pt-2">
          <strong class="text-[10px] font-medium">Outbound calls</strong>
          <div
            v-for="call in callsFrom(endpoint.id)"
            :key="call.id"
            class="flex items-center gap-2 text-[10px]"
          >
            <span class="min-w-0 flex-1 truncate">{{ targetLabel(call.targetEndpointId) }}</span>
            <UButton
              type="button"
              color="error"
              variant="ghost"
              class="grid size-7 shrink-0 place-items-center rounded-md text-[var(--danger)] hover:bg-[var(--danger-soft)]"
              :aria-label="`Remove outbound call to ${targetLabel(call.targetEndpointId)}`"
              @click="confirmRemoveCall(call)"
            >
              <UIcon name="i-lucide-trash" class="size-3.5" aria-hidden="true" />
            </UButton>
          </div>
          <USelect
            v-if="endpoint.id"
            :items="availableTargets(endpoint.id)"
            placeholder="Add outbound call"
            aria-label="Add outbound call"
            :ui="{
              base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)]',
            }"
            @update:model-value="
              (targetEndpointId: string) =>
                targetEndpointId && emit('addOutboundCall', endpoint.id!, targetEndpointId)
            "
          />
          <span v-else class="text-[10px] text-[var(--muted)]"
            >Save endpoint before adding calls.</span
          >
        </section>
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
