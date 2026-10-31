import type { CompletionContext } from "@codemirror/autocomplete";
import { Decoration, EditorView, ViewPlugin, type DecorationSet } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

export function variableCompletions(
  context: CompletionContext,
  variables: Array<{ name: string }>,
) {
  const match = context.matchBefore(/\{\{\w*$/);
  if (!match && !context.explicit) return null;
  return {
    from: match?.from ?? context.pos,
    options: variables.map(({ name }) => ({ label: `{{${name}}}`, apply: `{{${name}}}` })),
  };
}

const placeholderMark = Decoration.mark({ class: "cm-variable-placeholder" });

export const variablePlaceholderExtension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = this.find(view);
    }
    update(update: { docChanged: boolean; viewportChanged: boolean; view: EditorView }) {
      if (update.docChanged || update.viewportChanged) this.decorations = this.find(update.view);
    }
    find(view: EditorView) {
      const builder = new RangeSetBuilder<Decoration>();
      const text = view.state.doc.toString();
      for (const match of text.matchAll(/\{\{[A-Za-z_]\w*\}\}/g))
        builder.add(match.index!, match.index! + match[0].length, placeholderMark);
      return builder.finish();
    }
  },
  { decorations: (plugin) => plugin.decorations },
);
