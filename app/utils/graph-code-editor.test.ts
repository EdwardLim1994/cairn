import { CompletionContext } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vite-plus/test";
import { graphCodeCompletions } from "./graph-code-editor";

describe("graphCodeCompletions", () => {
  it("suggests values only inside fixed enum fields", () => {
    const doc = '{"framework": "Spr';
    const context = new CompletionContext(EditorState.create({ doc }), doc.length, true);
    expect(graphCodeCompletions(context)?.options.map(({ label }) => label)).toEqual([
      "Spring Boot",
      ".NET",
      "Other",
    ]);

    const otherDoc = '{"name": "Ord';
    const other = new CompletionContext(
      EditorState.create({ doc: otherDoc }),
      otherDoc.length,
      true,
    );
    expect(graphCodeCompletions(other)).toBeNull();
  });
});
