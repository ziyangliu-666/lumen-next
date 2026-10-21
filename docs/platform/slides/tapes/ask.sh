#!/usr/bin/env bash
# A real question through the public API, with an API key, answered by the real model.
source "$(dirname "$0")/lib.sh"
say "curl -s \"\$API/questions\" -H \"\$AUTH\" -H \"\$JSON\" -d '{\"question\":\"How many prime numbers are there below 100?\"}' | tee /tmp/q.json | jq"; pause 2
say 'SID=$(jq -r .sessionId /tmp/q.json); sleep 4'
say "curl -s \"\$API/questions/\$SID\" -H \"\$AUTH\" | tee /tmp/a.json | jq '{status, cost, startedAt, endedAt}'"; pause 2
say "jq -r .answer /tmp/a.json"; pause 5
