<script setup lang="ts">
import { computed, ref, toRaw, watch } from "vue";
import {
  ConfirmDialog,
  HeaderRowsEditor,
  SettingsAccordionCard,
  WorkspaceDrawer,
} from "../../../shared/ui";
import RequestJsonEditor from "../../../features/mock-api-editor/ui/RequestJsonEditor.vue";
import type {
  AuthorizationTemplateDraft,
  EnvironmentVariable,
  HeaderTemplateDraft,
  MockApiDraft,
} from "../../../entities/mock-api";

const mockApis = defineModel<MockApiDraft[]>("mockApis", { required: true });
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
  setMockEndpoint: [entry: MockApiDraft];
  formatRequest: [entry: MockApiDraft];
}>();
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
const initialDraft = ref("");
const pendingDiscard = ref<"back" | "close" | null>(null);
const pendingDelete = ref(false);
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
  if (!editor.value) return "REST Â· GraphQL Â· unary gRPC Â· raw WebSocket";
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
    const serviceType = { HTTP: "REST", WEBSOCKET: "WEBSOCKET", GRPC: "GRPC" }[type];
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
  let requestJson = source.requestJson;
  if (typeof requestJson !== "string") {
    requestJson =
      source.apiType === "WEBSOCKET"
        ? JSON.stringify(requestJson ?? "")
        : JSON.stringify(requestJson ?? {}, null, 2);
  }
  const draft: MockApiDraft = {
    ...source,
    pathParameters: { ...source.pathParameters },
    customHeaders: (source.customHeaders ?? []).map(({ name, value }) => ({ name, value })),
    ...(source.readinessReasons
      ? { readinessReasons: source.readinessReasons.map((reason) => ({ ...reason })) }
      : {}),
    requestJson,
  };
  editor.value = {
    kind: "mock",
    id: pending ? null : entry.id!,
    ...(pending && entry.id ? { draftId: entry.id } : {}),
    draft,
  };
}

watch(editor, (value) => {
  initialDraft.value = value ? JSON.stringify(value.draft) : "";
});

function discardEditor() {
  if (editor.value && JSON.stringify(editor.value.draft) !== initialDraft.value) {
    pendingDiscard.value = "back";
    return;
  }
  editor.value = null;
  editorError.value = "";
}

function closePanel() {
  if (editor.value && JSON.stringify(editor.value.draft) !== initialDraft.value) {
    pendingDiscard.value = "close";
    return;
  }
  emit("discard");
}

function confirmDiscard() {
  const action = pendingDiscard.value;
  pendingDiscard.value = null;
  editor.value = null;
  editorError.value = "";
  if (action === "close") emit("discard");
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
  ([id]) => {
    if (!id) return;
    const entry = mockApis.value.find((mock) => mock.id === id);
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
  if (!open) closePanel();
}
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
    <template #back>
      <UButton
        v-if="editor"
        type="button"
        color="neutral"
        variant="ghost"
        size="sm"
        class="grid size-8 shrink-0 place-items-center p-0"
        aria-label="Back to Mock APIs"
        title="Back to Mock APIs"
        @click="discardEditor"
      >
        <UIcon name="i-lucide-arrow-left" class="size-4" aria-hidden="true" />
      </UButton>
    </template>
    <template #title>{{ editorTitle }}</template>
    <template #description>{{ editorDescription }}</template>
    <template #actions>
      <UButton
        v-if="editor?.id"
        type="button"
        color="error"
        variant="outline"
        class="inline-grid size-[34px] place-items-center rounded-lg border border-[var(--danger)] bg-[var(--panel)] p-0 leading-none text-[var(--danger)] hover:bg-[var(--danger-soft)]"
        :aria-label="`Delete ${editorTitle}`"
        :title="`Delete ${editorTitle}`"
        :loading="deletingEditor"
        :disabled="deletingEditor || savingEditor"
        @click="pendingDelete = true"
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
          <div class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]">
            Variable name
            <UInput
              v-model="editor.draft.name"
              aria-label="Variable name"
              placeholder="e.g. API_BASE_URL"
              required
            />
          </div>
          <div class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]">
            Value
            <UTextarea
              v-model="editor.draft.value"
              aria-label="Value"
              :rows="4"
              placeholder="Variable value"
            />
          </div>
          <p class="text-xs text-[var(--muted)]">
            Use <code class="font-mono">&#123;&#123;name&#125;&#125;</code> to reference this value
            in requests.
          </p>
        </template>
        <template v-else-if="editor.kind === 'header'">
          <div class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]">
            Template name
            <UInput
              v-model="editor.draft.name"
              aria-label="Template name"
              placeholder="e.g. Internal API headers"
              required
            />
          </div>
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
          <div class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]">
            Template name
            <UInput
              v-model="editor.draft.name"
              aria-label="Template name"
              placeholder="e.g. Service bearer token"
              required
            />
          </div>
          <div class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]">
            Authorization type
            <USelect
              :model-value="editor.draft.type"
              aria-label="Authorization type"
              :items="authorizationTypeOptions"
              @update:model-value="setAuthorizationType(editor.draft, $event)"
            />
          </div>
          <template v-if="editor.draft.type === 'bearer'">
            <div class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]">
              Bearer token
              <UInput
                v-model="editor.draft.token"
                aria-label="Bearer token"
                :type="secretVisible(editor.draft, 'token') ? 'text' : 'password'"
                placeholder="Token or {{variable}}"
              />
            </div>
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
            <div class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]">
              Username<UInput
                v-model="editor.draft.username"
                aria-label="Username"
                placeholder="Username or {{variable}}"
              />
            </div>
            <div class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]">
              Password<UInput
                v-model="editor.draft.password"
                aria-label="Password"
                :type="secretVisible(editor.draft, 'password') ? 'text' : 'password'"
              />
            </div>
          </template>
          <template v-else-if="editor.draft.type === 'api-key'">
            <div class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]">
              Header name<UInput
                v-model="editor.draft.headerName"
                aria-label="Header name"
                placeholder="X-API-Key"
              />
            </div>
            <div class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]">
              API key value<UInput
                v-model="editor.draft.value"
                aria-label="API key value"
                :type="secretVisible(editor.draft, 'value') ? 'text' : 'password'"
              />
            </div>
          </template>
          <template v-else>
            <div class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]">
              Token URL<UInput
                v-model="editor.draft.tokenUrl"
                aria-label="Token URL"
                placeholder="https://auth.example.com/token"
              />
            </div>
            <div class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]">
              Client ID<UInput v-model="editor.draft.clientId" aria-label="Client ID" />
            </div>
            <div class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]">
              Client secret<UInput
                v-model="editor.draft.clientSecret"
                aria-label="Client secret"
                type="password"
              />
            </div>
            <div class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]">
              Scope (optional)<UInput v-model="editor.draft.scope" aria-label="Scope (optional)" />
            </div>
          </template>
        </template>
        <template v-else>
          <div class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]">
            Mock API name
            <UInput
              v-model="editor.draft.name"
              aria-label="Mock API name"
              placeholder="e.g. Create order"
              required
            />
          </div>
          <div class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]">
            API type
            <USelect
              :model-value="editor.draft.apiType ?? 'HTTP'"
              aria-label="API type"
              :items="mockApiTypeOptions"
              @update:model-value="setMockApiType(editor.draft, $event)"
            />
          </div>
          <div class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]">
            Service endpoint
            <USelect
              v-model="editor.draft.targetEndpointId"
              aria-label="Service endpoint"
              :items="endpointOptions(editor.draft)"
              @update:model-value="emit('setMockEndpoint', editor.draft)"
            />
          </div>
          <div
            v-for="name in props.endpointPathParameterNames(editor.draft)"
            :key="name"
            class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]"
          >
            Path parameter: {{ name }}
            <UInput
              v-model="editor.draft.pathParameters[name]"
              :aria-label="`Path parameter: ${name}`"
              :placeholder="`Value or {{${name}}}`"
            />
          </div>
          <div
            v-if="supportsHandshakeSettings(editor.draft)"
            class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]"
          >
            Header template
            <USelect
              v-model="editor.draft.headerTemplateId"
              :items="templateOptions()"
              aria-label="Header template"
            />
          </div>
          <div
            v-if="supportsHandshakeSettings(editor.draft)"
            class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]"
          >
            Authorization
            <USelect
              v-model="editor.draft.authorizationTemplateId"
              aria-label="Authorization"
              :items="authorizationOptions()"
            />
          </div>
          <HeaderRowsEditor
            v-if="supportsHandshakeSettings(editor.draft)"
            v-model="editor.draft.customHeaders"
          />
          <div class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]">
            {{ editor.draft.apiType === "WEBSOCKET" ? "Message" : "Request (JSON)" }}
            <UTextarea
              v-if="editor.draft.apiType === 'WEBSOCKET'"
              v-model="editor.draft.requestJson"
              aria-label="Message"
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
          </div>
          <div class="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]">
            Description<UInput
              v-model="editor.draft.description"
              aria-label="Description"
              placeholder="Optional note"
            />
          </div>
          <div
            class="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium"
          >
            Active
            <USwitch
              v-model="editor.draft.active"
              aria-label="Active"
              size="sm"
              :disabled="!editor.draft.targetEndpointId"
            />
          </div>
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
                color="neutral"
                variant="outline"
                size="sm"
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
                color="neutral"
                variant="outline"
                size="sm"
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
                      v-for="(entry, index) in mockApis"
                      :key="entry.id"
                      :id="`mock-api-${entry.id}`"
                      :title="entry.name || `Mock API ${index + 1}`"
                      :subtitle="`${mockApiTypeLabel(entry)} | ${servicesForSelect.find((option) => option.id === entry.targetEndpointId)?.label ?? 'Select service endpoint'}`"
                      :delete-label="`Delete ${entry.name || `Mock API ${index + 1}`}`"
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
                      <p class="text-xs text-[var(--muted)]">{{ entry.status }}</p>
                    </SettingsAccordionCard>
                    <div
                      v-if="!mockApis.length"
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
    <template v-if="editor" #footer>
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
        {{ editor.id ? "Update" : "Save" }}
      </UButton>
    </template>
  </WorkspaceDrawer>
  <ConfirmDialog
    :open="Boolean(pendingDiscard)"
    title="Discard changes?"
    description="Your edits to this item will be lost."
    confirm-label="Discard"
    destructive
    @confirm="confirmDiscard"
    @cancel="pendingDiscard = null"
  />
  <ConfirmDialog
    :open="pendingDelete"
    title="Delete this item?"
    description="This action removes the saved item."
    confirm-label="Delete"
    destructive
    @confirm="((pendingDelete = false), deleteEditor())"
    @cancel="pendingDelete = false"
  />
</template>
