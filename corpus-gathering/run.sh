#!/bin/sh
# Usage: corpus-gathering/run.sh <raw folder>. Keep the raw folder outside the repo: its documents hold the sites' real text.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
raw=$(mkdir -p "$1" && cd "$1" && pwd)
fejkdata_image=larvit/fejkdata:0.2.0
node_image=node:26.13.0-alpine3.24

in_node() {
  docker run --rm --memory 2g --memory-swap 2g --ulimit core=0 -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$here/..:/repo" -v "$raw:/raw" -w /repo "$node_image" "$@"
}

# Takes a draws file's name, the number of lines and the template of a line.
draw() {
  printf '%s\n' "$3" | docker run --rm -i --memory 256m --memory-swap 256m "$fejkdata_image" --seed 163 --repeat "$2" > "$raw/draws/$1.txt"
}

[ -d "$raw/documents" ] || in_node node corpus-gathering/fetch.mjs corpus-gathering/sites.json /raw

mkdir -p "$raw/draws"
draw digits 5000 '{digits(32)}'
draw hex 5000 '{hex(32)}'
draw letters 5000 '{lower(32)}'
draw persons 2000 '{/en_US.person}'
draw uuids 20000 '{/misc.uuid}'
draw words 20000 '{/en_US.word}'

in_node node corpus-gathering/write-corpus.mjs corpus-gathering/sites.json /raw corpus/real-world corpus/real-world-sources.json
