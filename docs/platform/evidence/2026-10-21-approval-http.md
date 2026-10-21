# Billing to session approval acceptance

Checked on 21 October 2026 against `ass/platform` base
`b808acda15d0b0fd5a057e35cc485836b7169144` plus this PR.

## Local integration evidence

`apps/server/src/services/shared/approvalResume.test.ts` starts separate
Fastify HTTP listeners for billing and session. Both use the real public
slice factories and an isolated, migrated Postgres schema. Billing's durable
delivery loop calls the session listener with the same client and route
adapter that the production services use.

The four tests passed:

| Scenario | Observed result |
|---|---|
| Zero remaining cap, then owner grants | Task waits without calling the worker. HTTP delivery resumes it once and records USD 0.10. Repeated grant is harmless, duplicate resume returns 404, and a later turn waits for a new approval. |
| Owner rejects, then increases the cap | Task becomes stopped; the worker is never called and delivery clears `resumePending`. |
| Wrong internal key or a different account | Internal caller gets 401; foreign owner/approval gets 404. Task stays waiting and approval stays pending. |
| Session endpoint returns 503, then billing restarts | Task stays waiting and `resumePending` stays true in Postgres. After the real 30-second lease expires, delivery retries, the task ends, and the worker has run once. |

Reproduce from the repository root:

```sh
docker compose -p lumen-next up -d db
npm ci
npm run typecheck
DATABASE_URL=postgres://lumen:lumen@localhost:5432/lumen \
  npx vitest run apps/server/src/services/shared/approvalResume.test.ts \
  --maxWorkers=2 --minWorkers=1
```

The targeted run took about 35 seconds, including the real lease wait. No
fake timer, direct outbox SQL update, provider key or paid model call was
used. Signup/project routes are fixture conveniences; production serves
those in the identity/project services. The deterministic worker replaces
RabbitMQ and the model provider, so this does not claim a live Kubernetes,
ingress, broker or provider acceptance run. Existing `shared/turn.test.ts`
separately exercises the queue-worker/report protocol.

## Repository gate

With `DATABASE_URL` set and Docker's Postgres running, `npm run verify`
passed: 130 test files passed, 1 file skipped; 1193 tests passed, 5 skipped.
Lines and statements were 97.5%, branches 92.31%, functions 99.5%.
The four new HTTP tests ran and passed; they were not among the skips.
Format, lint and typecheck passed. Lint reported eight existing warnings
outside the changed files and no errors.

## Hosted deployment check

[Platform deploy run 39542685448](https://github.com/ziyangliu-666/lumen-next/actions/runs/39542685448)
completed successfully at the same base SHA:

- verify, SCA, SAST, image scan/deploy and ZAP baseline: passed;
- k6 smoke: skipped because effective worker mode was steering;
- workflow summary: passed.

The later CI run 39543634317 and Security run 39543634297 also passed at
that SHA. They are separate workflows, not later deployments.

Read-only HTTPS checks at 04:39 UTC on 21 October:

| Path | Status | Meaning |
|---|---|---|
| `/api/health` | 200, `status: ok`, `service: session` | Public TLS and session health work. |
| `/api/wallet` | 401 without a cookie | Wallet endpoint requires authentication. |
| `/api/admin/accounts` | 401 without a cookie | Admin endpoint requires authentication. |
| `/api/v1/openapi.json` | 200 | Public API description is reachable. |

These checks do not establish every pod's health or exercise authenticated
wallet/admin operations. The test PR is not included in this deployed base.

## Hosted follow-up

Coordinate with the session/core owner for one isolated test account and an
agreed worker mode/provider budget. Capture an over-cap task waiting, approve
it in Wallet, and record the same task resuming through the worker queue and
its ledger entry. Repeat rejection on another waiting task and confirm no
worker execution. Save redacted task/approval IDs and timestamps with the
image SHA and worker mode. Do not capture cookies, service keys or provider
keys. Keep this hosted result pending until that evidence exists.
