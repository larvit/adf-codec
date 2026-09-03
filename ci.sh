#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
source ./docker-runner.sh

in_image "$node_image" npm ci
in_image "$node_image" npm run typecheck

if ! test_output=$(in_image "$node_image" npm test 2>&1); then
  printf '%s\n' "$test_output"
  exit 1
fi
printf '%s\n' "$test_output"
if printf '%s' "$test_output" | grep -q 'ℹ tests 0'; then
  echo 'the gate ran zero tests — failing instead of a vacuous green'
  exit 1
fi

in_image "$deno_image" deno test --allow-read --no-check src/
in_image "$bun_image" bun test src/

in_image "$node_image" npm run build
in_image "$node_image" sh -c 'set -e
  rm -rf package-tests/node_modules
  npm pack --pack-destination /tmp >/dev/null
  npm install --no-save --no-package-lock --prefix package-tests /tmp/*.tgz >/dev/null'
in_image "$node_image" npx tsc -p package-tests
in_image "$floor_image" node package-tests/node-floor.js
