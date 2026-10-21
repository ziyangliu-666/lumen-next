#!/usr/bin/env bash
# Every deploy is a Helm release on the server.
source "$(dirname "$0")/lib.sh"
say "helm history lumen -n lumen"; pause 3
say "kubectl rollout history deployment/worker -n lumen"; pause 5
