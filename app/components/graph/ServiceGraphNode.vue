<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";

type Endpoint = {
  id?: string;
  name: string;
  method: string;
};

defineProps<{
  data: {
    serviceId: string;
    name: string;
    framework: string;
    online: boolean | null;
    endpoints: Endpoint[];
    endpointsCollapsed: boolean;
    hasError: boolean;
  };
}>();

const emit = defineEmits<{
  toggleEndpoints: [serviceId: string];
  openEndpoint: [endpointId: string | undefined];
}>();
</script>

<template>
  <article class="app__graph-node--service app__graph-node relative rounded-2xl">
    <Handle id="service-out" type="source" :position="Position.Right" class="app__service-source" />
    <div class="flex h-[58px] items-center gap-2 border-b border-[var(--border)] px-3">
      <div class="grid size-[31px] shrink-0 place-items-center rounded-[9px] bg-transparent">
        <img
          v-if="data.framework.toLowerCase().includes('spring')"
          :src="'/icons/spring-boot.svg'"
          alt="Spring Boot"
        />
        <img v-else :src="'/icons/dotnet.svg'" alt=".NET" />
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
      class="app__endpoint-row relative flex h-[47px] min-w-0 items-center gap-2 border-t border-dashed border-[var(--border)] px-3"
      :class="{
        'app__endpoint-row--collapsed': data.endpointsCollapsed,
        'app__endpoint-row--bundle':
          data.endpointsCollapsed && endpoint.id === data.endpoints[0]?.id,
      }"
    >
      <Handle
        v-if="endpoint.id && (!data.endpointsCollapsed || endpoint.id === data.endpoints[0]?.id)"
        :id="endpoint.id"
        type="target"
        :position="Position.Left"
        class="app__endpoint-handle"
      />
      <span
        class="rounded px-1 py-0.5 font-mono text-[9px]"
        :class="`app__method-tag--${endpoint.method.toLowerCase()}`"
      >
        {{ endpoint.method }}
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
