#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
source ./docker-runner.sh

in_image_memory=4g
leg "install ($node_image)" in_image "$node_image" npm ci
leg "build ($node_image)" in_image "$node_image" npm run build
leg "write the feature table ($node_image)" in_image "$node_image" node feature-table/build.mjs
