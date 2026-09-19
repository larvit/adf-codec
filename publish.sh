#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
source ./docker-runner.sh

published_version() {
  in_image "$node_image" npm view "$1@$2" version 2>/dev/null || true
}

push_tag() {
  git tag "v$version" && git push origin "v$version"
}

read_field() {
  in_image "$node_image" npm pkg get "$1" | tr -d '"\r'
}

read_package_fields() {
  private=$(read_field private) &&
    name=$(read_field name) &&
    version=$(read_field version)
}

leg "read package.json ($node_image)" read_package_fields
if [ "$private" = 'true' ]; then
  echo 'package.json is private — the maintainer removes that in the bump that first publishes'
  exit 0
fi

published=$(leg "ask npmjs for $name@$version ($node_image)" published_version "$name" "$version")
tagged=$(leg "ask origin for v$version" git ls-remote --tags origin "v$version")

# Both steps observe their own end state, so a partial run converges on the next push to main.
if [ -z "$published" ]; then
  : "${NPM_TOKEN:?the publish needs NPM_TOKEN}"
  leg "install ($node_image)" in_image "$node_image" npm ci
  leg "build ($node_image)" in_image "$node_image" npm run build
  leg "publish $name@$version ($node_image)" \
    docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -e NPM_TOKEN -v "$PWD:/app" -w /app --entrypoint sh "$node_image" -c \
    'printf "//registry.npmjs.org/:_authToken=%s\n" "$NPM_TOKEN" > "$HOME/.npmrc" && npm publish --access public'
fi

if [ -z "$tagged" ]; then
  leg "tag v$version" push_tag
fi
