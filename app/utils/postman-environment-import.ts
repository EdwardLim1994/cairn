type EnvironmentVariableDraft = { name: string; value: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function parsePostmanEnvironment(text: string, existingNames: Iterable<string> = []) {
  const document: unknown = JSON.parse(text);
  if (!isRecord(document) || !Array.isArray(document.values))
    throw new Error("This is not a Postman environment");

  const names = new Set(existingNames);
  const variables: EnvironmentVariableDraft[] = [];
  const warnings: string[] = [];
  for (const entry of document.values) {
    if (!isRecord(entry) || entry.enabled === false) continue;
    const name = entry.key;
    if (typeof name !== "string" || !/^[A-Za-z_]\w{0,254}$/.test(name)) {
      warnings.push("Skipped an environment variable with an invalid name.");
      continue;
    }
    if (names.has(name)) {
      warnings.push(`Skipped duplicate environment variable "${name}".`);
      continue;
    }
    const value = entry.value;
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      warnings.push(`Skipped "${name}": only string, number, and boolean values are supported.`);
      continue;
    }
    names.add(name);
    variables.push({ name, value: String(value) });
  }
  return { variables, warnings };
}
