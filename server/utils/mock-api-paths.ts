import { resolveJsonVariables } from "./environment-variables";

export function resolveEndpointPath(
  route: string,
  parameters: Record<string, string>,
  variables: Map<string, string>,
) {
  return route.replace(
    /\{([A-Za-z_][\w-]*)(?::[^{}]+)?\}|:([A-Za-z_][\w-]*)/g,
    (token, curlyName: string | undefined, colonName: string | undefined) => {
      const name = curlyName ?? colonName!;
      if (!(name in parameters)) throw new Error(`Path parameter "${name}" has no saved value`);
      const resolved = resolveJsonVariables(parameters[name], variables);
      if (resolved === null || !["string", "number", "boolean"].includes(typeof resolved))
        throw new Error(`Path parameter "${name}" must resolve to a scalar value`);
      const text =
        typeof resolved === "string"
          ? resolved
          : typeof resolved === "number"
            ? resolved.toString()
            : resolved
              ? "true"
              : "false";
      return encodeURIComponent(text);
    },
  );
}
