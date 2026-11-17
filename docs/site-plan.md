# eucalypt.curvelogic.info: the site plan

This repository becomes eucalypt's website: one Astro + Starlight site with
three parts in the Ghost Gum design: the homepage, the documentation and the
playground. This page records how it is put together and the work that
follows. The design, and the reasoning behind it, are in the owner's design
and review artifacts; this plan follows them.

## Structure

| URL | What | Built from |
| --- | --- | --- |
| `/` | Homepage | `src/pages/index.astro` |
| `/docs/…` | Documentation | eucalypt's `docs/`, imported at build time |
| `/play/` | Playground | `src/pages/play/index.astro` + `src/main.ts` |

- **Docs URLs** keep mdBook's paths without `.html`: `docs/guide/anaphora.md`
  is `/docs/guide/anaphora/`, `docs/reference/prelude/index.md` is
  `/docs/reference/prelude/`. The welcome page (`welcome/index.md`, mdBook's
  first chapter) is `/docs/`. Every old URL therefore has one obvious new one.
- **One shell.** `src/styles/ghost-gum.css` holds the tokens for light and
  dark and maps them onto Starlight's custom properties, so the docs theme is
  overrides, not a fork. `SiteHeader.astro` (mark, wordmark, Docs,
  Playground, Prelude, Install) is the header on all three; Starlight's
  `Header` is overridden to use it, with search, version and theme select.
- **Theme.** `data-theme` on `<html>`, from localStorage
  `starlight-theme`, which Starlight already uses; the homepage and `/play`
  read and write the same key, so one choice holds across the site.
- **Grove.** One SVG, drawn at build time from a fixed seed
  (`src/components/grove.ts`), fixed behind the page: full strength on the
  homepage, about half on the docs (via the `SkipLink` override, the first
  thing in Starlight's `<body>`), none on `/play`. Its strength is one token,
  `--gg-grove-strength`, per theme.
- **Fonts** are self-hosted from `@fontsource` packages (Familjen Grotesk,
  Atkinson Hyperlegible Next, Fragment Mono): no third-party requests, and
  they are cached with the site.
- **Favicon** is the mark redrawn for 16px: heavier braces, the leaf without
  its vein, green on either scheme.

## The docs import

The docs stay in `curvelogic/eucalypt` under `docs/`, where they are written
and reviewed. `scripts/import-docs.mjs` (`npm run docs`, run by `npm run
build`) takes them from the revision pinned in `eucalypt-pin.json`, the same
revision the engine and grammar come from (`scripts/fetch-eucalypt.sh` is
shared with `scripts/vendor-eucalypt.sh`).

- `docs/SUMMARY.md` is the only list of what is published. It becomes the
  Starlight sidebar (headings are groups; a nested list becomes a group that
  opens with its parent page; a note such as "(experimental, …)" becomes a
  badge). A page it does not list is never copied, so `docs/superpowers/`,
  `docs/development/` and the like cannot reach the site.
  `scripts/check-site.mjs` checks the built output both ways: every listed
  page is there, and nothing else is under `/docs/`.
- Each page's leading `# Title` becomes front matter, with an edit link to
  the file in eucalypt. Links between pages become site URLs; links to
  anything unpublished go to the file on GitHub at the pinned commit.
  Fence flags become meta (`eu,notest` becomes `eu notest`), kept for the
  runnable blocks. Pages stay `.md`, not MDX, so `<thunk>` and `{…}` in prose
  mean what they meant in mdBook.
- Code blocks are highlighted with eucalypt's own TextMate grammar
  (`editors/vscode`) from the same revision.

**How a docs change reaches the site:** it is merged in eucalypt, then the
commit in `eucalypt-pin.json` is bumped here. That one change moves the docs,
the engine, the grammar and the highlighting together, and CI builds and
checks them together, so the docs never describe a different eucalypt from
the one the playground runs. A pin bump is a small PR that can be automated
later (see the lanes).

## The shared editor

The playground's pieces are the editor for the whole site:

- `src/evaluator.ts`, the WASM engine (`vendor/engine`), built from the pin;
- `src/editor.ts`, CodeMirror 6, now themed from the Ghost Gum tokens so it
  follows light and dark;
- `src/highlight/`, tree-sitter highlighting identical to eucalypt's
  `xtask highlight-html`;
- `src/share.ts`, the `#z=` share links.

They are used in three places:

1. **`/play`** uses them as they are. The playground's markup moved from
   `index.html` into an Astro page, unchanged; its tests run against
   `/play/`.
2. **The homepage hero** is pre-rendered: `src/site/engine.ts` runs the same
   WASM engine in Node at build time, so every output in the hero, the tour
   and the pillars is what the engine produces (the four command-line
   snippets carry what `eu` printed), an example that stops working fails
   the build, and
   the output is there on first paint without JavaScript. "Open in the
   playground" links are built with `encodeState`. The live stage mounts
   `createEditor` over the pre-rendered source on idle or first focus,
   loads the engine, and re-evaluates as the source changes (debounced, with
   the playground's step limit), switching the output pane in place.
3. **Runnable docs blocks**: each ` ```eu ` fence (not `notest`) gets its
   output pre-rendered at build time by the same engine, a Run button that
   mounts the editor in place, and "Open in the playground". A fence whose
   output the engine cannot produce fails the build, which makes the docs
   their own test.

The component to extract for 2 and 3 is one function,
`mountLiveEditor(container, { source, format, onOutput })`, over
`createEditor` and `evaluator`, loaded with a dynamic `import()` so pages
that never run code never fetch the engine (several megabytes of WASM).

## Redirects from the old docs

The old docs are at `https://curvelogic.github.io/eucalypt/` (mdBook, from
eucalypt's `docs.yaml` workflow, published to its `gh-pages` branch). The
import writes `src/generated/redirects.json`, old path to new path, from
`SUMMARY.md`, e.g. `guide/anaphora.html` → `/docs/guide/anaphora/` and
`index.html` → `/docs/`.

GitHub Pages cannot send HTTP redirects, so the redirect lane replaces the
`gh-pages` content in eucalypt with a static page per old path: a
`<meta http-equiv="refresh">` and `<link rel="canonical">` to the new URL,
plus a `404.html` that maps any other path by script. The pages are
generated from `redirects.json`. The mdBook workflow is retired at the same
time, so a release does not overwrite them.

## Deployment

Cloudflare, where the `curvelogic.info` zone and the owner's other apps
already are: a Worker with static assets and no script of its own, on the
Custom Domain `eucalypt.curvelogic.info`. `wrangler.jsonc` is the source of
truth; `.github/workflows/deploy.yml` builds without secrets and deploys with
`wrangler deploy` from a separate job that alone reads
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. A Custom Domain creates
its own DNS record and certificate, so no record is added by hand (an
existing CNAME on the hostname would block it). The old playground at
`curvelogic.github.io/eucalypt-playground/` keeps serving its last Pages
deployment until it is retired (lane 5).

## Build lanes that follow

1. **Deployment** (owner merges): the Worker, its Custom Domain, deploy on push.
2. **Hero editor, live**: `mountLiveEditor` on the homepage, as above.
3. **Runnable docs blocks**: an Expressive Code plugin or rehype step for
   `eu` fences, with build-time output, and Run and "Open in the
   playground".
4. **`/play` in Ghost Gum**: the design's toolbar (example picker, format
   tabs, Share in the header), the problems panel, and the mobile layout.
5. **Redirects from the old URLs**: the old docs, retiring the mdBook
   workflow in eucalypt, and the old playground's Pages site, replaced by a
   page that sends `#z=`, `#gh=` and older links on to `/play/`.
6. **Pin bumps**: a scheduled job that opens a PR moving `eucalypt-pin.json`
   to eucalypt's latest release.
7. **Mobile header**: the design's menu under 760px on the homepage and
   `/play` (the docs already have Starlight's).
