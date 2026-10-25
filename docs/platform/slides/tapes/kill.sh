#!/usr/bin/env bash
# A worker is killed in the middle of a question; the question still ends.
source "$(dirname "$0")/lib.sh"
say "SID=\$(curl -s \"\$API/questions\" -H \"\$AUTH\" -H \"\$JSON\" -d '{\"question\":\"What was published recently on Catalan numbers?\",\"agent\":\"literature-scout\"}' | jq -r .sessionId); echo \$SID"; pause 8
say "curl -s \"\$API/questions/\$SID\" -H \"\$AUTH\" | jq -c '{status, cost}'"; pause 1
say "kubectl delete pod -n lumen -l app.kubernetes.io/name=worker --force --grace-period=0 2>/dev/null"; pause 2
say "kubectl get pods -n lumen -l app.kubernetes.io/name=worker"; pause 1
say "until curl -s \"\$API/questions/\$SID\" -H \"\$AUTH\" | jq -c '{status, cost, findings: (.findings | length)}' | tee /dev/stderr | grep -qv running; do sleep 6; done"; pause 1
say "kubectl get pods -n lumen -l app.kubernetes.io/name=worker"; pause 4
