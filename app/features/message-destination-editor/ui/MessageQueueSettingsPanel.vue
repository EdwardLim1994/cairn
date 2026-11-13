<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { CanvasGetResponse } from "#shared/api/canvas";
import { ConfirmDialog, WorkspaceDrawer } from "../../../shared/ui";

type Destination = CanvasGetResponse["messageDestinations"][number];
const props = defineProps<{
  destination: Destination | null;
  position: { x: number; y: number };
  projectId: string;
}>();
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{
  save: [destination: Destination];
  remove: [destinationId: string];
}>();

const broker = ref<"kafka" | "rabbitmq">("kafka");
const name = ref("");
const url = ref("localhost:9092");
const initialFields = ref("");
const discardConfirmationOpen = ref(false);
const deleteConfirmationOpen = ref(false);
const isDirty = computed(
  () => JSON.stringify([broker.value, name.value, url.value]) !== initialFields.value,
);
const brokerOptions = [
  { label: "Kafka", value: "kafka" },
  { label: "RabbitMQ", value: "rabbitmq" },
];

function connectionUrl(destination: Destination) {
  if (destination.broker === "kafka") return destination.connection.brokers;
  const protocol = destination.connection.tls ? "amqps" : "amqp";
  return `${protocol}://${destination.connection.host}:${destination.connection.port}${destination.connection.virtualHost}`;
}

watch(
  () => [open.value, props.destination] as const,
  ([isOpen, destination]) => {
    if (!isOpen) return;
    broker.value = destination?.broker ?? "kafka";
    name.value = destination?.name ?? "";
    url.value = destination ? connectionUrl(destination) : "localhost:9092";
    initialFields.value = JSON.stringify([broker.value, name.value, url.value]);
  },
  { immediate: true },
);
watch(broker, (value, previous) => {
  if (value === previous) return;
  if (props.destination?.broker === value) {
    url.value = connectionUrl(props.destination);
    return;
  }
  url.value = value === "kafka" ? "localhost:9092" : "amqp://localhost:5672/";
});

function save() {
  const id = props.destination?.id ?? crypto.randomUUID();
  const common = {
    id,
    queueId: id,
    queueName: props.destination?.queueName ?? "Message Queue",
    name: name.value.trim(),
    x: props.destination?.x ?? props.position.x,
    y: props.destination?.y ?? props.position.y,
    projectId: props.destination?.projectId || props.projectId || "local",
    health: props.destination?.health ?? null,
  };

  if (broker.value === "kafka") {
    const previous = props.destination?.broker === "kafka" ? props.destination.connection : {};
    emit("save", {
      ...common,
      broker: "kafka",
      connection: { ...previous, brokers: url.value.trim() },
    });
    return;
  }

  const parsed = /^(amqps?):\/\/([^/:]+)(?::(\d+))?(\/.*)?$/.exec(url.value.trim());
  const previous =
    props.destination?.broker === "rabbitmq"
      ? props.destination.connection
      : { port: 5672, virtualHost: "/", tls: false };
  emit("save", {
    ...common,
    broker: "rabbitmq",
    connection: {
      ...previous,
      host: parsed?.[2] ?? url.value.trim(),
      port: parsed?.[3] ? Number(parsed[3]) : previous.port,
      virtualHost: parsed?.[4] ?? previous.virtualHost,
      tls: parsed?.[1] === "amqps" || (!parsed && previous.tls),
    },
  });
}

function close() {
  open.value = false;
}

function requestClose() {
  if (isDirty.value) discardConfirmationOpen.value = true;
  else close();
}

function confirmDiscard() {
  discardConfirmationOpen.value = false;
  close();
}

function confirmDelete() {
  deleteConfirmationOpen.value = false;
  if (props.destination) emit("remove", props.destination.id);
}
</script>

<template>
  <WorkspaceDrawer
    :open="open"
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
    @update:open="(value: boolean) => !value && requestClose()"
  >
    <template #title>{{ destination ? "Message queue settings" : "Add message queue" }}</template>
    <template #description>Configure one Kafka topic or RabbitMQ exchange</template>
    <template #actions>
      <UButton
        v-if="destination"
        type="button"
        color="error"
        variant="outline"
        class="inline-grid size-[34px] place-items-center rounded-lg border border-[var(--danger)] bg-[var(--panel)] p-0 text-[var(--danger)] hover:bg-[var(--danger-soft)]"
        aria-label="Remove message queue"
        title="Remove message queue"
        @click="deleteConfirmationOpen = true"
      >
        <UIcon name="i-lucide-trash" class="size-4" aria-hidden="true" />
      </UButton>
    </template>
    <template #body>
      <div class="flex flex-col gap-1">
        <span class="text-[12px] font-medium text-[var(--muted)]">Topic or exchange name</span>
        <UInput v-model="name" aria-label="Topic or exchange name" required />
      </div>
      <div class="flex gap-2.5 max-[720px]:flex-col">
        <div class="min-w-0 flex flex-1 flex-col gap-1">
          <span class="text-[12px] font-medium text-[var(--muted)]">Broker type</span>
          <USelect v-model="broker" :items="brokerOptions" aria-label="Broker type" />
        </div>
        <div class="min-w-0 flex flex-1 flex-col gap-1">
          <span class="text-[12px] font-medium text-[var(--muted)]">Connection URL</span>
          <UInput
            v-model="url"
            aria-label="Connection URL"
            :placeholder="broker === 'kafka' ? 'localhost:9092' : 'amqp://localhost:5672/'"
            required
          />
        </div>
      </div>
    </template>
    <template #footer>
      <UButton type="button" color="neutral" variant="outline" @click="requestClose"
        >Discard</UButton
      >
      <UButton type="button" :disabled="!name.trim() || !url.trim()" @click="save">{{
        destination ? "Update" : "Save"
      }}</UButton>
    </template>
  </WorkspaceDrawer>
  <ConfirmDialog
    :open="discardConfirmationOpen"
    title="Discard changes?"
    description="Your unsaved message queue changes will be lost."
    confirm-label="Discard changes"
    destructive
    @confirm="confirmDiscard"
    @cancel="discardConfirmationOpen = false"
  />
  <ConfirmDialog
    :open="deleteConfirmationOpen"
    title="Delete message queue?"
    description="The queue and its producer and consumer connections will be removed."
    confirm-label="Delete message queue"
    destructive
    @confirm="confirmDelete"
    @cancel="deleteConfirmationOpen = false"
  />
</template>
