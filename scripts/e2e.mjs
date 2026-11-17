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
// raw.githubusercontent.com. Runnable blocks in the docs and the homepage
// tour show their pre-rendered output, load no engine until Run, and then
// re-run as the source is edited.
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
// strictPort: if the port is taken, fail rather than test whatever
// else is listening there (the astro CLI has no --strictPort flag).
const { preview } = await import("astro");
const server = await preview({ root, logLevel: "warn", server: { port }, vite: { preview: { strictPort: true } } });

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
  return page.$$eval("#editor-container .cm-content .cm-line", (lines) =>
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

  await check("colours YAML, JSON and TOML output in either theme; EDN stays plain", async () => {
    const link = (source, format) => base + "#" + Buffer.from(JSON.stringify({ source, format })).toString("base64");
    // The colour of each highlighted run in the output, by its text.
    const runs = () =>
      page.$$eval("#output .cm-line span", (spans) => Object.fromEntries(spans.map((s) => [s.textContent.trim(), getComputedStyle(s).color])));
    // What a Ghost Gum syntax token resolves to in the current theme.
    const token = (name) =>
      page.$eval("#output", (out, name) => {
        const probe = out.appendChild(document.createElement("span"));
        probe.style.color = `var(--gg-sx-${name})`;
        const colour = getComputedStyle(probe).color;
        probe.remove();
        return colour;
      }, name);
    const source = 'service: { name: "web" port: 8080 live: true }';
    const want = { yaml: ["service", "8080"], json: ['"service"', "8080"], toml: ["[service]", "8080"] };
    for (const [format, [key, num]] of Object.entries(want)) {
      await open(link(source, format));
      await page.waitForSelector("#output .cm-line span");
      for (const theme of ["light", "dark"]) {
        await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
        const r = await runs();
        assert(r[key] === (await token("key")), `${format}, ${theme}: key ${key} is ${r[key]}`);
        assert(r[num] === (await token("num")), `${format}, ${theme}: number ${num} is ${r[num]}`);
        const str = format === "yaml" ? null : '"web"';
        if (str) assert(r[str] === (await token("string")), `${format}, ${theme}: string is ${r[str]}`);
      }
      if (shots && format === "toml") await page.screenshot({ path: join(shots, "output-toml-dark.png") });
      await page.evaluate(() => (document.documentElement.dataset.theme = "light"));
    }
    await open(link(source, "edn"));
    await page.waitForFunction(() => document.querySelector("#output").textContent.includes("8080"));
    const spans = await page.$$eval("#output .cm-line span", (s) => s.length);
    assert(spans === 0, `EDN output has ${spans} highlighted runs`);
  });

  await check("highlights pasted source as xtask highlight-html does", async () => {
    for (const name of files) {
      const source = readFileSync(join(fixtures, `${name}.eu`), "utf8").replace(/\n+$/, "");
      await page.click("#editor-container .cm-content");
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
    const before = await page.$$eval("#editor-container .cm-line", (l) => l.map((x) => x.textContent).join("\n"));
    await open(base + hash);
    const after = await page.$$eval("#editor-container .cm-line", (l) => l.map((x) => x.textContent).join("\n"));
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
      await page.waitForSelector("#editor-container .cm-content");
      compareLines(await editorClasses(page), expectedLines(name));
      assert(!(await page.isVisible("#run-btn")), "Run is visible in a repository view");
      assert((await page.getAttribute("#editor-container .cm-content", "contenteditable")) === "false", "view is editable");
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

  await check("docs blocks show their output and load no engine until Run", async () => {
    const wasm = [];
    const onRequest = (r) => r.url().endsWith(".wasm") && wasm.push(r.url());
    page.on("request", onRequest);
    await page.goto(new URL("/docs/guide/string-interpolation/", base).href);
    const block = page.locator("[data-run]").first();
    assert((await block.locator("[data-run-out]").textContent()).includes("Hello"), "no pre-rendered output");
    assert(await block.locator("[data-run-btn]").isVisible(), "no Run button");
    assert((await block.locator("[data-run-link]").getAttribute("href")).startsWith("/play/#z="), "no playground link");
    await page.waitForTimeout(500);
    page.off("request", onRequest);
    assert(wasm.length === 0, `fetched ${wasm.join(", ")} before Run`);
  });

  await check("Run makes a docs block editable and re-runs it on each edit", async () => {
    await page.goto(new URL("/docs/guide/string-interpolation/", base).href);
    const block = page.locator("[data-run]").first();
    const before = await block.locator("[data-run-link]").getAttribute("href");
    await block.locator("[data-run-btn]").click();
    const editor = block.locator(".cm-content");
    await editor.waitFor();
    await editor.click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.type("\nadded: 6 * 7");
    await page.waitForFunction(() => document.querySelector("[data-run] .gg-run-live")?.textContent.includes("added: 42"));
    // The link is re-encoded just after the output is shown.
    await page.waitForFunction((h) => document.querySelector("[data-run] [data-run-link]").getAttribute("href") !== h, before);
    await page.keyboard.type("\nbroken: no-such-name");
    await page.waitForFunction(() => document.querySelector("[data-run] .gg-run-live.err")?.textContent.includes("no-such-name"));
  });

  await check("homepage tour cards run in place", async () => {
    await page.goto(new URL("/#tour", base).href);
    const card = page.locator(".tcard[data-run]").first();
    await card.locator("[data-run-btn]").click();
    await card.locator(".cm-content").waitFor();
    await card.locator(".gg-run-live").waitFor();
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

  await check("format tabs rerun the code; errors go to the problems panel", async () => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(base);
    await page.click("#format-tabs [data-fmt=json]");
    assert((await page.textContent("#output-label")) === "output.json", await page.textContent("#output-label"));
    await page.waitForFunction(() => document.querySelector("#output").textContent.includes('"hello": "world"'));
    await page.click("#editor-container .cm-content");
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("x: no-such-name");
    await page.click("#run-btn");
    assert((await page.textContent("#problems-count")) === "1 error", await page.textContent("#problems-count"));
    assert(await page.isVisible("#error-message"), "the error is not shown");
    assert(await page.isHidden("#output"), "the output is still shown");
    await page.setViewportSize({ width: 1280, height: 9000 });
  });

  await check("Share is a secondary button in the header", async () => {
    await open(base);
    const style = await page.$eval("#share-btn", (b) => {
      const s = getComputedStyle(b);
      const probe = document.body.appendChild(document.createElement("i"));
      probe.style.color = "var(--gg-line-strong)";
      const want = getComputedStyle(probe).color;
      probe.remove();
      return { inHeader: !!b.closest(".gg-site-header"), size: s.fontSize, weight: s.fontWeight, border: s.borderTopColor, want };
    });
    assert(style.inHeader, "Share is not in the header");
    assert(style.size === "14px" && style.weight === "600", `Share is ${style.size} weight ${style.weight}`);
    assert(style.border === style.want, `Share border ${style.border}, not ${style.want}`);
  });

  await check("/play fits phone widths without sideways overflow", async () => {
    const phone = await browser.newContext({ viewport: { width: 320, height: 640 } });
    const p = await phone.newPage();
    try {
      for (const width of [320, 360, 375, 390, 414]) {
        await p.setViewportSize({ width, height: 740 });
        await p.goto("about:blank");
        await p.goto(base);
        await p.waitForSelector("#loading-overlay", { state: "hidden" });
        const over = await p.evaluate(() => {
          const out = [];
          if (document.documentElement.scrollWidth > innerWidth) out.push(`page ${document.documentElement.scrollWidth}`);
          for (const el of document.querySelectorAll(".gg-site-header, .gg-site-header *, #toolbar, #toolbar *, #status-bar, #status-bar *, .tabs, .tabs *")) {
            const r = el.getBoundingClientRect();
            if (r.width && r.right > innerWidth + 0.5) out.push(`${el.id ? "#" + el.id : el.className || el.tagName} ends at ${Math.round(r.right)}`);
            if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== "visible" && !el.matches(".sr-only, #engine-version"))
              out.push(`${el.id || el.className || el.tagName} scrolls by ${el.scrollWidth - el.clientWidth}`);
          }
          return out;
        });
        assert(over.length === 0, `at ${width}: ${over.slice(0, 5).join("; ")}`);
      }
    } finally {
      await phone.close();
    }
  });

  await check("/play does not scroll sideways at tablet and desktop widths", async () => {
    for (const width of [768, 772, 901, 1024, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await open(base);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert(over <= 0, `${over}px wider than the screen at ${width}`);
    }
    await page.setViewportSize({ width: 1280, height: 9000 });
  });

  await check("no page errors", async () => {
    assert(pageErrors.length === 0, pageErrors.join("\n"));
  });
} finally {
  await browser.close();
  await server.stop();
}

if (failures) {
  console.log(`${failures} check(s) failed`);
  process.exit(1);
}
console.log("all checks passed");
