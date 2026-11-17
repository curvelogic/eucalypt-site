// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import { existsSync, readFileSync } from "node:fs";

// Written by scripts/import-docs.mjs from the pinned eucalypt revision.
const generated = (name) => {
  const path = new URL(`./src/generated/${name}`, import.meta.url);
  if (!existsSync(path)) throw new Error(`src/generated/${name} is missing: run npm run docs`);
  return JSON.parse(readFileSync(path, "utf8"));
};

export default defineConfig({
  site: "https://eucalypt.curvelogic.info",
  trailingSlash: "always",
  integrations: [
    starlight({
      title: "eucalypt",
      description: "A little language for YAML, JSON and TOML.",
      favicon: "/favicon.svg",
      sidebar: generated("sidebar.json"),
      customCss: ["./src/styles/ghost-gum.css", "./src/styles/starlight.css"],
      components: {
        Header: "./src/components/starlight/Header.astro",
        SkipLink: "./src/components/starlight/SkipLink.astro",
        ThemeProvider: "./src/components/starlight/ThemeProvider.astro",
        ThemeSelect: "./src/components/ThemeSelect.astro",
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
  ],
});
