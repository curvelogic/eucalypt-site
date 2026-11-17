/**
 * A live eucalypt editor for any page: the playground's editor
 * (src/editor.ts) and engine (src/evaluator.ts), mounted in place over a
 * pre-rendered block. It re-evaluates as the source changes, and at once on
 * Ctrl/Cmd+Enter or run().
 *
 * Pages load this with a dynamic import() when a reader asks for it, so a
 * page that never runs code never fetches the engine.
 */
import "../vendor/highlight.css";
import { EditorView } from "@codemirror/view";
import { StateEffect } from "@codemirror/state";
import { createEditor } from "./editor";
import { initEvaluator, run as runUnit, runExpr, type EvalResult } from "./evaluator";
import { loadHighlighter } from "./highlight/browser";
import type { EuHighlighter } from "./highlight/core";

export type { EvalResult };

export interface LiveOptions {
  source: string;
  format: string;
  mode?: "unit" | "expr";
  /** Called with each result, and the source it came from. */
  onOutput: (result: EvalResult, source: string) => void;
  /** Milliseconds to wait after an edit before evaluating. */
  delay?: number;
  /** Wrap long lines instead of scrolling sideways. */
  wrap?: boolean;
}

export interface LiveEditor {
  view: EditorView;
  source(): string;
  /** Evaluate now. */
  run(): void;
  /** Change the output format and evaluate. */
  setFormat(format: string): void;
  destroy(): void;
}

let engine: Promise<void> | null = null;
let highlighter: Promise<EuHighlighter | null> | null = null;

/** Start loading the engine and highlighter, e.g. on idle; safe to call often. */
export function preload(): Promise<unknown> {
  engine ??= initEvaluator();
  // Highlighting is a nicety: without it the editor still works.
  highlighter ??= loadHighlighter().catch(() => null);
  return Promise.all([engine, highlighter]);
}

/** Replace the contents of `container` with a live editor over `source`. */
export async function mountLiveEditor(container: HTMLElement, options: LiveOptions): Promise<LiveEditor> {
  await preload();
  const hl = await highlighter!;
  let format = options.format;
  const mode = options.mode ?? "unit";
  let timer: ReturnType<typeof setTimeout> | undefined;

  const evaluate = () => {
    clearTimeout(timer);
    const source = view.state.doc.toString();
    let result: EvalResult;
    try {
      result = mode === "expr" ? runExpr(source, format) : runUnit(source, format);
    } catch (e) {
      result = { success: false, error: { message: String(e) } };
    }
    options.onOutput(result, source);
  };

  container.replaceChildren();
  const view = createEditor(container, options.source, hl, evaluate);
  view.dispatch({
    effects: StateEffect.appendConfig.of([
      EditorView.updateListener.of((u) => {
        if (!u.docChanged) return;
        clearTimeout(timer);
        timer = setTimeout(evaluate, options.delay ?? 300);
      }),
      options.wrap ? EditorView.lineWrapping : [],
    ]),
  });

  return {
    view,
    source: () => view.state.doc.toString(),
    run: evaluate,
    setFormat(f) {
      format = f;
      evaluate();
    },
    destroy() {
      clearTimeout(timer);
      view.destroy();
    },
  };
}
