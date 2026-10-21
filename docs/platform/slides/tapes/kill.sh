#!/usr/bin/env bash
# A worker is killed in the middle of a question; the question still ends.
source "$(dirname "$0")/lib.sh"
say "SID=\$(curl -s \"\$API/questions\" -H \"\$AUTH\" -H \"\$JSON\" -d '{\"question\":\"Find three recent papers on pattern-avoiding permutations and summarise each in one line.\"}' | jq -r .sessionId); echo \$SID"; pause 3
say "kubectl delete pod -n lumen -l app.kubernetes.io/name=worker --force --grace-period=0"; pause 3
say "for i in \$(seq 12); do curl -s \"\$API/questions/\$SID\" -H \"\$AUTH\" | jq -c '{status, cost}'; sleep 4; done"
say "kubectl get pods -n lumen -l app.kubernetes.io/name=worker"; pause 4
