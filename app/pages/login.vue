<script setup lang="ts">
import { ref } from "vue";
import { safeLocalReturnPath } from "../utils/auth-redirect";

const route = useRoute();
const username = ref("");
const password = ref("");
const error = ref("");
const loading = ref(false);

async function signIn() {
  error.value = "";
  loading.value = true;
  try {
    await $fetch("/api/auth/login", {
      method: "POST",
      body: { username: username.value, password: password.value },
    });
    await navigateTo(safeLocalReturnPath(route.query.returnTo));
  } catch {
    error.value = "Username or password is incorrect.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="grid min-h-screen place-items-center bg-neutral-50 p-6 dark:bg-neutral-950">
    <UCard class="w-full max-w-sm">
      <template #header>
        <h1 class="text-xl font-semibold">Sign in to Cairn</h1>
      </template>
      <form class="space-y-4" @submit.prevent="signIn">
        <label class="block space-y-1 text-sm font-medium" for="username">
          <span>Username</span>
          <UInput
            id="username"
            name="username"
            v-model="username"
            aria-label="Username"
            autocomplete="username"
            required
          />
        </label>
        <label class="block space-y-1 text-sm font-medium" for="password">
          <span>Password</span>
          <UInput
            id="password"
            name="password"
            v-model="password"
            aria-label="Password"
            type="password"
            autocomplete="current-password"
            required
          />
        </label>
        <p v-if="error" role="alert" class="text-sm text-error">{{ error }}</p>
        <UButton class="w-full justify-center" type="submit" :loading="loading"> Sign in </UButton>
      </form>
    </UCard>
  </main>
</template>
