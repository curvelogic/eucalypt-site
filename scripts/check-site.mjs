#!/usr/bin/env node
// Check the built site in dist/:
//   - every page eucalypt's docs/SUMMARY.md lists is there, under /docs/;
//   - nothing else is under /docs/: no internal material (docs/superpowers/,
//     docs/development/ and the like) and no page SUMMARY.md does not list;
//   - no page links to internal material (docs/superpowers/), even on GitHub;
//   - the homepage and /play are there.
//
//   npm run build   (runs this last)
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const dist = join(root, "dist");
const redirects = JSON.parse(readFileSync(join(root, "src/generated/redirects.json"), "utf8"));
const published = new Set(Object.values(redirects));

const failures = [];
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

for (const path of published) {
  if (!existsSync(join(dist, path, "index.html"))) failures.push(`missing published page ${path}`);
}
for (const file of walk(join(dist, "docs"))) {
  const rel = "/" + relative(dist, file).split("\\").join("/");
  const page = rel.replace(/index\.html$/, "");
  if (!published.has(page)) failures.push(`unpublished file in the build: ${rel}`);
}
for (const file of walk(dist)) {
  const rel = relative(dist, file);
  if (/(^|\/)(superpowers|development)(\/|$)/.test(rel)) failures.push(`internal material in the build: ${rel}`);
}
for (const file of walk(dist).filter((f) => f.endsWith(".html"))) {
  if (/href="[^"]*\/docs\/superpowers\//.test(readFileSync(file, "utf8"))) {
    failures.push(`link to internal material in ${relative(dist, file)}`);
  }
}
for (const page of ["index.html", "play/index.html"]) {
  if (!existsSync(join(dist, page))) failures.push(`missing ${page}`);
}

if (failures.length) {
  for (const f of failures) console.error(`error: ${f}`);
  process.exit(1);
}
console.log(`site checked: ${published.size} docs pages, nothing unpublished under /docs/, no internal material`);
