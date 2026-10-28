#!/usr/bin/env bash
# Records one script as an asciinema cast and renders it as a GIF the size of the deck's
# picture, in lumen's dark palette and JetBrains Mono.
#   record.sh pods [seconds]     seconds: stop a --watch after this long
set -euo pipefail
cd "$(dirname "$0")"
name=$1
limit=${2:-0}
out=../out
mkdir -p "$out/casts"
cmd="bash $PWD/$name.sh"
[ "$limit" -gt 0 ] && cmd="timeout $limit $cmd"
asciinema rec --headless --overwrite -q --window-size 140x25 -i 2 -c "$cmd" "$out/casts/$name.cast" || true
