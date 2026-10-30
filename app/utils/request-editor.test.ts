// @vitest-environment happy-dom
import { CompletionContext } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vite-plus/test";
import { variableCompletions, variablePlaceholderExtension } from "./request-editor";

describe("request editor completions", () => {
  it("completes shared variable references at the cursor", () => {
    const context = new CompletionContext(EditorState.create({ doc: "{{TO" }), 4, false);
    expect(variableCompletions(context, [{ name: "TOKEN" }, { name: "TRACE_ID" }])).toEqual({
      from: 0,
      options: [
        { label: "{{TOKEN}}", apply: "{{TOKEN}}" },
        { label: "{{TRACE_ID}}", apply: "{{TRACE_ID}}" },
      ],
    });
  });

  it("offers completions explicitly when no variable prefix is present", () => {
    const context = new CompletionContext(EditorState.create({ doc: "request" }), 7, false);
    expect(variableCompletions(context, [{ name: "TOKEN" }])).toBeNull();
    const explicit = new CompletionContext(EditorState.create({ doc: "request" }), 7, true);
    expect(variableCompletions(explicit, [{ name: "TOKEN" }])?.from).toBe(7);
  });

  it("highlights variable tokens and recalculates decorations after document edits", () => {
    const view = new EditorView({
      parent: document.createElement("div"),
      state: EditorState.create({
        doc: "hello {{TOKEN}}",
        extensions: [variablePlaceholderExtension],
      }),
    });
    const plugin = view.plugin(variablePlaceholderExtension);
    expect(plugin?.decorations.size).toBe(1);
    view.dispatch({ changes: { from: 0, to: 5, insert: "{{A}} {{B}}" } });
    expect(plugin?.decorations.size).toBe(3);
    view.destroy();
  });
});
