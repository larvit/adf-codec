#!/bin/sh
# Keep these versions and --before in step with the README's comparison table.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
node_image=node:26.12.1-alpine3.24
docker run --rm --ulimit core=0 -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$here:/comparison:ro" -w /tmp \
  "$node_image" sh -c '
    npm install --before=2026-10-15 --ignore-scripts --no-audit --no-fund --silent \
      @atlaskit/editor-json-transformer@10.0.0 \
      @atlaskit/editor-markdown-transformer@6.3.1 \
      @larvit/adf-codec@0.2.0 \
      adf-to-markdown@1.0.1 \
      adf-to-md@1.2.1 \
      adf2markdown@1.2.0 \
      extended-markdown-adf-parser@2.4.0 \
      marklassian@1.2.1 \
      md-to-adf@0.6.4 &&
    cp /comparison/compare.mjs . && node compare.mjs'
