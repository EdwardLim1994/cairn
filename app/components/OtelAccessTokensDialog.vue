<script setup lang="ts">
import type {
  OtelAccessTokenCreateResponse,
  OtelAccessTokenListItem,
} from "#shared/api/otel-access-tokens";
import { ref, watch } from "vue";

const open = defineModel<boolean>("open", { required: true });
const tokens = ref<OtelAccessTokenListItem[]>([]);
const name = ref("");
const expiryDate = ref("");
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

function expiryTimestamp(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year!, month! - 1, day!, 23, 59, 59, 999).toISOString();
}

async function generate() {
  error.value = "";
  try {
    const created = await $fetch<OtelAccessTokenCreateResponse>("/api/access-tokens", {
      method: "POST",
      body: { name: name.value, expiresAt: expiryTimestamp(expiryDate.value) },
    });
    secret.value = created.token;
    name.value = "";
    expiryDate.value = "";
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
  <UModal v-model:open="open" title="Manage access tokens" :ui="{ content: 'max-w-xl' }">
    <template #body>
      <form class="grid gap-3 sm:grid-cols-[1fr_10rem_auto]" @submit.prevent="generate">
        <UInput
          v-model="name"
          aria-label="Token name"
          placeholder="Token name"
          required
          maxlength="255"
        />
        <UInput v-model="expiryDate" aria-label="Expiration date" type="date" required />
        <UButton type="submit" :disabled="!name.trim() || !expiryDate">Generate</UButton>
      </form>
      <p v-if="error" role="alert" class="mt-3 text-sm text-[var(--danger)]">{{ error }}</p>
      <section
        v-if="secret"
        class="mt-4 rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] p-3"
      >
        <p class="text-sm font-semibold">Copy token now. It cannot be shown again.</p>
        <code class="mt-2 block break-all text-xs">{{ secret }}</code>
        <UButton class="mt-2" type="button" color="neutral" variant="outline" @click="copySecret"
          >Copy token</UButton
        >
      </section>
      <p v-if="loading" class="mt-4 text-sm text-[var(--muted)]">Loading tokens…</p>
      <p v-else-if="!tokens.length" class="mt-4 text-sm text-[var(--muted)]">No access tokens.</p>
      <ul v-else class="mt-4 grid gap-2">
        <li
          v-for="token in tokens"
          :key="token.id"
          class="flex items-center gap-3 rounded-lg border border-[var(--border)] p-3"
        >
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold">{{ token.name }}</p>
            <p class="text-xs text-[var(--muted)]">
              Expires {{ new Date(token.expiresAt).toLocaleString()
              }}<span v-if="token.expired"> · Expired</span>
            </p>
          </div>
          <UButton type="button" color="error" variant="ghost" @click="revokeTarget = token"
            >Revoke</UButton
          >
        </li>
      </ul>
      <div
        v-if="revokeTarget"
        role="alertdialog"
        aria-label="Confirm revocation"
        class="mt-4 rounded-lg border border-[var(--danger)] p-3"
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
  </UModal>
</template>
