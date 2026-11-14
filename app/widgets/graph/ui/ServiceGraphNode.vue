<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";
import { computed } from "vue";

type Endpoint = {
  id?: string;
  name: string;
  method: string | null;
  url?: string | null;
  rpcMethod: string | null;
};
type Subscription = {
  id: string;
  destinationName: string;
  consumerGroup?: string;
  bindingKey?: string;
};
type OutboundCall = {
  id: string;
  kind?: "api" | "message";
  targetServiceId?: string;
  targetServiceName?: string;
  targetEndpointLabel?: string;
  sourceEndpointName?: string;
  destinationId?: string;
  sourceEndpointId?: string | null;
  sourceSubscriptionId?: string | null;
  label?: string;
  methodTag?: string;
};

const props = defineProps<{
  data: {
    serviceId: string;
    name: string;
    apiType: "REST" | "GRPC" | "WEBSOCKET";
    framework: string;
    inboundCount?: number;
    outboundCount?: number;
    online: boolean | null;
    endpoints: Endpoint[];
    subscriptions: Subscription[];
    outboundCalls: OutboundCall[];
    observedInboundEndpointIds?: string[];
    observedOutboundCallIds?: string[];
    observedSubscriptionIds?: string[];
    hasMessagePublisher: boolean;
    endpointsCollapsed: boolean;
    hasError: boolean;
  };
}>();
const data = computed(() => props.data);
const outboundCallRows = computed(() => {
  const groups = new Map<string, { calls: OutboundCall[]; label: string; title: string }>();
  for (const call of data.value.outboundCalls) {
    let key = `call:${call.id}`;
    if (call.targetServiceId) key = `service:${call.targetServiceId}`;
    else if (call.destinationId) key = `destination:${call.destinationId}`;
    const group = groups.get(key) ?? { calls: [], label: call.label ?? call.id, title: "" };
    group.calls.push(call);
    const endpointLabels = [
      ...new Set(group.calls.map(({ targetEndpointLabel }) => targetEndpointLabel).filter(Boolean)),
    ];
    if (call.targetServiceName) {
      group.label = [call.targetServiceName, endpointLabels.join(", ")].filter(Boolean).join(" · ");
    }
    const origins = [
      ...new Set(group.calls.map(({ sourceEndpointName }) => sourceEndpointName).filter(Boolean)),
    ];
    const originDescription = origins.length ? ` from ${origins.join(", ")}` : "";
    group.title =
      group.calls.length > 1
        ? `${group.calls.length} configured calls${originDescription}`
        : (call.label ?? call.id);
    groups.set(key, group);
  }
  return [...groups].map(([id, group]) => ({ id, ...group }));
});

function endpointOutboundCalls(endpointId: string | undefined) {
  return endpointId
    ? data.value.outboundCalls.filter((call) => call.sourceEndpointId === endpointId)
    : [];
}

function subscriptionOutboundCalls(subscriptionId: string) {
  return data.value.outboundCalls.filter((call) => call.sourceSubscriptionId === subscriptionId);
}

function isObservedInboundEndpoint(endpointId: string) {
  return data.value.observedInboundEndpointIds?.includes(endpointId) ?? false;
}

function isObservedOutboundCall(callId: string) {
  return data.value.observedOutboundCallIds?.includes(callId) ?? false;
}

function isObservedSubscription(subscriptionId: string) {
  return data.value.observedSubscriptionIds?.includes(subscriptionId) ?? false;
}

function endpointsWithoutOutboundCalls() {
  return data.value.endpoints.filter(
    (endpoint) => endpoint.id && !endpointOutboundCalls(endpoint.id).length,
  );
}

function subscriptionsWithoutOutboundCalls() {
  return data.value.subscriptions.filter(
    (subscription) => !subscriptionOutboundCalls(subscription.id).length,
  );
}

function endpointLabel(endpoint: Endpoint) {
  if (endpoint.rpcMethod) return endpoint.rpcMethod;
  if (endpoint.url && endpoint.method) return `${endpoint.method} ${endpoint.url}`;
  return endpoint.name;
}

function callTagClass(tag: string) {
  const method = tag.toLowerCase();
  if (["get", "post", "put", "patch", "delete"].includes(method))
    return `app__method-tag--${method}`;
  if (method === "grpc")
    return "bg-[color-mix(in_srgb,_var(--ui-success)_10%,_transparent)] text-success";
  if (method === "pub" || method === "sub")
    return "bg-[color-mix(in_srgb,_var(--ui-warning)_10%,_transparent)] text-warning";
  if (method === "ws")
    return "bg-[color-mix(in_srgb,_var(--ui-primary)_10%,_transparent)] text-primary";
  return "bg-elevated text-muted";
}

function callTag(call: OutboundCall) {
  return call.methodTag ?? (call.kind === "message" ? "PUB" : "API");
}

function callRowTag(calls: OutboundCall[]) {
  const tags = [...new Set(calls.map(callTag))];
  return tags.length === 1 ? tags[0]! : "API";
}

function frameworkBadgeClass() {
  const framework = data.value.framework.toLowerCase();
  if (framework.includes("spring"))
    return "bg-[color-mix(in_srgb,_var(--ui-success)_10%,_transparent)] text-success";
  if (framework.includes(".net"))
    return "bg-[color-mix(in_srgb,_var(--ui-secondary)_10%,_transparent)] text-[var(--ui-secondary)]";
  return "bg-elevated text-default";
}

const emit = defineEmits<{
  edit: [serviceId: string];
  toggleEndpoints: [serviceId: string];
  openEndpoint: [endpointId: string | undefined];
}>();
const serviceOutHandle = "service-out";
</script>

<template>
  <article class="app__graph-node--service app__graph-node relative rounded-[10px]">
    <template v-if="data.endpointsCollapsed">
      <template v-for="endpoint in data.endpoints" :key="endpoint.id">
        <Handle
          v-if="endpoint.id"
          :id="`in:${endpoint.id}`"
          type="target"
          :position="Position.Left"
          :connectable="false"
          class="app__endpoint-handle app__endpoint-handle--collapsed app__service-handle--collapsed"
          :class="{ 'app__endpoint-handle--observed': isObservedInboundEndpoint(endpoint.id) }"
        />
      </template>
      <Handle
        v-for="subscription in data.subscriptions"
        :key="`collapsed-in-${subscription.id}`"
        :id="`subscriber-in:${subscription.id}`"
        type="target"
        :position="Position.Left"
        :connectable="false"
        class="app__endpoint-handle app__endpoint-handle--collapsed app__service-handle--collapsed"
        :class="{ 'app__endpoint-handle--observed': isObservedSubscription(subscription.id) }"
      />
      <Handle
        v-for="call in data.outboundCalls"
        :key="`collapsed-out-${call.id}`"
        :id="`outbound-call:${call.id}`"
        type="source"
        :position="Position.Right"
        :connectable="false"
        class="app__endpoint-source app__endpoint-source--collapsed app__service-handle--collapsed"
        :class="{ 'app__endpoint-source--observed': isObservedOutboundCall(call.id) }"
      />
      <Handle
        v-for="endpoint in endpointsWithoutOutboundCalls()"
        :key="`collapsed-out-${endpoint.id}`"
        :id="`out:${endpoint.id}`"
        type="source"
        :position="Position.Right"
        :connectable="false"
        class="app__endpoint-source app__endpoint-source--collapsed app__service-handle--collapsed"
      />
      <Handle
        v-for="subscription in subscriptionsWithoutOutboundCalls()"
        :key="`collapsed-consumer-${subscription.id}`"
        :id="`consumer-out:${subscription.id}`"
        type="source"
        :position="Position.Right"
        :connectable="false"
        class="app__endpoint-source app__endpoint-source--collapsed app__service-handle--collapsed"
        :class="{ 'app__endpoint-source--observed': isObservedSubscription(subscription.id) }"
      />
      <Handle
        v-if="data.hasMessagePublisher && !data.outboundCalls.length"
        :id="serviceOutHandle"
        type="source"
        :position="Position.Right"
        :connectable="false"
        class="app__endpoint-source app__endpoint-source--collapsed app__service-handle--collapsed"
      />
    </template>
    <header
      class="relative flex h-14 flex-col justify-center gap-1.5 border-b border-default px-3 py-2"
      :class="
        data.endpointsCollapsed &&
        !data.subscriptions.length &&
        !data.hasMessagePublisher &&
        !data.hasError
          ? 'border-b-0'
          : ''
      "
    >
      <div class="flex min-w-0 items-center pr-[5.25rem]">
        <strong class="truncate font-mono text-[13px] font-semibold">{{ data.name }}</strong>
      </div>
      <div class="flex min-w-0 items-center gap-1.5 pr-14">
        <span
          v-if="data.framework.toLowerCase() === 'other'"
          class="grid size-[18px] shrink-0 place-items-center rounded bg-elevated text-[9px] font-semibold uppercase text-default"
          aria-label="Other framework"
        >
          {{ data.name.slice(0, 2) }}
        </span>
        <span
          class="inline-flex h-[18px] shrink-0 items-center rounded px-1.5 text-[10.5px] font-semibold"
          :class="frameworkBadgeClass()"
          aria-label="Service framework"
        >
          <UIcon
            v-if="data.framework.toLowerCase().includes('spring')"
            name="i-simple-icons-springboot"
            class="mr-1 size-3 text-success"
            aria-hidden="true"
          />
          <UIcon
            v-else-if="data.framework.toLowerCase().includes('.net')"
            name="i-simple-icons-dotnet"
            class="mr-1 size-3 text-secondary"
            aria-hidden="true"
          />
          {{ data.framework }}
        </span>
        <output
          class="size-[7px] shrink-0 rounded-full"
          :class="
            data.online === true ? 'bg-success' : data.online === false ? 'bg-error' : 'bg-warning'
          "
          :aria-label="
            data.online === true
              ? 'Service online'
              : data.online === false
                ? 'Service offline'
                : 'Checking service status'
          "
          :title="data.online === true ? 'Online' : data.online === false ? 'Offline' : 'Checking'"
        />
        <span class="truncate text-[11px] text-muted">
          {{ data.online === true ? "Online" : data.online === false ? "Offline" : "Checking" }}
        </span>
        <span v-if="data.endpointsCollapsed" class="truncate text-[11px] text-muted">
          · {{ data.inboundCount ?? 0 }} in · {{ data.outboundCount ?? data.outboundCalls.length }}
          out
        </span>
      </div>
      <button
        type="button"
        class="nodrag absolute right-2 top-2 inline-flex h-6 items-center gap-1 rounded-md border border-default bg-default px-2 text-[11.5px] font-medium text-muted hover:border-accented hover:bg-elevated hover:text-default"
        :aria-label="`Edit ${data.name}`"
        title="Edit service"
        @click.stop="emit('edit', data.serviceId)"
      >
        <UIcon name="i-lucide-pencil" class="size-3" aria-hidden="true" />
        Edit
      </button>
      <button
        v-if="data.endpoints.length"
        type="button"
        class="nodrag absolute right-2 top-[34px] grid size-5 shrink-0 place-items-center rounded-md border border-default bg-default text-muted hover:bg-elevated hover:text-default"
        :aria-label="
          data.endpointsCollapsed ? 'Show service endpoints' : 'Collapse service endpoints'
        "
        :title="data.endpointsCollapsed ? 'Show service endpoints' : 'Collapse service endpoints'"
        @click.stop="emit('toggleEndpoints', data.serviceId)"
      >
        <UIcon
          :name="data.endpointsCollapsed ? 'i-lucide-plus' : 'i-lucide-minus'"
          class="size-4"
          aria-hidden="true"
        />
      </button>
    </header>
    <template v-if="!data.endpointsCollapsed">
      <div
        class="flex h-6 items-center px-3 pt-[9px] text-[10px] font-semibold tracking-[0.07em] text-muted"
      >
        INBOUND CALLS
      </div>
      <div
        v-for="endpoint in data.endpoints"
        :key="endpoint.id"
        class="app__endpoint-row relative flex h-[30px] min-w-0 items-center gap-2 border-t border-dashed border-default px-3"
      >
        <Handle
          v-if="endpoint.id"
          :id="'in:' + endpoint.id"
          type="target"
          :position="Position.Left"
          class="app__endpoint-handle"
          :class="{ 'app__endpoint-handle--observed': isObservedInboundEndpoint(endpoint.id) }"
        />
        <span
          class="shrink-0 rounded px-1 py-0.5 font-mono text-[9px]"
          :class="
            callTagClass(
              data.apiType === 'REST'
                ? (endpoint.method ?? 'API')
                : data.apiType === 'WEBSOCKET'
                  ? 'WS'
                  : 'gRPC',
            )
          "
        >
          {{
            data.apiType === "REST"
              ? (endpoint.method ?? "API")
              : data.apiType === "WEBSOCKET"
                ? "WS"
                : "gRPC"
          }}
        </span>
        <button
          type="button"
          class="min-w-0 truncate whitespace-nowrap border-0 bg-transparent p-0 text-left font-mono text-[11px] text-inherit hover:text-primary hover:underline"
          :aria-label="'Open endpoint ' + endpoint.name"
          @click.stop="emit('openEndpoint', endpoint.id)"
        >
          {{ endpointLabel(endpoint) }}
        </button>
      </div>
      <div
        v-for="subscription in data.subscriptions"
        :key="subscription.id"
        class="relative flex h-[30px] min-w-0 items-center gap-2 border-t border-dashed border-default px-3"
      >
        <Handle
          :id="'subscriber-in:' + subscription.id"
          type="target"
          :position="Position.Left"
          class="app__endpoint-handle"
          :class="{ 'app__endpoint-handle--observed': isObservedSubscription(subscription.id) }"
        />
        <span
          class="shrink-0 rounded px-1 py-0.5 font-mono text-[9px]"
          :class="callTagClass('SUB')"
        >
          SUB
        </span>
        <span class="min-w-0 flex-1 truncate font-mono text-[11px]">
          {{ subscription.destinationName }}
        </span>
        <span class="max-w-24 truncate text-[9px] text-muted">
          {{ subscription.consumerGroup ?? subscription.bindingKey }}
        </span>
      </div>
      <div
        v-if="!data.endpoints.length && !data.subscriptions.length"
        class="px-3 py-2 text-[11px] text-muted"
      >
        No inbound calls
      </div>

      <div
        class="flex h-6 items-center px-3 pt-[9px] text-[10px] font-semibold tracking-[0.07em] text-muted"
      >
        OUTBOUND CALLS
      </div>
      <div
        v-for="row in outboundCallRows"
        :key="row.id"
        :data-outbound-call-group="row.id"
        class="relative flex h-[30px] min-w-0 items-center gap-2 border-t border-dashed border-default px-3"
      >
        <Handle
          v-for="call in row.calls"
          :key="call.id"
          :id="'outbound-call:' + call.id"
          type="source"
          :position="Position.Right"
          :data-outbound-call="call.id"
          class="app__endpoint-source app__endpoint-source--connected"
          :class="{
            'app__endpoint-source--message': call.kind === 'message',
            'app__endpoint-source--observed': isObservedOutboundCall(call.id),
          }"
        />
        <span
          class="shrink-0 rounded px-1 py-0.5 font-mono text-[9px]"
          :class="callTagClass(callRowTag(row.calls))"
        >
          {{ callRowTag(row.calls) }}
        </span>
        <span class="min-w-0 flex-1 truncate font-mono text-[11px]" :title="row.title">
          {{ row.label }}
        </span>
      </div>
      <div
        v-for="endpoint in endpointsWithoutOutboundCalls()"
        :key="'out-' + endpoint.id"
        class="relative flex h-[30px] min-w-0 items-center gap-2 border-t border-dashed border-default px-3"
      >
        <Handle
          :id="'out:' + endpoint.id"
          type="source"
          :position="Position.Right"
          class="app__endpoint-source app__endpoint-source--authoring"
        />
        <span class="shrink-0 rounded bg-elevated px-1 py-0.5 font-mono text-[9px] text-muted">
          API
        </span>
        <span class="min-w-0 flex-1 truncate text-[11px] text-muted">
          Connect from {{ endpoint.name }}
        </span>
      </div>
      <div
        v-for="subscription in subscriptionsWithoutOutboundCalls()"
        :key="'consumer-out-' + subscription.id"
        class="relative flex h-[30px] min-w-0 items-center gap-2 border-t border-dashed border-default px-3"
      >
        <Handle
          :id="'consumer-out:' + subscription.id"
          type="source"
          :position="Position.Right"
          class="app__endpoint-source app__endpoint-source--authoring"
          :class="{ 'app__endpoint-source--observed': isObservedSubscription(subscription.id) }"
        />
        <span class="shrink-0 rounded bg-elevated px-1 py-0.5 font-mono text-[9px] text-muted">
          SUB
        </span>
        <span class="min-w-0 flex-1 truncate text-[11px] text-muted">
          Connect from {{ subscription.destinationName }}
        </span>
      </div>
      <div
        v-if="data.hasMessagePublisher && !data.outboundCalls.length"
        class="relative flex h-[30px] items-center gap-2 border-t border-dashed border-default px-3"
      >
        <Handle
          :id="serviceOutHandle"
          type="source"
          :position="Position.Right"
          class="app__endpoint-source app__endpoint-source--authoring"
        />
        <span class="min-w-0 text-[11px] text-muted">Message publisher</span>
      </div>
      <div
        v-if="
          !data.outboundCalls.length &&
          !endpointsWithoutOutboundCalls().length &&
          !subscriptionsWithoutOutboundCalls().length &&
          !data.hasMessagePublisher
        "
        class="px-3 py-2 text-[11px] text-muted"
      >
        No outbound calls
      </div>
    </template>
    <div v-if="data.hasError" class="border-t border-default px-3 py-2 text-[10px] text-error">
      <span
        class="mr-1 inline-grid size-4 place-items-center rounded-full bg-[color-mix(in_srgb,_var(--ui-error)_10%,_transparent)] font-bold"
        >!</span
      >
      Error reported for this service
    </div>
  </article>
</template>
