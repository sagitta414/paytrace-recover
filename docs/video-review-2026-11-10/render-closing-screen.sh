#!/bin/bash
# Exports closing-screen.html to closing-screen.png and closing-screen.mp4 (1920x1080, 30 fps).
# Usage: render-closing-screen.sh [seconds]   (default 10.7, the length of the current end card)
set -euo pipefail
HERE="$(dirname "$(realpath "$0")")"
SECONDS_LONG="${1:-10.7}"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/paytrace-endcard.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
FRAMES=$(awk -v s="$SECONDS_LONG" 'BEGIN { printf "%d", s * 30 + 0.5 }')

shot() {
  local i="$1" t
  t=$(awk -v i="$i" 'BEGIN { printf "%.4f", i / 30 }')
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size=1920,1080 --user-data-dir="$WORK/profile-$((i % 6))-$$-$i" \
    --screenshot="$WORK/$(printf 'f_%04d.png' "$i")" \
    "file://$HERE/closing-screen.html?t=$t" >/dev/null 2>&1
  rm -rf "$WORK/profile-$((i % 6))-$$-$i"
}
export -f shot; export CHROME WORK HERE
seq 0 $((FRAMES - 1)) | xargs -P 6 -I{} bash -c 'shot {}'

ffmpeg -v error -y -framerate 30 -i "$WORK/f_%04d.png" -c:v libx264 -crf 14 -preset slow \
  -pix_fmt yuv420p -movflags +faststart "$HERE/closing-screen.mp4"
cp "$WORK/$(printf 'f_%04d.png' $((FRAMES - 1)))" "$HERE/closing-screen.png"
echo "Wrote $HERE/closing-screen.mp4 and closing-screen.png ($FRAMES frames)"
