# Sourced, hidden, at the start of every tape. The API key is read from a file outside
# the repository and never printed: commands show only "$AUTH".
export PATH="$TAPES/bin:$PATH"
export LUMEN_URL="https://lumen.139-180-185-51.sslip.io"
export API="$LUMEN_URL/api/v1"
export AUTH="Authorization: Bearer $(cat "$HOME/.lumen-platform/demo-key")"
export JSON="content-type: application/json"
export PS1='\[\e[38;2;154;157;163m\]lumen\[\e[0m\] $ '
export GH_REPO=ziyangliu-666/lumen-next
cd "$TAPES/../../../.."
export GH_PAGER=cat PAGER=cat GH_NO_UPDATE_NOTIFIER=1
