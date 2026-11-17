/**
 * The playground's output pane: a read-only CodeMirror view, coloured for
 * YAML, JSON or TOML according to the format the output was rendered in,
 * with the Ghost Gum syntax tokens (--gg-sx-*), so it follows the site's
 * light or dark theme. Text, EDN and HTML output stay plain.
 */

import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { HighlightStyle, StreamLanguage, syntaxHighlighting, type StreamParser } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { yaml } from "@codemirror/legacy-modes/mode/yaml";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import { json } from "@codemirror/legacy-modes/mode/javascript";

/**
 * The legacy modes name their tokens differently (a YAML key is an "atom",
 * a JSON key a "string property", a TOML table header an "atom" like
 * `true`), so each mode's tokens are renamed to the same few names here,
 * and one style colours all three. StreamLanguage looks its own names up
 * before a tokenTable, so the new names must not be any of its own.
 */
const NAMES = {
  key: tags.propertyName,
  str: tags.string,
  num: tags.number,
  lit: tags.bool,
  doc: tags.contentSeparator,
  note: tags.comment,
  mark: tags.labelName,
  punct: tags.punctuation,
};
type Name = keyof typeof NAMES;

function retag<S>(
  parser: StreamParser<S>,
  rename: (style: string, text: string) => Name | null,
): StreamLanguage<S> {
  return StreamLanguage.define<S>({
    ...parser,
    token(stream, state) {
      const start = stream.pos;
      const style = parser.token(stream, state);
      return style ? `gg-${rename(style, stream.string.slice(start, stream.pos)) ?? "plain"}` : null;
    },
    tokenTable: Object.fromEntries(Object.entries(NAMES).map(([n, tag]) => [`gg-${n}`, tag])),
  });
}

const LANGUAGES = {
  yaml: retag(yaml, (style) =>
    ({ atom: "key", string: "str", number: "num", keyword: "lit", def: "doc", comment: "note", variable: "mark", meta: "punct" } as const)[
      style
    ] ?? null,
  ),
  json: retag(json, (style) =>
    style.includes("property") ? "key" : style === "string" ? "str" : style === "number" ? "num" : style === "atom" ? "lit" : null,
  ),
  toml: retag(toml, (style, text) =>
    style === "atom"
      ? text.startsWith("[") ? "key" : "lit"
      : ({ property: "key", string: "str", number: "num", comment: "note", bracket: "punct" } as const)[style] ?? null,
  ),
};

export type HighlightedFormat = keyof typeof LANGUAGES;

/** The language for an output format, or null for one shown plain. */
export function outputLanguage(format: string): StreamLanguage<unknown> | null {
  return Object.prototype.hasOwnProperty.call(LANGUAGES, format) ? LANGUAGES[format as HighlightedFormat] : null;
}

export const outputHighlightStyle = HighlightStyle.define([
  { tag: tags.propertyName, color: "var(--gg-sx-key)" },
  { tag: tags.string, color: "var(--gg-sx-string)" },
  { tag: [tags.number, tags.bool], color: "var(--gg-sx-num)" },
  { tag: [tags.comment, tags.contentSeparator], color: "var(--gg-sx-comment)" },
  { tag: tags.labelName, color: "var(--gg-sx-meta)" },
  { tag: tags.punctuation, color: "var(--gg-sx-op)" },
]);

const outputTheme: Extension = EditorView.theme({
  "&": { height: "100%", backgroundColor: "transparent", color: "var(--gg-ink)" },
  ".cm-content": { padding: "14px 0", caretColor: "transparent" },
  ".cm-line": { padding: "0 14px" },
  "&.cm-focused": { outline: "none" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
    { backgroundColor: "color-mix(in srgb, var(--gg-leaf) 24%, transparent)" },
  ".cm-scroller": { overflow: "auto", fontFamily: "var(--gg-mono)", fontSize: "13px", lineHeight: "1.6" },
});

export interface OutputView {
  view: EditorView;
  /** Show text rendered in the given format, highlighted if it is YAML, JSON or TOML. */
  show(text: string, format: string): void;
}

export function createOutputView(container: HTMLElement): OutputView {
  const language = new Compartment();
  const view = new EditorView({
    parent: container,
    state: EditorState.create({
      extensions: [
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ "aria-label": "Output", tabindex: "0" }),
        language.of([]),
        syntaxHighlighting(outputHighlightStyle),
        outputTheme,
      ],
    }),
  });
  return {
    view,
    show(text, format) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
        effects: language.reconfigure(outputLanguage(format) ?? []),
      });
    },
  };
}
