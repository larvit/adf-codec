bun_image=oven/bun:1.4.0-alpine
deno_image=denoland/deno:2.9.6
floor_image=node:18.20.8-alpine3.21
node_image=node:24.19.0-alpine3.24

in_image() {
  local image=$1 entrypoint=$2
  shift 2
  docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD:/app" -w /app --entrypoint "$entrypoint" "$image" "$@"
}
