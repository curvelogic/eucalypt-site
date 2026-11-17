#!/usr/bin/env bash
# Build everything the playground takes from eucalypt, from the revision
# pinned in eucalypt-pin.json, into vendor/ (git-ignored):
#
#   vendor/engine/            the engine, built with wasm-pack from source
#   vendor/tree-sitter/       the published grammar WASM, highlights.scm and
#                             wasm-manifest.json (WASM checked against its
#                             recorded sha256)
#   vendor/highlight.css      the capture-to-colour stylesheet of
#                             `cargo xtask highlight-html --css`, scoped to .eu
#   vendor/eucalypt.json      the engine version and commit, shown in the UI
#   vendor/fixtures/          with --fixtures: each examples/aoc25 file and
#                             its `highlight-html --fragment` rendering, for
#                             the tests
#
# Needs git, cargo, the wasm32-unknown-unknown target and wasm-pack.
# WASM_PACK_NO_OPT=1 skips wasm-opt (a larger engine, for local builds
# where wasm-pack cannot fetch binaryen); CI always optimises.
# The checkout comes from scripts/fetch-eucalypt.sh: EUCALYPT_DIR names an
# existing one at the pinned commit; otherwise it is fetched into .eucalypt/.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

fixtures=false
for arg in "$@"; do
  case "$arg" in
    --fixtures) fixtures=true ;;
    *) echo "usage: $0 [--fixtures]" >&2; exit 2 ;;
  esac
done

pin() { node -e "process.stdout.write(require('./eucalypt-pin.json').$1)"; }
repo="$(pin repository)"
commit="$(pin commit)"

src="$(scripts/fetch-eucalypt.sh)"

out="$root/vendor"
rm -rf "$out"
mkdir -p "$out/tree-sitter"

# Engine
opt=()
if [ "${WASM_PACK_NO_OPT:-}" = 1 ]; then opt=(--no-opt); fi
(cd "$src" && wasm-pack build --release "${opt[@]}" --target web --no-pack --out-dir "$out/engine" --out-name eucalypt)
rm -f "$out/engine/.gitignore"

# Grammar: the committed WASM and query, checked against the manifest.
ts="$src/editors/tree-sitter-eucalypt"
cp -f "$ts/tree-sitter-eucalypt.wasm" "$ts/queries/highlights.scm" "$ts/wasm-manifest.json" "$out/tree-sitter/"
want="$(node -e "process.stdout.write(require('$out/tree-sitter/wasm-manifest.json').wasm.sha256)")"
got="$(sha256sum "$out/tree-sitter/tree-sitter-eucalypt.wasm" | cut -d' ' -f1)"
if [ "$want" != "$got" ]; then
  echo "error: tree-sitter-eucalypt.wasm sha256 $got does not match wasm-manifest.json ($want)" >&2
  exit 1
fi
wts_pinned="$(node -e "process.stdout.write(require('$out/tree-sitter/wasm-manifest.json').web_tree_sitter)")"
wts_ours="$(node -e "process.stdout.write(require('./node_modules/web-tree-sitter/package.json').version)")"
if [ "$wts_pinned" != "$wts_ours" ]; then
  echo "error: the grammar WASM was checked with web-tree-sitter $wts_pinned, but $wts_ours is installed" >&2
  exit 1
fi

# Stylesheet, and fixtures for the tests, from the same revision's renderer.
(cd "$src" && cargo xtask highlight-html --css) > "$out/highlight.raw.css"
node scripts/scope-highlight-css.mjs "$out/highlight.raw.css" "$out/highlight.css"
rm -f "$out/highlight.raw.css"
if $fixtures; then
  mkdir -p "$out/fixtures"
  for f in "$src"/examples/aoc25/*.eu; do
    name="$(basename "$f" .eu)"
    cp -f "$f" "$out/fixtures/$name.eu"
    (cd "$src" && cargo xtask highlight-html --fragment "$f") > "$out/fixtures/$name.html"
  done
fi

# Version record
version="$(cd "$src" && cargo metadata --no-deps --format-version 1 \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).packages.find(p=>p.name==='eucalypt').version))")"
node -e "
const m = require('$out/tree-sitter/wasm-manifest.json');
require('fs').writeFileSync('$out/eucalypt.json', JSON.stringify({
  repository: '$repo', commit: '$commit', version: '$version',
  grammar_version: m.grammar_version, grammar_abi: m.abi_version,
}, null, 2) + '\n');
"
echo "vendored eucalypt $version ($commit) into vendor/"
