#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
source ./docker-runner.sh

test_log=$(mktemp)

# Streamed, and copied so the zero-test guard reads the count without trading the output for it.
node_tests() {
  in_image "$node_image" npm test 2>&1 | tee "$test_log"
}

leg "install ($node_image)" in_image "$node_image" npm ci
leg "typecheck ($node_image)" in_image "$node_image" npm run typecheck

leg "tests ($node_image)" node_tests
if grep -q 'ℹ tests 0' "$test_log"; then
  echo 'the gate ran zero tests — failing instead of a vacuous green'
  exit 1
fi
rm -f "$test_log"

leg "tests ($deno_image)" in_image "$deno_image" deno test --allow-env=PROPERTY_RUNS --allow-read --no-check src/
leg "tests ($bun_image)" in_image "$bun_image" bun test src/

leg "build ($node_image)" in_image "$node_image" npm run build
leg "pack and install the tarball ($node_image)" in_image "$node_image" sh -c 'set -e
  rm -rf package-tests/node_modules
  npm pack --pack-destination /tmp
  npm install --no-audit --no-fund --no-package-lock --no-save --offline --prefix package-tests /tmp/*.tgz'
leg "typecheck the consumer ($node_image)" in_image "$node_image" npx tsc -p package-tests
leg "round-trip on the engines floor ($floor_image)" in_image "$floor_image" node package-tests/node-floor.js

leg "browser ($firefox_image)" with_firefox in_image "$node_image" node browser-tests/run.js
