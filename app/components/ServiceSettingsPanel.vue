<script setup lang="ts">
type EndpointDraft = {
  id?: string;
  name: string;
  apiType: "REST";
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  requestJson?: unknown;
};
type ServiceDraft = {
  name: string;
  framework: string;
  baseUrl: string;
  active: boolean;
  endpoints: EndpointDraft[];
};

const draft = defineModel<ServiceDraft>("draft", { required: true });
const frameworkMenuOpen = defineModel<boolean>("frameworkMenuOpen", { required: true });
const props = defineProps<{ editingServiceId: string | null }>();
const emit = defineEmits<{
  addEndpoint: [];
  removeEndpoint: [index: number];
  save: [];
  discard: [];
  removeService: [id: string];
}>();
</script>

<template>
  <div class="app__dialog-backdrop" @click.self="emit('discard')">
    <section
      class="app__side-dialog app__surface"
      role="dialog"
      aria-modal="true"
      aria-label="Service settings"
    >
      <header class="app__dialog-header">
        <div>
          <strong>{{ props.editingServiceId ? "Service settings" : "Add service node" }}</strong>
          <span>Configure the service and its endpoints</span>
        </div>
        <button
          v-if="props.editingServiceId"
          class="app__icon-button app__icon-button--danger"
          aria-label="Remove service"
          title="Remove service"
          @click="emit('removeService', props.editingServiceId)"
        >
          <svg class="app__icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" />
          </svg>
        </button>
      </header>
      <div class="app__dialog-body">
        <div class="app__service-config-fields">
          <label class="app__field">
            <span>Service name</span>
            <input
              v-model="draft.name"
              class="app__control"
              placeholder="e.g. Checkout API"
              required
            />
          </label>
          <div class="app__field-row">
            <div class="app__field">
              <span>Framework</span>
              <div class="app__framework-select">
                <button
                  type="button"
                  class="app__control app__control--framework-select"
                  role="combobox"
                  aria-haspopup="listbox"
                  :aria-expanded="frameworkMenuOpen"
                  :aria-label="`Framework: ${draft.framework || 'Select framework'}`"
                  @click.stop="frameworkMenuOpen = !frameworkMenuOpen"
                >
                  <img
                    v-if="draft.framework"
                    :src="
                      draft.framework.toLowerCase().includes('spring')
                        ? '/icons/spring-boot.svg'
                        : '/icons/dotnet.svg'
                    "
                    alt=""
                    aria-hidden="true"
                  />
                  <span>{{ draft.framework || "Select framework" }}</span>
                  <svg
                    class="app__icon app__framework-chevron"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                <div v-if="frameworkMenuOpen" class="app__framework-options" role="listbox">
                  <button
                    type="button"
                    role="option"
                    :aria-selected="draft.framework === 'Spring Boot'"
                    @click.stop="
                      draft.framework = 'Spring Boot';
                      frameworkMenuOpen = false;
                    "
                  >
                    <img :src="'/icons/spring-boot.svg'" alt="" aria-hidden="true" />Spring Boot
                  </button>
                  <button
                    type="button"
                    role="option"
                    :aria-selected="draft.framework === '.NET'"
                    @click.stop="
                      draft.framework = '.NET';
                      frameworkMenuOpen = false;
                    "
                  >
                    <img :src="'/icons/dotnet.svg'" alt="" aria-hidden="true" />.NET
                  </button>
                </div>
              </div>
            </div>
            <label class="app__field">
              <span>Base URL</span>
              <input
                v-model="draft.baseUrl"
                class="app__control"
                placeholder="http://localhost:4000"
              />
            </label>
          </div>
        </div>
        <div class="app__section-title">
          <strong>Available endpoints</strong>
          <button
            class="app__button app__button--secondary app__button--small"
            @click="emit('addEndpoint')"
          >
            + New endpoint
          </button>
        </div>
        <details
          v-for="(endpoint, index) in draft.endpoints"
          :id="endpoint.id ? `service-endpoint-${endpoint.id}` : undefined"
          :key="endpoint.id || index"
          class="app__endpoint-form-card"
        >
          <summary class="app__endpoint-form-head app__endpoint-form-summary">
            <div class="app__endpoint-summary-title">
              <button
                type="button"
                class="app__endpoint-delete-button"
                :aria-label="`Remove ${endpoint.name || `Endpoint ${index + 1}`}`"
                :title="`Remove ${endpoint.name || `Endpoint ${index + 1}`}`"
                @click.stop.prevent="emit('removeEndpoint', index)"
              >
                <svg class="app__icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" />
                </svg>
              </button>
              <div class="app__endpoint-summary-copy">
                <strong>{{ endpoint.name || `Endpoint ${index + 1}` }}</strong>
                <span>{{ endpoint.method }} {{ endpoint.url }}</span>
              </div>
            </div>
          </summary>
          <label class="app__field">
            <span>Name</span>
            <input v-model="endpoint.name" class="app__control" placeholder="e.g. Get order" />
          </label>
          <div class="app__field-row">
            <label class="app__field">
              <span>API type</span>
              <select v-model="endpoint.apiType" class="app__control">
                <option>REST</option>
              </select>
            </label>
            <label class="app__field">
              <span>Method</span>
              <select v-model="endpoint.method" class="app__control">
                <option>GET</option>
                <option>POST</option>
                <option>PUT</option>
                <option>PATCH</option>
                <option>DELETE</option>
              </select>
            </label>
          </div>
          <label class="app__field">
            <span>URL</span>
            <input v-model="endpoint.url" class="app__control" placeholder="/orders" />
          </label>
        </details>
      </div>
      <footer class="app__dialog-footer">
        <button class="app__button app__button--secondary" @click="emit('discard')">Discard</button>
        <button class="app__button app__button--primary" @click="emit('save')">Save</button>
      </footer>
    </section>
  </div>
</template>
