<script setup lang="ts">
import { ref } from "vue";
import SettingsAccordionCard from "./SettingsAccordionCard.vue";
import HeaderRowsEditor from "./HeaderRowsEditor.vue";
import type { HeaderTemplateDraft } from "../models/mock-api";
import type { CanvasGetResponse } from "#shared/api/canvas";

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
type OutboundCall = {
  id: string;
  sourceEndpointId: string | null;
  sourceSubscriptionId?: string | null;
  targetEndpointId: string;
};
type OutboundRow = { key: string; connectionId?: string; draftKey?: string; value: string };
type EndpointOption = { id: string; serviceId: string; label: string };
type Destination = CanvasGetResponse["messageDestinations"][number];
type SubscriptionDraft = {
  id: string;
  destinationId: string;
  consumerGroup?: string;
  bindingKey?: string;
};

const draft = defineModel<ServiceDraft>("draft", { required: true });
const frameworkMenuOpen = defineModel<boolean>("frameworkMenuOpen", { required: true });
const props = withDefaults(
  defineProps<{
    editingServiceId: string | null;
    headerTemplates: HeaderTemplateDraft[];
    outboundCallEdges?: OutboundCall[];
    endpointOptions?: EndpointOption[];
    messageDestinations?: Destination[];
    messageSubscriptions?: SubscriptionDraft[];
    messageConnections?: Array<{
      id: string;
      type: string;
      serviceId?: string;
      endpointId?: string;
      subscriptionId?: string;
      destinationId: string;
    }>;
  }>(),
  {
    outboundCallEdges: () => [],
    endpointOptions: () => [],
    messageDestinations: () => [],
    messageSubscriptions: () => [],
    messageConnections: () => [],
  },
);
const openApiFileInput = ref<HTMLInputElement | null>(null);
const protoUpload = ref<File | undefined>(undefined);
const expandedEndpointKey = ref<string | null>(null);
const subscriptions = ref<SubscriptionDraft[]>(
  props.messageSubscriptions.map((item) => ({ ...item })),
);
const expandedSubscriptionId = ref<string | null>(null);
const newOutboundRows = ref<Record<string, Array<{ key: string; value: string }>>>({});
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
  save: [subscriptions: SubscriptionDraft[]];
  discard: [];
  removeService: [id: string];
  setOutboundCall: [sourceId: string, connectionId: string | undefined, target: string];
  removeOutboundCall: [edgeId: string];
}>();

function addSubscription() {
  const destination = props.messageDestinations.find(
    (item) => !subscriptions.value.some((subscription) => subscription.destinationId === item.id),
  );
  if (!destination) return;
  const subscription: SubscriptionDraft = {
    id: crypto.randomUUID(),
    destinationId: destination.id,
    ...(destination.broker === "kafka"
      ? { consumerGroup: "cairn-consumers" }
      : { bindingKey: "#" }),
  };
  subscriptions.value.push(subscription);
  expandedSubscriptionId.value = subscription.id;
}

function canAddSubscription() {
  return (
    Boolean(props.editingServiceId) &&
    props.messageDestinations.some(
      (destination) =>
        !subscriptions.value.some((subscription) => subscription.destinationId === destination.id),
    )
  );
}

function availableDestinations(subscription: SubscriptionDraft) {
  return props.messageDestinations
    .filter(
      (destination) =>
        destination.id === subscription.destinationId ||
        !subscriptions.value.some(
          (item) => item.id !== subscription.id && item.destinationId === destination.id,
        ),
    )
    .map((destination) => ({ label: destination.name, value: destination.id }));
}

function selectDestination(subscription: SubscriptionDraft, destinationId: string) {
  const destination = props.messageDestinations.find((item) => item.id === destinationId);
  if (!destination) return;
  subscription.destinationId = destinationId;
  subscription.consumerGroup = destination.broker === "kafka" ? "cairn-consumers" : undefined;
  subscription.bindingKey = destination.broker === "rabbitmq" ? "#" : undefined;
}

function subscriptionTitle(subscription: SubscriptionDraft) {
  return (
    props.messageDestinations.find((item) => item.id === subscription.destinationId)?.name ??
    "Select topic"
  );
}

function subscriptionsValid() {
  return subscriptions.value.every((subscription) => {
    const destination = props.messageDestinations.find(
      (item) => item.id === subscription.destinationId,
    );
    if (destination?.broker === "kafka") return Boolean(subscription.consumerGroup?.trim());
    if (destination?.broker === "rabbitmq") return Boolean(subscription.bindingKey?.trim());
    return false;
  });
}

function callsFrom(sourceId: string | undefined, subscription = false) {
  return sourceId
    ? props.outboundCallEdges.filter((edge) =>
        subscription
          ? edge.sourceSubscriptionId === sourceId
          : edge.sourceEndpointId === sourceId ||
            (!edge.sourceEndpointId &&
              !edge.sourceSubscriptionId &&
              props.draft.endpoints[0]?.id === sourceId),
      )
    : [];
}

function outboundRows(sourceId: string, subscription = false): OutboundRow[] {
  const serviceCalls = callsFrom(sourceId, subscription).map((call) => ({
    key: `edge:${call.id}`,
    connectionId: call.id,
    value: `endpoint:${call.targetEndpointId}`,
  }));
  const publishes = props.messageConnections
    .filter(
      (connection) =>
        connection.type === "publish" &&
        (subscription
          ? connection.subscriptionId === sourceId
          : connection.endpointId === sourceId ||
            (!connection.endpointId &&
              !connection.subscriptionId &&
              connection.serviceId === props.editingServiceId &&
              props.draft.endpoints[0]?.id === sourceId)),
    )
    .map((connection) => ({
      key: `publish:${connection.id}`,
      connectionId: connection.id,
      value: `destination:${connection.destinationId}`,
    }));
  return [
    ...serviceCalls,
    ...publishes,
    ...(newOutboundRows.value[sourceId] ?? []).map((row) => ({
      key: `draft:${row.key}`,
      draftKey: row.key,
      value: row.value,
    })),
  ];
}

function outboundTargetOptions(sourceId: string, value: string) {
  const usedValues = new Set(
    outboundRows(sourceId)
      .filter((row) => row.value !== value)
      .map((row) => row.value),
  );
  return [
    ...props.endpointOptions
      .filter((option) => option.serviceId !== props.editingServiceId)
      .map(({ id, label }) => ({ label, value: `endpoint:${id}` })),
    ...props.messageDestinations.map((destination) => ({
      label: `Message Queue | ${destination.name} (publish)`,
      value: `destination:${destination.id}`,
    })),
  ].filter((option) => option.value === value || !usedValues.has(option.value));
}

function addOutboundRow(sourceId: string) {
  newOutboundRows.value[sourceId] = [
    ...(newOutboundRows.value[sourceId] ?? []),
    { key: crypto.randomUUID(), value: "" },
  ];
}

function setOutboundTarget(sourceId: string, row: OutboundRow, target: string) {
  emit("setOutboundCall", sourceId, row.connectionId, target);
  if (!row.draftKey) return;
  newOutboundRows.value[sourceId] = (newOutboundRows.value[sourceId] ?? []).filter(
    (draft) => draft.key !== row.draftKey,
  );
}

function removeOutboundRow(sourceId: string, row: OutboundRow) {
  if (row.connectionId) emit("removeOutboundCall", row.connectionId);
  if (row.draftKey)
    newOutboundRows.value[sourceId] = (newOutboundRows.value[sourceId] ?? []).filter(
      (draft) => draft.key !== row.draftKey,
    );
}

function outboundTargetLabel(value: string) {
  const [type, id] = value.split(":", 2);
  if (type === "endpoint")
    return props.endpointOptions.find((option) => option.id === id)?.label ?? id;
  if (type === "destination")
    return `Message Queue | ${props.messageDestinations.find((destination) => destination.id === id)?.name ?? id} (publish)`;
  return "Select outbound target";
}

function isSavedSubscription(subscriptionId: string) {
  return props.messageSubscriptions.some(({ id }) => id === subscriptionId);
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
        <div v-if="draft.apiType === 'GRPC'" class="mt-2 flex items-center gap-2 text-[11px]">
          <UCheckbox v-model="draft.grpcTls" aria-label="Use TLS for gRPC calls" />
          <span>Use TLS</span>
        </div>
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
      <section class="flex flex-col gap-2">
        <div class="flex items-center justify-between gap-2">
          <strong class="text-xs">Consumers / subscribers</strong>
          <UButton
            type="button"
            color="neutral"
            variant="outline"
            :disabled="!canAddSubscription()"
            @click="addSubscription"
          >
            + New subscriber
          </UButton>
        </div>
        <SettingsAccordionCard
          v-for="(subscription, index) in subscriptions"
          :key="subscription.id"
          :title="subscriptionTitle(subscription)"
          :subtitle="subscription.consumerGroup || subscription.bindingKey || 'Subscriber'"
          :delete-label="`Remove subscriber ${subscriptionTitle(subscription)}`"
          :open="expandedSubscriptionId === subscription.id"
          @toggle="expandedSubscriptionId = $event ? subscription.id : null"
          @delete="subscriptions.splice(index, 1)"
        >
          <div class="flex flex-col gap-1">
            <span class="text-[10px] font-medium text-[var(--muted)]">Message queue topic</span>
            <USelect
              :model-value="subscription.destinationId"
              :items="availableDestinations(subscription)"
              :aria-label="`Subscriber ${index + 1} topic`"
              @update:model-value="selectDestination(subscription, String($event))"
            />
          </div>
          <div
            v-if="
              props.messageDestinations.find((item) => item.id === subscription.destinationId)
                ?.broker === 'kafka'
            "
            class="flex flex-col gap-1"
          >
            <span class="text-[10px] font-medium text-[var(--muted)]">Consumer group</span>
            <UInput
              v-model="subscription.consumerGroup"
              :aria-label="`Subscriber ${index + 1} consumer group`"
              required
            />
          </div>
          <div v-else class="flex flex-col gap-1">
            <span class="text-[10px] font-medium text-[var(--muted)]">RabbitMQ binding key</span>
            <UInput
              v-model="subscription.bindingKey"
              :aria-label="`Subscriber ${index + 1} binding key`"
              required
            />
          </div>
          <section class="flex flex-col gap-2 border-t border-[var(--border)] pt-2">
            <div class="flex items-center justify-between gap-2">
              <strong class="text-[10px] font-medium">Outbound calls</strong>
              <UButton
                v-if="isSavedSubscription(subscription.id)"
                type="button"
                color="neutral"
                variant="outline"
                @click="addOutboundRow(subscription.id)"
                >New</UButton
              >
            </div>
            <div
              v-for="(row, rowIndex) in outboundRows(subscription.id, true)"
              :key="row.key"
              class="flex min-w-0 items-center gap-2"
            >
              <USelect
                class="min-w-0 flex-1"
                :model-value="row.value"
                :items="outboundTargetOptions(subscription.id, row.value)"
                :placeholder="row.value ? undefined : 'Select endpoint or message publish'"
                :aria-label="`Outbound call ${rowIndex + 1} target`"
                @update:model-value="setOutboundTarget(subscription.id, row, String($event))"
              />
              <UButton
                type="button"
                color="error"
                variant="ghost"
                class="grid size-7 shrink-0 place-items-center rounded-md text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                :aria-label="`Delete outbound call ${rowIndex + 1}`"
                @click="removeOutboundRow(subscription.id, row)"
              >
                <UIcon name="i-lucide-trash" class="size-3.5" aria-hidden="true" />
              </UButton>
            </div>
            <span
              v-if="!isSavedSubscription(subscription.id)"
              class="text-[10px] text-[var(--muted)]"
              >Save this consumer before adding outbound calls.</span
            >
          </section>
        </SettingsAccordionCard>
        <p
          v-if="!subscriptions.length"
          class="rounded-xl border border-dashed border-[var(--border)] p-3 text-[10px] text-[var(--muted)]"
        >
          {{
            props.messageDestinations.length
              ? "No consumers configured."
              : "Add a message queue topic before configuring consumers."
          }}
        </p>
        <p v-if="!props.editingServiceId" class="text-[10px] text-[var(--muted)]">
          Save the service before adding subscribers.
        </p>
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
          <div class="flex items-center justify-between gap-2">
            <strong class="text-[10px] font-medium">Outbound calls</strong>
            <UButton
              v-if="endpoint.id"
              type="button"
              color="neutral"
              variant="outline"
              @click="addOutboundRow(endpoint.id)"
              >New</UButton
            >
          </div>
          <div
            v-for="(row, rowIndex) in endpoint.id ? outboundRows(endpoint.id) : []"
            :key="row.key"
            class="flex min-w-0 items-center gap-2"
          >
            <USelect
              class="min-w-0 flex-1"
              :model-value="row.value"
              :items="outboundTargetOptions(endpoint.id!, row.value)"
              :placeholder="row.value ? undefined : 'Select endpoint or message publish'"
              :aria-label="`Outbound call ${rowIndex + 1} target`"
              @update:model-value="setOutboundTarget(endpoint.id!, row, String($event))"
            />
            <UButton
              type="button"
              color="error"
              variant="ghost"
              class="grid size-7 shrink-0 place-items-center rounded-md text-[var(--danger)] hover:bg-[var(--danger-soft)]"
              :aria-label="`Delete outbound call ${rowIndex + 1}`"
              @click="removeOutboundRow(endpoint.id!, row)"
            >
              <UIcon name="i-lucide-trash" class="size-3.5" aria-hidden="true" />
            </UButton>
          </div>
          <span v-if="!endpoint.id" class="text-[10px] text-[var(--muted)]"
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
        :disabled="!subscriptionsValid()"
        @click="emit('save', subscriptions)"
      >
        Save
      </UButton>
    </template>
  </USlideover>
</template>
