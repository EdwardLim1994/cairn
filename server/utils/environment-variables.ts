import { createError } from "h3";
import { record } from "./graph-validation";

const variableName = /^[A-Za-z_]\w*$/;
const variableReference = /\{\{([A-Za-z_]\w*)\}\}/g;

export function environmentVariableInput(value: unknown) {
  const input = record(value, "Environment variable");
  if (typeof input.name !== "string" || !variableName.test(input.name) || input.name.length > 255) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "Variable name must start with a letter or underscore and contain only letters, numbers, or underscores",
    });
  }
  if (typeof input.value !== "string")
    throw createError({ statusCode: 400, statusMessage: "Variable value must be text" });

  return { name: input.name, value: input.value };
}

export function resolveJsonVariables(value: unknown, variables: Map<string, string>): unknown {
  if (typeof value === "string") {
    const wholeReference = /^\{\{([A-Za-z_]\w*)\}\}$/.exec(value);
    if (wholeReference) return getVariable(wholeReference[1]!, variables);

    return value.replace(variableReference, (_, name: string) => {
      const replacement = getVariable(name, variables);
      return replacement;
    });
  }
  if (Array.isArray(value)) return value.map((item) => resolveJsonVariables(item, variables));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, resolveJsonVariables(item, variables)]),
    );
  return value;
}

function getVariable(name: string, variables: Map<string, string>) {
  if (!variables.has(name)) throw new Error(`Undefined environment variable: ${name}`);
  return variables.get(name)!;
}
