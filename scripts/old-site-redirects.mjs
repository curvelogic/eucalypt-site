#!/usr/bin/env node
// Static redirect pages for eucalypt's old addresses on GitHub Pages, which
// cannot send HTTP redirects.
//
//   node scripts/old-site-redirects.mjs docs OUT [OLD_PATHS]
//
// docs: the old mdBook docs at https://curvelogic.github.io/eucalypt/. One
// page per old path, from src/generated/redirects.json (written by
// `npm run docs`), forwarding to the matching page of the new docs. OLD_PATHS
// is an optional file listing the old site's pages, one per line (for
// instance `git ls-tree -r --name-only origin/gh-pages` in eucalypt); a page
// in it with no new equivalent forwards to /docs/. A 404.html forwards any
// other path the same way, by script. The old site's llms.txt files become
// notes giving their new place.
//
// Every page has a meta refresh, a canonical link and a visible link; a
// script forwards first so that the fragment is kept.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const SITE = "https://eucalypt.curvelogic.info";

/**
 * Old pages that redirects.json still maps but whose source eucalypt has
 * since deleted, so the new page will go at the next pin bump. They forward
 * to /docs/.
 */
export const RETIRED = ["appendices/migration.html"];

const escape = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** The page for one old path: forwards to `target`, keeping the fragment. */
export function redirectPage(target, title) {
  const t = escape(target);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escape(title)}</title>
<link rel="canonical" href="${t}">
<meta name="robots" content="noindex">
<script>location.replace(${JSON.stringify(target)} + location.hash)</script>
<meta http-equiv="refresh" content="0; url=${t}">
</head>
<body>
<p>This page has moved to <a href="${t}">${t}</a>.</p>
</body>
</html>
`;
}

/**
 * The 404 page for the old docs: maps the requested path under `prefix` by
 * `map`, and anything it does not know to /docs/.
 */
export function docsNotFoundPage(map, prefix = "/eucalypt/") {
  const fallback = `${SITE}/docs/`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>eucalypt documentation has moved</title>
<meta name="robots" content="noindex">
<script>
(function () {
  var map = ${JSON.stringify(map)};
  var path = location.pathname;
  var prefix = ${JSON.stringify(prefix)};
  if (path.indexOf(prefix) === 0) path = path.slice(prefix.length);
  if (path === "" || /\\/$/.test(path)) path += "index.html";
  else if (!/\\.html$/.test(path)) path += ".html";
  location.replace((map[path] || ${JSON.stringify(fallback)}) + location.hash);
})();
</script>
<noscript><meta http-equiv="refresh" content="0; url=${fallback}"></noscript>
</head>
<body>
<p>eucalypt's documentation has moved to <a href="${fallback}">${fallback}</a>.</p>
</body>
</html>
`;
}

/**
 * Old path → absolute new URL, for every path in `redirects` (old path → new
 * site path) and `oldPaths` (the old site's pages; non-HTML files are left
 * out). Paths in RETIRED and old pages with no new equivalent go to /docs/.
 */
export function docsMapping(redirects, oldPaths = []) {
  const map = {};
  for (const [from, to] of Object.entries(redirects)) map[from] = SITE + (RETIRED.includes(from) ? "/docs/" : to);
  for (const p of oldPaths) {
    if (p.endsWith(".html") && p !== "404.html" && !(p in map)) map[p] = `${SITE}/docs/`;
  }
  return map;
}

/**
 * Plain-text files the old site served, which cannot redirect: each is
 * replaced by a note saying where the file now is.
 */
export const TEXT_FILES = {
  "llms.txt": "https://github.com/curvelogic/eucalypt/blob/master/docs/llms.txt",
  "llms-full.txt": "https://github.com/curvelogic/eucalypt/blob/master/docs/llms-full.txt",
};

/** The files to write for the old docs: path → content. */
export function docsFiles(redirects, oldPaths = []) {
  const map = docsMapping(redirects, oldPaths);
  const files = { ".nojekyll": "", "404.html": docsNotFoundPage(map) };
  for (const [from, to] of Object.entries(map)) files[from] = redirectPage(to, "eucalypt documentation has moved");
  for (const p of oldPaths) {
    if (p in TEXT_FILES) {
      files[p] = `# Eucalypt\n\nThis file has moved to ${TEXT_FILES[p]}\nThe documentation is at ${SITE}/docs/\n`;
    }
  }
  return files;
}

function write(out, files) {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(out, path)), { recursive: true });
    writeFileSync(join(out, path), content);
  }
  console.log(`wrote ${Object.keys(files).length} files to ${out}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [kind, out, oldList] = process.argv.slice(2);
  if (!out || kind !== "docs") {
    console.error("usage: old-site-redirects.mjs docs OUT [OLD_PATHS]");
    process.exit(2);
  }
  const root = new URL("..", import.meta.url).pathname;
  const redirects = JSON.parse(readFileSync(join(root, "src/generated/redirects.json"), "utf8"));
  const oldPaths = oldList ? readFileSync(oldList, "utf8").split("\n").map((l) => l.trim()).filter(Boolean) : [];
  write(out, docsFiles(redirects, oldPaths));
}
