#!/usr/bin/env bash
# The worker pods during the load test: new copies start, and later go away.
source "$(dirname "$0")/lib.sh"
say "kubectl get pods -n lumen -l app.kubernetes.io/name=worker --watch"
