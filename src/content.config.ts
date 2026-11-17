import { defineCollection } from "astro:content";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";

// src/content/docs/docs/ is written by scripts/import-docs.mjs from the
// pinned eucalypt revision; it is not edited here.
export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
};
