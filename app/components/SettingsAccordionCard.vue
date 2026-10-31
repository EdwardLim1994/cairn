<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  id?: string;
  title: string;
  subtitle?: string;
  deleteLabel: string;
  open?: boolean;
}>();

const emit = defineEmits<{
  delete: [];
  toggle: [open: boolean];
  expand: [];
  collapse: [];
}>();

const items = computed(() => [{ value: "settings-card", label: props.title }]);

function updateOpen(value: string | string[] | undefined) {
  const open = value === "settings-card";
  emit("toggle", open);
  emit(open ? "expand" : "collapse");
}
</script>

<template>
  <div :id="id" class="app__endpoint-form-card" :data-open="Boolean(props.open)">
    <UButton
      type="button"
      color="error"
      variant="outline"
      class="app__endpoint-delete-button app__endpoint-card-delete"
      :aria-label="deleteLabel"
      :title="deleteLabel"
      @click.stop.prevent="emit('delete')"
    >
      <svg class="app__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" />
      </svg>
    </UButton>
    <UAccordion
      :items="items"
      type="single"
      collapsible
      :unmount-on-hide="false"
      :model-value="props.open ? 'settings-card' : undefined"
      :ui="{
        root: 'app__endpoint-accordion',
        item: 'app__endpoint-accordion-item',
        trigger: 'app__endpoint-form-summary',
        label: 'app__endpoint-summary-title',
        trailingIcon: 'app__settings-accordion-chevron',
        content: 'app__endpoint-accordion-content',
        body: 'app__endpoint-accordion-body',
      }"
      @update:model-value="updateOpen"
    >
      <template #default>
        <div class="app__endpoint-summary-copy">
          <strong>{{ title }}</strong>
          <span v-if="subtitle">{{ subtitle }}</span>
        </div>
      </template>
      <template #body>
        <slot />
      </template>
    </UAccordion>
  </div>
</template>
