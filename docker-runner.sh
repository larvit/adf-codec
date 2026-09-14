bun_image=oven/bun:1.4.0-alpine
deno_image=denoland/deno:2.9.6
firefox_image=selenium/standalone-firefox:153.0.4
floor_image=node:18.20.8-alpine3.21
node_image=node:24.19.0-alpine3.24

in_image() {
  local image=$1 entrypoint=$2
  shift 2
  docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp ${PROPERTY_RUNS:+-e PROPERTY_RUNS} ${in_image_network:+--network "$in_image_network"} -v "$PWD:/app" -w /app --entrypoint "$entrypoint" "$image" "$@"
}

with_firefox() {
  local container in_image_network status=0
  container=$(docker run -d --rm "$firefox_image")
  # The id is baked in: the trap fires after this function's locals are gone.
  trap "docker rm -f $container >/dev/null 2>&1" EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  in_image_network="container:$container"
  "$@" || status=$?
  return $status
}
