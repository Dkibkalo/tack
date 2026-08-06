#!/usr/bin/env bash
# Turns tools/record/frames/*.png into the three assets the site and README use.
# Run after record.mjs, or use `npm run demo` for both.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
FRAMES="$HERE/frames"
OUT="$ROOT/public"
FF="${FFMPEG:-ffmpeg}"

[ -d "$FRAMES" ] || { echo "no frames — run 'node tools/record/record.mjs' first" >&2; exit 1; }
command -v "$FF" >/dev/null || { echo "ffmpeg not found (set FFMPEG=/path/to/ffmpeg)" >&2; exit 1; }

# Frames are captured at 2x (2000x962) and halved here, which is what keeps the text
# crisp. 1000x482 is the size the landing's demo window is laid out around; changing
# it changes the page, so keep it unless you mean to.
"$FF" -hide_banner -loglevel error -framerate 20 -i "$FRAMES/%04d.png" \
  -vf "scale=1000:482:flags=lanczos" \
  -c:v libx264 -profile:v high -crf 26 -pix_fmt yuv420p -movflags +faststart \
  -y "$OUT/demo.mp4"

# The GIF exists for the README, because GitHub will not play an mp4 from markdown.
# 10fps/64 colours/700px is a deliberate trade: an 8fps cut saves ~150KB, but a demo
# is judged on how it moves, and the typing is where that shows.
"$FF" -hide_banner -loglevel error -framerate 20 -i "$FRAMES/%04d.png" \
  -vf "fps=10,scale=700:-1:flags=lanczos,palettegen=max_colors=64" -y "$FRAMES/palette.png"
"$FF" -hide_banner -loglevel error -framerate 20 -i "$FRAMES/%04d.png" -i "$FRAMES/palette.png" \
  -lavfi "fps=10,scale=700:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4" \
  -y "$OUT/demo.gif"

# The poster is what a phone shows under "tap full screen", so it has to show the tool
# working rather than an empty page. record.mjs marks the frame; never hardcode one.
POSTER="$(cat "$FRAMES/poster.txt" 2>/dev/null || echo 0)"
"$FF" -hide_banner -loglevel error -i "$FRAMES/$(printf '%04d' "$POSTER").png" \
  -vf "scale=1000:482:flags=lanczos" -q:v 4 -y "$OUT/demo-poster.jpg"

printf 'wrote:\n'
for f in demo.mp4 demo.gif demo-poster.jpg; do
  printf '  public/%-16s %8s bytes\n' "$f" "$(stat -c%s "$OUT/$f" 2>/dev/null || stat -f%z "$OUT/$f")"
done
printf 'poster taken from frame %s\n' "$POSTER"
