: "${EPOCHREALTIME:?the gate times its legs with EPOCHREALTIME — bash 5 or newer}"

bun_image=oven/bun:1.4.0-alpine
deno_image=denoland/deno:2.9.6
firefox_image=selenium/standalone-firefox:153.0.4
floor_image=node:18.20.8-alpine3.21
node_image=node:24.19.0-alpine3.24

in_image() {
  local image=$1 entrypoint=$2
  shift 2
  docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp ${PROPERTY_RUNS+-e PROPERTY_RUNS} ${in_image_network:+--network "$in_image_network"} -v "$PWD:/app" -w /app --entrypoint "$entrypoint" "$image" "$@"
}

# Markers on stderr so a captured leg's value stays clean; leg_* because bash scopes local into the leg's own call.
leg() {
  local leg_name=$1 leg_elapsed leg_started leg_status=0
  shift
  printf '\n\033[1;34m==> %s\033[0m\n' "$leg_name" >&2
  # EPOCHREALTIME carries the locale's radix character, so keep the digits and read microseconds.
  leg_started=${EPOCHREALTIME//[^0-9]/}
  "$@" || leg_status=$?
  leg_elapsed=$((${EPOCHREALTIME//[^0-9]/} - leg_started))
  printf '\033[1;34m<== %s: %d.%ds\033[0m\n' "$leg_name" "$((leg_elapsed / 1000000))" "$((leg_elapsed % 1000000 / 100000))" >&2
  return $leg_status
}

with_firefox() {
  local container in_image_network status=0
  container=$(docker run -d --rm "$firefox_image") || return $?
  # The id is baked in: the trap fires after this function's locals are gone.
  trap "docker rm -f $container >/dev/null 2>&1" EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  in_image_network="container:$container"
  "$@" || status=$?
  return $status
}
