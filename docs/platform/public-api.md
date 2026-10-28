# Lumen Platform: producers, consumers and the public API (v1)

This is the contract for the platform side of the ASS project: the part that
makes Lumen a platform and not only an app (docs/platform/requirements-check.md,
R1, R7, R8, R9). Every piece below builds against this page.

## The platform's roles

| Role | Who | What they do on the platform |
|---|---|---|
| Seed | The run engine: session, worker, billing | A question runs as a tree of costed, recorded steps under the account's cap. |
| Producer | An agent author | Publishes an agent (instructions for the lead) in the registry. Reads how much it is used. |
| Consumer | A research team, or an app built on the API | Asks a question with a chosen agent, reads the answer, the findings and the cost. |
| Operator | The team (staff accounts) | Reads usage for every account and every agent. |

The web app is the first consumer. The literature watch (`apps/watch/`) is the
second: it uses only this API and an API key.

## API keys

- A signed-in user (cookie) creates keys. A key is shown once, at creation.
- Format: `lmn_<8-char prefix>_<32 random base62 chars>`. The database keeps
  only the SHA-256 of the whole key, and the prefix to show in lists.
- Scopes: `agents:read`, `agents:write`, `questions:read`, `questions:write`,
  `usage:read`. A key can do only what its scopes allow.
- A key works only on `/api/v1/*`. On any other path a request with
  `Authorization: Bearer lmn_...` gets 403. The web app's routes stay cookie
  only.
- Rate limit per key: 60 requests a minute, burst 20, in each pod. Over the
  limit: 429 with `Retry-After`. (Per pod, so with N pods the true limit is up
  to N times higher. The report says so.)
- A revoked key gets 401. `last_used_at` is updated at most once a minute.

## Endpoints

All bodies are JSON. Every error is `{ "error": "<message>" }`.

| Method and path | Auth | Service | Answer |
|---|---|---|---|
| `POST /api/v1/keys` `{name, scopes[]}` | cookie | identity | 201 `{id, name, prefix, scopes, createdAt, key}` |
| `GET /api/v1/keys` | cookie | identity | 200 `{items: [{id, name, prefix, scopes, createdAt, lastUsedAt, revokedAt}]}` |
| `DELETE /api/v1/keys/:id` | cookie | identity | 204 |
| `GET /api/v1/agents` | `agents:read` or cookie | project | 200 `{items: [{slug, name, description, owner, createdAt}]}`, published agents only |
| `GET /api/v1/agents/:slug` | `agents:read` or cookie | project | 200, with `instructions` only for the owner |
| `POST /api/v1/agents` `{slug, name, description, instructions}` | `agents:write` or cookie | project | 201. `slug`: `^[a-z][a-z0-9-]{2,39}$`, unique. `instructions`: at most 4000 characters. |
| `DELETE /api/v1/agents/:slug` | `agents:write` or cookie, owner only | project | 204. The agent is withdrawn, not deleted, so usage stays. |
| `POST /api/v1/questions` `{question, agent?}` | `questions:write` or cookie | project | 201 `{sessionId, projectId, agent}`. `agent` is a published slug; without it, the default lead. |
| `GET /api/v1/questions/:sessionId` | `questions:read` or cookie, owner only | session | 200 `{sessionId, status, agent, answer, findings, cost, startedAt, endedAt}` |
| `GET /api/v1/usage` | `usage:read` or cookie | project | 200 `{asConsumer: {...}, asProducer: [{slug, sessions, cost, medianSecondsToRest}], all?: [...]}`. `all` only for staff. |
| `GET /api/v1/openapi.json` | none | project | The OpenAPI 3.1 document for every path on this page. |

`status` is the root task's status. `answer` is the text of the root task's
last `reply` step, or null. `cost` is the session's total in dollars.

## How a chosen agent reaches the worker

The session starts inside `POST /api/projects`, and the root turn can reach a
worker before that call returns. So the choice cannot be written after the
session exists. Instead:

1. `POST /api/v1/questions` writes an **intent** row first: account, agent,
   question text, time, and no session yet.
2. It creates the project with the same request as the web app
   (`POST /api/projects`, through Fastify's `inject` with the caller's
   authorization). Then it sets the intent's `session_id`.
3. The worker, on a root turn (depth 0), asks for the intent of this session:
   the row with this `session_id`, or else the newest unclaimed row with the
   same account and the same question text from the last 60 seconds. It claims
   the row (sets `session_id`) with `FOR UPDATE SKIP LOCKED`.
4. With an agent, the worker runs the turn with this input:
   `Instructions from the agent "<name>" (<slug>):\n<instructions>\n\nQuestion:\n<question>`.
   Without one, the input does not change.

The same row records which agent ran which session, for usage (UC5).

## Tables (new migrations, on this branch only)

The numbers start at 090, so they never collide with a migration that `main`
adds later. node-pg-migrate runs here with `checkOrder: false`.

- `090_platform_api_keys.sql`: `platform_api_keys (id uuid pk, account_id uuid
  not null references accounts(id) on delete cascade, name text not null,
  prefix text not null, key_hash text not null unique, scopes text[] not null,
  created_at timestamptz not null default now(), last_used_at timestamptz,
  revoked_at timestamptz)`.
- `091_platform_registry.sql`: `platform_agents (id uuid pk, owner_account_id
  uuid not null references accounts(id) on delete cascade, slug text not null
  unique, name text not null, description text not null, instructions text not
  null, withdrawn_at timestamptz, created_at timestamptz not null default
  now())` and `platform_question_intents (id uuid pk, account_id uuid not null,
  agent_id uuid references platform_agents(id), question text not null,
  session_id uuid unique, created_at timestamptz not null default now())`.

## As built

The code is in `apps/server/src/services/platform/`. Where the table above
leaves a detail open, the code decides it as follows.

- Every time is an ISO 8601 string (`createdAt`, `startedAt`, `endedAt`).
- `owner` on an agent is the owner's display name.
- The key guard checks a request with `Authorization: Bearer lmn_...` in this
  order: path (403 off `/api/v1`), key (401), rate (429), scope (403). The
  `/api/v1/keys` routes refuse every key with 403: one key never makes another.
  A v1 route that the guard does not list is refused to keys, so a new route
  is closed until it gets a scope.
- A request with a key is never resolved by its cookie. A bad key with a good
  cookie gets 401.
- The `x-lumen-internal` header with the shared key lets a key reach a path
  off `/api/v1`. Only `POST /api/v1/questions` sends it, in its inject to
  `POST /api/projects`. That inject does not take a second token.
- `POST /api/v1/agents` answers 409 when the slug is taken, also by a
  withdrawn agent. `name` is at most 100 characters and `description` at most
  500. A withdrawn agent answers 404 on `GET` and `DELETE`.
- `POST /api/v1/questions` answers 400 for an agent that is not published. When
  the project is not created, it deletes the intent and passes on the status
  of `POST /api/projects`.
- `GET /api/v1/questions/:sessionId` uses the kernel's own read rule: the
  owner, or staff. Any other caller gets 404.
- `asConsumer` is `{sessions, cost, medianSecondsToRest}` over every session of
  the account, from the web app or the API. Each `asProducer` row counts the
  sessions that ran the agent, withdrawn agents included. `all` adds `owner`.
- `cost` is the sum of `tasks.own_cost` for the session's tasks: the same sum
  as the session snapshot's `spend`. `medianSecondsToRest` is the median of
  the root task's `ended_at - started_at`, over sessions whose root ended.
- The worker claims the intent on every root turn, so a later message in the
  same session also runs with the agent's instructions.
- `withApiKeys` and `keyGuard` run in all five services, so a key on any
  path outside `/api/v1` gets 403 everywhere. The key routes run in identity.

## Ownership

| Part | Member |
|---|---|
| API keys, the key resolver and guard, `/api/v1/keys` | LU YI |
| The agent registry, `/api/v1/agents`, `/api/v1/usage`, `/api/v1/questions` (POST), OpenAPI | PENG XUJIAN |
| `GET /api/v1/questions/:sessionId` in the session service | LIU ZIYANG |
| The agent's instructions on a root turn, in the worker | LI ZHUOYANG |
| The literature watch app and its CronJob | PENG XUJIAN |
| SCA, SAST, image scan and DAST in the pipeline | HE RONG |
