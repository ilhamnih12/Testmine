#!/usr/bin/env bash
#
# build-luanti-wasm.sh
#
# Builds the real Luanti (Minetest) engine to WebAssembly via the community
# Emscripten pipeline and stages the outputs into this repo's /public folder so
# the Next.js wrapper boots the actual engine instead of the fallback demo.
#
# Background: upstream Luanti has no official WASM target. The de-facto build
# is the `paradust7/luanti-wasm` (formerly minetest-wasm) toolchain, forked and
# modernised by `Kaesual/minetest-wasm`. This script wraps that Docker-based
# build so you don't need to install Emscripten yourself.
#
# Usage:
#   ./scripts/build-luanti-wasm.sh
#
# Prerequisites:
#   - docker (with buildx)
#   - curl, git, tar
#
# Output (staged into /public):
#   - luanti.js    (Emscripten loader)
#   - luanti.wasm  (engine binary)
#   - luanti.data  (file system / game pack bundle)
#   - games/*      (optional: pre-packed games such as VoxeLibre)
#
# NOTE: These artifacts are large (tens of MB) and are git-ignored.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUBLIC_DIR="${REPO_ROOT}/public"
WORK_DIR="${REPO_ROOT}/.luanti-wasm-build"
UPSTREAM_REPO="https://github.com/Kaesual/minetest-wasm.git"

mkdir -p "${PUBLIC_DIR}/games" "${WORK_DIR}"

log() { echo -e "\033[1;34m[luanti-wasm]\033[0m $*"; }
err() { echo -e "\033[1;31m[luanti-wasm]\033[0m $*" >&2; exit 1; }

command -v docker >/dev/null 2>&1 || err "docker is required. Install it, or use the Kaesual build repo directly."
command -v git >/dev/null 2>&1 || err "git is required."

log "Fetching upstream Luanti-WASM build repo..."
if [ ! -d "${WORK_DIR}/minetest-wasm" ]; then
  git clone --depth 1 "${UPSTREAM_REPO}" "${WORK_DIR}/minetest-wasm"
else
  git -C "${WORK_DIR}/minetest-wasm" pull --ff-only || true
fi

cd "${WORK_DIR}/minetest-wasm"

log "Building engine + loader with Docker (this takes a while; be patient)..."
./build_all_with_docker.sh

log "Staging outputs into ${PUBLIC_DIR}..."
STAGED="${WORK_DIR}/minetest-wasm/www"
for f in luanti.js luanti.wasm luanti.data; do
  if [ -f "${STAGED}/${f}" ]; then
    cp "${STAGED}/${f}" "${PUBLIC_DIR}/${f}"
    log "  + /public/${f} ($(du -h "${PUBLIC_DIR}/${f}" | cut -f1))"
  else
    warn "  ! expected ${f} not found in ${STAGED}; check the upstream build logs"
  fi
done

# Copy any pre-packed games (VoxeLibre etc.)
if [ -d "${STAGED}/games" ]; then
  cp -r "${STAGED}/games/." "${PUBLIC_DIR}/games/"
  log "  + /public/games/*"
fi

log "Done. Restart the app; the wrapper will now boot the real engine instead of the demo."
log "Tip: for a deployment, run the same build in CI and commit /public outputs (or upload to a bucket)."
