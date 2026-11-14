import { migrateColorMode } from "../shared/lib";

export default defineNuxtPlugin((nuxtApp) => {
  const colorMode = useColorMode();
  const legacy = useCookie<boolean | null>("cairn-dark-mode", { default: () => null });
  nuxtApp.hook("app:mounted", () => {
    // Keep this key aligned with nuxt.config.ts.
    let preference;
    try {
      preference = migrateColorMode(legacy.value, window.localStorage, "nuxt-color-mode");
    } catch {
      // Browser storage can be disabled; Nuxt's current mode remains usable.
      return;
    }
    if (preference) {
      colorMode.preference = preference;
      legacy.value = null;
    }
  });
});
