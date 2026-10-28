# Shared by every recording script: the hidden setup, and say(), which types a command
# the way a person would and then runs it, so the recording shows real output.
TAPES="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export TAPES
# shellcheck source=/dev/null
source "$TAPES/env.sh"
GREY=$'\e[38;2;154;157;163m'
RESET=$'\e[0m'

say() {
  printf '%slumen%s $ ' "$GREY" "$RESET"
  local s="$1" i
  for ((i = 0; i < ${#s}; i++)); do
    printf '%s' "${s:i:1}"
    sleep 0.025
  done
  sleep 0.4
  printf '\n'
  eval "$1"
}

pause() { sleep "${1:-2}"; }
