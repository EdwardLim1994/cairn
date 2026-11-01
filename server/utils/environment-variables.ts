import { createError } from "h3";
import { record } from "./graph-validation";
import { findVariableReferences } from "#shared/utils/environment-variables";

const variableName = /^[A-Za-z_]\w*$/;

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

export function missingVariableNames(value: unknown, variables: Map<string, string>) {
  return [...new Set(findVariableReferences(value).filter((name) => !variables.has(name)))];
}
