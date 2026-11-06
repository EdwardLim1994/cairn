import type { CompletionContext } from "@codemirror/autocomplete";

export function graphCodeCompletions(context: CompletionContext) {
  const before = context.state.doc.sliceString(0, context.pos);
  const match = /"(framework|apiType|method)"\s*:\s*"([^"]*)$/.exec(before);
  if (!match) return null;
  const values =
    {
      framework: ["Spring Boot", ".NET", "Other"],
      apiType: ["REST", "GRPC"],
      method: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    }[match[1]!] ?? [];
  return {
    from: context.pos - match[2]!.length,
    options: values.map((label) => ({ label, type: "enum" })),
    validFor: /^[\w .-]*$/,
  };
}
