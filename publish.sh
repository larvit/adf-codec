#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
source ./docker-images.sh

read_field() {
  in_image "$node_image" npm pkg get "$1" | tr -d '"\r'
}

if [ "$(read_field private)" = 'true' ]; then
  echo 'package.json is private — the maintainer removes that in the bump that first publishes'
  exit 0
fi

name=$(read_field name)
version=$(read_field version)
published=$(in_image "$node_image" npm view "$name@latest" version 2>/dev/null || true)
if [ "$version" = "$published" ]; then
  echo "npm holds $name $version already — no bump, no deploy"
  exit 0
fi

: "${NPM_TOKEN:?the publish needs NPM_TOKEN}"
in_image "$node_image" npm ci
in_image "$node_image" npm run build
in_image "$node_image" sh -c 'printf "//registry.npmjs.org/:_authToken=%s\n" "$NPM_TOKEN" > "$HOME/.npmrc" && npm publish --access public'
git tag "v$version"
git push origin "v$version"
