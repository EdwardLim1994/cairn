<script setup lang="ts">
import { ref, watch } from "vue";
import type { CanvasGetResponse } from "#shared/api/canvas";
import SettingsAccordionCard from "./SettingsAccordionCard.vue";

type Destination = CanvasGetResponse["messageDestinations"][number];
type TopicDraft = { id: string; codeKey: string; name: string; x: number; y: number };

const props = withDefaults(
  defineProps<{
    queueId?: string;
    position?: { x: number; y: number };
    destinations: Destination[];
  }>(),
  {
    queueId: "legacy-queue",
    position: () => ({ x: 160, y: 120 }),
  },
);
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{
  save: [queueId: string, destinations: Destination[]];
  remove: [queueId: string];
}>();
const broker = ref<"kafka" | "rabbitmq">("kafka");
const queueName = ref("Message Queue");
const url = ref("localhost:9092");
const topics = ref<TopicDraft[]>([]);
const expandedTopicId = ref<string | null>(null);
const brokerOptions = [
  { label: "Kafka", value: "kafka" },
  { label: "RabbitMQ", value: "rabbitmq" },
];

function connectionUrl(destination: Destination) {
  if (destination.broker === "kafka") return destination.connection.brokers;
  const protocol = destination.connection.tls ? "amqps" : "amqp";
  return `${protocol}://${destination.connection.host}:${destination.connection.port}${destination.connection.virtualHost}`;
}

function expandTopic(id: string) {
  expandedTopicId.value = id;
}

function collapseTopic(id: string) {
  if (expandedTopicId.value === id) expandedTopicId.value = null;
}

watch(
  () => [open.value, props.destinations] as const,
  ([isOpen, destinations]) => {
    if (!isOpen) return;
    const first = destinations[0];
    queueName.value = first?.queueName ?? "Message Queue";
    broker.value = first?.broker ?? "kafka";
    url.value = first ? connectionUrl(first) : "localhost:9092";
    topics.value = destinations.map(({ id, codeKey, name, x, y }) => ({ id, codeKey, name, x, y }));
    expandedTopicId.value = null;
  },
  { immediate: true },
);

function addTopic() {
  const id = crypto.randomUUID();
  topics.value.push({
    id,
    codeKey: "",
    name: "",
    x: props.destinations[0]?.x ?? props.position.x,
    y: props.destinations[0]?.y ?? props.position.y,
  });
  expandedTopicId.value = id;
}

function save() {
  const previous = new Map(props.destinations.map((destination) => [destination.id, destination]));
  const destinations = topics.value.map((topic): Destination => {
    const old = previous.get(topic.id);
    if (broker.value === "kafka") {
      const connection =
        old?.broker === "kafka" ? old.connection : { securityProtocol: "PLAINTEXT" as const };
      return {
        ...topic,
        broker: "kafka",
        connection: { ...connection, brokers: url.value },
        ...(old
          ? { projectId: old.projectId, health: old.health }
          : { projectId: props.destinations[0]?.projectId ?? "local", health: null }),
      };
    }
    const address = /^(?:amqps?:\/\/)?(?:[^/@]+@)?\[?([^\]/:]+|::1)\]?(?::(\d+))?(\/.*)?$/.exec(
      url.value,
    );
    const connection =
      old?.broker === "rabbitmq" ? old.connection : { port: 5672, virtualHost: "/", tls: false };
    return {
      ...topic,
      broker: "rabbitmq",
      connection: {
        ...connection,
        host: address?.[1] ?? url.value,
        port: Number(address?.[2] ?? connection.port),
        virtualHost: address?.[3] ?? connection.virtualHost,
        tls: url.value.startsWith("amqps://"),
      },
      ...(old
        ? { projectId: old.projectId, health: old.health }
        : { projectId: props.destinations[0]?.projectId ?? "local", health: null }),
    };
  });
  emit(
    "save",
    props.queueId,
    destinations.map((destination) => ({
      ...destination,
      queueId: props.queueId,
      queueName: queueName.value,
    })),
  );
}

function handleOpenChange(value: boolean) {
  if (!value) open.value = false;
}
</script>

<template>
  <USlideover
    :open="open"
    side="right"
    :portal="false"
    :close="false"
    :content="{ 'aria-label': 'Message queue settings' }"
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
    <template #title>Message Queue Settings</template>
    <template #description>Configure the broker and its topics</template>
    <template #actions>
      <UButton
        v-if="props.destinations.length"
        type="button"
        color="error"
        variant="outline"
        class="inline-grid size-[34px] place-items-center rounded-lg border border-[var(--danger)] bg-[var(--panel)] p-0 leading-none text-[var(--danger)] hover:bg-[var(--danger-soft)]"
        aria-label="Remove message queue"
        title="Remove message queue"
        @click="emit('remove', props.queueId)"
      >
        <UIcon name="i-lucide-trash" class="size-4" aria-hidden="true" />
      </UButton>
    </template>
    <template #body>
      <div class="flex flex-col gap-1">
        <span class="text-[10px] font-medium text-[var(--muted)]">Message queue name</span>
        <UInput v-model="queueName" aria-label="Message queue name" required />
      </div>
      <div class="flex gap-2.5 max-[720px]:flex-col">
        <div class="min-w-0 flex flex-1 flex-col gap-1">
          <span class="text-[10px] font-medium text-[var(--muted)]">Message queue type</span>
          <USelect v-model="broker" :items="brokerOptions" aria-label="Message queue type" />
        </div>
        <div class="min-w-0 flex flex-1 flex-col gap-1">
          <span class="text-[10px] font-medium text-[var(--muted)]">URL</span>
          <UInput
            v-model="url"
            aria-label="Message queue URL"
            :placeholder="broker === 'kafka' ? 'localhost:9092' : 'amqp://localhost:5672/'"
          />
        </div>
      </div>
      <div class="mt-1 flex items-center justify-between gap-2">
        <strong class="text-xs">Topics</strong>
        <UButton type="button" color="neutral" variant="outline" @click="addTopic">New</UButton>
      </div>
      <SettingsAccordionCard
        v-for="(topic, index) in topics"
        :key="topic.id"
        :title="topic.name || `Topic ${index + 1}`"
        :subtitle="topic.codeKey"
        :delete-label="`Remove ${topic.name || `Topic ${index + 1}`}`"
        :open="expandedTopicId === topic.id"
        @expand="expandTopic(topic.id)"
        @collapse="collapseTopic(topic.id)"
        @delete="topics.splice(index, 1)"
      >
        <div class="flex flex-col gap-1">
          <span class="text-[10px] font-medium text-[var(--muted)]">Name</span>
          <UInput v-model="topic.name" :aria-label="`Topic ${index + 1} name`" required />
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-[10px] font-medium text-[var(--muted)]">Stable code key</span>
          <UInput v-model="topic.codeKey" :aria-label="`Topic ${index + 1} code key`" required />
        </div>
      </SettingsAccordionCard>
      <p
        v-if="!topics.length"
        class="rounded-xl border border-dashed border-[var(--border)] p-4 text-xs text-[var(--muted)]"
      >
        No topics configured yet.
      </p>
    </template>
    <template #footer>
      <UButton type="button" color="neutral" variant="outline" @click="open = false"
        >Discard</UButton
      >
      <UButton
        type="button"
        :disabled="
          !url.trim() ||
          !topics.length ||
          topics.some(({ name, codeKey }) => !name.trim() || !codeKey.trim())
        "
        @click="save"
        >Save</UButton
      >
    </template>
  </USlideover>
</template>
