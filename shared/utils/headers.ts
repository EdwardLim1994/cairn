import { resolveStringVariables } from "./environment-variables";

export type HeaderRow = { name: string; value: string };

export function validateHeaderRows(rows: HeaderRow[], label = "Header") {
  const names = new Set<string>();
  for (const row of rows) {
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(row.name))
      throw new Error(`${label} name is invalid`);
    if (row.name.length > 255 || row.value.length > 8192)
      throw new Error(`${label} "${row.name}" is too long`);
    const key = row.name.toLowerCase();
    if (key === "traceparent") throw new Error('Header "traceparent" is reserved');
    if (names.has(key)) throw new Error(`Duplicate ${label.toLowerCase()}: ${row.name}`);
    names.add(key);
    if (/[\r\n]/.test(row.value)) throw new Error(`${label} "${row.name}" contains a newline`);
  }
}

export function mergeHeaderRows(template: HeaderRow[], custom: HeaderRow[]) {
  validateHeaderRows(template, "Template header");
  validateHeaderRows(custom, "Custom header");
  const effective = new Map(template.map((row) => [row.name.toLowerCase(), row]));
  for (const row of custom) effective.set(row.name.toLowerCase(), row);
  return [...effective.values()];
}

export function resolveHeaderRows(
  template: HeaderRow[],
  custom: HeaderRow[],
  variables: Map<string, string>,
) {
  const rows = mergeHeaderRows(template, custom).map(({ name, value }) => ({
    name,
    value: resolveStringVariables(value, variables),
  }));
  validateHeaderRows(rows);
  return Object.fromEntries(rows.map(({ name, value }) => [name, value]));
}
