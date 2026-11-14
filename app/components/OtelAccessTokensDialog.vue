<script setup lang="ts">
import type {
  OtelAccessTokenCreateResponse,
  OtelAccessTokenListItem,
} from "#shared/api/otel-access-tokens";
import { ref, watch } from "vue";
import { WorkspaceDrawer } from "../shared/ui";

const open = defineModel<boolean>("open", { required: true });
const tokens = ref<OtelAccessTokenListItem[]>([]);
const name = ref("");
const expiryDays = ref("30");
const secret = ref("");
const revokeTarget = ref<OtelAccessTokenListItem | null>(null);
const error = ref("");
const loading = ref(false);

async function load() {
  loading.value = true;
  error.value = "";
  try {
    tokens.value = await $fetch<OtelAccessTokenListItem[]>("/api/access-tokens");
  } catch {
    error.value = "Could not load access tokens.";
  } finally {
    loading.value = false;
  }
}

const expiryOptions = [
  { label: "7 days", value: "7" },
  { label: "30 days", value: "30" },
  { label: "90 days", value: "90" },
  { label: "No expiry", value: "never" },
];

function expiryTimestamp(days: string) {
  return days === "never"
    ? null
    : new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000).toISOString();
}

async function generate() {
  error.value = "";
  try {
    const created = await $fetch<OtelAccessTokenCreateResponse>("/api/access-tokens", {
      method: "POST",
      body: { name: name.value, expiresAt: expiryTimestamp(expiryDays.value) },
    });
    secret.value = created.token;
    name.value = "";
    expiryDays.value = "30";
    await load();
  } catch {
    error.value = "Could not generate access token.";
  }
}

async function copySecret() {
  await navigator.clipboard.writeText(secret.value);
}

async function revoke() {
  if (!revokeTarget.value) return;
  try {
    await $fetch(`/api/access-tokens/${revokeTarget.value.id}`, { method: "DELETE" });
    revokeTarget.value = null;
    await load();
  } catch {
    error.value = "Could not revoke access token.";
  }
}

watch(
  open,
  (isOpen) => {
    if (isOpen) void load();
    else {
      secret.value = "";
      revokeTarget.value = null;
    }
  },
  { immediate: true },
);
</script>

<template>
  <WorkspaceDrawer v-model:open="open">
    <template #title>Manage access tokens</template>
    <template #description>Access tokens for OpenTelemetry ingestion</template>
    <template #body>
      <form
        class="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto]"
        @submit.prevent="generate"
      >
        <div class="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted">
          Token name
          <UInput
            v-model="name"
            aria-label="Token name"
            placeholder="e.g. otel-collector · prod"
            required
            maxlength="255"
          />
        </div>
        <div class="flex flex-col gap-1 text-xs font-medium text-muted">
          Expires after
          <USelect v-model="expiryDays" :items="expiryOptions" aria-label="Expires after" />
        </div>
        <UButton type="submit" :disabled="!name.trim()">Generate</UButton>
      </form>
      <p v-if="error" role="alert" class="mt-3 text-sm text-error">{{ error }}</p>
      <section
        v-if="secret"
        class="mt-4 rounded-lg border border-primary bg-[color-mix(in_srgb,_var(--ui-primary)_10%,_transparent)] p-3"
      >
        <p class="text-sm font-semibold">Copy token now. It cannot be shown again.</p>
        <code class="mt-2 block break-all text-xs">{{ secret }}</code>
        <UButton type="button" color="neutral" variant="outline" @click="copySecret"
          >Copy token</UButton
        >
      </section>
      <p v-if="loading" class="mt-4 text-sm text-muted">Loading tokens…</p>
      <p v-else-if="!tokens.length" class="mt-4 text-sm text-muted">No access tokens.</p>
      <ul v-else class="mt-4 grid gap-2">
        <li
          v-for="token in tokens"
          :key="token.id"
          class="flex min-h-14 items-center gap-3 border-b border-default bg-default px-2 py-2.5 last:border-b-0"
        >
          <div class="min-w-0 flex-1">
            <p class="truncate text-[12.5px] font-semibold">{{ token.name }}</p>
            <p class="mt-0.5 font-mono text-[11.5px] text-muted">
              Created {{ new Date(token.createdAt).toLocaleDateString() }} ·
            </p>
          </div>
          <span
            class="shrink-0 rounded-full px-2 py-1 text-[11px] font-medium"
            :class="token.expired ? 'app__run-state--failed' : 'bg-elevated text-muted'"
            >{{
              token.expired
                ? "Expired"
                : token.expiresAt
                  ? `Expires ${new Date(token.expiresAt).toLocaleDateString()}`
                  : "No expiry"
            }}</span
          >
          <UButton type="button" color="error" variant="ghost" @click="revokeTarget = token"
            >Revoke</UButton
          >
        </li>
      </ul>
      <div
        v-if="revokeTarget"
        role="alertdialog"
        aria-label="Confirm revocation"
        class="mt-4 rounded-lg border border-error p-3"
      >
        <p class="text-sm">
          Revoke “{{ revokeTarget.name }}”? Collector requests using it will fail.
        </p>
        <div class="mt-3 flex justify-end gap-2">
          <UButton type="button" color="neutral" variant="outline" @click="revokeTarget = null"
            >Cancel</UButton
          >
          <UButton type="button" color="error" @click="revoke">Confirm revoke</UButton>
        </div>
      </div>
    </template>
  </WorkspaceDrawer>
</template>
