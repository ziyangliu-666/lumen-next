#!/usr/bin/env bash
# Every service runs on the public server, and the autoscalers are in place.
source "$(dirname "$0")/lib.sh"
say "kubectl get pods -n lumen"; pause 3
say "kubectl get hpa -n lumen"; pause 5
