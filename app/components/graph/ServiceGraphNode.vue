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
  <article class="app__graph-node--service app__graph-node">
    <Handle id="service-out" type="source" :position="Position.Right" class="app__service-source" />
    <div class="app__node-header">
      <div class="app__framework-icon">
        <img
          v-if="data.framework.toLowerCase().includes('spring')"
          :src="'/icons/spring-boot.svg'"
          alt="Spring Boot"
        />
        <img v-else :src="'/icons/dotnet.svg'" alt=".NET" />
      </div>
      <div class="app__node-heading">
        <div class="app__node-name-line">
          <output
            class="app__service-status-dot"
            :class="
              data.online === true
                ? 'app__service-status-dot--on'
                : data.online === false
                  ? 'app__service-status-dot--off'
                  : 'app__service-status-dot--checking'
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
          <strong>{{ data.name }}</strong>
        </div>
        <span>{{ data.framework }} | {{ data.endpoints.length }} endpoints</span>
      </div>
      <button
        v-if="data.endpoints.length"
        type="button"
        class="app__collapse-connections nodrag"
        :aria-label="
          data.endpointsCollapsed ? 'Show service endpoints' : 'Collapse service endpoints'
        "
        :title="data.endpointsCollapsed ? 'Show service endpoints' : 'Collapse service endpoints'"
        @click.stop="emit('toggleEndpoints', data.serviceId)"
      >
        <svg class="app__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path v-if="data.endpointsCollapsed" d="M12 5v14m-7-7h14" />
          <path v-else d="M5 12h14" />
        </svg>
      </button>
    </div>
    <div
      class="app__endpoint-heading"
      :class="{ 'app__endpoint-heading--collapsed': data.endpointsCollapsed }"
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
      class="app__endpoint-row"
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
      <span class="app__method-tag" :class="`app__method-tag--${endpoint.method.toLowerCase()}`">
        {{ endpoint.method }}
      </span>
      <button
        type="button"
        class="app__endpoint-name app__endpoint-link"
        @click.stop="emit('openEndpoint', endpoint.id)"
      >
        {{ endpoint.name }}
      </button>
    </div>
    <div v-if="!data.endpoints.length" class="app__empty-endpoints">No endpoints registered</div>
    <div v-if="data.hasError" class="app__error-indicator">
      <span class="app__error-mark">!</span> Error reported for this service
    </div>
  </article>
</template>
