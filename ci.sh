#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

bun_image=oven/bun:1.4.0-alpine
deno_image=denoland/deno:2.9.6
node_image=node:24.19.0-alpine3.24
in_image() {
  local image=$1 entrypoint=$2
  shift 2
  docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD:/app" -w /app --entrypoint "$entrypoint" "$image" "$@"
}

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
