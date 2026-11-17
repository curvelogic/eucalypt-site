// End-to-end checks of the built playground in headless Chromium.
//
//   npm run build && npm run e2e [-- --screenshots DIR]
//
// Serves dist/ with `astro preview` and checks the playground at /play/: the engine version is shown;
// examples run; pasted source and #gh= views of every examples/aoc25 file
// are highlighted exactly as `cargo xtask highlight-html` renders them
// (vendor/fixtures, from scripts/vendor-eucalypt.sh --fixtures); #gh= views
// are read-only, link back to their source and pick out lines; share links
// are compressed and still read the old form. The #gh= checks fetch from
// raw.githubusercontent.com.
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { classesByLine, fragmentClasses } from "./fragment-classes.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const root = new URL("..", import.meta.url).pathname;
const engine = JSON.parse(readFileSync(join(root, "vendor/eucalypt.json"), "utf8"));
const fixtures = join(root, "vendor/fixtures");
const shotsArg = process.argv.indexOf("--screenshots");
const shots = shotsArg > 0 ? process.argv[shotsArg + 1] : null;
if (shots) mkdirSync(shots, { recursive: true });

const port = 4173;
const base = `http://localhost:${port}/play/`;
const server = spawn(process.execPath, [join(root, "node_modules/astro/bin/astro.mjs"), "preview", "--port", String(port), "--ignore-lock"], {
  cwd: root,
  stdio: ["ignore", "pipe", "inherit"],
  // Its own process group, so stopping it stops the server the CLI starts.
  detached: true,
});
await new Promise((resolve, reject) => {
  server.stdout.on("data", (d) => String(d).includes(String(port)) && resolve());
  server.on("exit", (code) => reject(new Error(`astro preview exited with ${code}`)));
});

let failures = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (e) {
    failures++;
    console.log(`FAIL ${name}\n     ${String(e?.message ?? e).split("\n").join("\n     ")}`);
  }
}
function assert(cond, message) {
  if (!cond) throw new Error(message);
}

/** Per-line, per-character innermost ts- class list of the rendered editor. */
async function editorClasses(page) {
  return page.$$eval(".cm-content .cm-line", (lines) =>
    lines.map((line) => {
      const out = [];
      const walk = (node, cls) => {
        if (node.nodeType === Node.TEXT_NODE) {
          for (const _ of node.data) out.push(cls);
        } else if (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains("cm-widgetBuffer")) {
          const own = [...node.classList].filter((c) => c.startsWith("ts-")).join(" ");
          for (const child of node.childNodes) walk(child, own || cls);
        }
      };
      for (const child of line.childNodes) walk(child, null);
      return out;
    }),
  );
}

function compareLines(actual, expected) {
  // The renderer drops a file's final newline; CodeMirror shows an empty last line.
  while (actual.length > expected.length && actual[actual.length - 1].length === 0) actual.pop();
  assert(actual.length === expected.length, `rendered ${actual.length} lines, expected ${expected.length}`);
  for (let n = 0; n < expected.length; n++) {
    const a = JSON.stringify(actual[n]);
    const e = JSON.stringify(expected[n]);
    assert(a === e, `line ${n + 1} differs:\n  playground ${a}\n  xtask      ${e}`);
  }
}

function expectedLines(name) {
  const { text, classes } = fragmentClasses(readFileSync(join(fixtures, `${name}.html`), "utf8"));
  return classesByLine(text, classes);
}

const browser = await chromium.launch();
// Tall enough that CodeMirror renders every line of the longest file.
const context = await browser.newContext({
  viewport: { width: 1280, height: 9000 },
  deviceScaleFactor: shots ? 2 : 1,
});
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
const ready = () => page.waitForSelector("#loading-overlay", { state: "hidden" });
// A fresh load: a hash-only navigation would instead fire the page's own
// hashchange reload.
async function open(url) {
  await page.goto("about:blank");
  await page.goto(url);
  await ready();
}
const files = readdirSync(fixtures).filter((f) => f.endsWith(".eu")).map((f) => f.slice(0, -3)).sort();

try {
  await check("shows the engine version", async () => {
    await open(base);
    const text = await page.textContent("#engine-version");
    assert(text === `eucalypt ${engine.version} (${engine.commit.slice(0, 7)})`, `version shown as ${text}`);
    assert(/runs in your browser/.test(await page.textContent("#engine-note")), "no note that the engine runs in the browser");
    const href = await page.getAttribute("#engine-version", "href");
    assert(href.endsWith(engine.commit), `version links to ${href}`);
  });

  await check("runs the default example", async () => {
    await page.click("#run-btn");
    const out = await page.textContent("#output");
    assert(out.includes("hello: world"), `output ${out}`);
  });

  await check("highlights pasted source as xtask highlight-html does", async () => {
    for (const name of files) {
      const source = readFileSync(join(fixtures, `${name}.eu`), "utf8").replace(/\n+$/, "");
      await page.click(".cm-content");
      await page.keyboard.press("ControlOrMeta+A");
      await page.keyboard.press("Delete");
      await page.evaluate((t) => navigator.clipboard.writeText(t), source);
      await page.keyboard.press("ControlOrMeta+V");
      await page.waitForTimeout(50);
      try {
        compareLines(await editorClasses(page), expectedLines(name));
      } catch (e) {
        throw new Error(`${name}.eu: ${e.message}`);
      }
    }
  });

  if (shots) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.evaluate(() => document.querySelector(".cm-scroller").scrollTo(0, 0));
    await page.screenshot({ path: join(shots, "pasted.png") });
    await page.setViewportSize({ width: 1280, height: 9000 });
  }

  await check("compresses share links and reads them back", async () => {
    await page.click("#share-btn");
    await page.waitForFunction(() => document.querySelector("#share-btn").textContent === "Copied!");
    const hash = await page.evaluate(() => location.hash);
    assert(hash.startsWith("#z="), `hash ${hash.slice(0, 20)}`);
    const before = await page.$$eval(".cm-line", (l) => l.map((x) => x.textContent).join("\n"));
    await open(base + hash);
    const after = await page.$$eval(".cm-line", (l) => l.map((x) => x.textContent).join("\n"));
    assert(after === before, `shared source did not round-trip: ${before.length} chars became ${after.length}: ${after.slice(0, 80)}`);
  });

  await check("reads share links from before compression", async () => {
    const legacy = Buffer.from(JSON.stringify({ source: "x: 41 + 1", format: "json" })).toString("base64");
    await open(base + "#" + legacy);
    await page.waitForFunction(() => document.querySelector("#output").textContent.includes("42"));
  });

  for (const name of files) {
    await check(`#gh= view of examples/aoc25/${name}.eu matches xtask highlight-html`, async () => {
      await open(`${base}#gh=${engine.repository}/${engine.commit}/examples/aoc25/${name}.eu`);
      await page.waitForSelector(".cm-content");
      compareLines(await editorClasses(page), expectedLines(name));
      assert(!(await page.isVisible("#run-btn")), "Run is visible in a repository view");
      assert((await page.getAttribute(".cm-content", "contenteditable")) === "false", "view is editable");
    });
  }

  await check("#gh= view picks out lines and links back to them", async () => {
    const path = `${engine.repository}/${engine.commit}/examples/aoc25/day01.eu`;
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(`${base}#gh=${path}&L20-L24`);
    await page.waitForSelector(".cm-picked-line");
    const picked = await page.$$eval(".cm-picked-line", (l) => l.length);
    assert(picked === 5, `${picked} lines picked`);
    const href = await page.getAttribute("#view-source", "href");
    assert(href === `https://github.com/${engine.repository}/blob/${engine.commit}/examples/aoc25/day01.eu#L20-L24`, href);
    if (shots) await page.screenshot({ path: join(shots, "gh-view.png") });
    await page.click(".cm-lineNumbers .cm-gutterElement:text-is('26')");
    const hash = await page.evaluate(() => location.hash);
    assert(hash.endsWith("&L26"), `hash after click ${hash}`);
    await page.click(".cm-lineNumbers .cm-gutterElement:text-is('29')", { modifiers: ["Shift"] });
    assert((await page.evaluate(() => location.hash)).endsWith("&L26-L29"), "shift-click did not extend");
  });

  await check("#gh= view explains a missing file", async () => {
    await open(`${base}#gh=${engine.repository}/${engine.commit}/no-such-file.eu`);
    const text = await page.textContent("#view-error");
    assert(/not found/.test(text) && /public repositories/.test(text), text);
  });

  await check("#gh= rejects a malformed link", async () => {
    await open(`${base}#gh=not-a-link`);
    assert(/not a valid repository file link/.test(await page.textContent("#view-error")), "no error shown");
  });

  await check("homepage hero switches example and format", async () => {
    await page.goto(new URL("/", base).href);
    await page.click("[data-pick=pipelines]");
    await page.click("#ex-pipelines [data-fmt=json]");
    const out = await page.textContent("#ex-pipelines [data-out=json]");
    assert(out.includes('"ADA"') && out.includes('"GRACE"'), `output ${out}`);
    assert(await page.isHidden("#ex-layers"), "the first example is still shown");
  });

  await check("homepage hero opens its example in the playground", async () => {
    await page.goto(new URL("/", base).href);
    await page.click("[data-pick=generate]");
    await page.click("#ex-generate .ed-foot a");
    await ready();
    await page.waitForFunction(() => document.querySelector("#output").textContent.includes("web-2"));
  });

  await check("theme is light by default, and a choice carries to the docs", async () => {
    const fresh = await browser.newContext({ colorScheme: "dark" });
    const p = await fresh.newPage();
    await p.goto(new URL("/", base).href);
    assert((await p.getAttribute("html", "data-theme")) === "light", "not light by default on a dark system");
    await p.selectOption("gg-theme-select select", "dark");
    await p.goto(new URL("/docs/", base).href);
    assert((await p.getAttribute("html", "data-theme")) === "dark", "dark not remembered on the docs");
    assert((await p.inputValue("gg-theme-select select")) === "dark", "docs select does not show dark");
    await p.selectOption("gg-theme-select select", "auto");
    await p.goto(new URL("/play/", base).href);
    assert((await p.getAttribute("html", "data-theme")) === "dark", "auto does not follow a dark system");
    await fresh.close();
  });

  await check("no page errors", async () => {
    assert(pageErrors.length === 0, pageErrors.join("\n"));
  });
} finally {
  await browser.close();
  process.kill(-server.pid);
}

if (failures) {
  console.log(`${failures} check(s) failed`);
  process.exit(1);
}
console.log("all checks passed");
