#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
source ./docker-runner.sh

base=$(git merge-base "${1:-origin/main}" HEAD)
# Each hunk's added lines as path:first-last, in the working tree's numbering; a hunk that only deletes has none to mutate.
mutate=$(git diff --no-ext-diff --no-prefix -U0 --no-color "$base" -- 'src/*.ts' ':!src/*.test.ts' ':!src/conformance/property-harness.ts' | awk '
  /^\+\+\+ / { path = $2 }
  /^@@ / {
    split($3, added, ",")
    first = substr(added[1], 2)
    count = (2 in added) ? added[2] : 1
    if (count > 0) { printf "%s%s:%d-%d", separator, path, first, first + count - 1; separator = "," }
  }')
if [ -z "$mutate" ]; then
  echo "no source line changed since $base"
  exit 0
fi

leg "install ($node_image)" in_image "$node_image" sh -c 'npm ci --no-audit --no-fund && npm ci --no-audit --no-fund --prefix mutation-tests'
# A test file peaks near 2.6 GB: past four workers 6 GB kills some, and a killed worker's mutant reads as a RuntimeError, which fails the run.
in_image_memory=6g leg "mutation tests ($node_image)" in_image "$node_image" sh -c 'mutation-tests/node_modules/.bin/stryker run mutation-tests/stryker.config.mjs --concurrency 4 --mutate "$1" && node mutation-tests/check-runtime-errors.mjs' sh "$mutate"
