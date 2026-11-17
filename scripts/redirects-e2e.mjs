// Browser checks of the redirect pages for eucalypt's old addresses
// (scripts/old-site-redirects.mjs), in headless Chromium.
//
//   npm run build && node scripts/redirects-e2e.mjs [OLD_PATHS] [--report FILE]
//
// One local server plays both sides: the old GitHub Pages sites under
// /eucalypt/ and /eucalypt-playground/ (with GitHub Pages' 404.html
// fallback), and the built site from dist/, which every request to
// https://eucalypt.curvelogic.info is routed to. Repository files for #gh=
// links are served from a stub. It checks that every old docs page lands on
// a page of the new docs that exists, that fragments are kept, that unknown
// paths go to /docs/, and that the old playground's #z=, #gh= and older
// base64 share links open the same program on /play/.
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { extname, join } from "node:path";
import { deflateRawSync } from "node:zlib";
import { docsFiles, playFiles, SITE } from "./old-site-redirects.mjs";

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
const play = playFiles();

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
  if (path.startsWith("/eucalypt-playground/")) return servePages(res, play, path.slice("/eucalypt-playground/".length));
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

const STUB_FILE = "greeting: \"hello from a repository file\"\n";
const browser = await chromium.launch();
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
await page.route(`${SITE}/**`, async (route) => {
  const u = new URL(route.request().url());
  const response = await route.fetch({ url: local + u.pathname + u.search });
  await route.fulfill({ response });
});
await page.route("https://raw.githubusercontent.com/**", (route) =>
  route.fulfill({ status: 200, contentType: "text/plain", body: STUB_FILE }),
);

/** Open `url` and wait until the browser has landed on the new site. */
async function follow(url) {
  await page.goto("about:blank");
  await page.goto(url);
  await page.waitForURL((u) => u.href.startsWith(SITE));
  await page.waitForLoadState("load");
  return page.url();
}

/** The playground's editor text, once it has loaded. */
async function editorText() {
  await page.waitForSelector("#loading-overlay", { state: "hidden", timeout: 60000 });
  await page.waitForSelector("#editor-container .cm-content");
  return page.$$eval("#editor-container .cm-line", (l) => l.map((x) => x.textContent).join("\n"));
}

const toBase64Url = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

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

  // Old playground share links, in each form it ever wrote.
  const source = "# Héllo, “world” ✓\nx: 41 + 1\ny: [1, 2, 3] map(_ * 2)\n";
  const state = { source, format: "yaml", mode: "unit" };

  await check("old playground #z= link opens the same program on /play/", async () => {
    const hash = "#z=" + toBase64Url(deflateRawSync(Buffer.from(JSON.stringify(state))));
    const landed = await follow(`${local}/eucalypt-playground/${hash}`);
    assert(landed === `${SITE}/play/${hash}`, landed);
    const text = await editorText();
    assert(text === source, `editor shows ${JSON.stringify(text)}`);
    const fmt = await page.getAttribute('#format-tabs [aria-checked="true"]', "data-fmt");
    assert(fmt === "yaml", `format is ${fmt}`);
    return landed.slice(0, 80) + "…";
  });

  await check("old playground pre-compression base64 link (btoa, with + / =) opens the same program", async () => {
    // As the first playground wrote them: btoa(unescape(encodeURIComponent(json))).
    let legacy = "";
    let pad = "";
    for (let extra = 0; extra < 64; extra++) {
      pad = " ".repeat(extra);
      legacy = Buffer.from(JSON.stringify({ source: source + pad + "z: \"??>>??\"", format: "json" })).toString("base64");
      if (/[+/]/.test(legacy) && legacy.endsWith("=")) break;
    }
    assert(/[+/]/.test(legacy) && legacy.endsWith("="), "test link lacks + / =");
    const landed = await follow(`${local}/eucalypt-playground/#${legacy}`);
    assert(landed === `${SITE}/play/#${legacy}`, landed);
    const text = await editorText();
    const want = source + pad + 'z: "??>>??"';
    assert(text === want, `editor shows ${JSON.stringify(text)}`);
    const fmt = await page.getAttribute('#format-tabs [aria-checked="true"]', "data-fmt");
    assert(fmt === "json", `format is ${fmt}`);
    return "base64 " + legacy.slice(0, 24) + "…";
  });

  await check("old playground #gh= link opens the same repository file on /play/", async () => {
    const hash = "#gh=curvelogic/eucalypt/master/examples/aoc25/day01.eu&L2-L3";
    const landed = await follow(`${local}/eucalypt-playground/${hash}`);
    assert(landed === `${SITE}/play/${hash}`, landed);
    await page.waitForSelector("body.viewing");
    const text = await editorText();
    assert(text.startsWith(STUB_FILE.trim()), `viewer shows ${JSON.stringify(text)}`);
    const href = await page.getAttribute("#view-source", "href");
    assert(href === "https://github.com/curvelogic/eucalypt/blob/master/examples/aoc25/day01.eu#L2-L3", href);
    return landed;
  });

  await check("old playground index.html and other paths forward too", async () => {
    const a = await follow(`${local}/eucalypt-playground/index.html#z=abc`);
    assert(a === `${SITE}/play/#z=abc`, a);
    const b = await follow(`${local}/eucalypt-playground/some/old/path`);
    assert(b === `${SITE}/play/`, b);
    return `${a}; ${b}`;
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
