#!/usr/bin/env bash
# The command-line demonstration for the presentation
# (docs/platform/contract.md, "The demonstration, from the command line").
#
#   LUMEN_URL=https://lumen.1-2-3-4.sslip.io \
#   LUMEN_SSH_HOST=1.2.3.4 LUMEN_SSH_KEY=~/.ssh/lumen-deploy \
#   deploy/k8s/demo.sh [--no-pause]
#
# LUMEN_URL       the public origin (required). The same script runs against
#                 local k3d with LUMEN_URL=http://lumen.localhost.
# LUMEN_SSH_HOST  run kubectl on the k3s host over SSH, as user ubuntu. Unset:
#                 use the local kubectl and its current context.
# LUMEN_SSH_KEY   the private key for LUMEN_SSH_HOST (optional).
#
# Each step prints the exact command before it runs it, then waits for Enter,
# so the presenter sets the pace. --no-pause runs straight through.
set -euo pipefail

PAUSE=1
for arg in "$@"; do
  case "$arg" in
    --no-pause) PAUSE=0 ;;
    -h | --help)
      sed -n '2,17p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg (use --no-pause)" >&2
      exit 2
      ;;
  esac
done

if [ -z "${LUMEN_URL:-}" ]; then
  echo 'Set LUMEN_URL, for example LUMEN_URL=https://lumen.1-2-3-4.sslip.io' >&2
  exit 2
fi
# The identity slice compares the Origin header with LUMEN_ORIGIN exactly,
# so a trailing slash would make every sign-in a 403.
BASE=${LUMEN_URL%/}
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
NS=lumen

# --- Tools -----------------------------------------------------------------

need() {
  local tool=$1 hint=$2
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Missing: $tool. Install it with: $hint" >&2
    MISSING=1
  fi
}
MISSING=0
need curl 'brew install curl  (Ubuntu: sudo apt-get install curl)'
need jq 'brew install jq  (Ubuntu: sudo apt-get install jq)'
need k6 'brew install k6  (other systems: https://grafana.com/docs/k6/latest/set-up/install-k6/)'
if [ -n "${LUMEN_SSH_HOST:-}" ]; then
  need ssh 'brew install openssh  (Ubuntu: sudo apt-get install openssh-client)'
  KUBECTL=(ssh)
  if [ -n "${LUMEN_SSH_KEY:-}" ]; then KUBECTL+=(-i "$LUMEN_SSH_KEY"); fi
  KUBECTL+=("ubuntu@$LUMEN_SSH_HOST" sudo k3s kubectl)
else
  need kubectl 'brew install kubectl  (Ubuntu: sudo snap install kubectl --classic)'
  KUBECTL=(kubectl)
fi
if [ "$MISSING" = 1 ]; then exit 1; fi

# --- Helpers ---------------------------------------------------------------

WORK=$(mktemp -d)
JAR="$WORK/cookies"
K6_PID=''
cleanup() {
  if [ -n "$K6_PID" ] && kill -0 "$K6_PID" 2>/dev/null; then kill "$K6_PID" 2>/dev/null || true; fi
  rm -rf "$WORK"
}
trap cleanup EXIT

PASSWORD=''
STEP=0
step() {
  STEP=$((STEP + 1))
  printf '\n\033[1m== %d. %s\033[0m\n' "$STEP" "$*"
}

pause() {
  if [ "$PAUSE" = 1 ]; then
    read -r -p '   [Enter] ' _ </dev/tty || true
  fi
}

# Print the command, then run it. The password shows as $PASSWORD: the
# audience sees the command, not the secret.
show() {
  local shown="$*"
  # shellcheck disable=SC2016 # the literal text $PASSWORD is the point
  if [ -n "$PASSWORD" ]; then shown=${shown//"$PASSWORD"/'$PASSWORD'}; fi
  printf '\033[36m$ %s\033[0m\n' "$shown"
}
run() {
  show "$@"
  "$@"
}
kc() {
  run "${KUBECTL[@]}" "$@"
}

# The API, as the browser calls it: the session cookie in a jar, and the
# Origin header that the identity and billing slices check on writes.
api() {
  local method=$1 path=$2 body=${3:-}
  local args=(curl -sS --fail-with-body -b "$JAR" -c "$JAR" -X "$method" -H "Origin: $BASE")
  if [ -n "$body" ]; then args+=(-H 'content-type: application/json' -d "$body"); fi
  "${args[@]}" "$BASE$path"
}
api_shown() {
  show curl -sS -b "$JAR" -c "$JAR" -X "$1" -H "Origin: $BASE" ${3:+-H 'content-type: application/json' -d "'$3'"} "$BASE$2"
  api "$@"
}

root_status() {
  api GET "/api/sessions/$1" | jq -r '.tasks[] | select(.parentId == null) | .status'
}

at_rest() {
  case "$1" in ended | stopped | failed | waiting) return 0 ;; *) return 1 ;; esac
}

# Print the steps of a session as they arrive, until its root task is at rest.
# Steps are keyed by task and index, because a child's steps interleave with
# the lead's.
follow() {
  local sid=$1 seen="$WORK/seen-$1" deadline=$((SECONDS + 300)) snap status
  : >"$seen"
  show "curl -sS -b $JAR $BASE/api/sessions/$sid   (every 2 s)"
  while [ "$SECONDS" -lt "$deadline" ]; do
    snap=$(api GET "/api/sessions/$sid")
    jq -r '(.tasks | map({(.id): .agent}) | add // {}) as $agent
      | .steps[] | "\(.taskId):\(.index)\t\($agent[.taskId] // "?")\t\(.kind)\t\(.text)"' \
      <<<"$snap" >"$WORK/steps"
    while IFS=$'\t' read -r key agent kind text; do
      if ! grep -qxF "$key" "$seen"; then
        printf '   %-8s %-9s %s\n' "$agent" "$kind" "$text"
        echo "$key" >>"$seen"
      fi
    done <"$WORK/steps"
    status=$(jq -r '.tasks[] | select(.parentId == null) | .status' <<<"$snap")
    if at_rest "$status"; then
      echo "   root task: $status, spend \$$(jq -r '.spend.dollars' <<<"$snap")"
      return 0
    fi
    sleep 2
  done
  echo '   the session did not come to rest in 5 minutes' >&2
  return 1
}

ask() {
  api POST /api/projects "$(jq -nc --arg q "$1" '{question: $q, mode: "explore"}')" | jq -r '.sessionId'
}

show_queues() {
  show "${KUBECTL[*]} exec -n $NS rabbitmq-0 -- rabbitmqctl list_queues name messages messages_unacknowledged consumers | grep -E '^(name|lumen\.turns)'"
  "${KUBECTL[@]}" exec -n "$NS" rabbitmq-0 -- rabbitmqctl list_queues name messages messages_unacknowledged consumers |
    grep -E '^(name|lumen\.turns)' || true
}

worker_replicas() {
  "${KUBECTL[@]}" get deployment worker -n "$NS" -o 'jsonpath={.status.replicas}' 2>/dev/null || echo 0
}

# --- The demonstration -----------------------------------------------------

step 'The public address and its certificate'
run curl -sI "$BASE/"
if [[ "$BASE" == https://* ]]; then
  show "curl -sv -o /dev/null $BASE/ 2>&1 | grep -E 'subject:|issuer:|expire date:'"
  curl -sv -o /dev/null "$BASE/" 2>&1 | grep -E 'subject:|issuer:|expire date:' || true
fi
run curl -sS --fail-with-body "$BASE/api/health"
echo
pause

step 'Every service is running'
kc get pods,svc -n "$NS"
pause

step 'Sign up and sign in'
EMAIL="demo-$(date +%s)@example.com"
PASSWORD="Demo-$(head -c 12 /dev/urandom | od -An -tx1 | tr -d ' \n')"
api_shown POST /api/auth/signup "$(jq -nc --arg e "$EMAIL" --arg p "$PASSWORD" \
  '{email: $e, displayName: "Demo", password: $p}')" | jq .
echo
api_shown POST /api/auth/signout
: >"$JAR"
api_shown POST /api/auth/password "$(jq -nc --arg e "$EMAIL" --arg p "$PASSWORD" \
  '{email: $e, password: $p}')" | jq .
api_shown GET /api/me | jq '{email, displayName, role}'
pause

step 'Create a project with a question'
QUESTION='How many permutations of length 5 avoid the pattern 132?'
created=$(api_shown POST /api/projects "$(jq -nc --arg q "$QUESTION" '{question: $q, mode: "explore"}')")
jq '{project: .project.id, sessionId}' <<<"$created"
SESSION=$(jq -r '.sessionId' <<<"$created")
QUESTIONS=1
pause

step 'Watch the session: the steps arrive as the workers write them'
follow "$SESSION"
show "curl -sS -b $JAR $BASE/api/sessions/$SESSION | jq '.tasks[] | {agent, depth, status}'"
api GET "/api/sessions/$SESSION" | jq -c '.tasks[] | {agent, depth, status}'
pause

step 'Turns on the queues: one queue per task depth'
echo '   Ask one more question, then look at the queues at once.'
show "curl -sS -b $JAR -X POST -H 'Origin: $BASE' -H 'content-type: application/json' -d '{\"question\":\"...\",\"mode\":\"explore\"}' $BASE/api/projects"
QUEUE_SESSION=$(ask 'Which Catalan numbers are prime?')
QUESTIONS=$((QUESTIONS + 1))
sleep 2
show_queues
pause

step 'Load: k6 in the background, and the workers scale out'
SUMMARY="$WORK/k6-summary.json"
show "k6 run -e LUMEN_URL=$BASE -e PROFILE=short -e SUMMARY=$SUMMARY $SCRIPT_DIR/load/ask.js > $WORK/k6.log 2>&1 &"
k6 run -e "LUMEN_URL=$BASE" -e PROFILE=short -e "SUMMARY=$SUMMARY" \
  "$SCRIPT_DIR/load/ask.js" >"$WORK/k6.log" 2>&1 &
K6_PID=$!
PEAK=1
deadline=$((SECONDS + 240))
while [ "$SECONDS" -lt "$deadline" ]; do
  echo
  kc get scaledobject,hpa,pods -n "$NS"
  show_queues
  replicas=$(worker_replicas)
  if [ "${replicas:-0}" -gt "$PEAK" ]; then PEAK=$replicas; fi
  if [ "${replicas:-0}" -gt 1 ]; then
    echo "   worker replicas: $replicas"
    break
  fi
  sleep 5
done
if [ "$PEAK" -le 1 ]; then echo '   the worker did not scale out in 4 minutes'; fi
pause

step 'Kill a worker during a run: another worker takes the turn'
KILL_SESSION=$(ask 'Count the Dyck paths of semilength 6.')
QUESTIONS=$((QUESTIONS + 1))
echo "   session $KILL_SESSION"
# Wait for the first steps, so that a turn is in a worker's hands.
for _ in $(seq 1 15); do
  if [ "$(api GET "/api/sessions/$KILL_SESSION" | jq '.steps | length')" -ge 2 ]; then break; fi
  sleep 1
done
show "${KUBECTL[*]} get pods -n $NS -o name | grep '^pod/worker-' | head -1"
VICTIM=$("${KUBECTL[@]}" get pods -n "$NS" -o name | grep '^pod/worker-' | head -1 || true)
if [ -n "$VICTIM" ]; then
  kc delete "$VICTIM" -n "$NS" --wait=false
else
  echo '   no worker pod found'
fi
follow "$KILL_SESSION"
kc get pods -n "$NS"
pause

step 'The load test ends; the workers scale back in after the cooldown'
show "wait $K6_PID   (k6, the short profile takes about 2 minutes)"
wait "$K6_PID" || echo '   k6 reported a failed threshold'
K6_PID=''
tail -5 "$WORK/k6.log"
kc get scaledobject,hpa,pods -n "$NS"
pause

step 'The wallet: what the questions of the demo account cost'
WALLET=$(api_shown GET /api/wallet)
jq . <<<"$WALLET"

# The queue question also ran; record how it ended for the summary line.
QUEUE_STATUS=$(root_status "$QUEUE_SESSION")
P95=$(jq -r '.metrics.time_to_rest.values["p(95)"] // empty' "$SUMMARY" 2>/dev/null || true)
printf '\n\033[1mDone:\033[0m %d questions by %s (the queue question is %s), worker peak %s replicas, k6 time_to_rest p95 %s ms, spent $%s of a $%s cap.\n' \
  "$QUESTIONS" "$EMAIL" "$QUEUE_STATUS" "$PEAK" "${P95:-n/a}" \
  "$(jq -r '.spent.dollars' <<<"$WALLET")" "$(jq -r '.cap.dollars' <<<"$WALLET")"
