// Screenshots of the built site, in light and dark, at 1440 wide.
//
//   npm run build && node scripts/screenshots.mjs DIR [--scale N] [--full]
//
// Serves dist/ with `astro preview` and saves home, a docs page and /play
// (running an example) in each theme to DIR.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const root = new URL("..", import.meta.url).pathname;
const out = process.argv[2];
if (!out) throw new Error("usage: node scripts/screenshots.mjs DIR [--scale N] [--full]");
const scaleArg = process.argv.indexOf("--scale");
const scale = scaleArg > 0 ? Number(process.argv[scaleArg + 1]) : 2;
const full = process.argv.includes("--full");
mkdirSync(out, { recursive: true });

const port = 4174;
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

// /play opens on a share link, so it runs and shows highlighted output.
const playSource = 'service(n): {\n  name: "web-{n}"\n  port: 8080 + n\n  tier: (n = 0) then(:primary, :replica)\n}\n\nservices: range(0, 3) map(service)\n';
const playHash = Buffer.from(JSON.stringify({ source: playSource, format: "yaml" })).toString("base64");
const pages = [
  ["home", "/"],
  ["docs", "/docs/guide/expressions-and-pipelines/"],
  ["play", `/play/#${playHash}`],
];
const browser = await chromium.launch();
try {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: scale });
    await context.addInitScript((t) => localStorage.setItem("eucalypt-theme", t), theme);
    const page = await context.newPage();
    for (const [name, path] of pages) {
      await page.goto(`http://localhost:${port}${path}`);
      if (name === "play") await page.waitForSelector("#loading-overlay", { state: "hidden" });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: join(out, `${name}-${theme}.png`), fullPage: full && name !== "play" });
    }
    await context.close();
  }
} finally {
  await browser.close();
  process.kill(-server.pid);
}
