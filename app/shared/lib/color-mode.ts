export function migrateColorMode(
  legacy: unknown,
  storage: Pick<Storage, "getItem" | "setItem">,
  key: string,
): "light" | "dark" | "system" | undefined {
  try {
    const existing = storage.getItem(key);
    if (existing === "light" || existing === "dark" || existing === "system") return existing;
    const preference = legacy === true ? "dark" : legacy === false ? "light" : "system";
    storage.setItem(key, preference);
    return preference;
  } catch {
    return undefined;
  }
}
