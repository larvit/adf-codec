#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
source ./docker-runner.sh

read_field() {
  in_image "$node_image" npm pkg get "$1" | tr -d '"\r'
}

published_version() {
  in_image "$node_image" npm view "$1@$2" version 2>/dev/null || true
}

private=$(read_field private)
if [ "$private" = 'true' ]; then
  echo 'package.json is private — the maintainer removes that in the bump that first publishes'
  exit 0
fi

name=$(read_field name)
version=$(read_field version)

# Both steps observe their own end state, so a partial run converges on the next push to main.
if [ -z "$(published_version "$name" "$version")" ]; then
  : "${NPM_TOKEN:?the publish needs NPM_TOKEN}"
  in_image "$node_image" npm ci
  in_image "$node_image" npm run build
  docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -e NPM_TOKEN -v "$PWD:/app" -w /app --entrypoint sh "$node_image" -c \
    'printf "//registry.npmjs.org/:_authToken=%s\n" "$NPM_TOKEN" > "$HOME/.npmrc" && npm publish --access public'
fi

if [ -z "$(git ls-remote --tags origin "v$version")" ]; then
  git tag "v$version"
  git push origin "v$version"
fi
