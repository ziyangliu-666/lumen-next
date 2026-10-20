# Report: the literature watch, the second app on the platform (subagent, 2026-10-20)

Verbatim report from the subagent that wrote `apps/watch/`, the `watch` CronJob
and the demo step.

---

The literature watch is built, and the five tests against a fake server pass. Two things block a clean `npm run lint` or a real run: eslint needs one ignore line, and the server's v1 endpoints are not in yet. Nothing is staged or committed, and I contacted no live server.

## Files
- `apps/watch/watch.mjs`: the consumer program.
- `apps/watch/publish-agent.mjs`: the producer program.
- `apps/watch/watches.example.json`: a watch list with two topics.
- `apps/watch/watch.test.mjs`: the test against a fake server.
- `apps/watch/README.md`: the steps (with the key `curl`), the settings, the error behaviour, Kubernetes, and "What the platform gives this app".
- `deploy/k8s/lumen/templates/watch.yaml`: ConfigMap `watch-topics` (from `watch.topics`) and CronJob `watch`.
  - The CronJob uses `concurrencyPolicy: Forbid`, `backoffLimit: 1`, and runs as user 1000 with a read-only root filesystem and all capabilities dropped.
  - It requests 50m/64Mi with a 128Mi limit, and mounts ConfigMap `watch-app`, which the chart does not make.
- `deploy/k8s/lumen/values.yaml`: I only added the `watch:` block. It has one key you did not ask for: `lumenUrl: ''`, which defaults to `lumen.origin`.
- `deploy/k8s/demo.sh`: a new step, "A second app on the platform: the literature watch", before the wallet step.
  - The step asks one topic only, and shows the key as `$LUMEN_API_KEY`.
  - It skips with a message when `LUMEN_API_KEY` or `node` is missing.
  - If the watch fails, the step prints the exit code and the demo goes on.
- `deploy/k8s/README.md`: a section "The literature watch (optional)" with the `kubectl create configmap watch-app ... --dry-run=client -o yaml | kubectl apply -f -` command.

## How the watch behaves
- **Order:** it asks one topic at a time. It polls `GET /api/v1/questions/:id` every 3 s for up to 10 min per topic. It prints the digest to stdout and progress to stderr. With `DIGEST_DIR` set, it also writes `<date>-<slug>.md`.
- **Default agent:** a topic without `agent` uses `literature-scout`.
- **429:** it waits for the time in `Retry-After`, then asks again.
- **401 or 403:** it stops with a clear message and exits 2.
- **Network errors and 5xx:** it retries 3 times, after 1 s, 2 s and 4 s. Then that topic fails and the watch goes on to the next one.
- **Exit codes:** 0 when every topic ended or stopped. 1 when a topic failed, timed out or got an error. 2 for missing settings or a bad key. I count status `failed` as exit 1; your spec could be read either way.
- **Duplicate slug:** `publish-agent.mjs` exits 0 on 409. The contract gives no status for a taken slug, so it also exits 0 when `GET /api/v1/agents/literature-scout` returns 200.

One digest from the fake-server run:
```
# Literature watch: Pattern avoidance in permutations

- Agent: literature-scout
- Session: s-2
- Status: ended
- Cost: $0.0123
- Time taken: 2 min 5 s

## Answer

1. A paper on attern avoidance in permutat... (2026), arxiv.org/abs/2601.00001

## Findings

1. **Survey**: One survey covers the field.
2. A plain finding.
```
The cut-off text in the answer comes from the fake server, not from the watch.

## Checks
- `node --check` on all three `.mjs` files: OK.
- `node --test apps/watch/*.test.mjs`: 5 pass, 0 fail. The test covers polling, the 429 wait, stdout and `DIGEST_DIR` output, a bad key (exit 2), a failed session (exit 1), network retries, and missing settings.
- `npx prettier --check apps/watch deploy/k8s/README.md deploy/k8s/lumen/values.yaml`: OK. `.prettierignore` skips `*.md`, so Prettier does not really check the READMEs.
- `bash -n` and `shellcheck` on `deploy/k8s/demo.sh`: clean.
- `helm lint deploy/k8s/lumen`, with and without `watch.enabled=true`: 0 failed. `helm template ... --set watch.enabled=true` renders. With the default values the chart renders no watch objects.
- I also ran `watch.mjs` through a symlink, the way a ConfigMap mounts it, and it starts.
- `npx eslint apps/watch` fails with "not found by the project service". The typed config cannot parse `.mjs` files that are in no tsconfig.

## Line count
`watch.mjs` has 258 lines, of which 210 are code without comments and blank lines. `publish-agent.mjs` has 50, of which 36 are code. The README states these numbers.

## Open
- **eslint:** add this line to the `ignores` list in `eslint.config.js` (I did not edit the file):
  ```js
      // The literature watch: plain Node ESM that runs from a ConfigMap, outside every tsconfig.
      'apps/watch/**',
  ```
  With this ignore, `npx eslint apps/watch` reports that every file is ignored instead of passing. `npm run lint` (`eslint .`) is fine.
- **`node --test apps/watch/` does not work on Node 26:** a bare directory is not expanded. The working command is `node --test apps/watch/*.test.mjs`, and the README uses it.
- **No `package.json` in `apps/watch`:** `apps/*` is an npm workspace, so a `package.json` there would change the lockfile.
- **Contract gaps:** the contract does not define the `findings` shape. The digest accepts strings or objects with `title` and `text`, `statement` or `claim`. It reads `cost` as a number of dollars, or as an object with `dollars`.
- **k3d:** inside a pod, `lumen.localhost` does not reach Traefik. Set `watch.lumenUrl` to an address that does. Both READMEs say so. On the public host the default origin works.
- **Before a real run:** the server side of `/api/v1` must be in, the agent must be published, and a key must exist. The CronJob also needs ConfigMap `watch-app` and Secret `watch-api-key` made by hand. Nobody has run the program against a real server yet.
