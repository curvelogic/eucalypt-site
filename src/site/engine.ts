/**
 * The eucalypt engine at build time: the same WASM build the playground
 * runs, evaluated in Node while the site is built. The homepage's hero, tour
 * and pillar outputs come from here, so they cannot show output the engine
 * does not produce, and an example that stops running fails the build. (The
 * command-line snippets in src/site/examples.ts carry what `eu` printed.)
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { EvalResult } from "../evaluator";
import { encodeState } from "../share";

type Engine = typeof import("../../vendor/engine/eucalypt.js");

let engine: Promise<Engine> | null = null;

function load(): Promise<Engine> {
  engine ??= (async () => {
    const mod = await import("../../vendor/engine/eucalypt.js");
    await mod.default({ module_or_path: readFileSync(join(process.cwd(), "vendor/engine/eucalypt_bg.wasm")) });
    return mod;
  })();
  return engine;
}

export type Format = "yaml" | "json" | "toml";

/** Evaluate a unit and return the engine's result envelope. */
export async function evaluate(source: string, format: Format): Promise<EvalResult> {
  const mod = await load();
  return JSON.parse(mod.evaluate(source, format)) as EvalResult;
}

/** Evaluate a unit that must succeed; fail the build otherwise. */
export async function output(name: string, source: string, format: Format): Promise<string> {
  const result = await evaluate(source, format);
  if (!result.success || result.output === undefined) {
    throw new Error(`example "${name}" failed to evaluate as ${format}: ${result.error?.message}`);
  }
  return result.output.replace(/\n+$/, "");
}

/**
 * A failing unit's diagnostic, laid out as the CLI lays it out: the message,
 * then the source line with the span underlined. Fails the build if the
 * unit evaluates.
 */
export async function diagnostic(name: string, file: string, source: string): Promise<string> {
  const result = await evaluate(source, "yaml");
  if (result.success || !result.error) throw new Error(`example "${name}" was meant to fail, but evaluated`);
  const { message, location } = result.error;
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

/** A link that opens `source` in the playground. */
export async function playLink(source: string, format: Format = "yaml"): Promise<string> {
  return `/play/#${await encodeState({ source, format, mode: "unit" })}`;
}
