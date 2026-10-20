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

## Ownership

| Part | Member |
|---|---|
| API keys, the key resolver and guard, `/api/v1/keys` | LU YI |
| The agent registry, `/api/v1/agents`, `/api/v1/usage`, `/api/v1/questions` (POST), OpenAPI | PENG XUJIAN |
| `GET /api/v1/questions/:sessionId` in the session service | LIU ZIYANG |
| The agent's instructions on a root turn, in the worker | LI ZHUOYANG |
| The literature watch app and its CronJob | PENG XUJIAN |
| SCA, SAST, image scan and DAST in the pipeline | HE RONG |
