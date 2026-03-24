# Eucalypt Playground

A browser-based interactive playground for the [Eucalypt](https://github.com/curvelogic/eucalypt) language. Write and run Eucalypt code directly in your browser with instant output in YAML, JSON, TOML, text, EDN, or HTML.

## Try it

Visit the live playground at **https://curvelogic.github.io/eucalypt-playground/**

## Features

- **Live editor** — CodeMirror 6 with line numbers and syntax highlighting
- **Instant evaluation** — Eucalypt runs entirely in the browser via WebAssembly
- **Multiple output formats** — YAML, JSON, TOML, text, EDN, HTML
- **Built-in examples** — Hello World, list operations, string processing, functions, conditionals, and more
- **Sharing** — Share your code via URL (state encoded in the hash fragment)
- **Keyboard shortcut** — Ctrl/Cmd+Enter to run

## Development

### Prerequisites

- Node.js 20+
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/) (for rebuilding the WASM module)

### Running locally

```bash
npm install
npm run dev
```

Open http://localhost:5173/eucalypt-playground/

### Rebuilding the WASM module

The `pkg/` directory contains a pre-built WASM bundle from the main Eucalypt repository. To rebuild from source:

```bash
# From the eucalypt repo root
wasm-pack build --target web --out-dir /path/to/eucalypt-playground/pkg
```

Then restart the dev server.

### Production build

```bash
npm run build    # Outputs to dist/
npm run preview  # Preview the production build locally
```

### Deployment

Pushes to `main` automatically deploy to GitHub Pages via the workflow in `.github/workflows/deploy.yml`.

## Architecture

- **Frontend**: TypeScript + Vite single-page application
- **Editor**: CodeMirror 6 (One Dark theme)
- **Evaluation**: WebAssembly module compiled from Eucalypt's Rust codebase via `wasm-pack`
- **WASM API**: Two functions — `evaluate(source, format)` returns a JSON result envelope, `formats()` returns available output formats

The WASM module runs the full Eucalypt pipeline (parse, desugar, cook, compile, evaluate) with a step limit of 1,000,000 to prevent infinite loops from hanging the browser tab.

## Related

- [Eucalypt](https://github.com/curvelogic/eucalypt) — the language and CLI tool
- [Eucalypt documentation](https://curvelogic.github.io/eucalypt/) — language guide and reference
