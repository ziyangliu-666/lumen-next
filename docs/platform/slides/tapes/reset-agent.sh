#!/usr/bin/env bash
# Before the talk: take literature-scout out of the registry, so it can be
# published live from the Agents page. Past sessions stay; they lose the link
# to the agent, so its usage starts again from zero.
# DRY=1 only shows the agents.
set -euo pipefail
HOST="${LUMEN_HOST:-139.180.185.51}"
if [ "${DRY:-}" = 1 ]; then
  SQL="select slug, created_at from platform_agents where withdrawn_at is null;"
else
  SQL="update platform_question_intents set agent_id = null where agent_id in (select id from platform_agents where slug = 'literature-scout'); delete from platform_agents where slug = 'literature-scout';"
fi
echo "$SQL" | ssh -i "$HOME/.ssh/lumen-platform" -o BatchMode=yes -o LogLevel=ERROR "ubuntu@$HOST" \
  sudo k3s kubectl exec -i -n lumen postgres-0 -- psql -U lumen -d lumen
