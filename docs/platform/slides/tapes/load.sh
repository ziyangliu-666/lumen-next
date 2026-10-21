#!/usr/bin/env bash
# The k6 load test against the public server: ten users ask questions without pause.
source "$(dirname "$0")/lib.sh"
say "k6 run -q -e PROFILE=short -e LUMEN_URL=\$LUMEN_URL deploy/k8s/load/ask.js"; pause 5
