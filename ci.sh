#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

image=node:24.19.0-alpine3.24
in_node() { docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD:/app" -w /app "$image" "$@"; }

in_node npm ci
in_node npm run typecheck

test_output=$(in_node npm test)
printf '%s\n' "$test_output"
if printf '%s' "$test_output" | grep -q 'ℹ tests 0'; then
  echo 'the gate ran zero tests — failing instead of a vacuous green'
  exit 1
fi
