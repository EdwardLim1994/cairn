import type { CompletionContext } from "@codemirror/autocomplete";

export function graphCodeCompletions(context: CompletionContext) {
  const before = context.state.doc.sliceString(0, context.pos);
  const match = before.match(/"(framework|apiType|method)"\s*:\s*"([^"]*)$/);
  if (!match) return null;
  const values =
    match[1] === "framework"
      ? ["Spring Boot", ".NET", "Other"]
      : match[1] === "apiType"
        ? ["REST"]
        : ["GET", "POST", "PUT", "PATCH", "DELETE"];
  return {
    from: context.pos - match[2]!.length,
    options: values.map((label) => ({ label, type: "enum" })),
    validFor: /^[\w .-]*$/,
  };
}
