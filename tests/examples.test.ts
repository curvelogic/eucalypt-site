// The playground's example dropdown: every example runs in the engine the
// playground ships (vendor/engine, from scripts/vendor-eucalypt.sh), and the
// examples that teach a result produce it.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { EvalResult } from "../src/evaluator";
import { EXAMPLES } from "../src/examples";

type Engine = typeof import("../vendor/engine/eucalypt.js");
let engine: Engine;

beforeAll(async () => {
  engine = await import("../vendor/engine/eucalypt.js");
  await engine.default({ module_or_path: readFileSync(join(process.cwd(), "vendor/engine/eucalypt_bg.wasm")) });
});

function run(name: string): EvalResult {
  const example = EXAMPLES.find((e) => e.name === name);
  if (!example) throw new Error(`no example "${name}"`);
  const evaluate = example.mode === "expr" ? engine.evaluate_expr : engine.evaluate;
  return JSON.parse(evaluate(example.source, example.format)) as EvalResult;
}

/** The example's output as data, evaluated as JSON. */
function data(name: string): Record<string, unknown> {
  const example = EXAMPLES.find((e) => e.name === name)!;
  const result = JSON.parse(engine.evaluate(example.source, "json")) as EvalResult;
  expect(result.error?.message).toBeUndefined();
  return JSON.parse(result.output!);
}

describe("playground examples", () => {
  it("have unique names", () => {
    expect(new Set(EXAMPLES.map((e) => e.name)).size).toBe(EXAMPLES.length);
  });

  for (const { name } of EXAMPLES) {
    it(`"${name}" evaluates`, () => {
      const result = run(name);
      expect(result.error?.message).toBeUndefined();
      expect(result.success).toBe(true);
    });
  }

  it("separate top-level definitions with a blank line", () => {
    for (const { name, source, mode } of EXAMPLES) {
      if (mode === "expr") continue;
      const lines = source.split("\n");
      for (let n = 1; n < lines.length; n++) {
        // A line at the left margin opens a definition, or the doc string
        // or comment above one; closing brackets end the one before.
        const opens = /^[^\s}\]]/.test(lines[n]);
        // It must follow a blank line, or the doc string or comment it
        // belongs to.
        const prev = lines[n - 1];
        const ok = prev === "" || prev.startsWith("`") || prev.startsWith("#");
        expect(opens && !ok, `${name}, line ${n + 1}`).toBe(false);
      }
    }
  });

  it("Block Merging: catenation and merge are shallow, << and deep-merge deep", () => {
    const shallow = { name: "web", db: { host: "db.prod" } };
    const deep = { name: "web", db: { host: "db.prod", port: 5432 } };
    const out = data("Block Merging");
    expect(out["shallow-cat"]).toEqual(shallow);
    expect(out["shallow-fn"]).toEqual(shallow);
    expect(out["deep-op"]).toEqual(deep);
    expect(out["deep-fn"]).toEqual(deep);
  });

  it("Conditionals: then, if and cond", () => {
    const out = data("Conditionals");
    expect(out.weather).toBe("warm");
    expect(out.coat).toBe("light");
    expect(out.grades).toEqual(["A", "B", "F", "A", "C"]);
  });

  it("Map and Filter Pipelines", () => {
    const out = data("Map and Filter Pipelines");
    expect(out["odd-squares"]).toEqual([1, 9, 25, 49, 81]);
    expect(out.letters).toEqual(["a", "b", "c", "d"]);
    expect(out.total).toBe(400);
  });

  it("Lenses: view and over", () => {
    const out = data("Lenses");
    expect(out.host).toBe("localhost");
    expect(out.bumped).toEqual({ server: { db: { host: "localhost", port: 5433 } } });
    expect(out.moved).toEqual({ server: { db: { host: "db.prod", port: 5432 } } });
  });

  it("Monads: :for combinations and seeded :random rolls", () => {
    const out = data("Monads");
    expect(out.sizes).toEqual(["s-red", "s-blue", "m-red", "m-blue"]);
    expect(out.rolls).toEqual([2, 12]);
    expect(out).not.toHaveProperty("dice");
  });
});
