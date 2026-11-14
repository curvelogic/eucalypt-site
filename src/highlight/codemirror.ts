/** CodeMirror decorations driven by the tree-sitter highlighter. */

import { RangeSetBuilder, StateField, type Extension, type Text } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import { classesOf, type EuHighlighter } from "./core";

export function treeSitterHighlighting(highlighter: EuHighlighter): Extension {
  const marks = new Map<string, Decoration>();
  const mark = (name: string): Decoration => {
    let m = marks.get(name);
    if (!m) {
      m = Decoration.mark({ class: classesOf(name) });
      marks.set(name, m);
    }
    return m;
  };
  const decorate = (doc: Text): DecorationSet => {
    const builder = new RangeSetBuilder<Decoration>();
    for (const span of highlighter.highlight(doc.toString())) {
      builder.add(span.from, span.to, mark(span.name));
    }
    return builder.finish();
  };
  const field = StateField.define<DecorationSet>({
    create: (state) => decorate(state.doc),
    update: (value, tr) => (tr.docChanged ? decorate(tr.newDoc) : value),
    provide: (f) => EditorView.decorations.from(f),
  });
  // The shared stylesheet's capture rules apply under `.eu`.
  return [field, EditorView.editorAttributes.of({ class: "eu" })];
}
