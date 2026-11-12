<script setup lang="ts">
import type { GraphService } from "../models/graph";
import type { CanvasGetResponse } from "#shared/api/canvas";
import WorkspaceDrawer from "./WorkspaceDrawer.vue";

withDefaults(
  defineProps<{
    open: boolean;
    services: GraphService[];
    serviceHealth?: Record<string, boolean | null>;
    destinations: CanvasGetResponse["messageDestinations"];
  }>(),
  { serviceHealth: () => ({}) },
);
const emit = defineEmits<{
  "update:open": [open: boolean];
  "edit-service": [id: string];
  "edit-destination": [id: string];
  "add-service": [];
  "add-queue": [];
}>();

function frameworkIcon(framework: string) {
  const normalized = framework.toLowerCase();
  if (normalized.includes("spring")) return "/icons/spring-boot.svg";
  if (normalized.includes(".net")) return "/icons/dotnet.svg";
  return null;
}
</script>

<template>
  <WorkspaceDrawer :open="open" @update:open="emit('update:open', $event)">
    <template #title>Manage nodes</template>
    <template #description
      >{{ services.length }} services · {{ destinations.length }} topics</template
    >
    <template #body>
      <section class="flex flex-col gap-2" aria-label="Services">
        <header class="flex items-center justify-between gap-2">
          <h3 class="text-[12.5px] font-semibold">Services</h3>
          <UButton color="neutral" variant="outline" size="sm" @click="emit('add-service')">
            Register service
          </UButton>
        </header>
        <div class="overflow-hidden rounded-[9px] border border-[var(--border)]">
          <button
            v-for="service in services"
            :key="service.id"
            type="button"
            class="flex w-full items-center gap-2.5 border-b border-[var(--border)] bg-[var(--panel)] px-2.5 py-2.5 text-left last:border-b-0 hover:bg-[var(--panel2)]"
            :aria-label="`Edit ${service.name}`"
            @click="emit('edit-service', service.id)"
          >
            <span
              class="grid size-8 shrink-0 place-items-center rounded-md bg-[var(--panel2)]"
              :title="service.framework"
            >
              <img
                v-if="frameworkIcon(service.framework)"
                :src="frameworkIcon(service.framework)!"
                class="size-5 object-contain"
                :alt="service.framework"
              />
              <span
                v-else
                class="text-[10px] font-semibold uppercase"
                aria-label="Custom framework"
              >
                {{ service.name.slice(0, 2) }}
              </span>
            </span>
            <span class="flex min-w-0 flex-1 flex-col gap-0.5">
              <span class="truncate font-mono text-[12.5px] font-semibold">{{ service.name }}</span>
              <span class="truncate text-[11.5px] text-[var(--muted)]">{{ service.baseUrl }}</span>
            </span>
            <span class="flex shrink-0 items-center gap-1.5 text-[11px] text-[var(--muted)]">
              <span
                class="size-[7px] rounded-full"
                :class="
                  serviceHealth[service.id] === true
                    ? 'bg-[var(--success)]'
                    : serviceHealth[service.id] === false
                      ? 'bg-[var(--warning)]'
                      : 'bg-[var(--muted)]'
                "
              />
              {{
                serviceHealth[service.id] === true
                  ? "Healthy"
                  : serviceHealth[service.id] === false
                    ? "Slow"
                    : "Unknown"
              }}
            </span>
            <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-[var(--muted)]" />
          </button>
          <p v-if="!services.length" class="p-3 text-xs text-[var(--muted)]">
            No services registered.
          </p>
        </div>
      </section>
      <section class="flex flex-col gap-2" aria-label="Message queues">
        <header class="flex items-center justify-between gap-2">
          <h3 class="text-[12.5px] font-semibold">Message queues</h3>
          <UButton size="sm" color="neutral" variant="outline" @click="emit('add-queue')"
            >Add queue</UButton
          >
        </header>
        <div class="overflow-hidden rounded-[9px] border border-[var(--border)]">
          <button
            v-for="destination in destinations"
            :key="destination.id"
            type="button"
            class="flex w-full items-center gap-2.5 border-b border-[var(--border)] bg-[var(--panel)] px-2.5 py-2.5 text-left last:border-b-0 hover:bg-[var(--panel2)]"
            :aria-label="`Edit ${destination.name}`"
            @click="emit('edit-destination', destination.id)"
          >
            <span
              class="grid size-8 shrink-0 place-items-center rounded-md bg-[var(--panel2)]"
              :title="destination.broker === 'kafka' ? 'Kafka' : 'RabbitMQ'"
            >
              <img
                :src="destination.broker === 'kafka' ? '/icons/kafka.svg' : '/icons/rabbitmq.svg'"
                class="size-5 object-contain"
                :alt="destination.broker === 'kafka' ? 'Kafka' : 'RabbitMQ'"
              />
            </span>
            <span class="flex min-w-0 flex-1 flex-col gap-0.5">
              <span class="truncate font-mono text-[12.5px] font-semibold">{{
                destination.name
              }}</span>
              <span class="truncate text-[11.5px] text-[var(--muted)]">{{
                destination.queueName || destination.name
              }}</span>
            </span>
            <span class="flex shrink-0 items-center gap-1.5 text-[11px] text-[var(--muted)]">
              <span
                class="size-[7px] rounded-full"
                :class="
                  destination.health === true
                    ? 'bg-[var(--success)]'
                    : destination.health === false
                      ? 'bg-[var(--warning)]'
                      : 'bg-[var(--muted)]'
                "
              />
              {{
                destination.health === true
                  ? "Healthy"
                  : destination.health === false
                    ? "Slow"
                    : "Unknown"
              }}
            </span>
            <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-[var(--muted)]" />
          </button>
          <p v-if="!destinations.length" class="p-3 text-xs text-[var(--muted)]">
            No message queues configured.
          </p>
        </div>
      </section>
      <p class="text-xs leading-relaxed text-[var(--muted)]">
        Mock API triggers aren't listed here. Configure them from Mock APIs.
      </p>
    </template>
  </WorkspaceDrawer>
</template>
