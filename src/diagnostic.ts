/**
 * A failing unit's diagnostic, laid out as the command line lays it out:
 * the message, then the source line with the span underlined. Shared by
 * the build (src/site/engine.ts) and the live hero (src/site/hero.ts), so
 * an error reads the same before and after the engine loads.
 */
import type { EvalResult } from "./evaluator";

export function formatDiagnostic(error: NonNullable<EvalResult["error"]>, file: string, source: string): string {
  const { message, location } = error;
  const [first, ...rest] = message.split("\n");
  const lines = [`error: ${first}`, ...rest];
  if (location) {
    const n = String(location.line);
    const pad = " ".repeat(n.length);
    const text = source.split("\n")[location.line - 1] ?? "";
    const width = location.end_line === location.line ? Math.max(1, location.end_column - location.column) : 1;
    lines.push(
      `${pad} ┌─ ${file}:${location.line}:${location.column}`,
      `${pad} │`,
      `${n} │ ${text}`,
      `${pad} │ ${" ".repeat(location.column - 1)}${"^".repeat(width)}`,
    );
  }
  return lines.join("\n");
}
