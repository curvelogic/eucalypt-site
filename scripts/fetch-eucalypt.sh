#!/usr/bin/env bash
# Print the path of a eucalypt checkout at the commit pinned in
# eucalypt-pin.json, fetching it into .eucalypt/ first if need be.
#
# EUCALYPT_DIR names an existing checkout to use instead; it must already be
# at the pinned commit. Both scripts/vendor-eucalypt.sh (the engine, grammar
# and stylesheet) and scripts/import-docs.mjs (the documentation) take their
# eucalypt from here, so the site is built from one revision.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

pin() { node -e "process.stdout.write(require('./eucalypt-pin.json').$1)"; }
repo="$(pin repository)"
commit="$(pin commit)"

src="${EUCALYPT_DIR:-$root/.eucalypt}"
if [ -z "${EUCALYPT_DIR:-}" ]; then
  if [ ! -d "$src/.git" ]; then
    git init -q "$src"
    git -C "$src" remote add origin "https://github.com/$repo.git"
  fi
  if [ "$(git -C "$src" rev-parse -q --verify HEAD || true)" != "$commit" ]; then
    git -C "$src" fetch -q --depth 1 origin "$commit" >&2
    git -C "$src" checkout -q --detach FETCH_HEAD >&2
  fi
fi
head="$(git -C "$src" rev-parse HEAD)"
if [ "$head" != "$commit" ]; then
  echo "error: $src is at $head, but eucalypt-pin.json pins $commit" >&2
  exit 1
fi
echo "$src"
