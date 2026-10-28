# The literature watch

The literature watch is a second app on the Lumen platform. Once a day it asks
the platform one question for each topic on a watch list: "What was published
recently on this topic?". Then it prints a Markdown digest for each topic:
the answer, the findings, the cost and the time taken.

The watch uses only the public API v1 (`docs/platform/public-api.md`) and an
API key. It has no database, no model calls, no sandbox and no billing of its
own. It is a consumer of the platform, in the same way as the web app.
`publish-agent.mjs` is the producer side: it publishes the agent that the
watch asks with.

The programs are plain Node 22 ESM with no dependencies. They run in a stock
`node:22-alpine` image from a ConfigMap, with nothing to install or build.

## Files

| File | What it is |
|---|---|
| `watch.mjs` | The consumer. Asks, polls, prints the digest. |
| `publish-agent.mjs` | The producer. Publishes the agent `literature-scout`. |
| `watches.example.json` | A watch list: `[{ "topic": "...", "agent": "literature-scout" }]`. |
| `watch.test.mjs` | Runs `watch.mjs` against a fake platform (`node:http`). |

## Run it

1. Sign in on the web at `$LUMEN_URL`. Copy the value of the `lumen_session`
   cookie from the browser's developer tools.

2. Create an API key with that cookie. The key is shown once, in the `key`
   field of the answer. Write requests need the `Origin` header.

   ```sh
   export LUMEN_URL=https://lumen.example.org
   curl -sS -X POST "$LUMEN_URL/api/v1/keys" \
     -b "lumen_session=<cookie value>" \
     -H "Origin: $LUMEN_URL" \
     -H 'content-type: application/json' \
     -d '{"name":"literature watch","scopes":["questions:read","questions:write","agents:read","agents:write"]}'
   export LUMEN_API_KEY=lmn_...
   ```

   The watch alone needs `questions:read`, `questions:write` and
   `agents:read`. Only the producer step needs `agents:write`. For a key that
   cannot publish agents, leave `agents:write` out.

3. Publish the agent. If the slug `literature-scout` exists already, the
   program says so and exits 0.

   ```sh
   node apps/watch/publish-agent.mjs
   ```

4. Run the watch:

   ```sh
   cp apps/watch/watches.example.json watches.json
   node apps/watch/watch.mjs
   # Also write one file per topic, <date>-<slug>.md:
   DIGEST_DIR=digests node apps/watch/watch.mjs
   ```

### Settings

| Variable | Default | Meaning |
|---|---|---|
| `LUMEN_URL` | (required) | The platform's public origin. |
| `LUMEN_API_KEY` | (required) | The API key from step 2. |
| `WATCH_FILE` | `./watches.json` | The watch list. A topic without `agent` uses `literature-scout`. |
| `DIGEST_DIR` | (none) | Also write `<date>-<slug>.md` for each topic here. |
| `WATCH_POLL_MS` | `3000` | The time between two polls of a question. |
| `WATCH_TIMEOUT_MS` | `600000` | The time a topic can take before the watch gives up on it. |
| `WATCH_BACKOFF_MS` | `1000` | The first wait after a network error. It doubles on each retry. |

### What it does on errors

- 429: it waits for the time in `Retry-After`, then asks again.
- 401 or 403: it stops at once, says that the key is wrong, revoked or lacks a
  scope, and exits 2. A retry cannot fix a key.
- A network error or a 5xx: it retries three times, after 1 s, 2 s and 4 s.
  After that, the topic fails and the watch goes on to the next topic.

Exit codes: 0 when every topic ended or stopped; 1 when a topic failed, timed
out or was refused; 2 for missing settings or a bad key.

### Test

```sh
node --test apps/watch/*.test.mjs
```

The test starts a fake platform with the two endpoints. It checks the polling,
the 429 wait, the digest on stdout and in `DIGEST_DIR`, a bad key (exit 2), a
failed session (exit 1) and the network retries. It contacts no real server.

## On Kubernetes

The chart has a CronJob `watch` (`deploy/k8s/lumen/templates/watch.yaml`). It
is off by default. The program comes from ConfigMap `watch-app`, which you make
from this directory, so the repository keeps one copy of `watch.mjs`:

```sh
kubectl create configmap watch-app -n lumen --from-file=apps/watch/watch.mjs \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret generic watch-api-key -n lumen \
  --from-literal=LUMEN_API_KEY="$LUMEN_API_KEY"
helm upgrade --install lumen deploy/k8s/lumen -n lumen --reuse-values \
  --set watch.enabled=true
```

Run the ConfigMap command again after each change to `watch.mjs`. The topics
come from `watch.topics` in the chart's values (ConfigMap `watch-topics`). The
digest is in the job's log: `kubectl logs -n lumen job/<job name>`.

## What the platform gives this app

The watch is about 210 lines of code in `watch.mjs` (258 with comments and
blank lines), and 36 in `publish-agent.mjs`. That is the whole app. The
platform gives it the rest:

- **Sign-in and keys.** Accounts, the API key with its scopes, revocation and
  the rate limit. The app stores no user and no password.
- **The agent runtime.** The lead agent, its children, the queues and the
  workers that run each turn. The app sends one question and reads one answer.
- **The sandbox.** Code that an agent runs to check a claim runs on the
  platform, never in the app.
- **Cost capping and approval.** Each step is costed against the account's
  cap, and a run over the cap waits for approval. The app only reads the cost.
- **Scaling.** KEDA adds workers when the queues grow. Twenty topics need no
  change in the app.

The app itself is only this:

- a watch list in a JSON file;
- the text of one question for each topic;
- a poll loop with a timeout, and the handling of 429, 401, 403 and network
  errors;
- the layout of a Markdown digest.
