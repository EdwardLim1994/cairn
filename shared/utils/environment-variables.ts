const variableReference = /\{\{([A-Za-z_]\w*)\}\}/g;

export function resolveJsonVariables(value: unknown, variables: Map<string, string>): unknown {
  if (typeof value === "string") return resolveStringVariables(value, variables);
  if (Array.isArray(value)) return value.map((item) => resolveJsonVariables(item, variables));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, resolveJsonVariables(item, variables)]),
    );
  return value;
}

export function resolveStringVariables(value: string, variables: Map<string, string>) {
  return value.replace(variableReference, (_, name: string) => getVariable(name, variables));
}

export function findVariableReferences(value: unknown): string[] {
  if (typeof value === "string")
    return [...value.matchAll(variableReference)].map((match) => match[1]!);
  if (Array.isArray(value)) return value.flatMap(findVariableReferences);
  if (value && typeof value === "object")
    return Object.values(value).flatMap(findVariableReferences);
  return [];
}

function getVariable(name: string, variables: Map<string, string>) {
  if (!variables.has(name)) throw new Error(`Undefined environment variable: ${name}`);
  return variables.get(name)!;
}
