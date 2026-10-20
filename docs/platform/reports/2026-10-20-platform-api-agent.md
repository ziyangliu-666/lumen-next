# Report: API keys, agent registry and public API v1 (subagent, 2026-10-20)

Verbatim report from the subagent that built `apps/server/src/services/platform/`,
the two platform migrations and the `/api/v1` wiring. After this report, the lead
added the key resolver and guard to the worker and billing services, which closes
the first open point below.

---

I built the platform side of API v1 in the worktree. Nothing is committed and I did not contact the public host. All four required checks pass, and `npm run verify` fails only on the two DeepSeek live tests.

**Files created or changed, by owner**

LU YI (API keys):
- `apps/server/src/core/db/migrations/090_platform_api_keys.sql` (new)
- `apps/server/src/services/platform/apiKeys.ts` (new): key generation, SHA-256 hashing, the Postgres store and `withApiKeys`
- `apps/server/src/services/platform/keyGuard.ts` (new): the onRequest guard, the route-to-scope table and the per-key rate limiter
- `apps/server/src/services/platform/keyRoutes.ts` (new): `registerKeyRoutes`
- `apps/server/src/services/platform/apiKeys.test.ts` and `keyGuard.test.ts` (new)
- `apps/server/src/services/identity.ts` (changed)

PENG XUJIAN (registry, POST questions, usage, OpenAPI):
- `apps/server/src/core/db/migrations/091_platform_registry.sql` (new)
- `apps/server/src/services/platform/registry.ts` (new): the agents, intents and usage stores, and `agentInput`
- `apps/server/src/services/platform/agentRoutes.ts` (new): `registerAgentRoutes` and `registerUsageRoutes`
- `apps/server/src/services/platform/askRoutes.ts` (new): `registerAskRoutes`
- `apps/server/src/services/platform/openapi.ts` (new)
- `apps/server/src/services/platform/routes.test.ts` and `stores.test.ts` (new)
- `apps/server/src/services/project.ts` (changed)

LIU ZIYANG (GET questions in session):
- `apps/server/src/services/platform/answerRoutes.ts` (new)
- `apps/server/src/services/session.ts` (changed): wraps the resolver with `withApiKeys`, adds the guard, and registers the GET route

LI ZHUOYANG (worker hook):
- `apps/server/src/services/platform/rootTurn.ts` and `rootTurn.test.ts` (new)
- `apps/server/src/services/worker.ts` (changed): `worker.run` gets `await inputFor(turn.task, turn.input)`

Ingress and docs:
- `deploy/k8s/lumen/templates/ingress.yaml`: three new rules.
  - `GET /api/v1/questions/<id>` goes to session (Method plus PathRegexp, priority 100).
  - `/api/v1/keys*` goes to identity (priority 60).
  - The rest of `/api/v1*` goes to project (priority 50).
  - `/internal` stays unrouted.
- `docs/platform/public-api.md`: I added an "As built" section. It records the choices the contract left open: ISO times, `owner` as the display name, the guard order, 409 for a taken slug, the `asConsumer` shape, and the cost and median sources.
- `docs/platform/evidence/2026-10-20-k6-short-summary.json`: whitespace only. This file was already committed and failed `prettier --check docs/platform`, so the required check could not pass without the fix.

**Design points**
- **Resolver:** `withApiKeys` makes a new Principal on each request and stores its key in a WeakMap. The guard and the key routes read the scopes and key id from `request.principal`, so a request costs one database read. `last_used_at` gets one more write, at most once a minute.
- **Bad keys:** a request that has a key never falls back to its cookie. An unknown or revoked key gets 401.
- **Guard order:** path (403), key (401), rate (429 with Retry-After), scope (403).
  - All `/api/v1/keys` routes refuse every key.
  - A v1 route that the scope table does not list is refused to keys.
  - A request with a valid `x-lumen-internal` header skips the path check and the rate limit, but the key must still be valid.
- **Cost:** the sum of `tasks.own_cost` for the session's tasks. This is the same number as the snapshot's `spend`.
- **Median seconds:** `percentile_cont(0.5)` over the root task's `ended_at - started_at`, for sessions whose root ended.
- **Claiming an intent:** the worker first looks for the row with the session id. If there is none, it claims the newest unclaimed row for the same account and question from the last 60 seconds, with `FOR UPDATE SKIP LOCKED`.
- **Worker failures:** any failure in the lookup is logged as a warning, and the turn runs with its original input.

**Checks**
- `npx tsc -p apps/server --noEmit`: passes.
- `npx eslint apps/server/src/services`: passes.
- `npx prettier --check apps/server/src/services docs/platform`: passes.
- `npx vitest run apps/server/src/services`: 36 pass, 5 skipped. The skipped tests need a database.
- The same tests with `DATABASE_URL=postgres://localhost:5432/lumen_dev_test`: all 41 pass, including the store tests and the ask-through-inject test.
- `npm run verify`: format, lint and typecheck pass. 959 tests pass and 2 fail, both DeepSeek tests in `core/model/live.test.ts` (HTTP 401 on the local key).
- `helm lint deploy/k8s/lumen`: 0 charts failed. `helm template ...` renders the three new routes.

**Left open**
- Worker and billing do not resolve keys. A key on their paths (for example `/api/projects/:id/files`) gets 401, not the 403 the contract states. Adding `withApiKeys` and the guard to those two entry points is a 3-line change in each. The contract's "As built" section records this gap.
- `GET /api/v1/questions/:id` uses the kernel's read rule, so staff can also read any question. The contract says owner only.
- The intent fallback can swap agents between two identical questions from the same account if both are asked within the same second. The unique index on `session_id` stops a crash, but the swap can still happen.
- The worker claims the intent on every root turn, so a follow-up message in the same session also gets the agent's instructions.
- The rate limit is per pod, as the contract already says.
- I did not test the down migrations, and I did not run the flow against a live cluster.
