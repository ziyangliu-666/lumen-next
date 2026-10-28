#!/usr/bin/env bash
# The literature watch: a second app, built only on the public API and an API key.
source "$(dirname "$0")/lib.sh"
export LUMEN_API_KEY="$(cat "$HOME/.lumen-platform/demo-key")" WATCH_FILE=/tmp/assvid/watches.json
say 'cat $WATCH_FILE'; pause 2
say 'node apps/watch/watch.mjs > digest.md; head -8 digest.md'; pause 3
say "sed -n '/## Findings/,\$p' digest.md | cut -c1-100"; pause 4
say "curl -s \"\$API/usage\" -H \"\$AUTH\" | jq '.asProducer'"; pause 5
