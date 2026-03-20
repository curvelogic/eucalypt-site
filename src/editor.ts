/**
 * CodeMirror 6 editor setup for Eucalypt source.
 */

import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import {
  defaultKeymap,
  historyKeymap,
  history,
  indentWithTab,
} from "@codemirror/commands";
import { indentOnInput, syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";

export function createEditor(
  container: HTMLElement,
  initialDoc: string,
  onRun: () => void
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
      syntaxHighlighting(defaultHighlightStyle),
      oneDark,
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      runKeymap,
      EditorView.theme({
        "&": { height: "100%" },
        ".cm-scroller": { overflow: "auto", fontFamily: "monospace", fontSize: "14px" },
        ".cm-content": { padding: "12px 0" },
      }),
    ],
  });

  return new EditorView({ state, parent: container });
}
