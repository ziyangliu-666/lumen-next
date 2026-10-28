# Report: deploy workflow, k6 load test, demo script (subagent, 2026-10-20)

Verbatim report from the subagent that wrote `.github/workflows/platform-deploy.yml`,
`deploy/k8s/load/` and `deploy/k8s/demo.sh`.

---

I created all four files and nothing else. Nothing is staged or committed, and I did not contact the host. **Warning:** `ask.js` breaks `npm run lint`, so `npm run verify` and the workflow's verify job will fail until one line goes into `eslint.config.js`. I was not allowed to edit that file.

## Files
- `.github/workflows/platform-deploy.yml`
- `deploy/k8s/load/ask.js`
- `deploy/k8s/load/README.md`
- `deploy/k8s/demo.sh` (executable)

## The blocker: `ask.js` fails lint
`eslint .` reports a parsing error on `deploy/k8s/load/ask.js` because no tsconfig includes the file. The fix is one entry in the `ignores` list of `eslint.config.js`:
```js
'deploy/k8s/load/**',
```
The owner of `eslint.config.js` should add it before this lands on `ass/platform`.

## API calls taken from the source
| Call | Body | Source |
|---|---|---|
| `POST /api/auth/signup` → 201 `{accountId, role}`, sets the cookie | `{email, displayName, password}`, password at least 8 characters | `modules/identity/routes.ts:253`, `accountService.ts:78` |
| `POST /api/auth/password` → 200, sets the cookie | `{email, password}`, no other keys | `identity/routes.ts:196` |
| `POST /api/auth/signout` | none | `identity/routes.ts:324` |
| `GET /api/me` | none | `identity/routes.ts:338` |
| `POST /api/projects` → 201 `{project, sessionId}` (this opens the session) | `{question, mode: "explore"\|"seed", model?}` | `projects/routes.ts:13`, `validation.ts` `creationOf`, `projectService.ts:43` |
| `GET /api/sessions/:id` → `SessionSnapshot {session, tasks, steps, totals, spend}` | none | `session/routes.ts:85`, `packages/contracts/src/sessions.ts` |
| `GET /api/wallet` → `{spent:{dollars}, cap:{dollars}}` | none | `billing/routes.ts:13`, `ledger.ts:49` |

Details the scripts depend on:
- **Cookie:** the name is `lumen_session` (`identity/sessionStrategy.ts:5`).
- **Origin header:** identity and some billing writes refuse any `Origin` that is not exactly `LUMEN_ORIGIN`. Both scripts send `Origin: $LUMEN_URL` with the trailing slash removed.
- **At rest:** the root task is the one with `parentId === null`. I count it at rest when its status is `ended`, `stopped`, `failed` or `waiting`. The kernel sets `waiting` only for an approval over the cap, and the root stays `running` while its children work.
- **Pool size:** a demo question costs $0.03 and each account has a $1 cap, so one account holds about 33 questions. The pool is 60 accounts (`POOL` overrides it), not 20, so the full profile does not reach the cap. Over-cap roots are counted apart in the summary.
- **Short profile:** `PROFILE=short` (10 VUs, about 2 minutes) is for `demo.sh`.

## Commands and results
- `bash -n deploy/k8s/demo.sh`: OK.
- `shellcheck`: OK after one documented disable (SC2016, for printing the literal text `$PASSWORD`).
- `actionlint`: OK, after I changed an empty-string choice option to `auto`.
- `k6 inspect` (k6 v2.3.0): the options parse. A probe run showed that `crypto.getRandomValues` is a global in k6.
- `prettier --check` on the new files: OK.
- `eslint` on `ask.js`: fails, as described above.
- I installed shellcheck, actionlint and k6 with brew.
- I did not run `ask.js` or `demo.sh` against a live server.

## Decisions and open questions
1. **No registry versus the contract.** The contract's "Public deployment" table still says GHCR plus build-and-push. I followed your brief (`docker save` → scp → `k3s ctr images import`), so the contract table needs an update.
2. **Worker mode.** The chart has no `config.LUMEN_WORKER`. It has `config.worker`, where `""` means steering if a model key is set and demo otherwise. So a TODO line was not needed. With `OPENAI_API_KEY` set, the load test would use steering workers and cost money. To prevent this, I added a `workflow_dispatch` input `worker` (auto, demo or steering), passed as `--set-string config.worker=…`. Any push redeploys with `auto`, so before a load run, do a manual dispatch with `demo`.
3. **Optional key.** `OPENAI_API_KEY` and `LUMEN_MODEL_PROVIDER=openai` go in only when the secret is not empty. The helm command reaches the host on ssh stdin, quoted with `printf %q`, so the key is not in the log. It is still visible in the host's process list while helm runs.
4. **Core secrets.** The chart generates the database password and `LUMEN_INTERNAL_KEY` inside the cluster (`secrets.yaml`, kept on uninstall). The contract says these are GitHub secrets, so the workflow passes none of them. The team should confirm that this is acceptable.
5. **Chart facts that `demo.sh` assumes:**
   - The RabbitMQ pod is `rabbitmq-0`.
   - The default vhost `/` holds the queues.
   - Worker pods have names that start with `worker-`.
   - The worker Deployment is named `worker`.
6. **Queues.** `demo.sh` uses the lead's change: `list_queues name messages messages_unacknowledged consumers`, filtered to names that start with `lumen.turns`.
7. **Deleting a worker.** `demo.sh` deletes the first worker pod after the question shows two steps. It cannot pick the pod that holds the turn, so with several workers it can delete one with no turn.
8. **Image name.** The prune step greps for `/lumen-next:` because containerd stores the image as `docker.io/library/lumen-next:<sha>`. The chart's `pullPolicy: IfNotPresent` resolves that name.
