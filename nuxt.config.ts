// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  runtimeConfig: {
    public: {
      projectId: process.env.PROJECT_ID ?? "",
    },
  },
  modules: ["@pinia/nuxt", "@nuxt/ui"],
  nitro: { ignore: ["modules/**"] },
  vite: {
    build: { chunkSizeWarningLimit: 700 },
    plugins: [tailwindcss()],
  },
});
