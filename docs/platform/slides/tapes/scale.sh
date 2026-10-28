#!/usr/bin/env bash
# KEDA's autoscaler during the load test: jobs per worker against the target of 5.
source "$(dirname "$0")/lib.sh"
say "kubectl get hpa keda-hpa-worker -n lumen --watch"
