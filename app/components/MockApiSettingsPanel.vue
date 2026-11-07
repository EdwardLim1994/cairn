<script setup lang="ts">
import { nextTick, ref, watch, watchEffect } from "vue";
import SettingsAccordionCard from "./SettingsAccordionCard.vue";
import HeaderRowsEditor from "./HeaderRowsEditor.vue";
import RequestJsonEditor from "./RequestJsonEditor.vue";
import type {
  AuthorizationTemplateDraft,
  EnvironmentVariable,
  HeaderTemplateDraft,
  MockApiDraft,
} from "../models/mock-api";
import { evaluateMockApiReadiness } from "#shared/utils/mock-api-readiness";

const mockDraft = defineModel<MockApiDraft[]>("mockDraft", { required: true });
const environmentVariables = defineModel<EnvironmentVariable[]>("environmentVariables", {
  required: true,
});
const headerTemplates = defineModel<HeaderTemplateDraft[]>("headerTemplates", { required: true });
const authorizationTemplates = defineModel<AuthorizationTemplateDraft[]>("authorizationTemplates", {
  default: () => [],
});
const variablesOpen = defineModel<boolean>("variablesOpen", { required: true });
const apisOpen = defineModel<boolean>("apisOpen", { required: true });
const variableDraft = defineModel<{ name: string; value: string }>("variableDraft", {
  required: true,
});
const props = defineProps<{
  environmentVariablesLoading: boolean;
  editingEnvironmentVariableId: string | null;
  expandedEnvironmentVariableId: string | null;
  focusMockApiId?: string | null;
  focusMockApiRequest?: number;
  servicesForSelect: { id: string; label: string; apiType?: "HTTP" | "GRPC" | "WEBSOCKET" }[];
  endpointPathParameterNames: (entry: MockApiDraft) => string[];
  endpointDetails: {
    id: string;
    url: string | null;
    apiType?: "REST" | "GRPC" | "WEBSOCKET";
  }[];
}>();
const emit = defineEmits<{
  discard: [];
  save: [];
  addVariable: [];
  openVariable: [variable: EnvironmentVariable];
  closeVariable: [variable: EnvironmentVariable];
  updateVariable: [];
  deleteVariable: [variable: EnvironmentVariable];
  importCollection: [event: Event];
  importEnvironment: [event: Event];
  addHeaderTemplate: [];
  deleteHeaderTemplate: [template: HeaderTemplateDraft];
  addAuthorizationTemplate: [];
  deleteAuthorizationTemplate: [template: AuthorizationTemplateDraft];
  addMockApi: [apiType: "HTTP" | "GRPC" | "WEBSOCKET"];
  removeMockApi: [index: number];
  setMockEndpoint: [entry: MockApiDraft];
  formatRequest: [entry: MockApiDraft];
}>();
const fileInput = ref<HTMLInputElement | null>(null);
const environmentFileInput = ref<HTMLInputElement | null>(null);
const variableSectionItems = [{ value: "variables", label: "Shared environment variables" }];
const mockApiSectionItems = [{ value: "apis", label: "Registered mock APIs" }];
const expandedCardId = ref<string | null>(null);
const visibleSecrets = ref(new Set<string>());
const authorizationTypeOptions = [
  { label: "Bearer token", value: "bearer" },
  { label: "Basic Auth", value: "basic" },
  { label: "API key", value: "api-key" },
  { label: "OAuth 2.0 Client Credentials", value: "oauth-client-credentials" },
];

function expandCard(id: string) {
  const expandedVariableId = props.expandedEnvironmentVariableId;
  if (expandedVariableId && id !== `variable:${expandedVariableId}`) {
    const variable = environmentVariables.value.find(({ id }) => id === expandedVariableId);
    if (variable) emit("closeVariable", variable);
  }
  expandedCardId.value = id;
}

function collapseCard(id: string) {
  if (expandedCardId.value === id) expandedCardId.value = null;
}

function expandVariableCard(variable: EnvironmentVariable) {
  expandCard(`variable:${variable.id}`);
  emit("openVariable", variable);
}

function collapseVariableCard(variable: EnvironmentVariable) {
  collapseCard(`variable:${variable.id}`);
  emit("closeVariable", variable);
}

function mockApiKey(entry: MockApiDraft, index: number) {
  return entry.id || `mock-api-${index}`;
}

function mockApiTypeLabel(entry: MockApiDraft) {
  if (entry.apiType === "WEBSOCKET") return "WebSocket";
  return entry.apiType === "GRPC" ? "gRPC" : "HTTP";
}

function supportsHandshakeSettings(entry: MockApiDraft) {
  const apiType = entry.apiType ?? "HTTP";
  return apiType === "HTTP" || apiType === "WEBSOCKET";
}

watch(
  () => props.expandedEnvironmentVariableId,
  (id) => {
    if (id) expandedCardId.value = `variable:${id}`;
    else if (expandedCardId.value?.startsWith("variable:")) expandedCardId.value = null;
  },
  { immediate: true },
);

watch(
  () => [props.focusMockApiId, props.focusMockApiRequest] as const,
  async ([id]) => {
    if (!id) return;
    const index = mockDraft.value.findIndex((entry) => entry.id === id);
    if (index < 0) return;
    expandedCardId.value = `mock:${mockApiKey(mockDraft.value[index]!, index)}`;
    await nextTick();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const panel = document.querySelector<HTMLElement>(".mock-api-settings-panel__body");
    const card = document.getElementById(`mock-api-${id}`);
    if (!panel || !card) return;
    panel.scrollTo({
      top: panel.scrollTop + card.getBoundingClientRect().top - panel.getBoundingClientRect().top,
      behavior: "smooth",
    });
  },
  { immediate: true },
);

watch(
  () => authorizationTemplates.value.find(({ pendingCreate }) => pendingCreate)?.id,
  (id) => {
    if (id) expandedCardId.value = `authorization:${id}`;
  },
);

function setAuthorizationType(template: AuthorizationTemplateDraft, value: unknown) {
  const id = template.id;
  const name = template.name;
  const pendingCreate = template.pendingCreate;
  const type = value as AuthorizationTemplateDraft["type"];
  let next: AuthorizationTemplateDraft;
  switch (type) {
    case "basic":
      next = { id, name, type, username: "", password: "", pendingCreate };
      break;
    case "api-key":
      next = { id, name, type, headerName: "", value: "", pendingCreate };
      break;
    case "oauth-client-credentials":
      next = {
        id,
        name,
        type,
        tokenUrl: "",
        clientId: "",
        clientSecret: "",
        scope: "",
        pendingCreate,
      };
      break;
    default:
      next = { id, name, type: "bearer", token: "", pendingCreate };
  }
  const index = authorizationTemplates.value.findIndex((item) => item.id === id);
  if (index >= 0) authorizationTemplates.value[index] = next;
}

function secretVisible(template: AuthorizationTemplateDraft, field: string) {
  return visibleSecrets.value.has(`${template.id}:${field}`);
}

function toggleSecret(template: AuthorizationTemplateDraft, field: string) {
  const key = `${template.id}:${field}`;
  const next = new Set(visibleSecrets.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  visibleSecrets.value = next;
}

function endpointOptions(entry: MockApiDraft) {
  return [
    { label: "Select endpoint", value: "" },
    ...props.servicesForSelect
      .filter(({ apiType }) => (apiType ?? "HTTP") === (entry.apiType ?? "HTTP"))
      .map(({ id, label }) => ({ label, value: id })),
  ];
}

function templateOptions() {
  return [
    { label: "No template", value: "" },
    ...headerTemplates.value.map(({ id, name }) => ({
      label: name || "Untitled template",
      value: id,
    })),
  ];
}

function authorizationOptions() {
  return [
    { label: "No Auth", value: "" },
    ...authorizationTemplates.value.map(({ id, name, type }) => ({
      label: `${name || "Untitled template"} (${authorizationTypeLabel(type)})`,
      value: id,
    })),
  ];
}

function authorizationTypeLabel(type: AuthorizationTemplateDraft["type"]) {
  return authorizationTypeOptions.find((option) => option.value === type)?.label ?? type;
}

function authorizationSummary(entry: MockApiDraft) {
  const template = authorizationTemplates.value.find(
    ({ id }) => id === entry.authorizationTemplateId,
  );
  return template
    ? `${template.name || "Untitled template"} (${authorizationTypeLabel(template.type)})`
    : "No Auth";
}

function readinessAuthorizationTemplate(template: AuthorizationTemplateDraft | undefined) {
  if (!template) return null;
  switch (template.type) {
    case "bearer":
      return { type: template.type, config: { token: template.token } };
    case "basic":
      return {
        type: template.type,
        config: { username: template.username, password: template.password },
      };
    case "api-key":
      return {
        type: template.type,
        config: { headerName: template.headerName, value: template.value },
      };
    case "oauth-client-credentials":
      return {
        type: template.type,
        config: {
          tokenUrl: template.tokenUrl,
          clientId: template.clientId,
          clientSecret: template.clientSecret,
          scope: template.scope ?? "",
        },
      };
  }
}

function addHeaderRow(rows: { name: string; value: string }[]) {
  rows.push({ name: "", value: "" });
}

function removeHeaderRow(rows: { name: string; value: string }[], index: number) {
  rows.splice(index, 1);
}

function preventOutsideDismiss(event: Event) {
  event.preventDefault();
}

function handleOpenChange(open: boolean) {
  if (!open) emit("discard");
}

watchEffect(() => {
  const variables = new Map(environmentVariables.value.map(({ name, value }) => [name, value]));
  for (const entry of mockDraft.value) {
    const template = headerTemplates.value.find(({ id }) => id === entry.headerTemplateId);
    const authTemplate = authorizationTemplates.value.find(
      ({ id }) => id === entry.authorizationTemplateId,
    );
    const endpoint = props.endpointDetails.find(({ id }) => id === entry.targetEndpointId);
    const endpointUrl = endpoint?.url ?? null;
    const readiness = evaluateMockApiReadiness(
      {
        ...entry,
        endpointApiType: endpoint?.apiType ?? null,
        headerTemplateExists: !entry.headerTemplateId || Boolean(template),
        authorizationTemplateId: entry.authorizationTemplateId,
        authorizationTemplateExists: !entry.authorizationTemplateId || Boolean(authTemplate),
        authorizationTemplate: readinessAuthorizationTemplate(authTemplate),
        customHeaders: entry.customHeaders ?? [],
        active: entry.active ?? false,
      },
      endpointUrl,
      template?.headers ?? [],
      variables,
    );
    if (readiness.status === "draft") entry.active = false;
    entry.status = readiness.status;
    entry.readinessReasons = readiness.reasons;
  }
});
</script>

<template>
  <USlideover
    :open="true"
    side="right"
    :portal="false"
    :close="false"
    :content="{
      'aria-label': 'Mock API settings',
      onInteractOutside: preventOutsideDismiss,
    }"
    :ui="{
      overlay:
        'fixed inset-0 z-[70] flex h-full w-full max-h-none max-w-none justify-end m-0 border-0 bg-[rgba(20,24,28,0.4)] p-0 text-inherit',
      content:
        'z-[71] flex h-full w-[min(520px,100vw)] flex-col overflow-hidden rounded-l-[18px] bg-[var(--panel)] text-inherit max-[720px]:w-full max-[720px]:rounded-none',
      header: 'flex items-center justify-between border-b border-[var(--border)] px-5 py-4',
      body: 'mock-api-settings-panel__body flex flex-1 flex-col gap-3 overflow-auto px-5 py-4',
      footer: 'flex justify-end gap-2 border-t border-[var(--border)] px-5 py-3',
    }"
    @update:open="handleOpenChange"
  >
    <template #title>Mock APIs</template>
    <template #description>Calls linked to registered service endpoints</template>
    <template #body>
      <section class="mt-5">
        <div class="mt-1 flex items-center justify-between gap-2">
          <strong>Shareable header templates</strong>
          <UButton
            type="button"
            class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[11px] font-medium hover:bg-[var(--panel2)]"
            @click="emit('addHeaderTemplate')"
            >New template</UButton
          >
        </div>
        <SettingsAccordionCard
          v-for="template in headerTemplates"
          :key="template.id"
          :title="template.name || 'New header template'"
          :delete-label="`Delete ${template.name || 'header template'}`"
          :open="expandedCardId === `template:${template.id}`"
          @expand="expandCard(`template:${template.id}`)"
          @collapse="collapseCard(`template:${template.id}`)"
          @delete="emit('deleteHeaderTemplate', template)"
        >
          <label
            :for="`header-template-name-${template.id}`"
            class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[10px] [&>span]:font-medium [&>span]:text-[var(--muted)] [&>legend]:text-[10px] [&>legend]:font-medium [&>legend]:text-[var(--muted)]"
          >
            <span>Name</span>
            <UInput
              :id="`header-template-name-${template.id}`"
              v-model="template.name"
              :ui="{
                base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
              }"
            />
          </label>
          <div
            v-for="(header, row) in template.headers"
            :key="row"
            class="grid grid-cols-[1fr_1fr_auto] items-center gap-2"
          >
            <UInput
              v-model="header.name"
              aria-label="Header name"
              placeholder="Header"
              :ui="{
                base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
              }"
            />
            <UInput
              v-model="header.value"
              aria-label="Header value"
              placeholder="Value or {{variable}}"
              :ui="{
                base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
              }"
            />
            <UButton
              type="button"
              aria-label="Remove header row"
              class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[11px] font-medium hover:bg-[var(--panel2)]"
              @click="removeHeaderRow(template.headers, row)"
              >Remove</UButton
            >
          </div>
          <UButton
            type="button"
            class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[11px] font-medium hover:bg-[var(--panel2)]"
            @click="addHeaderRow(template.headers)"
            >Add header</UButton
          >
        </SettingsAccordionCard>
      </section>
      <section id="authorization-templates" class="mt-5">
        <div class="mt-1 flex items-center justify-between gap-2">
          <strong>Shareable authorization templates</strong>
          <UButton
            type="button"
            class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[11px] font-medium hover:bg-[var(--panel2)]"
            @click="emit('addAuthorizationTemplate')"
            >New template</UButton
          >
        </div>
        <SettingsAccordionCard
          v-for="template in authorizationTemplates"
          :key="template.id"
          :id="`authorization-template-${template.id}`"
          :title="template.name || 'New authorization template'"
          :delete-label="`Delete ${template.name || 'authorization template'}`"
          :open="expandedCardId === `authorization:${template.id}`"
          @expand="expandCard(`authorization:${template.id}`)"
          @collapse="collapseCard(`authorization:${template.id}`)"
          @delete="emit('deleteAuthorizationTemplate', template)"
        >
          <label
            :for="`authorization-template-name-${template.id}`"
            class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[10px] [&>span]:font-medium [&>span]:text-[var(--muted)]"
          >
            <span>Name</span>
            <UInput
              :id="`authorization-template-name-${template.id}`"
              v-model="template.name"
              aria-label="Authorization template name"
              :ui="{
                base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
              }"
            />
          </label>
          <label
            :for="`authorization-template-type-${template.id}`"
            class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[10px] [&>span]:font-medium [&>span]:text-[var(--muted)]"
          >
            <span>Authorization type</span>
            <USelect
              :id="`authorization-template-type-${template.id}`"
              :model-value="template.type"
              :items="authorizationTypeOptions"
              aria-label="Authorization type"
              :ui="{
                base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
              }"
              @update:model-value="setAuthorizationType(template, $event)"
            />
          </label>
          <template v-if="template.type === 'bearer'">
            <label
              :for="`authorization-token-${template.id}`"
              class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[10px] [&>span]:font-medium [&>span]:text-[var(--muted)]"
            >
              <span>Token</span>
              <div class="flex gap-2">
                <UInput
                  :id="`authorization-token-${template.id}`"
                  v-model="template.token"
                  :type="secretVisible(template, 'token') ? 'text' : 'password'"
                  aria-label="Bearer token"
                  placeholder="Token or {{variable}}"
                  :ui="{
                    base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px]',
                  }"
                />
                <UButton
                  type="button"
                  :aria-label="`${secretVisible(template, 'token') ? 'Hide' : 'Show'} Bearer token`"
                  @click="toggleSecret(template, 'token')"
                  >{{ secretVisible(template, "token") ? "Hide" : "Show" }}</UButton
                >
              </div>
            </label>
          </template>
          <template v-else-if="template.type === 'basic'">
            <div class="min-w-0 flex flex-1 flex-col gap-1">
              <label
                :for="`authorization-username-${template.id}`"
                class="text-[10px] font-medium text-[var(--muted)]"
              >
                Username
              </label>
              <UInput
                :id="`authorization-username-${template.id}`"
                v-model="template.username"
                aria-label="Basic username"
                placeholder="Username or {{variable}}"
              />
            </div>
            <div class="min-w-0 flex flex-1 flex-col gap-1">
              <label
                :for="`authorization-password-${template.id}`"
                class="text-[10px] font-medium text-[var(--muted)]"
              >
                Password
              </label>
              <div class="flex gap-2">
                <UInput
                  :id="`authorization-password-${template.id}`"
                  v-model="template.password"
                  :type="secretVisible(template, 'password') ? 'text' : 'password'"
                  aria-label="Basic password"
                />
                <UButton
                  type="button"
                  :aria-label="`${secretVisible(template, 'password') ? 'Hide' : 'Show'} Basic password`"
                  @click="toggleSecret(template, 'password')"
                  >{{ secretVisible(template, "password") ? "Hide" : "Show" }}</UButton
                >
              </div>
            </div>
          </template>
          <template v-else-if="template.type === 'api-key'">
            <div class="min-w-0 flex flex-1 flex-col gap-1">
              <label
                :for="`authorization-header-name-${template.id}`"
                class="text-[10px] font-medium text-[var(--muted)]"
              >
                Header name
              </label>
              <UInput
                :id="`authorization-header-name-${template.id}`"
                v-model="template.headerName"
                aria-label="API key header name"
                placeholder="X-API-Key"
              />
            </div>
            <div class="min-w-0 flex flex-1 flex-col gap-1">
              <label
                :for="`authorization-value-${template.id}`"
                class="text-[10px] font-medium text-[var(--muted)]"
              >
                Value
              </label>
              <div class="flex gap-2">
                <UInput
                  :id="`authorization-value-${template.id}`"
                  v-model="template.value"
                  :type="secretVisible(template, 'value') ? 'text' : 'password'"
                  aria-label="API key value"
                />
                <UButton
                  type="button"
                  :aria-label="`${secretVisible(template, 'value') ? 'Hide' : 'Show'} API key value`"
                  @click="toggleSecret(template, 'value')"
                  >{{ secretVisible(template, "value") ? "Hide" : "Show" }}</UButton
                >
              </div>
            </div>
          </template>
          <template v-else>
            <div class="min-w-0 flex flex-1 flex-col gap-1">
              <label
                :for="`authorization-token-url-${template.id}`"
                class="text-[10px] font-medium text-[var(--muted)]"
              >
                Token URL
              </label>
              <UInput
                :id="`authorization-token-url-${template.id}`"
                v-model="template.tokenUrl"
                aria-label="OAuth token URL"
                placeholder="https://auth.example.com/token"
              />
            </div>
            <div class="min-w-0 flex flex-1 flex-col gap-1">
              <label
                :for="`authorization-client-id-${template.id}`"
                class="text-[10px] font-medium text-[var(--muted)]"
              >
                Client ID
              </label>
              <UInput
                :id="`authorization-client-id-${template.id}`"
                v-model="template.clientId"
                aria-label="OAuth client ID"
              />
            </div>
            <div class="min-w-0 flex flex-1 flex-col gap-1">
              <label
                :for="`authorization-client-secret-${template.id}`"
                class="text-[10px] font-medium text-[var(--muted)]"
              >
                Client secret
              </label>
              <div class="flex gap-2">
                <UInput
                  :id="`authorization-client-secret-${template.id}`"
                  v-model="template.clientSecret"
                  :type="secretVisible(template, 'clientSecret') ? 'text' : 'password'"
                  aria-label="OAuth client secret"
                />
                <UButton
                  type="button"
                  :aria-label="`${secretVisible(template, 'clientSecret') ? 'Hide' : 'Show'} OAuth client secret`"
                  @click="toggleSecret(template, 'clientSecret')"
                  >{{ secretVisible(template, "clientSecret") ? "Hide" : "Show" }}</UButton
                >
              </div>
            </div>
            <div class="min-w-0 flex flex-1 flex-col gap-1">
              <label
                :for="`authorization-scope-${template.id}`"
                class="text-[10px] font-medium text-[var(--muted)]"
              >
                Scope (optional)
              </label>
              <UInput
                :id="`authorization-scope-${template.id}`"
                v-model="template.scope"
                aria-label="OAuth scope"
              />
            </div>
          </template>
        </SettingsAccordionCard>
      </section>
      <section class="mt-5">
        <div class="text-xs">
          <UAccordion
            id="shared-environment-variables-toggle"
            class="w-full min-w-0"
            :items="variableSectionItems"
            type="single"
            collapsible
            :unmount-on-hide="false"
            :model-value="variablesOpen ? 'variables' : undefined"
            :ui="{
              root: 'w-full min-w-0',
              item: 'border-0',
              trigger:
                'flex w-full items-center justify-between gap-2 !border-0 !bg-transparent !p-0 text-left text-inherit',
              trailingIcon: 'text-[var(--muted)] transition-transform duration-150',
              content: 'pt-3',
              body: 'w-full',
            }"
            @update:model-value="variablesOpen = $event === 'variables'"
          >
            <template #default><strong>Shared environment variables</strong></template>
            <template #body>
              <div class="mb-3 flex justify-end gap-2">
                <input
                  ref="environmentFileInput"
                  id="postman-environment-file"
                  class="hidden"
                  type="file"
                  accept="application/json,.json"
                  aria-label="Postman environment JSON"
                  @change="emit('importEnvironment', $event)"
                />
                <UButton
                  type="button"
                  color="neutral"
                  variant="outline"
                  class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[11px] font-medium hover:bg-[var(--panel2)]"
                  @click="environmentFileInput?.click()"
                  >Import environment</UButton
                >
                <UButton
                  type="button"
                  color="neutral"
                  variant="outline"
                  class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[11px] font-medium hover:bg-[var(--panel2)]"
                  :disabled="props.environmentVariablesLoading"
                  @click="emit('addVariable')"
                  >New variable</UButton
                >
              </div>
              <div id="shared-environment-variables-content">
                <div v-if="environmentVariables.length" class="grid gap-2">
                  <SettingsAccordionCard
                    v-for="variable in environmentVariables"
                    :key="variable.id"
                    :id="`environment-variable-${variable.id}`"
                    :title="variable.name || 'New variable'"
                    :delete-label="`Delete ${variable.name || 'variable'}`"
                    :open="expandedCardId === `variable:${variable.id}`"
                    @expand="expandVariableCard(variable)"
                    @collapse="collapseVariableCard(variable)"
                    @delete="emit('deleteVariable', variable)"
                  >
                    <template v-if="props.editingEnvironmentVariableId === variable.id">
                      <label
                        :for="`environment-variable-name-${variable.id}`"
                        class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[10px] [&>span]:font-medium [&>span]:text-[var(--muted)] [&>legend]:text-[10px] [&>legend]:font-medium [&>legend]:text-[var(--muted)]"
                      >
                        <span>Name</span>
                        <UInput
                          :id="`environment-variable-name-${variable.id}`"
                          v-model="variableDraft.name"
                          :ui="{
                            base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
                          }"
                        />
                      </label>
                      <label
                        :for="`environment-variable-value-${variable.id}`"
                        class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[10px] [&>span]:font-medium [&>span]:text-[var(--muted)] [&>legend]:text-[10px] [&>legend]:font-medium [&>legend]:text-[var(--muted)]"
                      >
                        <span>Value</span>
                        <UTextarea
                          :id="`environment-variable-value-${variable.id}`"
                          v-model="variableDraft.value"
                          :ui="{
                            base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
                          }"
                          :rows="2"
                        />
                      </label>
                      <footer
                        class="flex items-center justify-end gap-2 border-t border-[var(--border)] pt-3"
                      >
                        <UButton
                          type="button"
                          color="primary"
                          class="rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-2 py-1.5 text-[11px] font-medium text-[var(--accent-ink)] disabled:opacity-60"
                          v-if="!variable.pendingCreate"
                          @click="emit('updateVariable')"
                        >
                          Update
                        </UButton>
                      </footer>
                    </template>
                  </SettingsAccordionCard>
                </div>
              </div>
            </template>
          </UAccordion>
        </div>
      </section>
      <section class="mt-5">
        <div class="text-xs">
          <UAccordion
            id="registered-mock-apis-toggle"
            class="w-full min-w-0"
            :items="mockApiSectionItems"
            type="single"
            collapsible
            :unmount-on-hide="false"
            :model-value="apisOpen ? 'apis' : undefined"
            :ui="{
              root: 'w-full min-w-0',
              item: 'border-0',
              trigger:
                'flex w-full items-center justify-between gap-2 !border-0 !bg-transparent !p-0 text-left text-inherit',
              trailingIcon: 'text-[var(--muted)] transition-transform duration-150',
              content: 'pt-3',
              body: 'w-full',
            }"
            @update:model-value="apisOpen = $event === 'apis'"
          >
            <template #default><strong>Registered mock APIs</strong></template>
            <template #body>
              <div class="mb-3 flex justify-end gap-2">
                <input
                  ref="fileInput"
                  id="postman-collection-file"
                  class="hidden"
                  type="file"
                  accept="application/json,.json"
                  aria-label="Postman collection JSON"
                  @change="emit('importCollection', $event)"
                />
                <UButton
                  type="button"
                  color="neutral"
                  variant="outline"
                  class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[11px] font-medium hover:bg-[var(--panel2)]"
                  @click="fileInput?.click()"
                >
                  Import APIs
                </UButton>
                <UButton
                  type="button"
                  color="neutral"
                  variant="outline"
                  class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[11px] font-medium hover:bg-[var(--panel2)]"
                  @click="emit('addMockApi', 'HTTP')"
                >
                  + New HTTP API
                </UButton>
                <UButton
                  type="button"
                  color="neutral"
                  variant="outline"
                  class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[11px] font-medium hover:bg-[var(--panel2)]"
                  @click="emit('addMockApi', 'GRPC')"
                >
                  + New gRPC API
                </UButton>
                <UButton
                  type="button"
                  color="neutral"
                  variant="outline"
                  class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[11px] font-medium hover:bg-[var(--panel2)]"
                  @click="emit('addMockApi', 'WEBSOCKET')"
                >
                  + New WebSocket API
                </UButton>
              </div>
              <div id="registered-mock-apis-content" class="flex flex-col gap-y-3">
                <SettingsAccordionCard
                  v-for="(entry, index) in mockDraft"
                  :key="entry.id || `new-${index}`"
                  :id="entry.id ? `mock-api-${entry.id}` : undefined"
                  :title="entry.name || `Mock API ${index + 1}`"
                  :subtitle="`${mockApiTypeLabel(entry)} · ${servicesForSelect.find((option) => option.id === entry.targetEndpointId)?.label ?? 'Select service endpoint'}`"
                  :delete-label="`Remove ${entry.name || `Mock API ${index + 1}`}`"
                  :open="expandedCardId === `mock:${mockApiKey(entry, index)}`"
                  compact
                  @expand="expandCard(`mock:${mockApiKey(entry, index)}`)"
                  @collapse="collapseCard(`mock:${mockApiKey(entry, index)}`)"
                  @delete="emit('removeMockApi', index)"
                >
                  <template #actions>
                    <div class="flex items-center" @click.stop @keydown.stop>
                      <USwitch
                        v-model="entry.active"
                        :aria-label="`${entry.active ? 'Deactivate' : 'Activate'} ${entry.name || `Mock API ${index + 1}`}`"
                        :disabled="entry.status === 'draft'"
                        size="sm"
                      />
                    </div>
                  </template>
                  <label
                    :for="`mock-api-name-${entry.id || index}`"
                    class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[10px] [&>span]:font-medium [&>span]:text-[var(--muted)] [&>legend]:text-[10px] [&>legend]:font-medium [&>legend]:text-[var(--muted)]"
                  >
                    <span>Name</span>
                    <UInput
                      :id="`mock-api-name-${entry.id || index}`"
                      v-model="entry.name"
                      :ui="{
                        base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
                      }"
                      placeholder="e.g. Create order"
                    />
                  </label>
                  <label
                    :for="`mock-api-endpoint-${entry.id || index}`"
                    class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[10px] [&>span]:font-medium [&>span]:text-[var(--muted)] [&>legend]:text-[10px] [&>legend]:font-medium [&>legend]:text-[var(--muted)]"
                  >
                    <span>Service endpoint</span>
                    <USelect
                      :id="`mock-api-endpoint-${entry.id || index}`"
                      v-model="entry.targetEndpointId"
                      :items="endpointOptions(entry)"
                      :ui="{
                        base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
                      }"
                      @update:model-value="emit('setMockEndpoint', entry)"
                    />
                  </label>
                  <template v-if="(entry.apiType ?? 'HTTP') === 'HTTP'">
                    <label
                      v-for="name in props.endpointPathParameterNames(entry)"
                      :key="name"
                      :for="`mock-api-path-${entry.id || index}-${name}`"
                      class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[10px] [&>span]:font-medium [&>span]:text-[var(--muted)] [&>legend]:text-[10px] [&>legend]:font-medium [&>legend]:text-[var(--muted)]"
                    >
                      <span>Path parameter: {{ name }}</span>
                      <UInput
                        :id="`mock-api-path-${entry.id || index}-${name}`"
                        v-model="entry.pathParameters[name]"
                        :ui="{
                          base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
                        }"
                        :placeholder="`Value or {{${name}}}`"
                      />
                    </label>
                  </template>
                  <label
                    v-if="supportsHandshakeSettings(entry)"
                    :for="`mock-api-template-${entry.id || index}`"
                    class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[10px] [&>span]:font-medium [&>span]:text-[var(--muted)] [&>legend]:text-[10px] [&>legend]:font-medium [&>legend]:text-[var(--muted)]"
                  >
                    <span>Header template</span>
                    <USelect
                      :id="`mock-api-template-${entry.id || index}`"
                      v-model="entry.headerTemplateId"
                      :items="templateOptions()"
                      :ui="{
                        base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
                      }"
                    />
                  </label>
                  <UAccordion
                    v-if="supportsHandshakeSettings(entry)"
                    :id="`mock-api-authorization-${entry.id || index}`"
                    class="w-full min-w-0"
                    :items="[{ value: 'authorization', label: 'Authorization' }]"
                    type="single"
                    collapsible
                    :unmount-on-hide="false"
                    :ui="{
                      root: 'w-full min-w-0',
                      item: 'border-0',
                      trigger:
                        'flex w-full items-center justify-between gap-2 border-0 bg-transparent p-0 text-left text-inherit',
                      trailingIcon: 'text-[var(--muted)] transition-transform duration-150',
                      content: 'pt-2',
                      body: 'flex flex-col gap-2',
                    }"
                  >
                    <template #default><strong>Authorization</strong></template>
                    <template #body>
                      <label
                        :for="`mock-api-authorization-select-${entry.id || index}`"
                        class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[10px] [&>span]:font-medium [&>span]:text-[var(--muted)]"
                      >
                        <span>Authorization</span>
                        <USelect
                          :id="`mock-api-authorization-select-${entry.id || index}`"
                          :model-value="entry.authorizationTemplateId ?? ''"
                          :items="authorizationOptions()"
                          :aria-label="`Authorization for ${entry.name || `Mock API ${index + 1}`}`"
                          :ui="{
                            base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
                          }"
                          @update:model-value="entry.authorizationTemplateId = $event || null"
                        />
                      </label>
                      <p class="text-[10px] text-[var(--muted)]">
                        Selected method: {{ authorizationSummary(entry) }}
                      </p>
                    </template>
                  </UAccordion>
                  <HeaderRowsEditor
                    v-if="supportsHandshakeSettings(entry)"
                    v-model="entry.customHeaders"
                  />
                  <div
                    class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[10px] [&>span]:font-medium [&>span]:text-[var(--muted)] [&>legend]:text-[10px] [&>legend]:font-medium [&>legend]:text-[var(--muted)]"
                  >
                    <span v-if="entry.status">Status: {{ entry.status }}</span>
                    <ul
                      v-if="entry.readinessReasons?.length"
                      class="list-disc pl-4 text-[10px] text-[var(--muted)]"
                    >
                      <li
                        v-for="reason in entry.readinessReasons"
                        :key="reason.code + reason.message"
                      >
                        {{ reason.message }}
                      </li>
                    </ul>
                  </div>
                  <fieldset
                    class="min-w-0 flex flex-1 flex-col gap-1 m-0 border-0 p-0 [&>legend]:text-[10px] [&>legend]:font-medium [&>legend]:text-[var(--muted)]"
                  >
                    <legend>
                      {{ entry.apiType === "WEBSOCKET" ? "Message" : "Request (JSON)" }}
                    </legend>
                    <template v-if="entry.apiType === 'WEBSOCKET'">
                      <UTextarea
                        v-model="entry.requestJson"
                        aria-label="WebSocket message"
                        :rows="6"
                        placeholder="Text message to send"
                        :ui="{
                          base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 font-mono text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
                        }"
                      />
                    </template>
                    <template v-else>
                      <div class="flex justify-end">
                        <UButton
                          type="button"
                          color="neutral"
                          variant="outline"
                          class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[11px] font-medium hover:bg-[var(--panel2)]"
                          @click="emit('formatRequest', entry)"
                        >
                          Format JSON
                        </UButton>
                      </div>
                      <RequestJsonEditor
                        :model-value="String(entry.requestJson ?? '')"
                        :variables="environmentVariables"
                        @update:model-value="entry.requestJson = $event"
                      />
                    </template>
                  </fieldset>
                  <label
                    :for="`mock-api-description-${entry.id || index}`"
                    class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[10px] [&>span]:font-medium [&>span]:text-[var(--muted)] [&>legend]:text-[10px] [&>legend]:font-medium [&>legend]:text-[var(--muted)]"
                  >
                    <span>Description</span>
                    <UInput
                      :id="`mock-api-description-${entry.id || index}`"
                      v-model="entry.description"
                      :ui="{
                        base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[11px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
                      }"
                      placeholder="Optional note"
                    />
                  </label>
                </SettingsAccordionCard>
                <div
                  v-if="!mockDraft.length"
                  class="rounded-lg border border-dashed border-[var(--border)] p-3 text-[11px] text-[var(--muted)]"
                >
                  No mock API rows yet. Add one to get started.
                </div>
              </div>
            </template>
          </UAccordion>
        </div>
      </section>
    </template>
    <template #footer>
      <UButton
        type="button"
        color="neutral"
        variant="outline"
        class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-xs font-medium hover:bg-[var(--panel2)]"
        @click="emit('discard')"
        >Discard</UButton
      >
      <UButton
        type="button"
        class="rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-3 py-2 text-xs font-medium text-[var(--accent-ink)] disabled:opacity-60"
        :disabled="props.environmentVariablesLoading"
        @click="emit('save')"
      >
        Save
      </UButton>
    </template>
  </USlideover>
</template>
