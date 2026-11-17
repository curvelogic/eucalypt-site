// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { satteri } from "@astrojs/markdown-satteri";
import { runnable } from "./src/site/runnable.ts";

// Written by scripts/import-docs.mjs from the pinned eucalypt revision.
const generated = (name) => {
  const path = new URL(`./src/generated/${name}`, import.meta.url);
  if (!existsSync(path)) throw new Error(`src/generated/${name} is missing: run npm run docs`);
  return JSON.parse(readFileSync(path, "utf8"));
};

/**
 * Starlight writes data-theme="dark" into each page's <html>, which its
 * theme script then replaces. Without JavaScript that leaves the docs dark;
 * the site's default is light, so the built pages start light. With
 * JavaScript, ThemeScript.astro sets the reader's choice before first paint
 * as before. scripts/check-site.mjs checks that no page starts dark.
 */
const startLight = {
  name: "eucalypt-start-light",
  hooks: {
    "astro:build:done": ({ dir }) => {
      const walk = (d) =>
        readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
      for (const file of walk(dir.pathname).filter((f) => f.endsWith(".html"))) {
        const html = readFileSync(file, "utf8");
        const out = html.replace(/<html\b[^>]*>/, (tag) => tag.replace('data-theme="dark"', 'data-theme="light"'));
        if (out !== html) writeFileSync(file, out);
      }
    },
  },
};

export default defineConfig({
  site: "https://eucalypt.curvelogic.info",
  trailingSlash: "always",
  // Runnable eu blocks in the docs, with output rendered by the engine.
  markdown: { processor: satteri({ mdastPlugins: [runnable] }) },
  integrations: [
    starlight({
      title: "eucalypt",
      description: "A little language for YAML, JSON and TOML.",
      favicon: "/favicon.svg",
      sidebar: generated("sidebar.json"),
      customCss: ["./src/styles/ghost-gum.css", "./src/styles/starlight.css", "./src/styles/run.css"],
      components: {
        Header: "./src/components/starlight/Header.astro",
        SkipLink: "./src/components/starlight/SkipLink.astro",
        MarkdownContent: "./src/components/starlight/MarkdownContent.astro",
        ThemeProvider: "./src/components/starlight/ThemeProvider.astro",
        ThemeSelect: "./src/components/ThemeSelect.astro",
        MobileMenuFooter: "./src/components/starlight/MobileMenuFooter.astro",
      },
      expressiveCode: {
        shiki: { langs: [generated("eucalypt.tmLanguage.json")] },
        styleOverrides: {
          borderRadius: "10px",
          codeFontFamily: "var(--gg-mono)",
          uiFontFamily: "var(--gg-body)",
        },
      },
      pagefind: true,
    }),
    startLight,
  ],
});
