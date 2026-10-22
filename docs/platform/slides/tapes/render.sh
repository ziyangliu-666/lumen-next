#!/usr/bin/env bash
# Renders casts as GIFs: lumen's black, white and greys, red kept for errors only.
#   render.sh pods [speed]
set -euo pipefail
cd "$(dirname "$0")"
name=$1
speed=${2:-1}
agg --font-family "JetBrains Mono" --font-size 22 --line-height 1.35 --fps-cap 30 \
  --speed "$speed" --idle-time-limit 2 --last-frame-duration 4 \
  --theme 000000,ffffff,000000,ff3b30,ffffff,d5d6d8,c4c6ca,c4c6ca,d5d6d8,9a9da3,7c8086,ff3b30,ffffff,ffffff,ffffff,ffffff,ffffff,ffffff \
  "../out/casts/$name.cast" "../out/rec-$name.gif"
ls -la "../out/rec-$name.gif"
