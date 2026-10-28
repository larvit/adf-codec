#!/bin/sh
# Keep these versions and --before in step with the README's comparison table and the packages it leaves out.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
node_image=node:26.12.1-alpine3.24
docker run --rm --memory 2g --memory-swap 2g --ulimit core=0 -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$here:/comparison:ro" -w /tmp \
  "$node_image" sh -c '
    npm install --before=2026-10-29 --ignore-scripts --no-audit --no-fund --silent \
      @atlaskit/editor-json-transformer@10.0.0 \
      @atlaskit/editor-markdown-transformer@6.3.1 \
      @faulander/md2adf@1.0.0 \
      @larvit/adf-codec@0.2.0 \
      @nthings.dev/adf4j-wasm@1.0.2 \
      @wrtnlabs/markdown-to-adf@1.0.2 \
      adf-converter@0.1.0 \
      adf-md@0.2.0 \
      adf-to-markdown@1.0.1 \
      adf-to-md@1.2.1 \
      adf2markdown@1.2.0 \
      extended-markdown-adf-parser@2.4.0 \
      github-markdown-adf@1.3.0 \
      markdown-to-adf@0.2.20 \
      marklassian@1.2.1 \
      md-adf@0.2.2 \
      md-to-adf@0.6.4 \
      mdast-util-from-adf@2.3.0 \
      mdast-util-to-markdown@2.2.1 &&
    cp /comparison/compare.mjs . && node compare.mjs'
