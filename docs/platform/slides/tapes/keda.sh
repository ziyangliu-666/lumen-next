#!/usr/bin/env bash
# KEDA on the public server: 15 questions at once, and the workers follow the queue.
source "$(dirname "$0")/lib.sh"
say 'kubectl get scaledobject worker -n lumen'; pause 2
say 'docs/platform/slides/tapes/burst.sh'; pause 1
say 'for i in $(seq 9); do kubectl get hpa keda-hpa-worker -n lumen --no-headers; sleep 4; done'; pause 1
say 'kubectl get pods -n lumen -l app.kubernetes.io/name=worker'; pause 5
