/**
 * Runnable docs blocks: a Sätteri mdast plugin (Astro's Markdown
 * processor) that gives every ` ```eu ` fence (not `notest`) its output,
 * rendered at build time by the engine, a Run button and an "Open in the
 * playground" link. A fence the engine cannot render
 * fails the build, naming the page and the fence, so the docs test
 * themselves.
 *
 * scripts/import-docs.mjs has already marked `notest` every fence that
 * eucalypt's own doc tests do not run, so the runnable blocks are the
 * examples eucalypt's CI runs through `eu`. A few of those cannot run in the
 * browser engine; they are listed in BROWSER_CANNOT_RUN and shown as plain
 * code.
 *
 * The block is a wrapper around two ordinary code nodes, the source and its
 * output, so Expressive Code highlights both as it does any other block. The
 * browser side is src/site/run-blocks.ts.
 */
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { MdastPluginEntry } from "satteri";
import { evaluate, playLink } from "./engine";

/** Just enough of mdast and hast for this plugin. */
interface Node {
  type: string;
  children?: Node[];
  lang?: string | null;
  meta?: string | null;
  value?: string;
  data?: Record<string, unknown>;
}
interface Element {
  type: "element";
  tagName: string;
  properties: Record<string, unknown>;
  children: unknown[];
}

/**
 * Fences eucalypt tests with `eu` that the browser engine cannot run, by
 * page and a line the fence contains. Each must still match a fence that
 * fails in the browser, so the list cannot go stale unnoticed.
 */
const BROWSER_CANNOT_RUN: { page: string; contains: string; reason: string }[] = [
  {
    page: "docs/guide/command-line.md",
    contains: "io.env lookup(:PATH)",
    reason: "reads the PATH environment variable, which the browser does not have",
  },
  {
    page: "docs/guide/state-monad.md",
    contains: '{ import: "state.eu" }',
    reason: "imports state.eu, a library the browser engine does not bundle",
  },
  {
    page: "docs/guide/advent-of-code.md",
    contains: "dijkstra(moves, goal?, start): {",
    reason: "Dijkstra over a 141 × 141 grid takes more steps than the browser engine's step limit allows",
  },
  {
    page: "docs/guide/advent-of-code.md",
    contains: "the stones that stone `x` becomes in one step",
    reason: "75 blinks take more steps than the browser engine's step limit allows",
  },
];

/** The page in eucalypt a file was imported from, e.g. docs/guide/anaphora.md. */
function pageOf(fileURL: URL | undefined): string {
  const path = fileURL ? relative(process.cwd(), fileURLToPath(fileURL)) : "unknown page";
  return path.replace(/^src\/content\/docs\//, "");
}

const el = (tagName: string, properties: Record<string, unknown>, children: unknown[] = []): Element => ({
  type: "element",
  tagName,
  properties,
  children,
});
const text = (value: string) => ({ type: "text", value });

/** A node that renders as a `tag` with these properties around `children`. */
const wrap = (tag: string, properties: Record<string, unknown>, children: Node[]): Node => ({
  type: "paragraph",
  children,
  data: { hName: tag, hProperties: properties },
});
/** A node that renders as this element. */
const leaf = (hast: Element): Node => ({
  type: "paragraph",
  children: [],
  data: { hName: hast.tagName, hProperties: hast.properties, hChildren: hast.children },
});

/**
 * The header of a runnable block: its language, the link and the Run
 * button, which stays hidden until the page's script shows it.
 */
const header = (link: string): Node =>
  leaf(
    el("div", { className: ["gg-run-h"] }, [
      el("span", {}, [text("eu")]),
      el("span", { className: ["sp"] }),
      el("a", { href: link, dataRunLink: "" }, [text("Open in the playground ↗")]),
      el("button", { type: "button", className: ["gg-run-btn"], dataRunBtn: "", hidden: true }, [text("▶ Run")]),
    ]),
  );

/** The Sätteri mdast plugin, one instance per page. */
export const runnable: MdastPluginEntry = ({ fileURL }) => {
  const page = pageOf(fileURL);
  if (!page.startsWith("docs/")) return null;
  const pending = new Set(BROWSER_CANNOT_RUN.filter((x) => x.page === page));
  return {
    name: "eucalypt-runnable",
    async code(node, ctx) {
      if (node.lang !== "eu" || (node.meta ?? "").split(/\s+/).includes("notest")) return;
      const source = node.value;
      const where = `${page}: the eu fence starting ${JSON.stringify(source.split("\n").find((l) => l.trim()) ?? "")}`;
      const result = await evaluate(source, "yaml");
      const known = BROWSER_CANNOT_RUN.find((x) => x.page === page && source.includes(x.contains));
      if (known) {
        if (result.success) throw new Error(`${where} runs in the browser now: take it out of BROWSER_CANNOT_RUN`);
        pending.delete(known);
        return;
      }
      if (!result.success || result.output === undefined) {
        throw new Error(`${where} cannot be rendered: ${result.error?.message ?? "no output"}`);
      }
      const output = result.output.replace(/^---\n/, "").replace(/\n+$/, "");
      const block = wrap("div", { className: ["gg-run", "not-content"], dataRun: "", dataSource: source, dataFormat: "yaml" }, [
        header(await playLink(source)),
        wrap("div", { className: ["gg-run-src"], dataRunSrc: "" }, [{ type: "code", lang: "eu", meta: node.meta, value: source }]),
        wrap("div", { className: ["gg-run-out"], dataRunOut: "" }, [
          leaf(el("span", { className: ["gg-run-oh"] }, [text("output")])),
          { type: "code", lang: "yaml", meta: null, value: output },
        ]),
      ]);
      ctx.replaceNode(node, block as never);
    },
    after() {
      for (const x of pending) {
        throw new Error(`${page}: no eu fence containing ${JSON.stringify(x.contains)} fails in the browser; update BROWSER_CANNOT_RUN`);
      }
    },
  };
};
