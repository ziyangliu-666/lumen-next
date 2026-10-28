#!/usr/bin/env bash
# For the KEDA demo: 15 questions with the agent at once (about USD 0.15).
# Watch in a second terminal: kubectl get hpa keda-hpa-worker -n lumen --watch
# The workers go from 1 to 3 in about 25 s, and back to 1 about 4 minutes later.
source "$(dirname "$0")/lib.sh"
for t in "Catalan numbers" "Motzkin paths" "Dyck paths" "Schroeder numbers" "permutation patterns" \
  "Young tableaux" "set partitions" "integer partitions" "Bell numbers" "Fibonacci identities" \
  "lattice paths" "plane trees" "Narayana numbers" "Stirling numbers" "q-analogues"; do
  curl -s "$API/questions" -H "$AUTH" -H "$JSON" -o /dev/null -w "%{http_code} " \
    -d "{\"question\":\"What was published recently on $t?\",\"agent\":\"${AGENT:-literature-scout}\"}"
done
echo
