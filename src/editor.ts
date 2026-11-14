/**
 * CodeMirror 6 setup for eucalypt source: an editor for playground code
 * and a read-only viewer for files linked from repositories.
 */

import { EditorState, StateEffect, StateField, RangeSetBuilder, type Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  type DecorationSet,
} from "@codemirror/view";
import { defaultKeymap, historyKeymap, history, indentWithTab } from "@codemirror/commands";
import { indentOnInput } from "@codemirror/language";
import { oneDarkTheme } from "@codemirror/theme-one-dark";
import type { EuHighlighter } from "./highlight/core";
import { treeSitterHighlighting } from "./highlight/codemirror";
import type { LineRange } from "./github";

/** One Dark's chrome, with the text colours of the shared stylesheet. */
const baseTheme: Extension = [
  oneDarkTheme,
  EditorView.theme({
    "&": { height: "100%", backgroundColor: "var(--eu-bg)", color: "var(--eu-fg)" },
    ".cm-gutters": { backgroundColor: "var(--eu-bg)" },
    ".cm-scroller": { overflow: "auto", fontFamily: "monospace", fontSize: "14px" },
    ".cm-content": { padding: "12px 0" },
  }),
];

export function createEditor(
  container: HTMLElement,
  initialDoc: string,
  highlighter: EuHighlighter,
  onRun: () => void,
): EditorView {
  const runKeymap = keymap.of([
    {
      key: "Ctrl-Enter",
      mac: "Cmd-Enter",
      run: () => {
        onRun();
        return true;
      },
    },
  ]);

  const state = EditorState.create({
    doc: initialDoc,
    extensions: [
      history(),
      lineNumbers(),
      highlightActiveLine(),
      indentOnInput(),
      treeSitterHighlighting(highlighter),
      baseTheme,
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      runKeymap,
    ],
  });

  return new EditorView({ state, parent: container });
}

/** Set the lines picked out in a viewer, or none. */
export const setPickedLines = StateEffect.define<LineRange | null>();

const pickedLine = Decoration.line({ class: "cm-picked-line" });

const pickedLines = StateField.define<LineRange | null>({
  create: () => null,
  update: (value, tr) => {
    for (const e of tr.effects) if (e.is(setPickedLines)) return e.value;
    return value;
  },
  provide: (f) =>
    EditorView.decorations.compute([f], (state): DecorationSet => {
      const range = state.field(f);
      const builder = new RangeSetBuilder<Decoration>();
      if (range) {
        const last = Math.min(range.end, state.doc.lines);
        for (let n = range.start; n <= last; n++) builder.add(state.doc.line(n).from, state.doc.line(n).from, pickedLine);
      }
      return builder.finish();
    }),
});

/**
 * A read-only, highlighted view of a file. Clicking a line number picks
 * that line; shift-click extends the pick to a range.
 */
export function createViewer(
  container: HTMLElement,
  doc: string,
  highlighter: EuHighlighter,
  lines: LineRange | null,
  onPick: (lines: LineRange) => void,
): EditorView {
  let current = lines;
  const state = EditorState.create({
    doc,
    extensions: [
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      lineNumbers({
        domEventHandlers: {
          mousedown(view, block, event) {
            const n = view.state.doc.lineAt(block.from).number;
            const shift = (event as MouseEvent).shiftKey && current;
            const next = shift
              ? { start: Math.min(current!.start, n), end: Math.max(current!.start, n) }
              : { start: n, end: n };
            current = next;
            view.dispatch({ effects: setPickedLines.of(next) });
            onPick(next);
            return true;
          },
        },
      }),
      pickedLines.init(() => lines),
      treeSitterHighlighting(highlighter),
      baseTheme,
    ],
  });
  const view = new EditorView({ state, parent: container });
  if (lines && lines.start <= view.state.doc.lines) {
    view.dispatch({
      effects: EditorView.scrollIntoView(view.state.doc.line(lines.start).from, { y: "center" }),
    });
  }
  return view;
}
