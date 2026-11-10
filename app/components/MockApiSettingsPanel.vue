<script setup lang="ts">
import { computed, ref, toRaw, watch, watchEffect } from "vue";
import SettingsAccordionCard from "./SettingsAccordionCard.vue";
import HeaderRowsEditor from "./HeaderRowsEditor.vue";
import WorkspaceDrawer from "./WorkspaceDrawer.vue";
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
const props = defineProps<{
  environmentVariablesLoading: boolean;
  focusMockApiId?: string | null;
  focusMockApiRequest?: number;
  servicesForSelect: { id: string; label: string; apiType?: "HTTP" | "GRPC" | "WEBSOCKET" }[];
  endpointPathParameterNames: (entry: MockApiDraft) => string[];
  endpointDetails: {
    id: string;
    url: string | null;
    apiType?: "REST" | "GRPC" | "WEBSOCKET";
  }[];
  saveEnvironmentVariable: (
    id: string | null,
    draft: { name: string; value: string },
  ) => Promise<EnvironmentVariable>;
  saveHeaderTemplate: (template: HeaderTemplateDraft) => Promise<HeaderTemplateDraft>;
  saveAuthorizationTemplate: (
    template: AuthorizationTemplateDraft,
  ) => Promise<AuthorizationTemplateDraft>;
  saveMockApi: (id: string | null, entry: MockApiDraft) => Promise<MockApiDraft>;
  deleteEnvironmentVariable: (variable: EnvironmentVariable) => Promise<boolean>;
  deleteHeaderTemplate: (template: HeaderTemplateDraft) => Promise<boolean>;
  deleteAuthorizationTemplate: (template: AuthorizationTemplateDraft) => Promise<boolean>;
  deleteMockApi: (entry: MockApiDraft) => Promise<boolean>;
}>();
const emit = defineEmits<{
  discard: [];
  save: [];
  importCollection: [event: Event];
  importEnvironment: [event: Event];
  setMockEndpoint: [entry: MockApiDraft];
  formatRequest: [entry: MockApiDraft];
}>();
const fileInput = ref<HTMLInputElement | null>(null);
const environmentFileInput = ref<HTMLInputElement | null>(null);
const variableSectionItems = [{ value: "variables", label: "Shared environment variables" }];
const mockApiSectionItems = [{ value: "apis", label: "Registered mock APIs" }];
type EditorState =
  | {
      kind: "variable";
      id: string | null;
      draftId?: string;
      draft: { name: string; value: string };
    }
  | { kind: "header"; id: string | null; draftId?: string; draft: HeaderTemplateDraft }
  | {
      kind: "authorization";
      id: string | null;
      draftId?: string;
      draft: AuthorizationTemplateDraft;
    }
  | { kind: "mock"; id: string | null; draftId?: string; draft: MockApiDraft };
const editor = ref<EditorState | null>(null);
const editorError = ref("");
const savingEditor = ref(false);
const deletingEditor = ref(false);
const editorTitle = computed(() => {
  if (!editor.value) return "Mock APIs";
  const action = editor.value.id || editor.value.draftId ? "Edit" : "Add";
  if (editor.value.kind === "variable") return `${action} environment variable`;
  if (editor.value.kind === "header") return `${action} header template`;
  if (editor.value.kind === "authorization") return `${action} authorization template`;
  return `${action} mock API`;
});
const editorDescription = computed(() => {
  if (!editor.value) return "REST · GraphQL · unary gRPC · raw WebSocket";
  if (editor.value.kind === "variable") return "Configure a shared project variable";
  if (editor.value.kind === "header") return "Configure reusable request headers";
  if (editor.value.kind === "authorization") return "Configure reusable API authorization";
  return "Configure the request and target service endpoint";
});
const visibleSecrets = ref(new Set<string>());
const authorizationTypeOptions = [
  { label: "Bearer token", value: "bearer" },
  { label: "Basic Auth", value: "basic" },
  { label: "API key", value: "api-key" },
  { label: "OAuth 2.0 Client Credentials", value: "oauth-client-credentials" },
];
const mockApiTypeOptions = [
  { label: "HTTP", value: "HTTP" },
  { label: "gRPC", value: "GRPC" },
  { label: "WebSocket", value: "WEBSOCKET" },
];

function mockApiTypeLabel(entry: MockApiDraft) {
  if (entry.apiType === "WEBSOCKET") return "WebSocket";
  return entry.apiType === "GRPC" ? "gRPC" : "HTTP";
}

function mockApiTypeIcon(entry: MockApiDraft) {
  if (entry.apiType === "WEBSOCKET") return "i-lucide-radio-tower";
  return entry.apiType === "GRPC" ? "i-lucide-network" : "i-lucide-play";
}

function supportsHandshakeSettings(entry: MockApiDraft) {
  const apiType = entry.apiType ?? "HTTP";
  return apiType === "HTTP" || apiType === "WEBSOCKET";
}

function setMockApiType(entry: MockApiDraft, value: unknown) {
  const apiType = value as NonNullable<MockApiDraft["apiType"]>;
  const endpointId =
    props.servicesForSelect.find((option) => (option.apiType ?? "HTTP") === apiType)?.id ?? null;
  entry.apiType = apiType;
  entry.targetEndpointId = endpointId;
  entry.active = Boolean(endpointId);
  entry.pathParameters = {};
  entry.requestJson = apiType === "WEBSOCKET" ? "" : "{}";
  entry.headerTemplateId = null;
  entry.authorizationTemplateId = null;
  entry.customHeaders = [];
  if (apiType === "HTTP") emit("setMockEndpoint", entry);
}

function beginCreate(
  kind: "variable" | "header" | "authorization" | "mock",
  apiType?: "HTTP" | "GRPC" | "WEBSOCKET",
) {
  editorError.value = "";
  if (kind === "variable") {
    editor.value = { kind, id: null, draft: { name: "", value: "" } };
  } else if (kind === "header") {
    editor.value = {
      kind,
      id: null,
      draft: { id: `draft-${crypto.randomUUID()}`, name: "", headers: [{ name: "", value: "" }] },
    };
  } else if (kind === "authorization") {
    editor.value = {
      kind,
      id: null,
      draft: {
        id: `draft-${crypto.randomUUID()}`,
        name: "",
        type: "bearer",
        token: "",
        pendingCreate: true,
      },
    };
  } else {
    const type = apiType ?? "HTTP";
    const serviceType = type === "HTTP" ? "REST" : type === "WEBSOCKET" ? "WEBSOCKET" : "GRPC";
    const endpointId =
      props.servicesForSelect.find((item) => (item.apiType ?? "HTTP") === serviceType)?.id ?? null;
    editor.value = {
      kind,
      id: null,
      draft: {
        name: "",
        apiType: type,
        targetEndpointId: endpointId,
        description: "",
        requestJson: type === "WEBSOCKET" ? "" : "{}",
        pathParameters: {},
        customHeaders: [],
        active: Boolean(endpointId),
      },
    };
    if (editor.value.draft.apiType === "HTTP") emit("setMockEndpoint", editor.value.draft);
  }
}

function beginEditVariable(variable: EnvironmentVariable) {
  editorError.value = "";
  editor.value = {
    kind: "variable",
    id: variable.pendingCreate ? null : variable.id,
    ...(variable.pendingCreate ? { draftId: variable.id } : {}),
    draft: { name: variable.name, value: variable.value },
  };
}

function beginEditHeader(template: HeaderTemplateDraft) {
  editorError.value = "";
  editor.value = {
    kind: "header",
    id: template.pendingCreate ? null : template.id,
    ...(template.pendingCreate ? { draftId: template.id } : {}),
    draft: structuredClone(toRaw(template)),
  };
}

function beginEditAuthorization(template: AuthorizationTemplateDraft) {
  editorError.value = "";
  editor.value = {
    kind: "authorization",
    id: template.pendingCreate ? null : template.id,
    ...(template.pendingCreate ? { draftId: template.id } : {}),
    draft: structuredClone(toRaw(template)),
  };
}

function beginEditMock(entry: MockApiDraft) {
  editorError.value = "";
  const pending = !entry.id || entry.id.startsWith("draft-");
  const source = toRaw(entry);
  const draft: MockApiDraft = {
    ...source,
    pathParameters: { ...source.pathParameters },
    customHeaders: (source.customHeaders ?? []).map(({ name, value }) => ({ name, value })),
    ...(source.readinessReasons
      ? { readinessReasons: source.readinessReasons.map((reason) => ({ ...reason })) }
      : {}),
    requestJson:
      source.apiType === "WEBSOCKET"
        ? typeof source.requestJson === "string"
          ? source.requestJson
          : String(source.requestJson ?? "")
        : typeof source.requestJson === "string"
          ? source.requestJson
          : JSON.stringify(source.requestJson ?? {}, null, 2),
  };
  editor.value = {
    kind: "mock",
    id: pending ? null : entry.id!,
    ...(pending && entry.id ? { draftId: entry.id } : {}),
    draft,
  };
}

function discardEditor() {
  editor.value = null;
  editorError.value = "";
}

async function saveEditor() {
  const current = editor.value;
  if (!current) return;
  savingEditor.value = true;
  editorError.value = "";
  try {
    if (current.kind === "variable") {
      await props.saveEnvironmentVariable(current.id ?? current.draftId ?? null, current.draft);
    } else if (current.kind === "header") {
      await props.saveHeaderTemplate(current.draft);
    } else if (current.kind === "authorization") {
      await props.saveAuthorizationTemplate(current.draft);
    } else {
      await props.saveMockApi(current.id, current.draft);
    }
    editor.value = null;
  } catch (cause) {
    editorError.value = cause instanceof Error ? cause.message : "Could not save this item";
  } finally {
    savingEditor.value = false;
  }
}

async function deleteEditor() {
  const current = editor.value;
  if (!current || (!current.id && !current.draftId)) return;
  deletingEditor.value = true;
  editorError.value = "";
  try {
    let deleted = false;
    if (current.kind === "variable") {
      const variable = environmentVariables.value.find(
        ({ id }) => id === (current.id ?? current.draftId),
      );
      if (!variable) throw new Error("Environment variable no longer exists");
      deleted = await props.deleteEnvironmentVariable(variable);
    } else if (current.kind === "header") {
      deleted = await props.deleteHeaderTemplate(current.draft);
    } else if (current.kind === "authorization") {
      deleted = await props.deleteAuthorizationTemplate(current.draft);
    } else {
      deleted = await props.deleteMockApi(current.draft);
    }
    if (deleted) editor.value = null;
  } catch (cause) {
    editorError.value = cause instanceof Error ? cause.message : "Could not delete this item";
  } finally {
    deletingEditor.value = false;
  }
}

watch(
  () => [props.focusMockApiId, props.focusMockApiRequest] as const,
  async ([id]) => {
    if (!id) return;
    const entry = mockDraft.value.find((mock) => mock.id === id);
    if (entry) beginEditMock(entry);
  },
  { immediate: true },
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
  Object.assign(template, next);
  if (index >= 0) authorizationTemplates.value[index] = template;
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
  <WorkspaceDrawer
    :open="true"
    side="right"
    :portal="false"
    :close="false"
    :content="{
      'aria-label': 'Mock API settings',
      onInteractOutside: preventOutsideDismiss,
    }"
    :ui="{
      body: 'mock-api-settings-panel__body',
    }"
    @update:open="handleOpenChange"
  >
    <template #title>
      <div class="flex min-w-0 items-center gap-2">
        <UButton
          v-if="editor"
          type="button"
          color="neutral"
          variant="ghost"
          size="sm"
          class="shrink-0 gap-1 px-1.5 text-[12px]"
          aria-label="Back to Mock APIs"
          @click="discardEditor"
        >
          <UIcon name="i-lucide-arrow-left" class="size-4" aria-hidden="true" />
          Back
        </UButton>
        <span class="truncate">{{ editorTitle }}</span>
      </div>
    </template>
    <template #description>{{ editorDescription }}</template>
    <template #actions>
      <UButton
        v-if="editor?.id || editor?.draftId"
        type="button"
        color="error"
        variant="outline"
        class="inline-grid size-[34px] place-items-center rounded-lg border border-[var(--danger)] bg-[var(--panel)] p-0 leading-none text-[var(--danger)] hover:bg-[var(--danger-soft)]"
        :aria-label="`Delete ${editorTitle}`"
        :title="`Delete ${editorTitle}`"
        :loading="deletingEditor"
        :disabled="deletingEditor || savingEditor"
        @click="deleteEditor"
      >
        <UIcon name="i-lucide-trash" class="size-4" aria-hidden="true" />
      </UButton>
    </template>
    <template #body>
      <form
        v-if="editor"
        id="mock-api-entity-editor"
        class="flex flex-col gap-3"
        @submit.prevent="saveEditor"
      >
        <template v-if="editor.kind === 'variable'">
          <label class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]">
            Variable name
            <UInput v-model="editor.draft.name" placeholder="e.g. API_BASE_URL" required />
          </label>
          <label class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]">
            Value
            <UTextarea v-model="editor.draft.value" :rows="4" placeholder="Variable value" />
          </label>
          <p class="text-xs text-[var(--muted)]">
            Use <code class="font-mono">&#123;&#123;name&#125;&#125;</code> to reference this value
            in requests.
          </p>
        </template>
        <template v-else-if="editor.kind === 'header'">
          <label class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]">
            Template name
            <UInput v-model="editor.draft.name" placeholder="e.g. Internal API headers" required />
          </label>
          <div class="flex flex-col gap-2">
            <div
              v-for="(header, index) in editor.draft.headers"
              :key="index"
              class="grid grid-cols-[1fr_1fr_auto] items-center gap-2"
            >
              <UInput v-model="header.name" aria-label="Header name" placeholder="Header" />
              <UInput
                v-model="header.value"
                aria-label="Header value"
                placeholder="Value or {{variable}}"
              />
              <UButton
                type="button"
                color="neutral"
                variant="outline"
                size="sm"
                @click="removeHeaderRow(editor.draft.headers, index)"
                >Remove</UButton
              >
            </div>
            <UButton
              type="button"
              color="neutral"
              variant="outline"
              size="sm"
              class="self-start"
              @click="addHeaderRow(editor.draft.headers)"
              >Add header</UButton
            >
          </div>
        </template>
        <template v-else-if="editor.kind === 'authorization'">
          <label class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]">
            Template name
            <UInput v-model="editor.draft.name" placeholder="e.g. Service bearer token" required />
          </label>
          <label class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]">
            Authorization type
            <USelect
              :model-value="editor.draft.type"
              :items="authorizationTypeOptions"
              @update:model-value="setAuthorizationType(editor.draft, $event)"
            />
          </label>
          <template v-if="editor.draft.type === 'bearer'">
            <label class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]"
              >Bearer token
              <UInput
                v-model="editor.draft.token"
                :type="secretVisible(editor.draft, 'token') ? 'text' : 'password'"
                placeholder="Token or {{variable}}"
              />
            </label>
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              size="sm"
              class="self-start"
              @click="toggleSecret(editor.draft, 'token')"
              >{{ secretVisible(editor.draft, "token") ? "Hide" : "Show" }} token</UButton
            >
          </template>
          <template v-else-if="editor.draft.type === 'basic'">
            <label class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]"
              >Username<UInput
                v-model="editor.draft.username"
                placeholder="Username or {{variable}}"
            /></label>
            <label class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]"
              >Password<UInput
                v-model="editor.draft.password"
                :type="secretVisible(editor.draft, 'password') ? 'text' : 'password'"
            /></label>
          </template>
          <template v-else-if="editor.draft.type === 'api-key'">
            <label class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]"
              >Header name<UInput v-model="editor.draft.headerName" placeholder="X-API-Key"
            /></label>
            <label class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]"
              >API key value<UInput
                v-model="editor.draft.value"
                :type="secretVisible(editor.draft, 'value') ? 'text' : 'password'"
            /></label>
          </template>
          <template v-else>
            <label class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]"
              >Token URL<UInput
                v-model="editor.draft.tokenUrl"
                placeholder="https://auth.example.com/token"
            /></label>
            <label class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]"
              >Client ID<UInput v-model="editor.draft.clientId"
            /></label>
            <label class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]"
              >Client secret<UInput v-model="editor.draft.clientSecret" type="password"
            /></label>
            <label class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]"
              >Scope (optional)<UInput v-model="editor.draft.scope"
            /></label>
          </template>
        </template>
        <template v-else>
          <label class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]"
            >Mock API name
            <UInput v-model="editor.draft.name" placeholder="e.g. Create order" required />
          </label>
          <label class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]"
            >API type
            <USelect
              :model-value="editor.draft.apiType ?? 'HTTP'"
              :items="mockApiTypeOptions"
              @update:model-value="setMockApiType(editor.draft, $event)"
            />
          </label>
          <label class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]"
            >Service endpoint
            <USelect
              v-model="editor.draft.targetEndpointId"
              :items="endpointOptions(editor.draft)"
              @update:model-value="emit('setMockEndpoint', editor.draft)"
            />
          </label>
          <label
            v-for="name in props.endpointPathParameterNames(editor.draft)"
            :key="name"
            class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]"
          >
            Path parameter: {{ name }}
            <UInput
              v-model="editor.draft.pathParameters[name]"
              :placeholder="`Value or {{${name}}}`"
            />
          </label>
          <label
            v-if="supportsHandshakeSettings(editor.draft)"
            class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]"
            >Header template
            <USelect v-model="editor.draft.headerTemplateId" :items="templateOptions()" />
          </label>
          <label
            v-if="supportsHandshakeSettings(editor.draft)"
            class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]"
            >Authorization
            <USelect
              v-model="editor.draft.authorizationTemplateId"
              :items="authorizationOptions()"
            />
          </label>
          <HeaderRowsEditor
            v-if="supportsHandshakeSettings(editor.draft)"
            v-model="editor.draft.customHeaders"
          />
          <label class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]"
            >{{ editor.draft.apiType === "WEBSOCKET" ? "Message" : "Request (JSON)" }}
            <UTextarea
              v-if="editor.draft.apiType === 'WEBSOCKET'"
              v-model="editor.draft.requestJson"
              :rows="6"
              placeholder="Text message to send"
            />
            <template v-else>
              <div class="flex justify-end">
                <UButton
                  type="button"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  @click="emit('formatRequest', editor.draft)"
                  >Format JSON</UButton
                >
              </div>
              <RequestJsonEditor
                :model-value="String(editor.draft.requestJson ?? '')"
                :variables="environmentVariables"
                @update:model-value="editor.draft.requestJson = $event"
              />
            </template>
          </label>
          <label class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]"
            >Description<UInput v-model="editor.draft.description" placeholder="Optional note"
          /></label>
          <label
            class="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium"
            >Active
            <USwitch
              v-model="editor.draft.active"
              size="sm"
              :disabled="!editor.draft.targetEndpointId"
            />
          </label>
        </template>
        <p v-if="editorError" role="alert" class="text-xs text-[var(--danger)]">
          {{ editorError }}
        </p>
      </form>
      <template v-else>
        <div class="mock-api-settings-panel__list flex flex-col gap-4">
          <section>
            <div class="flex items-center justify-between gap-2">
              <strong>Shareable header templates</strong>
              <UButton
                type="button"
                class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[12.5px] font-medium hover:bg-[var(--panel2)]"
                @click="beginCreate('header')"
                >New template</UButton
              >
            </div>
            <SettingsAccordionCard
              v-for="template in headerTemplates"
              :key="template.id"
              :title="template.name || 'New header template'"
              :subtitle="`${template.headers.length} headers`"
              :delete-label="`Delete ${template.name || 'header template'}`"
              navigation
              hide-delete
              @select="beginEditHeader(template)"
            >
              <template #leading>
                <span class="grid size-8 shrink-0 place-items-center rounded-md bg-[var(--panel2)]">
                  <UIcon
                    name="i-lucide-braces"
                    class="size-5 text-[var(--muted)]"
                    aria-hidden="true"
                  />
                </span>
              </template>
              <label
                :for="`header-template-name-${template.id}`"
                class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[12px] [&>span]:font-medium [&>span]:text-[var(--muted)] [&>legend]:text-[12px] [&>legend]:font-medium [&>legend]:text-[var(--muted)]"
              >
                <span>Name</span>
                <UInput
                  :id="`header-template-name-${template.id}`"
                  v-model="template.name"
                  :ui="{
                    base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] h-8 px-2.5 py-0 text-[12.5px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
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
                    base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] h-8 px-2.5 py-0 text-[12.5px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
                  }"
                />
                <UInput
                  v-model="header.value"
                  aria-label="Header value"
                  placeholder="Value or {{variable}}"
                  :ui="{
                    base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] h-8 px-2.5 py-0 text-[12.5px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
                  }"
                />
                <UButton
                  type="button"
                  aria-label="Remove header row"
                  class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[12.5px] font-medium hover:bg-[var(--panel2)]"
                  @click="removeHeaderRow(template.headers, row)"
                  >Remove</UButton
                >
              </div>
              <UButton
                type="button"
                class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[12.5px] font-medium hover:bg-[var(--panel2)]"
                @click="addHeaderRow(template.headers)"
                >Add header</UButton
              >
            </SettingsAccordionCard>
          </section>
          <section id="authorization-templates">
            <div class="flex items-center justify-between gap-2">
              <strong>Shareable authorization templates</strong>
              <UButton
                type="button"
                class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[12.5px] font-medium hover:bg-[var(--panel2)]"
                @click="beginCreate('authorization')"
                >New template</UButton
              >
            </div>
            <SettingsAccordionCard
              v-for="template in authorizationTemplates"
              :key="template.id"
              :id="`authorization-template-${template.id}`"
              :title="template.name || 'New authorization template'"
              :subtitle="authorizationTypeLabel(template.type)"
              :delete-label="`Delete ${template.name || 'authorization template'}`"
              navigation
              hide-delete
              @select="beginEditAuthorization(template)"
            >
              <template #leading>
                <span class="grid size-8 shrink-0 place-items-center rounded-md bg-[var(--panel2)]">
                  <UIcon
                    name="i-lucide-key-round"
                    class="size-5 text-[var(--muted)]"
                    aria-hidden="true"
                  />
                </span>
              </template>
              <label
                :for="`authorization-template-name-${template.id}`"
                class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[12px] [&>span]:font-medium [&>span]:text-[var(--muted)]"
              >
                <span>Name</span>
                <UInput
                  :id="`authorization-template-name-${template.id}`"
                  v-model="template.name"
                  aria-label="Authorization template name"
                  :ui="{
                    base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] h-8 px-2.5 py-0 text-[12.5px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
                  }"
                />
              </label>
              <label
                :for="`authorization-template-type-${template.id}`"
                class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[12px] [&>span]:font-medium [&>span]:text-[var(--muted)]"
              >
                <span>Authorization type</span>
                <USelect
                  :id="`authorization-template-type-${template.id}`"
                  :model-value="template.type"
                  :items="authorizationTypeOptions"
                  aria-label="Authorization type"
                  :ui="{
                    base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] h-8 px-2.5 py-0 text-[12.5px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
                  }"
                  @update:model-value="setAuthorizationType(template, $event)"
                />
              </label>
              <template v-if="template.type === 'bearer'">
                <label
                  :for="`authorization-token-${template.id}`"
                  class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[12px] [&>span]:font-medium [&>span]:text-[var(--muted)]"
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
                        base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] h-8 px-2.5 py-0 text-[12.5px]',
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
                    class="text-[12px] font-medium text-[var(--muted)]"
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
                    class="text-[12px] font-medium text-[var(--muted)]"
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
                    class="text-[12px] font-medium text-[var(--muted)]"
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
                    class="text-[12px] font-medium text-[var(--muted)]"
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
                    class="text-[12px] font-medium text-[var(--muted)]"
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
                    class="text-[12px] font-medium text-[var(--muted)]"
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
                    class="text-[12px] font-medium text-[var(--muted)]"
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
                    class="text-[12px] font-medium text-[var(--muted)]"
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
          <section>
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
                      class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[12.5px] font-medium hover:bg-[var(--panel2)]"
                      @click="environmentFileInput?.click()"
                      >Import environment</UButton
                    >
                    <UButton
                      type="button"
                      color="neutral"
                      variant="outline"
                      class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[12.5px] font-medium hover:bg-[var(--panel2)]"
                      :disabled="props.environmentVariablesLoading"
                      @click="beginCreate('variable')"
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
                        subtitle="Shared environment variable"
                        :delete-label="`Delete ${variable.name || 'variable'}`"
                        navigation
                        hide-delete
                        @select="beginEditVariable(variable)"
                      >
                        <template #leading>
                          <span
                            class="grid size-8 shrink-0 place-items-center rounded-md bg-[var(--panel2)]"
                          >
                            <UIcon
                              name="i-lucide-braces"
                              class="size-5 text-[var(--muted)]"
                              aria-hidden="true"
                            />
                          </span>
                        </template>
                      </SettingsAccordionCard>
                    </div>
                  </div>
                </template>
              </UAccordion>
            </div>
          </section>
          <section>
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
                      class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[12.5px] font-medium hover:bg-[var(--panel2)]"
                      @click="fileInput?.click()"
                    >
                      Import APIs
                    </UButton>
                    <UButton
                      type="button"
                      color="neutral"
                      variant="outline"
                      class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[12.5px] font-medium hover:bg-[var(--panel2)]"
                      @click="beginCreate('mock')"
                    >
                      + New API
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
                      navigation
                      hide-delete
                      @select="beginEditMock(entry)"
                    >
                      <template #leading>
                        <span
                          class="grid size-8 shrink-0 place-items-center rounded-md bg-[var(--panel2)]"
                        >
                          <UIcon
                            :name="mockApiTypeIcon(entry)"
                            class="size-5 text-[var(--muted)]"
                            aria-hidden="true"
                          />
                        </span>
                      </template>
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
                        class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[12px] [&>span]:font-medium [&>span]:text-[var(--muted)] [&>legend]:text-[12px] [&>legend]:font-medium [&>legend]:text-[var(--muted)]"
                      >
                        <span>Name</span>
                        <UInput
                          :id="`mock-api-name-${entry.id || index}`"
                          v-model="entry.name"
                          :ui="{
                            base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] h-8 px-2.5 py-0 text-[12.5px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
                          }"
                          placeholder="e.g. Create order"
                        />
                      </label>
                      <label
                        :for="`mock-api-endpoint-${entry.id || index}`"
                        class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[12px] [&>span]:font-medium [&>span]:text-[var(--muted)] [&>legend]:text-[12px] [&>legend]:font-medium [&>legend]:text-[var(--muted)]"
                      >
                        <span>Service endpoint</span>
                        <USelect
                          :id="`mock-api-endpoint-${entry.id || index}`"
                          v-model="entry.targetEndpointId"
                          :items="endpointOptions(entry)"
                          :ui="{
                            base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] h-8 px-2.5 py-0 text-[12.5px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
                          }"
                          @update:model-value="emit('setMockEndpoint', entry)"
                        />
                      </label>
                      <template v-if="(entry.apiType ?? 'HTTP') === 'HTTP'">
                        <label
                          v-for="name in props.endpointPathParameterNames(entry)"
                          :key="name"
                          :for="`mock-api-path-${entry.id || index}-${name}`"
                          class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[12px] [&>span]:font-medium [&>span]:text-[var(--muted)] [&>legend]:text-[12px] [&>legend]:font-medium [&>legend]:text-[var(--muted)]"
                        >
                          <span>Path parameter: {{ name }}</span>
                          <UInput
                            :id="`mock-api-path-${entry.id || index}-${name}`"
                            v-model="entry.pathParameters[name]"
                            :ui="{
                              base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] h-8 px-2.5 py-0 text-[12.5px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
                            }"
                            :placeholder="`Value or {{${name}}}`"
                          />
                        </label>
                      </template>
                      <label
                        v-if="supportsHandshakeSettings(entry)"
                        :for="`mock-api-template-${entry.id || index}`"
                        class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[12px] [&>span]:font-medium [&>span]:text-[var(--muted)] [&>legend]:text-[12px] [&>legend]:font-medium [&>legend]:text-[var(--muted)]"
                      >
                        <span>Header template</span>
                        <USelect
                          :id="`mock-api-template-${entry.id || index}`"
                          v-model="entry.headerTemplateId"
                          :items="templateOptions()"
                          :ui="{
                            base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] h-8 px-2.5 py-0 text-[12.5px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
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
                            class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[12px] [&>span]:font-medium [&>span]:text-[var(--muted)]"
                          >
                            <span>Authorization</span>
                            <USelect
                              :id="`mock-api-authorization-select-${entry.id || index}`"
                              :model-value="entry.authorizationTemplateId ?? ''"
                              :items="authorizationOptions()"
                              :aria-label="`Authorization for ${entry.name || `Mock API ${index + 1}`}`"
                              :ui="{
                                base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] h-8 px-2.5 py-0 text-[12.5px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
                              }"
                              @update:model-value="entry.authorizationTemplateId = $event || null"
                            />
                          </label>
                          <p class="text-[12px] text-[var(--muted)]">
                            Selected method: {{ authorizationSummary(entry) }}
                          </p>
                        </template>
                      </UAccordion>
                      <HeaderRowsEditor
                        v-if="supportsHandshakeSettings(entry)"
                        v-model="entry.customHeaders"
                      />
                      <div
                        class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[12px] [&>span]:font-medium [&>span]:text-[var(--muted)] [&>legend]:text-[12px] [&>legend]:font-medium [&>legend]:text-[var(--muted)]"
                      >
                        <span v-if="entry.status">Status: {{ entry.status }}</span>
                        <ul
                          v-if="entry.readinessReasons?.length"
                          class="list-disc pl-4 text-[12px] text-[var(--muted)]"
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
                        class="min-w-0 flex flex-1 flex-col gap-1 m-0 border-0 p-0 [&>legend]:text-[12px] [&>legend]:font-medium [&>legend]:text-[var(--muted)]"
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
                              base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 font-mono text-[12.5px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
                            }"
                          />
                        </template>
                        <template v-else>
                          <div class="flex justify-end">
                            <UButton
                              type="button"
                              color="neutral"
                              variant="outline"
                              class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-[12.5px] font-medium hover:bg-[var(--panel2)]"
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
                        class="min-w-0 flex flex-1 flex-col gap-1 [&>span]:text-[12px] [&>span]:font-medium [&>span]:text-[var(--muted)] [&>legend]:text-[12px] [&>legend]:font-medium [&>legend]:text-[var(--muted)]"
                      >
                        <span>Description</span>
                        <UInput
                          :id="`mock-api-description-${entry.id || index}`"
                          v-model="entry.description"
                          :ui="{
                            base: 'w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] h-8 px-2.5 py-0 text-[12.5px] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-soft)]',
                          }"
                          placeholder="Optional note"
                        />
                      </label>
                    </SettingsAccordionCard>
                    <div
                      v-if="!mockDraft.length"
                      class="rounded-lg border border-dashed border-[var(--border)] p-3 text-[12.5px] text-[var(--muted)]"
                    >
                      No mock API rows yet. Add one to get started.
                    </div>
                  </div>
                </template>
              </UAccordion>
            </div>
          </section>
        </div>
      </template>
    </template>
    <template #footer>
      <template v-if="editor">
        <UButton
          type="button"
          color="neutral"
          variant="outline"
          :disabled="deletingEditor"
          @click="discardEditor"
          >Discard</UButton
        >
        <UButton
          type="submit"
          form="mock-api-entity-editor"
          :loading="savingEditor"
          :disabled="savingEditor || deletingEditor || !editor.draft.name.trim()"
        >
          Save
        </UButton>
      </template>
      <template v-else>
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
    </template>
  </WorkspaceDrawer>
</template>
