#!/bin/bash
# Compile the macOS mouse-clamp native addon for one arch and stage it where
# electron-builder's extraResources picks it up (build-staging/mouseclamp/<arch>).
# See electron/native/mouseclamp/mouseclamp.mm for what it fixes.
set -euo pipefail

ARCH="${1:?usage: build-mouseclamp.sh <arm64|x64>}"
ELECTRON_TARGET="42.0.0"

HERE="$(cd "$(dirname "$0")/.." && pwd)"   # electron/
SRC="$HERE/native/mouseclamp"
OUT="$HERE/build-staging/mouseclamp/$ARCH"
NODE_GYP="$HERE/node_modules/.bin/node-gyp"
[[ -x "$NODE_GYP" ]] || NODE_GYP="npx --yes node-gyp"  # transitive dep usually, npx if not

echo "[mouseclamp] building for arch=$ARCH (electron $ELECTRON_TARGET)"
cd "$SRC"
rm -rf build
$NODE_GYP rebuild \
  --target="$ELECTRON_TARGET" \
  --arch="$ARCH" \
  --dist-url=https://electronjs.org/headers

mkdir -p "$OUT"
cp "build/Release/mouseclamp.node" "$OUT/mouseclamp.node"
echo "[mouseclamp] staged -> $OUT/mouseclamp.node"
file "$OUT/mouseclamp.node"
