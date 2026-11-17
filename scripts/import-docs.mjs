#!/usr/bin/env node
// Bring eucalypt's documentation into the site, from the revision pinned in
// eucalypt-pin.json.
//
//   node scripts/import-docs.mjs
//
// docs/SUMMARY.md in eucalypt is the table of contents of the published
// documentation, and the only thing that decides what is published: a page
// it does not list is never copied, so internal material (docs/superpowers/,
// docs/development/ and the like) cannot reach the site.
//
// For each listed page this:
//   - moves the leading "# Title" into Starlight front matter, with an edit
//     link to the page in eucalypt;
//   - rewrites links between pages to site URLs, and links to anything
//     unpublished to the file on GitHub at the pinned commit, except
//     internal material (INTERNAL below), which is never linked: such a
//     link becomes its text, and a page that still mentions internal
//     material is reported as a warning;
//   - turns mdBook fence flags into meta ("```eu,notest" becomes
//     "```eu notest"), so code blocks keep their flags for runnable blocks;
//     an eu fence that eucalypt's own doc tests (scripts/test-doc-examples.py)
//     do not run is marked notest too: a ```eucalypt fence (shown as eu),
//     one indented or in a blockquote, or one that test calls a fragment. So the runnable
//     blocks on the site are exactly the examples eucalypt's CI tests.
//
// It writes, all git-ignored:
//   src/content/docs/docs/     the pages, served under /docs/
//   src/generated/sidebar.json the Starlight sidebar, from SUMMARY.md
//   src/generated/redirects.json  old mdBook path -> new site path
//   src/generated/eucalypt.tmLanguage.json  the grammar for code blocks
//   src/generated/docs-source.json  the repository and commit
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const pin = JSON.parse(readFileSync(join(root, "eucalypt-pin.json"), "utf8"));
const src = execFileSync(join(root, "scripts/fetch-eucalypt.sh"), { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();
const docs = join(src, "docs");

/** The site path of a published page, from its path under docs/. */
export function sitePath(page, isRoot) {
  if (isRoot) return "/docs/";
  const slug = page.replace(/\.md$/, "").replace(/(^|\/)index$/, "");
  return `/docs/${slug}/`.replace(/\/+/g, "/");
}

// ── SUMMARY.md → pages and sidebar ───────────────────────────────────────────

const summary = readFileSync(join(docs, "SUMMARY.md"), "utf8");
const pages = []; // { page, label, path }
const sidebar = [];
let group = null;
let parent = null;
for (const line of summary.split("\n")) {
  const heading = line.match(/^#\s+(.+)$/);
  if (heading) {
    if (heading[1].trim() === "Summary") continue;
    group = { label: heading[1].trim(), items: [] };
    sidebar.push(group);
    parent = null;
    continue;
  }
  const item = line.match(/^(\s*)(?:-\s+)?\[([^\]]+)\]\(([^)]+)\)\s*(?:\(([^)]*)\))?\s*$/);
  if (!item) continue;
  const [, indent, label, page, note] = item;
  const isRoot = pages.length === 0 && !group;
  const path = sitePath(page, isRoot);
  pages.push({ page, label, path, isRoot });
  const entry = { label, link: path };
  if (note) entry.badge = { text: note.split(",")[0].trim(), variant: "caution" };
  if (isRoot) {
    sidebar.push({ label, link: path });
  } else if (indent.length > 0 && parent) {
    // A nested list: the parent becomes a group that opens with its own page.
    if (!parent.items) {
      const { label: l, link, badge } = parent;
      delete parent.link;
      delete parent.badge;
      parent.label = l;
      parent.items = [{ label: "Overview", link, ...(badge ? { badge } : {}) }];
    }
    parent.items.push(entry);
  } else {
    group.items.push(entry);
    parent = entry;
  }
}

const byPage = new Map(pages.map((p) => [p.page, p]));

// ── Pages ────────────────────────────────────────────────────────────────────

const repoBlob = (path) => `https://github.com/${pin.repository}/blob/${pin.commit}/${path}`;
const warnings = [];

/** Resolve a link target written in `from` (a path under docs/). */
function rewriteTarget(target, from) {
  if (/^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(target)) return target;
  const [path, hash = ""] = target.split(/(?=#)/);
  let resolved = posix.normalize(posix.join(posix.dirname(from), decodeURI(path)));
  const onDisk = join(docs, resolved);
  if (existsSync(onDisk) && statSync(onDisk).isDirectory()) {
    resolved = posix.join(resolved, "index.md");
  }
  const published = byPage.get(resolved);
  if (published) return published.path + hash;
  const repoPath = posix.normalize(posix.join("docs", resolved));
  if (repoPath.startsWith("../") || !existsSync(join(src, repoPath))) {
    warnings.push(`${from}: link to ${target} does not resolve`);
  }
  return repoBlob(repoPath) + hash;
}

/** Internal material under docs/: never published, never linked. */
const INTERNAL = /^superpowers\//;
const isInternal = (target, from) =>
  !/^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(target) &&
  INTERNAL.test(posix.normalize(posix.join(posix.dirname(from), decodeURI(target.split("#")[0]))));

/** Replace links into internal material by their text. */
function unlinkInternal(text, from) {
  return text.replace(/\[((?:`[^`]*`|[^\]`])*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (link, label, target) =>
    isInternal(target, from) ? label : link,
  );
}

function rewriteLinks(text, from) {
  // Inline links and reference definitions; not inside inline code spans.
  return text
    .split(/(`+[^`]*`+)/)
    .map((part, i) =>
      i % 2
        ? part
        : part
            .replace(/(\]\()([^)\s]+)((?:\s+"[^"]*")?\))/g, (_, a, t, b) => a + rewriteTarget(t, from) + b)
            .replace(/^(\s*\[(?!\^)[^\]]+\]:\s*)(\S+)/, (_, a, t) => a + rewriteTarget(t, from)),
    )
    .join("");
}

/** The lines of a fence's body, from its first line to its closing fence. */
function fenceBody(lines, start, fence) {
  const end = lines.findIndex((l, j) => j >= start && l.trim().startsWith(fence) && !l.trim().slice(fence.length).trim());
  return lines.slice(start, end < 0 ? undefined : end).join("\n");
}

/**
 * Whether eucalypt's doc tests skip a block as a fragment: no line (other
 * than a comment) declares anything, or it opens with a shell prompt or
 * pipe. The same heuristic as is_likely_fragment in
 * scripts/test-doc-examples.py.
 */
function isFragment(code) {
  const lines = code.trim().split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  if (!lines.length) return true;
  if (lines[0].startsWith("|") || lines[0].startsWith("$")) return true;
  return !lines.some((l) => l.includes(":"));
}

function convert(markdown, from) {
  const lines = markdown.split("\n");
  const first = lines.findIndex((l) => l.trim() !== "");
  const title = lines[first]?.match(/^#\s+(.+?)\s*#*\s*$/)?.[1];
  if (!title) throw new Error(`${from}: does not open with a "# Title" heading`);
  const body = lines.slice(first + 1);
  let fence = null;
  const out = body.map((line, i) => {
    // A fence may sit in a list or a blockquote: its prefix is kept.
    const open = line.match(/^((?:\s*>)*\s*)(`{3,}|~{3,})\s*([^`\s]*)(.*)$/);
    if (fence) {
      if (open && open[2][0] === fence[0] && open[2].length >= fence.length && !open[3] && !open[4].trim()) fence = null;
      return line;
    }
    if (open) {
      fence = open[2];
      const [lang, ...flags] = open[3].split(",");
      const name = lang === "eucalypt" ? "eu" : lang;
      const tested = lang === "eu" && !open[1] && !open[4].trim() && !isFragment(fenceBody(body, i + 1, fence));
      if (name === "eu" && !tested && !flags.includes("notest")) flags.push("notest");
      const meta = [...flags, open[4].trim()].filter(Boolean).join(" ");
      return `${open[1]}${open[2]}${name}${meta ? " " + meta : ""}`;
    }
    return rewriteLinks(unlinkInternal(line, from), from);
  });
  return { title, body: out.join("\n").replace(/^\n+/, "") };
}

const contentDir = join(root, "src/content/docs/docs");
rmSync(contentDir, { recursive: true, force: true });
// Astro keeps each page's rendered HTML between builds, and renders it again
// only when the page changes. Rendering runs every runnable fence through
// the engine (src/site/runnable.ts), so drop that cache: each build then
// tests every fence against the engine it ships.
rmSync(join(root, "node_modules/.astro/data-store.json"), { force: true });
for (const { page, path, isRoot } of pages) {
  const { title, body } = convert(readFileSync(join(docs, page), "utf8"), page);
  const mentions = body.match(/docs\/superpowers\/|\]\((?:\.\.\/)*superpowers\//g);
  if (mentions) warnings.push(`${page}: mentions internal material (docs/superpowers/) ${mentions.length} time(s)`);
  const front = [
    "---",
    `title: ${JSON.stringify(title)}`,
    `editUrl: ${JSON.stringify(`https://github.com/${pin.repository}/edit/master/docs/${page}`)}`,
    "---",
    "",
  ].join("\n");
  const rel = isRoot ? "index.md" : path.replace(/^\/docs\//, "").replace(/\/$/, "") + (page.endsWith("index.md") ? "/index.md" : ".md");
  const file = join(contentDir, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, front + body);
}

// ── Sidebar, redirects, grammar ──────────────────────────────────────────────

const generated = join(root, "src/generated");
mkdirSync(generated, { recursive: true });
writeFileSync(join(generated, "sidebar.json"), JSON.stringify(sidebar, null, 2) + "\n");

// mdBook served docs/x/y.md at /eucalypt/x/y.html, and its first chapter
// also at /eucalypt/index.html.
const redirects = { "index.html": "/docs/" };
for (const { page, path } of pages) redirects[page.replace(/\.md$/, ".html")] = path;
writeFileSync(join(generated, "redirects.json"), JSON.stringify(redirects, null, 2) + "\n");

const grammar = JSON.parse(readFileSync(join(src, "editors/vscode/syntaxes/eucalypt.tmLanguage.json"), "utf8"));
writeFileSync(join(generated, "eucalypt.tmLanguage.json"), JSON.stringify({ ...grammar, name: "eu", aliases: ["eucalypt"] }) + "\n");
writeFileSync(join(generated, "docs-source.json"), JSON.stringify({ repository: pin.repository, commit: pin.commit }, null, 2) + "\n");

for (const w of warnings) console.warn(`warning: ${w}`);
console.log(`imported ${pages.length} pages from ${pin.repository}@${pin.commit.slice(0, 7)}`);
