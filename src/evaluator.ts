/**
 * Eucalypt WASM evaluator wrapper.
 *
 * Loads the wasm-bindgen package and exposes `run()` and `getFormats()`.
 */

export interface EvalResult {
  success: boolean;
  output?: string;
  error?: {
    message: string;
    location?: {
      line: number;
      column: number;
      end_line: number;
      end_column: number;
    };
    notes?: string[];
  };
}

let evaluateFn: ((source: string, format: string) => string) | null = null;
let formatsFn: (() => string) | null = null;

export async function initEvaluator(): Promise<void> {
  const mod = await import("../pkg/eucalypt.js");
  await mod.default();
  evaluateFn = mod.evaluate;
  formatsFn = mod.formats;
}

export function run(source: string, format: string): EvalResult {
  if (!evaluateFn) throw new Error("Evaluator not initialised");
  const json = evaluateFn(source, format);
  return JSON.parse(json) as EvalResult;
}

export function getFormats(): string[] {
  if (!formatsFn) return ["yaml", "json", "toml", "text", "edn", "html"];
  return JSON.parse(formatsFn()) as string[];
}
