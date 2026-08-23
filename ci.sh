#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

image=node:24.19.0-alpine3.24
in_node() { docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD:/app" -w /app "$image" "$@"; }

in_node npm ci
in_node npm run typecheck
in_node npm test
