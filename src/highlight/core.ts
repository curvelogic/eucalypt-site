/**
 * Tree-sitter highlighting for eucalypt, independent of the browser.
 *
 * The grammar WASM and `highlights.scm` come from the pinned eucalypt
 * revision (scripts/vendor-eucalypt.sh). Highlights are resolved to
 * non-overlapping spans the way eucalypt's own consumers resolve them
 * (editors/tree-sitter-eucalypt/web/index.html and
 * scripts/check-highlighting-consistency.js): an inner capture overrides an
 * enclosing one and, of two captures of the same extent, the later pattern
 * wins. The tests check the result against `cargo xtask highlight-html`.
 */

import type Parser from "web-tree-sitter";

/** A highlighted range of the source, in UTF-16 code units. */
export interface Span {
  from: number;
  to: number;
  /** The capture name, e.g. `string.escape`. */
  name: string;
}

/**
 * The CSS classes for a capture, one per level of its dotted name, as
 * `xtask highlight-html` writes them: `string.escape` gives
 * `ts-string ts-string-escape`, so a name without a rule of its own falls
 * back to its parent's colour.
 */
export function classesOf(name: string): string {
  const parts = name.split(".");
  return parts.map((_, i) => "ts-" + parts.slice(0, i + 1).join("-")).join(" ");
}

interface Capture {
  name: string;
  pattern: number;
  start: number;
  end: number;
}

/** Resolve query matches to ordered, non-overlapping, non-empty spans. */
export function resolveSpans(length: number, matches: Parser.QueryMatch[]): Span[] {
  const captures: Capture[] = matches.flatMap(({ pattern, captures }) =>
    captures
      .filter(({ name }) => !name.startsWith("_"))
      .map(({ name, node }) => ({ name, pattern, start: node.startIndex, end: node.endIndex })),
  );
  // Widest first; among equal extents, earlier patterns first, so that
  // narrower and later captures paint over them.
  captures.sort((a, b) => b.end - b.start - (a.end - a.start) || a.pattern - b.pattern);
  const paint: (string | null)[] = new Array(length).fill(null);
  for (const c of captures) paint.fill(c.name, c.start, Math.min(c.end, length));
  const spans: Span[] = [];
  for (let i = 0; i < length; ) {
    let j = i + 1;
    while (j < length && paint[j] === paint[i]) j++;
    const name = paint[i];
    if (name !== null) spans.push({ from: i, to: j, name });
    i = j;
  }
  return spans;
}

/** A parser and query ready to highlight eucalypt source. */
export class EuHighlighter {
  private readonly parser: Parser;

  constructor(
    ParserClass: typeof Parser,
    language: Parser.Language,
    private readonly query: Parser.Query,
  ) {
    this.parser = new ParserClass();
    this.parser.setLanguage(language);
  }

  /** Load the grammar and query into an initialised `web-tree-sitter`. */
  static async create(
    ParserClass: typeof Parser,
    grammar: string | Uint8Array,
    highlightsScm: string,
  ): Promise<EuHighlighter> {
    const language = await ParserClass.Language.load(grammar);
    return new EuHighlighter(ParserClass, language, language.query(highlightsScm));
  }

  highlight(source: string): Span[] {
    const tree = this.parser.parse(source);
    try {
      return resolveSpans(source.length, this.query.matches(tree.rootNode));
    } finally {
      tree.delete();
    }
  }
}
