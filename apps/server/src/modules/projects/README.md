# projects — PENG XUJIAN

**Use case:** UC2 — start a project, review what ran while away
**Covers:** projects, findings — project management, and the finding cards shown on Home and in a session

## The design problem (from the proposal, section 6.4)

A project card renders and refreshes differently when it is running, waiting on
the user, finished or stopped. The conditional logic is spread across the list,
the card and the poller.

**Candidate pattern:** State. This is the starting hypothesis from the proposal,
not the conclusion. You compare the candidates, pick one, and write down why.

## Implementation status

UC2 now includes project creation, owner-scoped project cards, latest-session
Stop, persisted findings, cursor pagination, Landing and Home. The six State
classes provide the card label, tone, actions and refresh policy together. See
[the before/after record](CARD_STATE.md) for the brute-force version and refactor.

The shared application has **not** been wired to this slice. This task deliberately
keeps changes inside projects, Home and Landing. The current main entry point
therefore does not serve these routes. See [the integration handoff](integration/README.md)
for unapplied owner patches and the remaining acceptance checks. Proposal files
describe the target architecture; the API below describes the implemented slice.

## Public index

`createProjectsSlice({ sessions, db? })` creates an isolated slice instance. Supply
the `ProjectSessions` port from session's public index; omit `db` for memory mode.
The returned API is:

- `registerRoutes`: register as an encapsulated Fastify plugin.
- `requireProject(principal, projectId)`: metadata-only ownership check for session creation.
- `projectOf(sessionId)`: validated project/account association for trusted server callers.
- `recordFinding(sessionId, taskId, text)`: validate associations and persist a finding.
- `listFindings(sessionId)`: chronological findings for a validated session.

`ProjectSessions`, `ProjectMode`, `LatestSession`, `ProjectCard`, `Finding`, `Page`
and `projectsMigrationsDir` are public exports. State classes remain internal.
Finding operations are trusted server operations: session must authorize browser
access before calling them. Projects persists a finding; session publishes the
event after the write succeeds. Projects does not publish a duplicate event.

## HTTP contract

All routes use the existing `requireUser` guard and return `Cache-Control: no-store`.
An absent user receives 401; another owner's project receives 404. Errors follow
the current shared `{ error: string }` envelope.

| Method and path | Request | Success |
| --- | --- | --- |
| `POST /api/projects` | `{ question, mode }` | 201 `{ project, sessionId }` |
| `GET /api/projects` | `limit?`, `cursor?` | 200 `{ items: ProjectCard[], nextCursor }` |
| `GET /api/projects/:id` | No query fields | 200 `{ item: ProjectCard }` |
| `POST /api/projects/:id/stop` | Empty body or `{}` | 202 `stop_requested`, or 200 `already_terminal` / `no_session` |
| `GET /api/projects/:id/findings` | `limit?`, `cursor?` | 200 `{ items: Finding[], nextCursor }` |

Questions are trimmed, 1–10,000 Unicode code points; mode is `explore` or `seed`.
Titles use the first 120 code points with whitespace collapsed. IDs are UUIDs.
Unknown fields are rejected. Page size defaults to 20, with a maximum of 100.
Cursors are scoped to the account and endpoint, ordered by creation time and ID
descending. They are navigation tokens, never authorization credentials.

The latest session is selected by start time descending, then ID descending.
Its confirmed status and spend describe the card; findings count spans the whole
project. Stop selects the latest session when handling the request and delegates
its subtree stop to session. It never stops every session in the project or
optimistically replaces the confirmed status.

If session creation fails or times out after the project write, the project stays
visible as awaiting confirmation. There is no automatic replay or compensating
delete because a session may already exist. The browser retains the question and
asks the user to check Projects before trying again.

## Storage and pages

Memory and PostgreSQL stores implement the same port. SQL reads and writes only
the owned projects/findings tables. Migration `002_projects_read_model.sql` must
be registered by the composition root before using PostgreSQL. It accommodates
arbitrary temporary account IDs without changing authGuard, and adds finding
project associations and pagination indexes. See the handoff for legacy data.

Landing preserves question/mode in tab storage and uses the existing development
sign-in helper on localhost. Home supports loaded-project search/status filters,
pagination, safe literal finding text and source-session links. Active cards and
their findings refresh every five seconds; terminal cards refresh on demand or
window focus. Fetches are aborted on unmount, hidden tabs pause polling, and failed
refreshes retain the last data. A 401 clears private data. An optional shared-client
invalidation event triggers refetch; Home does not create another WebSocket.

## Validation

Run `npm run verify` for formatting, lint, strict types and coverage. Set
`DATABASE_URL` to a disposable PostgreSQL database to enable database tests.
`npx vitest run --coverage --no-file-parallelism` also avoids the shared runner's
fail-fast advisory-lock contention between existing core/session test files.
Projects storage tests migrate a unique schema per case, so they do not take a
global migration lock. Production migration locking is unchanged.

Tests cover State coherence, ownership, malformed input, cursor scope/order,
uncertain creation, latest-only Stop, finding associations, memory/SQL persistence
and real session-kernel integration through the public index. Browser checks use
a test-only composition adapter; they do not prove the unapplied shared patches.

## Boundary

Everything this slice exposes to the rest of the monolith is re-exported from
`index.ts`. Other slices import `modules/projects`, never a file inside it. You
own every file in this folder (see `/CODEOWNERS`).

## Definition of Done for a story here

See `/docs/DOD.md`. In short: a passing unit test on the behaviour, the pattern
demonstrated (brute-force version documented, then the refactor), lint and
typecheck green, and the CI pipeline green.
