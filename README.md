# eucalypt.curvelogic.info

The website of the [eucalypt](https://github.com/curvelogic/eucalypt)
language: the homepage, the documentation and the playground, as one Astro +
Starlight site in the Ghost Gum design. How it is put together, and the work
that follows, is in [docs/site-plan.md](docs/site-plan.md).

| URL | What |
| --- | --- |
| `/` | Homepage, with a pre-rendered hero editor |
| `/docs/` | The documentation, imported from eucalypt's `docs/` at the pinned revision |
| `/play/` | The playground |

The documentation is written in eucalypt, not here. `docs/SUMMARY.md` there
decides what is published; a change reaches the site when the commit in
`eucalypt-pin.json` is bumped.

## The playground

Write and run eucalypt in the browser, with output in YAML, JSON, TOML, text, EDN or HTML.

### Features

- **Live editor** — CodeMirror 6, following the site's light or dark theme, with line numbers and tree-sitter syntax highlighting, identical to eucalypt's own highlighted HTML (`cargo xtask highlight-html`)
- **Instant evaluation** — Eucalypt runs entirely in the browser via WebAssembly
- **Multiple output formats** — YAML, JSON, TOML, text, EDN, HTML; YAML, JSON and TOML output is highlighted in the site's light or dark theme
- **Built-in examples** — Hello World, list operations, string processing, functions, conditionals, and more
- **Sharing** — Share your code via URL (state compressed into the hash fragment)
- **Repository files** — `#gh=<owner>/<repo>/<ref>/<path>.eu` shows a `.eu` file from a public GitHub repository, highlighted and read-only, with a link back to its source; `&L5` or `&L5-L12` picks out lines (click or shift-click a line number). The ref is a branch, tag or commit without a `/`. Repository files are shown, never run
- **Format tabs** — choosing a format reruns the code in it; Copy copies the output
- **Problems panel** — an error and its notes appear under the panes, in place of the output
- **Phone layout** — under 760px the toolbar takes two rows and the panes stack; it fits a 320px screen
- **Keyboard shortcut** — Ctrl/Cmd+Enter to run

## Development

### Prerequisites

- Node.js 22+
- Rust with the `wasm32-unknown-unknown` target, and [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/) 0.13

### The eucalypt revision

The engine, the tree-sitter grammar, the highlighting stylesheet and the
documentation all come from one eucalypt commit, pinned in
`eucalypt-pin.json`; the UI shows its version. `scripts/fetch-eucalypt.sh`
fetches that commit into `.eucalypt/` for both scripts below. `npm run vendor` (`scripts/vendor-eucalypt.sh`) fetches that commit
into `.eucalypt/` and builds into `vendor/` (git-ignored):

- the engine, built from source with `wasm-pack`
- `tree-sitter-eucalypt.wasm`, `queries/highlights.scm` and
  `wasm-manifest.json` from `editors/tree-sitter-eucalypt`, the WASM checked
  against its recorded sha256
- the capture-to-colour stylesheet of `cargo xtask highlight-html --css`
- with `-- --fixtures`, every `examples/aoc25` file and its
  `highlight-html --fragment` rendering, for the tests

`npm run docs` (`scripts/import-docs.mjs`, also run by `npm run build`)
imports the pages `docs/SUMMARY.md` lists into `src/content/docs/docs/` and
writes the sidebar, the grammar for code blocks and the old-URL map into
`src/generated/` (both git-ignored).

CI runs the same scripts, so nothing is vendored by hand. To upgrade, change
the commit in `eucalypt-pin.json`. `EUCALYPT_DIR` uses an existing checkout
at that commit instead; `WASM_PACK_NO_OPT=1` skips `wasm-opt`.

### Running locally

```bash
npm install
npm run vendor -- --fixtures
npm run dev
```

Open http://localhost:4321/ (the playground is at `/play/`).

### Tests

```bash
npm test                     # unit tests, including highlighting against the fixtures
npm run build && npm run e2e # headless Chromium (needs Playwright and network access)
node scripts/screenshots.mjs DIR  # home, a docs page and /play, light and dark, at 1440 wide
```

The highlighting tests compare the playground with `xtask highlight-html`
character by character, for pasted source and for `#gh=` views of every
`examples/aoc25` file.

### Production build

```bash
npm run build    # imports the docs, builds dist/, then checks it (scripts/check-site.mjs)
npm run preview  # serves dist/
```

`scripts/check-site.mjs` fails the build unless every page `SUMMARY.md`
lists is in `dist/docs/` and nothing else is, so internal material in
eucalypt's `docs/` cannot be published. The homepage's outputs are produced
by the engine at build time, so an example that stops running fails the
build too.

### Deployment

Pushes to `main` deploy the site to Cloudflare, as a Worker with static
assets on the custom domain eucalypt.curvelogic.info
(`.github/workflows/deploy.yml`, configured by `wrangler.jsonc`). The build
job has no secrets; the deploy job runs `wrangler deploy` with the
repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
`npx wrangler dev` serves `dist/` as the Worker would.

## Architecture

- **Site**: Astro + Starlight; the playground is the page `src/pages/play/index.astro`, wired up by `src/main.ts`
- **Editor**: CodeMirror 6, its chrome from the Ghost Gum tokens and its text colours from eucalypt's highlighting palette, light or dark
- **Highlighting**: `web-tree-sitter` with eucalypt's published grammar WASM and `highlights.scm`, resolved to CodeMirror decorations
- **Evaluation**: WebAssembly module compiled from Eucalypt's Rust codebase via `wasm-pack`
- **WASM API**: Two functions — `evaluate(source, format)` returns a JSON result envelope, `formats()` returns available output formats

The WASM module runs the full Eucalypt pipeline (parse, desugar, cook, compile, evaluate) with a step limit of 1,000,000 to prevent infinite loops from hanging the browser tab.

## Related

- [Eucalypt](https://github.com/curvelogic/eucalypt) — the language and CLI tool
- [Eucalypt documentation](https://curvelogic.github.io/eucalypt/) — the current docs site, until this one replaces it
