# Eucalypt Playground

A browser-based interactive playground for the [Eucalypt](https://github.com/curvelogic/eucalypt) language. Write and run Eucalypt code directly in your browser with instant output in YAML, JSON, TOML, text, EDN, or HTML.

## Try it

Visit the live playground at **https://curvelogic.github.io/eucalypt-playground/**

## Features

- **Live editor** — CodeMirror 6 with line numbers and tree-sitter syntax highlighting, identical to eucalypt's own highlighted HTML (`cargo xtask highlight-html`)
- **Instant evaluation** — Eucalypt runs entirely in the browser via WebAssembly
- **Multiple output formats** — YAML, JSON, TOML, text, EDN, HTML
- **Built-in examples** — Hello World, list operations, string processing, functions, conditionals, and more
- **Sharing** — Share your code via URL (state compressed into the hash fragment)
- **Repository files** — `#gh=<owner>/<repo>/<ref>/<path>.eu` shows a `.eu` file from a public GitHub repository, highlighted and read-only, with a link back to its source; `&L5` or `&L5-L12` picks out lines (click or shift-click a line number). The ref is a branch, tag or commit without a `/`. Repository files are shown, never run
- **Keyboard shortcut** — Ctrl/Cmd+Enter to run

## Development

### Prerequisites

- Node.js 22+
- Rust with the `wasm32-unknown-unknown` target, and [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/) 0.13

### The eucalypt revision

The engine, the tree-sitter grammar and the highlighting stylesheet all come
from one eucalypt commit, pinned in `eucalypt-pin.json`; the UI shows its
version. `npm run vendor` (`scripts/vendor-eucalypt.sh`) fetches that commit
into `.eucalypt/` and builds into `vendor/` (git-ignored):

- the engine, built from source with `wasm-pack`
- `tree-sitter-eucalypt.wasm`, `queries/highlights.scm` and
  `wasm-manifest.json` from `editors/tree-sitter-eucalypt`, the WASM checked
  against its recorded sha256
- the capture-to-colour stylesheet of `cargo xtask highlight-html --css`
- with `-- --fixtures`, every `examples/aoc25` file and its
  `highlight-html --fragment` rendering, for the tests

CI runs the same script, so nothing is vendored by hand. To upgrade, change
the commit in `eucalypt-pin.json`. `EUCALYPT_DIR` uses an existing checkout
at that commit instead; `WASM_PACK_NO_OPT=1` skips `wasm-opt`.

### Running locally

```bash
npm install
npm run vendor -- --fixtures
npm run dev
```

Open http://localhost:5173/eucalypt-playground/

### Tests

```bash
npm test                     # unit tests, including highlighting against the fixtures
npm run build && npm run e2e # headless Chromium (needs Playwright and network access)
```

The highlighting tests compare the playground with `xtask highlight-html`
character by character, for pasted source and for `#gh=` views of every
`examples/aoc25` file.

### Production build

```bash
npm run build    # Outputs to dist/
npm run preview  # Preview the production build locally
```

### Deployment

Pushes to `main` automatically deploy to GitHub Pages via the workflow in `.github/workflows/deploy.yml`.

## Architecture

- **Frontend**: TypeScript + Vite single-page application
- **Editor**: CodeMirror 6 (One Dark chrome, eucalypt's dark highlighting palette)
- **Highlighting**: `web-tree-sitter` with eucalypt's published grammar WASM and `highlights.scm`, resolved to CodeMirror decorations
- **Evaluation**: WebAssembly module compiled from Eucalypt's Rust codebase via `wasm-pack`
- **WASM API**: Two functions — `evaluate(source, format)` returns a JSON result envelope, `formats()` returns available output formats

The WASM module runs the full Eucalypt pipeline (parse, desugar, cook, compile, evaluate) with a step limit of 1,000,000 to prevent infinite loops from hanging the browser tab.

## Related

- [Eucalypt](https://github.com/curvelogic/eucalypt) — the language and CLI tool
- [Eucalypt documentation](https://curvelogic.github.io/eucalypt/) — language guide and reference
