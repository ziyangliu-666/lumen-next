#!/bin/sh
# The container's first process. With LUMEN_COMPUTE_PROVIDER=docker it starts
# a Docker daemon inside this machine before the server, so the readers'
# sandboxes run here: their bind mounts are this machine's own .data folders,
# which a Docker host elsewhere could not see. A Fly machine is a full VM, so
# a daemon runs in it without a privileged flag. The daemon needs root; the
# server does not, so it is started as the node user once the daemon answers.
set -e

if [ "${LUMEN_COMPUTE_PROVIDER:-none}" = "docker" ]; then
  # No bridge and no iptables: every sandbox runs with --network none anyway,
  # and a VM without the netfilter modules would stop the daemon on them.
  dockerd --host=unix:///var/run/docker.sock --group=docker --bridge=none --iptables=false >/var/log/dockerd.log 2>&1 &
  # Up to 30 s for the daemon. If it never answers, the server still starts:
  # every run then fails with the daemon's error, which the agents report.
  i=0
  until docker info >/dev/null 2>&1 || [ "$i" -ge 30 ]; do i=$((i + 1)); sleep 1; done
  # Fetch the sandbox image now, so the first run of a session does not wait for it.
  (docker pull --quiet "${LUMEN_SANDBOX_IMAGE:-python:3.12-alpine3.20}" >/dev/null 2>&1 || true) &
fi

# HOME too: setpriv keeps root's, and the docker client then prints a
# permission warning into every run's output.
export HOME=/home/node
exec setpriv --reuid=node --regid=node --init-groups node apps/server/dist/main.js
