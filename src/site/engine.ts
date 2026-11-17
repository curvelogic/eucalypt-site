/**
 * The eucalypt engine at build time: the same WASM build the playground
 * runs, evaluated in Node while the site is built. The homepage's hero, tour
 * and pillar outputs come from here, so they cannot show output the engine
 * does not produce, and an example that stops running fails the build. (The
 * command-line snippets in src/site/examples.ts carry what `eu` printed.)
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { EvalResult } from "../evaluator";
import { formatDiagnostic } from "../diagnostic";
import { encodeState } from "../share";

type Engine = typeof import("../../vendor/engine/eucalypt.js");

let engine: Promise<Engine> | null = null;

/**
 * Node's own import(), out of Vite's reach. The docs plugin
 * (src/site/runnable.ts) is loaded with astro.config.mjs through a Vite
 * module runner that is closed before the pages render, so an import() it
 * rewrote would fail.
 */
const nativeImport = new Function("url", "return import(url)") as (url: string) => Promise<Engine>;

function load(): Promise<Engine> {
  engine ??= (async () => {
    const mod = await nativeImport(pathToFileURL(join(process.cwd(), "vendor/engine/eucalypt.js")).href);
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
  return formatDiagnostic(result.error, file, source);
}

/** A link that opens `source` in the playground. */
export async function playLink(source: string, format: Format = "yaml"): Promise<string> {
  return `/play/#${await encodeState({ source, format, mode: "unit" })}`;
}
