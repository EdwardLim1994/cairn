<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";
import { computed } from "vue";

type Endpoint = {
  id?: string;
  name: string;
  method: string | null;
  rpcMethod: string | null;
};
type Subscription = {
  id: string;
  destinationName: string;
  consumerGroup?: string;
  bindingKey?: string;
};

const props = defineProps<{
  data: {
    serviceId: string;
    name: string;
    apiType: "REST" | "GRPC" | "WEBSOCKET";
    framework: string;
    online: boolean | null;
    endpoints: Endpoint[];
    subscriptions: Subscription[];
    outboundCalls: Array<{
      id: string;
      kind?: "api" | "message";
      sourceEndpointId?: string | null;
      sourceSubscriptionId?: string | null;
    }>;
    hasMessagePublisher: boolean;
    endpointsCollapsed: boolean;
    hasError: boolean;
  };
}>();
const data = computed(() => props.data);

function endpointOutboundCalls(endpointId: string | undefined) {
  return endpointId
    ? data.value.outboundCalls.filter((call) => call.sourceEndpointId === endpointId)
    : [];
}

function subscriptionOutboundCalls(subscriptionId: string) {
  return data.value.outboundCalls.filter((call) => call.sourceSubscriptionId === subscriptionId);
}

function serviceOutboundCalls() {
  return data.value.outboundCalls.filter(
    (call) => !call.sourceEndpointId && !call.sourceSubscriptionId,
  );
}

function collapsedOutboundCalls() {
  return data.value.outboundCalls.filter(
    (call) => call.sourceEndpointId || call.sourceSubscriptionId,
  );
}

function callHandleStyle(index: number, count: number) {
  return { top: `${((index + 1) / (count + 1)) * 100}%` };
}

const emit = defineEmits<{
  toggleEndpoints: [serviceId: string];
  openEndpoint: [endpointId: string | undefined];
}>();
</script>

<template>
  <article class="app__graph-node--service app__graph-node relative rounded-2xl">
    <template v-if="data.endpointsCollapsed">
      <template v-for="endpoint in data.endpoints" :key="endpoint.id">
        <Handle
          v-if="endpoint.id"
          :id="`in:${endpoint.id}`"
          type="target"
          :position="Position.Left"
          :connectable="false"
          class="app__endpoint-handle app__endpoint-handle--collapsed"
        />
        <Handle
          v-if="endpoint.id && !endpointOutboundCalls(endpoint.id).length"
          :id="`out:${endpoint.id}`"
          type="source"
          :position="Position.Right"
          :connectable="false"
          class="app__endpoint-source app__endpoint-source--collapsed"
        />
      </template>
      <Handle
        v-for="call in collapsedOutboundCalls()"
        :key="`collapsed-${call.id}`"
        :id="`outbound-call:${call.id}`"
        type="source"
        :position="Position.Right"
        :connectable="false"
        class="app__endpoint-source app__endpoint-source--collapsed"
      />
    </template>
    <div class="flex h-[58px] items-center gap-2 border-b border-[var(--border)] px-3">
      <div class="grid size-[31px] shrink-0 place-items-center rounded-[9px] bg-transparent">
        <img
          v-if="data.framework.toLowerCase().includes('spring')"
          :src="'/icons/spring-boot.svg'"
          alt="Spring Boot"
        />
        <img
          v-else-if="data.framework.toLowerCase().includes('.net')"
          :src="'/icons/dotnet.svg'"
          alt=".NET"
        />
        <span v-else class="text-[10px] font-semibold uppercase" aria-label="Other framework">
          {{ data.name.slice(0, 2) }}
        </span>
      </div>
      <div class="flex min-w-0 flex-1 flex-col">
        <div class="flex min-w-0 items-center gap-1.5">
          <output
            class="inline-block size-[9px] shrink-0 rounded-full border-2 border-[var(--panel)]"
            :class="
              data.online === true
                ? 'bg-[#15966f]'
                : data.online === false
                  ? 'bg-[var(--danger)]'
                  : 'bg-[var(--muted)]'
            "
            :aria-label="
              data.online === true
                ? 'Service online'
                : data.online === false
                  ? 'Service offline'
                  : 'Checking service status'
            "
            :title="
              data.online === true ? 'Online' : data.online === false ? 'Offline' : 'Checking'
            "
          ></output>
          <strong class="truncate font-semibold">{{ data.name }}</strong>
        </div>
        <span class="text-[10px] text-[var(--muted)]"
          >{{ data.framework }} | {{ data.endpoints.length }} endpoints</span
        >
      </div>
      <button
        v-if="data.endpoints.length"
        type="button"
        class="nodrag grid size-6 shrink-0 place-items-center rounded-md border border-[var(--border)] bg-[var(--panel2)] text-[var(--muted)] hover:text-[var(--text)]"
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
    </div>
    <div
      class="flex h-[35px] items-center justify-between px-3 text-[9px] text-[var(--muted)]"
      :class="data.endpointsCollapsed ? 'whitespace-nowrap tracking-normal' : 'tracking-[0.08em]'"
    >
      <span>{{
        data.endpointsCollapsed
          ? `${data.endpoints.length} endpoints · incoming connections bundled`
          : "REGISTERED ENDPOINTS"
      }}</span>
    </div>
    <div
      v-for="endpoint in data.endpoints"
      :key="endpoint.id"
      class="app__endpoint-row relative flex h-[56px] min-w-0 items-center gap-2 border-t border-dashed border-[var(--border)] px-3"
      :class="{
        'app__endpoint-row--collapsed': data.endpointsCollapsed,
        'app__endpoint-row--bundle':
          data.endpointsCollapsed && endpoint.id === data.endpoints[0]?.id,
      }"
    >
      <Handle
        v-if="endpoint.id && !data.endpointsCollapsed"
        :id="`in:${endpoint.id}`"
        type="target"
        :position="Position.Left"
        :connectable="!data.endpointsCollapsed"
        class="app__endpoint-handle"
      />
      <Handle
        v-if="endpoint.id && !data.endpointsCollapsed && !endpointOutboundCalls(endpoint.id).length"
        :id="`out:${endpoint.id}`"
        type="source"
        :position="Position.Right"
        class="app__endpoint-source app__endpoint-source--authoring"
      />
      <Handle
        v-for="(call, callIndex) in data.endpointsCollapsed
          ? []
          : endpointOutboundCalls(endpoint.id)"
        :key="call.id"
        :id="`outbound-call:${call.id}`"
        type="source"
        :position="Position.Right"
        :style="callHandleStyle(callIndex, endpointOutboundCalls(endpoint.id).length)"
        class="app__endpoint-source app__endpoint-source--connected"
        :class="{ 'app__endpoint-source--message': call.kind === 'message' }"
      />
      <span
        class="rounded px-1 py-0.5 font-mono text-[9px]"
        :class="
          data.apiType === 'REST'
            ? `app__method-tag--${endpoint.method?.toLowerCase()}`
            : data.apiType === 'WEBSOCKET'
              ? 'rounded bg-[var(--accent-soft)] text-[var(--accent)]'
              : 'app__method-tag--grpc'
        "
      >
        {{
          data.apiType === "REST" ? endpoint.method : data.apiType === "WEBSOCKET" ? "WS" : "gRPC"
        }}
      </span>
      <button
        type="button"
        class="max-w-24 truncate whitespace-nowrap border-0 bg-transparent p-0 text-left text-[11px] text-inherit hover:text-[var(--accent)] hover:underline"
        :aria-label="`Open endpoint ${endpoint.name}`"
        @click.stop="emit('openEndpoint', endpoint.id)"
      >
        {{ endpoint.name }}
      </button>
    </div>
    <div v-if="!data.endpoints.length" class="p-5 text-center text-[11px] text-[var(--muted)]">
      No endpoints registered
    </div>
    <div
      v-if="data.hasMessagePublisher"
      class="relative flex h-[47px] items-center gap-2 border-t border-dashed border-[var(--border)] px-3"
    >
      <span class="min-w-0 flex-1 text-[10px] text-[var(--muted)]">Message publisher</span>
      <Handle
        v-if="!serviceOutboundCalls().length"
        id="service-out"
        type="source"
        :position="Position.Right"
        class="app__endpoint-source app__endpoint-source--authoring"
      />
      <Handle
        v-for="(call, callIndex) in serviceOutboundCalls()"
        :key="call.id"
        :id="`outbound-call:${call.id}`"
        type="source"
        :position="Position.Right"
        :style="callHandleStyle(callIndex, serviceOutboundCalls().length)"
        class="app__endpoint-source app__endpoint-source--connected"
        :class="{ 'app__endpoint-source--message': call.kind === 'message' }"
      />
    </div>
    <template v-if="data.endpointsCollapsed && data.subscriptions.length">
      <div
        class="relative flex h-[56px] items-center border-t border-dashed border-[var(--border)] px-3 text-[10px] text-[var(--muted)]"
      >
        <Handle
          v-for="subscription in data.subscriptions"
          :key="subscription.id"
          :id="`subscriber-in:${subscription.id}`"
          type="target"
          :position="Position.Left"
          :connectable="false"
          class="app__endpoint-handle"
        />
        <Handle
          v-for="subscription in data.subscriptions.filter(
            (item) => !subscriptionOutboundCalls(item.id).length,
          )"
          :key="`authoring-${subscription.id}`"
          :id="`consumer-out:${subscription.id}`"
          type="source"
          :position="Position.Right"
          :connectable="false"
          class="app__endpoint-source app__endpoint-source--collapsed"
        />
        {{ data.subscriptions.length }} consumers · connections bundled
      </div>
    </template>
    <div
      v-else
      v-for="subscription in data.subscriptions"
      :key="subscription.id"
      class="relative flex h-[56px] min-w-0 items-center gap-2 border-t border-dashed border-[var(--border)] px-3"
    >
      <Handle
        :id="`subscriber-in:${subscription.id}`"
        type="target"
        :position="Position.Left"
        class="app__endpoint-handle"
      />
      <Handle
        v-if="!subscriptionOutboundCalls(subscription.id).length"
        :id="`consumer-out:${subscription.id}`"
        type="source"
        :position="Position.Right"
        class="app__endpoint-source app__endpoint-source--authoring"
      />
      <Handle
        v-for="(call, callIndex) in subscriptionOutboundCalls(subscription.id)"
        :key="call.id"
        :id="`outbound-call:${call.id}`"
        type="source"
        :position="Position.Right"
        :style="callHandleStyle(callIndex, subscriptionOutboundCalls(subscription.id).length)"
        class="app__endpoint-source app__endpoint-source--connected"
        :class="{ 'app__endpoint-source--message': call.kind === 'message' }"
      />
      <span class="rounded px-1 py-0.5 text-[9px] text-[var(--muted)]">SUB</span>
      <span class="min-w-0 flex-1 truncate text-[11px]">{{ subscription.destinationName }}</span>
      <span class="max-w-24 truncate text-[9px] text-[var(--muted)]">
        {{ subscription.consumerGroup ?? subscription.bindingKey }}
      </span>
    </div>
    <div
      v-if="data.hasError"
      class="border-t border-[var(--border)] px-3 py-2 text-[10px] text-[var(--danger)]"
    >
      <span
        class="mr-1 inline-grid size-4 place-items-center rounded-full bg-[var(--danger-soft)] font-bold"
        >!</span
      >
      Error reported for this service
    </div>
  </article>
</template>
