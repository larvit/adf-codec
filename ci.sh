#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
source ./docker-runner.sh

leg "install ($node_image)" in_image "$node_image" npm ci
leg "typecheck ($node_image)" in_image "$node_image" npm run typecheck
leg "lint ($node_image)" in_image "$node_image" npm run lint

# The boundaries pass by finding nothing, so probe that each still fires: oxlint bumps automerge on green. Each line names a probe file and an import its boundary refuses.
boundary_probes="src/adf/boundary-probe.ts ../markdown/flavour.ts
src/adf/boundary-probe-html.ts ../html/emit/adf-to-html.ts
src/html/boundary-probe.ts ../markdown/flavour.ts
src/html/parse/boundary-probe.ts ../emit/adf-to-html.ts
src/html/parse/boundary-probe-markdown.ts ../../markdown/flavour.ts
src/markdown/boundary-probe-html.ts ../html/emit/adf-to-html.ts
src/markdown/directive/boundary-probe.ts ../parse/blocks.ts
src/markdown/directive/boundary-probe-emit.ts ../emit/image.ts
src/markdown/directive/boundary-probe-html.ts ../../html/emit/adf-to-html.ts
src/markdown/emit/boundary-probe.ts ../portable/conventions.ts
src/markdown/emit/boundary-probe-html.ts ../../html/emit/adf-to-html.ts
src/markdown/parse/boundary-probe.ts ../emit/adf-to-markdown.ts
src/markdown/parse/boundary-probe-html.ts ../../html/emit/adf-to-html.ts
src/markdown/parse/boundary-probe-portable.ts ../portable/conventions.ts"

boundaries_fire() {
  local allowed=src/markdown/parse/boundary-probe-allowed.ts lint_log probe probes target
  probes=$(cut -d ' ' -f 1 <<< "$boundary_probes" | tr '\n' ' ') &&
  lint_log=$(mktemp) &&
  # The paths are baked in: the trap fires after this function's locals are gone.
  trap "rm -f $allowed $probes $lint_log" EXIT &&
  trap 'exit 130' INT &&
  trap 'exit 143' TERM &&
  echo "import '../emit/spelling-questions.ts';" > "$allowed" &&
  in_image "$node_image" npm run lint &&
  while read -r probe target; do
    echo "import '$target';" > "$probe" || return 1
  done <<< "$boundary_probes" &&
  ! in_image "$node_image" npm run lint -- --format unix 2>&1 | tee "$lint_log" &&
  for probe in $probes; do
    grep -q "^$probe:.*eslint(no-restricted-imports)" "$lint_log" || return 1
  done &&
  rm -f "$allowed" $probes "$lint_log"
}

leg "import boundaries fire ($node_image)" boundaries_fire

interrupt_stops_container() {
  local pid ready status=0 waited=0
  ready=$(mktemp) || return 1
  in_image "$node_image" sh -c 'echo ready; sleep 60' > "$ready" &
  pid=$!
  until grep -q ready "$ready"; do
    waited=$((waited + 1))
    [ "$waited" -le 300 ] || { kill -INT "$pid"; rm -f "$ready"; return 1; }
    sleep 0.2
  done
  kill -INT "$pid" && wait "$pid" || status=$?
  rm -f "$ready"
  [ "$status" -eq 130 ]
}

leg "Ctrl-C stops an in_image container ($node_image)" interrupt_stops_container

# Equal --memory-swap leaves cgroup v2 a swap.max of 0; cgroup v1 reports it as the memory-plus-swap limit.
container_is_limited() {
  local limits
  limits=$(in_image "$node_image" sh -c 'cat /sys/fs/cgroup/memory.max /sys/fs/cgroup/memory.swap.max 2>/dev/null || cat /sys/fs/cgroup/memory/memory.limit_in_bytes /sys/fs/cgroup/memory/memory.memsw.limit_in_bytes' | tr '\n' ' ') &&
  { [ "$limits" = '8589934592 0 ' ] || [ "$limits" = '8589934592 8589934592 ' ]; }
}

leg "an in_image container is capped at 8g with no swap ($node_image)" container_is_limited

# with_firefox and publish.sh start containers no leg here can inspect.
every_docker_run_is_limited() {
  ! grep -h 'docker run' docker-runner.sh publish.sh | grep -v -e '--memory "[^"]*" --memory-swap "[^"]*"'
}

leg "every docker run in docker-runner.sh and publish.sh names a memory and a swap limit" every_docker_run_is_limited

test_log=$(mktemp)
node_tests() {
  in_image "$node_image" npm test 2>&1 | tee "$test_log"
}

leg "tests ($node_image)" node_tests
if grep -q 'ℹ tests 0' "$test_log"; then
  echo 'the gate ran zero tests — failing instead of a vacuous green'
  exit 1
fi
rm -f "$test_log"

leg "tests ($deno_image)" in_image "$deno_image" deno test --allow-env=PROPERTY_RUNS --allow-read --no-check src/
leg "tests ($bun_image)" in_image "$bun_image" bun test src/
leg "corpus-gathering tests ($node_image)" in_image "$node_image" node --test corpus-gathering/
leg "feature table tests ($node_image)" in_image "$node_image" node --test feature-table/
in_image_memory=1g leg "release tooling tests ($node_image)" in_image "$node_image" node --test release-tooling/

leg "build ($node_image)" in_image "$node_image" npm run build
leg "feature table is current ($node_image)" in_image "$node_image" node feature-table/build.mjs --check
leg "pack and install the tarball ($node_image)" in_image "$node_image" sh -c 'set -e
  rm -rf package-tests/node_modules
  npm pack --pack-destination /tmp
  npm install --no-audit --no-fund --no-package-lock --no-save --offline --prefix package-tests /tmp/*.tgz'
leg "typecheck the consumer ($node_image)" in_image "$node_image" npx tsc -p package-tests
leg "round-trip on the engines floor ($floor_image)" in_image "$floor_image" node package-tests/node-floor.js

leg "browser ($firefox_image)" with_firefox in_image "$node_image" node browser-tests/run.js
