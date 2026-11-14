// The playground's highlighting against eucalypt's own HTML renderer
// (`cargo xtask highlight-html --fragment`), for every examples/aoc25
// file at the pinned revision. scripts/vendor-eucalypt.sh --fixtures
// writes the pairs into vendor/fixtures/.
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type ParserType from "web-tree-sitter";
import { EuHighlighter, classesOf, resolveSpans } from "../src/highlight/core";
import { fragmentClasses } from "../scripts/fragment-classes.mjs";

const require = createRequire(import.meta.url);
const Parser = require("web-tree-sitter") as typeof ParserType;
const vendor = join(__dirname, "..", "vendor");
const fixtures = join(vendor, "fixtures");

let highlighter: EuHighlighter;

beforeAll(async () => {
  await Parser.init();
  highlighter = await EuHighlighter.create(
    Parser,
    new Uint8Array(readFileSync(join(vendor, "tree-sitter", "tree-sitter-eucalypt.wasm"))),
    readFileSync(join(vendor, "tree-sitter", "highlights.scm"), "utf8"),
  );
});

describe("classesOf", () => {
  it("gives one class per level of the capture name", () => {
    expect(classesOf("comment")).toBe("ts-comment");
    expect(classesOf("string.escape")).toBe("ts-string ts-string-escape");
    expect(classesOf("a.b.c")).toBe("ts-a ts-a-b ts-a-b-c");
  });
});

describe("resolveSpans", () => {
  const node = (startIndex: number, endIndex: number) => ({ startIndex, endIndex }) as ParserType.SyntaxNode;
  const match = (pattern: number, name: string, start: number, end: number) => ({
    pattern,
    captures: [{ name, node: node(start, end) }],
  });

  it("lets an inner capture override an enclosing one", () => {
    const spans = resolveSpans(6, [match(1, "inner", 2, 4), match(0, "outer", 0, 6)]);
    expect(spans).toEqual([
      { from: 0, to: 2, name: "outer" },
      { from: 2, to: 4, name: "inner" },
      { from: 4, to: 6, name: "outer" },
    ]);
  });

  it("lets the later pattern win for the same extent", () => {
    expect(resolveSpans(3, [match(5, "later", 0, 3), match(2, "earlier", 0, 3)])).toEqual([
      { from: 0, to: 3, name: "later" },
    ]);
  });

  it("ignores @_ captures and leaves uncaptured text unspanned", () => {
    expect(resolveSpans(4, [match(0, "_internal", 0, 4), match(1, "x", 1, 2)])).toEqual([
      { from: 1, to: 2, name: "x" },
    ]);
  });
});

const files = readdirSync(fixtures).filter((f) => f.endsWith(".eu")).sort();

describe("highlighting matches xtask highlight-html", () => {
  it("has the aoc25 fixtures", () => {
    expect(files.length).toBeGreaterThanOrEqual(12);
  });

  it.each(files)("%s", (file) => {
    const source = readFileSync(join(fixtures, file), "utf8");
    const rendered = fragmentClasses(readFileSync(join(fixtures, file.replace(/\.eu$/, ".html")), "utf8"));
    expect(rendered.text).toBe(source.replace(/\n+$/, ""));
    const ours: (string | null)[] = new Array(source.length).fill(null);
    for (const s of highlighter.highlight(source)) ours.fill(classesOf(s.name), s.from, s.to);
    const lines = source.split("\n");
    const mismatches: string[] = [];
    for (let i = 0; i < rendered.text.length && mismatches.length < 10; i++) {
      if (source[i] === "\n" || ours[i] === rendered.classes[i]) continue;
      const before = source.slice(0, i);
      const line = before.split("\n").length;
      const col = i - before.lastIndexOf("\n");
      mismatches.push(`${line}:${col} '${source[i]}' ours=${ours[i]} xtask=${rendered.classes[i]} | ${lines[line - 1]}`);
    }
    expect(mismatches).toEqual([]);
  });
});
