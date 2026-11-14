<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";

const emit = defineEmits<{ edit: [destinationId: string] }>();

defineProps<{
  data: {
    destinationId: string;
    name: string;
    destinations: {
      id: string;
      name: string;
      broker: "kafka" | "rabbitmq";
    }[];
    online: boolean | null;
    topicsCollapsed: boolean;
  };
}>();
</script>

<template>
  <article class="app__graph-node app__graph-node--message-queue relative w-72 rounded-[10px]">
    <div class="relative flex h-[58px] items-center gap-2 border-b border-default px-3 pr-[4.5rem]">
      <div class="grid size-[31px] shrink-0 place-items-center rounded-[9px]">
        <img
          v-if="data.destinations[0]?.broker === 'kafka'"
          :src="'/icons/kafka.svg'"
          class="app__message-queue-kafka-icon size-[25px]"
          alt="Apache Kafka"
        />
        <img v-else :src="'/icons/rabbitmq.svg'" class="size-[25px]" alt="RabbitMQ" />
      </div>
      <div class="flex min-w-0 flex-1 flex-col">
        <div class="flex min-w-0 items-center gap-1.5">
          <output
            class="inline-block size-[9px] shrink-0 rounded-full border-2 border-[var(--ui-bg)]"
            :class="
              data.online === true
                ? 'bg-success'
                : data.online === false
                  ? 'bg-error'
                  : 'bg-[var(--ui-text-muted)]'
            "
            :aria-label="
              data.online === true
                ? 'Broker online'
                : data.online === false
                  ? 'Broker offline'
                  : 'Broker health unknown'
            "
            :title="
              data.online === true ? 'Online' : data.online === false ? 'Offline' : 'Checking'
            "
          />
          <strong class="truncate font-semibold">{{ data.name }}</strong>
        </div>
        <span class="text-[10px] text-muted">
          {{
            data.destinations[0]?.broker === "rabbitmq" ? "RabbitMQ topic exchange" : "Kafka topic"
          }}
        </span>
      </div>
      <button
        type="button"
        class="nodrag absolute right-2 top-2 inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-default bg-default px-2 text-[11.5px] font-medium text-muted hover:border-accented hover:bg-elevated hover:text-default"
        :aria-label="`Edit ${data.name}`"
        title="Edit message queue"
        @click.stop="emit('edit', data.destinationId)"
      >
        <UIcon name="i-lucide-pencil" class="size-3" aria-hidden="true" />
        Edit
      </button>
    </div>
    <template v-if="data.topicsCollapsed">
      <template v-for="destination in data.destinations" :key="destination.id">
        <Handle
          :id="`publish-in:${destination.id}`"
          type="target"
          :position="Position.Left"
          :connectable="false"
          class="app__endpoint-handle app__message-queue-handle--collapsed"
        />
        <Handle
          :id="`subscribe-out:${destination.id}`"
          type="source"
          :position="Position.Right"
          :connectable="false"
          class="app__endpoint-source app__message-queue-handle--collapsed"
        />
      </template>
      <div
        class="flex h-[47px] items-center border-t border-dashed border-default px-3 text-[10px] text-muted"
      >
        Queue connections bundled
      </div>
    </template>
    <div v-else class="flex flex-col">
      <div
        v-for="destination in data.destinations"
        :key="destination.id"
        class="relative flex h-[47px] min-w-0 items-center gap-2 border-t border-dashed border-default px-3 text-xs"
      >
        <Handle
          :id="`publish-in:${destination.id}`"
          type="target"
          :position="Position.Left"
          class="app__endpoint-handle"
        />
        <span class="truncate">{{ destination.name }}</span>
        <Handle
          :id="`subscribe-out:${destination.id}`"
          type="source"
          :position="Position.Right"
          class="app__endpoint-source"
        />
      </div>
    </div>
  </article>
</template>
