// The output pane's languages: which formats are highlighted, and which
// tags their tokens get, so the one style colours YAML, JSON and TOML alike.
import { describe, expect, it } from "vitest";
import { highlightTree, tagHighlighter, tags } from "@lezer/highlight";
import { outputLanguage } from "../src/output";

const classes = tagHighlighter([
  { tag: tags.propertyName, class: "key" },
  { tag: tags.string, class: "string" },
  { tag: [tags.number, tags.bool], class: "num" },
  { tag: [tags.comment, tags.contentSeparator], class: "comment" },
]);

/** Each highlighted run of the text, as [text, class]. */
function runs(format: string, text: string): [string, string][] {
  const language = outputLanguage(format)!;
  const tree = language.parser.parse(text);
  const out: [string, string][] = [];
  highlightTree(tree, classes, (from, to, cls) => out.push([text.slice(from, to).trim(), cls]));
  return out;
}

describe("outputLanguage", () => {
  it("highlights YAML, JSON and TOML only", () => {
    for (const f of ["yaml", "json", "toml"]) expect(outputLanguage(f)).not.toBeNull();
    for (const f of ["text", "edn", "html", "constructor", ""]) expect(outputLanguage(f)).toBeNull();
  });

  it("colours YAML keys, numbers, quoted strings and the document marker", () => {
    const r = runs("yaml", '---\nservice:\n  name: "web-0"\n  port: 8080\n  live: true');
    expect(r).toContainEqual(["---", "comment"]);
    expect(r).toContainEqual(["service", "key"]);
    expect(r).toContainEqual(["name", "key"]);
    expect(r).toContainEqual(['"web-0"', "string"]);
    expect(r).toContainEqual(["8080", "num"]);
    expect(r).toContainEqual(["true", "num"]);
  });

  it("colours JSON keys apart from string values", () => {
    const r = runs("json", '{\n  "name": "web-0",\n  "port": 8080,\n  "live": true\n}');
    expect(r).toContainEqual(['"name"', "key"]);
    expect(r).toContainEqual(['"web-0"', "string"]);
    expect(r).toContainEqual(["8080", "num"]);
    expect(r).toContainEqual(["true", "num"]);
  });

  it("colours TOML tables and keys as keys, values by kind", () => {
    const r = runs("toml", '[[services]]\nname = "web-0"\nport = 8080\nlive = true');
    expect(r).toContainEqual(["[[services]]", "key"]);
    expect(r).toContainEqual(["name", "key"]);
    expect(r).toContainEqual(['"web-0"', "string"]);
    expect(r).toContainEqual(["8080", "num"]);
    expect(r).toContainEqual(["true", "num"]);
  });
});
