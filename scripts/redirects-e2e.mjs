// Browser checks of the redirect pages for eucalypt's old addresses
// (scripts/old-site-redirects.mjs), in headless Chromium.
//
//   npm run build && node scripts/redirects-e2e.mjs [OLD_PATHS] [--report FILE]
//
// One local server plays both sides: the old GitHub Pages docs site under
// /eucalypt/ (with GitHub Pages' 404.html fallback), and the built site from
// dist/, which every request to https://eucalypt.curvelogic.info is routed
// to. It checks that every old docs page lands on a page of the new docs that
// exists, that fragments are kept, and that unknown paths go to /docs/.
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { extname, join } from "node:path";
import { docsFiles, SITE } from "./old-site-redirects.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const root = new URL("..", import.meta.url).pathname;
const dist = join(root, "dist");
const args = process.argv.slice(2);
const reportArg = args.indexOf("--report");
const reportFile = reportArg >= 0 ? args.splice(reportArg, 2)[1] : null;
const oldPaths = args[0] ? readFileSync(args[0], "utf8").split("\n").map((l) => l.trim()).filter(Boolean) : [];

const redirects = JSON.parse(readFileSync(join(root, "src/generated/redirects.json"), "utf8"));
const docs = docsFiles(redirects, oldPaths);

// ── Server ───────────────────────────────────────────────────────────────────

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain",
  ".scm": "text/plain",
};

/** Serve `files` (path → content) as a GitHub Pages site would. */
function servePages(res, files, path) {
  if (path === "" || path.endsWith("/")) path += "index.html";
  if (path in files) {
    res.writeHead(200, { "content-type": types[extname(path)] ?? "text/plain" });
    return res.end(files[path]);
  }
  res.writeHead(404, { "content-type": types[".html"] });
  res.end(files["404.html"]);
}

function serveDist(res, path) {
  let file = join(dist, decodeURIComponent(path));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!file.startsWith(dist) || !existsSync(file)) {
    res.writeHead(404);
    return res.end("not found");
  }
  res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
  res.end(readFileSync(file));
}

const server = createServer((req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  if (path.startsWith("/eucalypt/") || path === "/eucalypt") return servePages(res, docs, path.slice("/eucalypt/".length));
  return serveDist(res, path);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const local = `http://127.0.0.1:${server.address().port}`;

// ── Checks ───────────────────────────────────────────────────────────────────

const results = [];
let failures = 0;
async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
    console.log(`ok   ${name}${detail ? ` (${detail})` : ""}`);
  } catch (e) {
    failures++;
    results.push({ name, ok: false, detail: String(e?.message ?? e) });
    console.log(`FAIL ${name}\n     ${String(e?.message ?? e).split("\n").join("\n     ")}`);
  }
}
function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const browser = await chromium.launch();
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
await page.route(`${SITE}/**`, async (route) => {
  const u = new URL(route.request().url());
  const response = await route.fetch({ url: local + u.pathname + u.search });
  await route.fulfill({ response });
});

/** Open `url` and wait until the browser has landed on the new site. */
async function follow(url) {
  await page.goto("about:blank");
  await page.goto(url);
  await page.waitForURL((u) => u.href.startsWith(SITE));
  await page.waitForLoadState("load");
  return page.url();
}

try {
  const map = Object.fromEntries(
    Object.keys(docs)
      .filter((p) => p.endsWith(".html") && p !== "404.html")
      .map((p) => [p, docs[p].match(/rel="canonical" href="([^"]+)"/)[1]]),
  );

  await check(`every old docs page (${Object.keys(map).length}) lands on a page the new site has`, async () => {
    const wrong = [];
    for (const [from, to] of Object.entries(map)) {
      const landed = await follow(`${local}/eucalypt/${from}`);
      const title = await page.title();
      if (landed !== to || /not found/i.test(title)) wrong.push(`${from} → ${landed} (${title})`);
      else if (!existsSync(join(dist, new URL(to).pathname, "index.html"))) wrong.push(`${from} → ${to}: not in dist/`);
    }
    assert(wrong.length === 0, wrong.join("\n"));
    return Object.entries(map).map(([f, t]) => `/eucalypt/${f} → ${t}`).join("; ");
  });

  await check("the old docs root lands on /docs/", async () => {
    const landed = await follow(`${local}/eucalypt/`);
    assert(landed === `${SITE}/docs/`, landed);
    return landed;
  });

  await check("an old docs link keeps its fragment", async () => {
    const landed = await follow(`${local}/eucalypt/guide/anaphora.html#block-anaphora`);
    assert(landed === `${SITE}/docs/guide/anaphora/#block-anaphora`, landed);
    return landed;
  });

  await check("a retired page (the migration appendix) lands on /docs/", async () => {
    const landed = await follow(`${local}/eucalypt/appendices/migration.html`);
    assert(landed === `${SITE}/docs/`, landed);
    return landed;
  });

  await check("404.html maps a known page asked for without .html", async () => {
    const landed = await follow(`${local}/eucalypt/guide/anaphora`);
    assert(landed === `${SITE}/docs/guide/anaphora/`, landed);
    return landed;
  });

  await check("404.html sends an unknown old path to /docs/, keeping the fragment", async () => {
    const landed = await follow(`${local}/eucalypt/no/such/page.html#x`);
    assert(landed === `${SITE}/docs/#x`, landed);
    return landed;
  });

  await check("the old docs pages have a canonical link, a meta refresh and a visible link", async () => {
    const res = await page.request.get(`${local}/eucalypt/guide/lenses.html`);
    const html = await res.text();
    const to = `${SITE}/docs/guide/lenses/`;
    assert(html.includes(`<link rel="canonical" href="${to}">`), "canonical");
    assert(html.includes(`<meta http-equiv="refresh" content="0; url=${to}">`), "refresh");
    assert(html.includes(`<a href="${to}">`), "visible link");
    return to;
  });

  await check("no page errors", async () => {
    assert(pageErrors.length === 0, pageErrors.join("\n"));
  });
} finally {
  // Requests still in flight (fonts, the engine) must not outlive the browser.
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await browser.close();
  server.close();
}

if (reportFile) writeFileSync(reportFile, JSON.stringify(results, null, 2) + "\n");
if (failures) {
  console.log(`${failures} check(s) failed`);
  process.exit(1);
}
console.log("all checks passed");
