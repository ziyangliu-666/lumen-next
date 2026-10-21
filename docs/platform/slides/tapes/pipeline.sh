#!/usr/bin/env bash
# The platform pipeline on GitHub: the runs, and every job of one run.
source "$(dirname "$0")/lib.sh"
say "gh run list --workflow platform-deploy.yml --limit 6"; pause 3
say "gh run view 39441445313 | head -12"; pause 6
