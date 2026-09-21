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

The normal application entry point registers projects using session's public
`SessionDirectory`. Migration 005 runs through the shared migration directory.
The core owner approved these two shared changes in PR #16. See
[the integration note](integration/README.md) for remaining cross-slice work.

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
are public exports. State classes remain internal.
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

If session creation rejects, the service checks the public session directory.
It removes the new project only when the settled start has no session. Existing
sessions, failed lookups or failed cleanup retain the project for reconciliation;
start is never replayed automatically. Cards without a confirmed session use
manual refresh. The browser retains the question and asks the user to check
Projects before trying again. This is compensation, not a cross-slice transaction.

## Storage and pages

Memory and PostgreSQL stores implement the same port. SQL reads and writes only
the owned projects/findings tables. Migration `005_projects_read_model.sql` lives in `core/db/migrations` and is applied on normal startup. It accommodates
arbitrary temporary account IDs without changing authGuard, and adds finding
project associations and pagination indexes. See the handoff for legacy data.

Landing preserves question/mode in tab storage and uses the existing development
sign-in helper on localhost. Home supports loaded-project search/status filters,
pagination, safe literal finding text and source-session links. Queued/running cards refresh every five seconds; waiting cards every fifteen
seconds; terminal and unconfirmed cards refresh manually or on window focus.
Fetches abort on unmount, hidden tabs pause polling, and errors retain loaded
data. A 401 clears private data. Transient failures back off 5/10/20/40/60 seconds,
then pause until Retry; permanent client errors pause immediately. Focus does
not bypass backoff. Home uses the shared HTTP client and creates no WebSocket.

## Validation

Run `npm run verify` for formatting, lint, strict types and coverage. Set
`DATABASE_URL` to a disposable PostgreSQL database to enable database tests.
Projects storage tests use the shared `openTestDb()` helper with an isolated
schema per case. The shared migration runner serializes migrations safely.
Run `npx vitest run --config apps/web/src/pages/home/vitest.config.ts` for the
page-local retry tests (the root test configuration includes only server/contracts).

Tests cover State command delegation/refusal, polling intervals, authoritative
summary replacement, ownership, malformed input, cursor scope/order, creation
compensation, latest-only Stop, finding associations, memory/SQL persistence and
integration with the real session public directory. No test-only lookup adapter
is required.

## Boundary

Everything this slice exposes to the rest of the monolith is re-exported from
`index.ts`. Other slices import `modules/projects`, never a file inside it. You
own every file in this folder (see `/CODEOWNERS`).

## Definition of Done for a story here

See `/docs/DOD.md`. In short: a passing unit test on the behaviour, the pattern
demonstrated (brute-force version documented, then the refactor), lint and
typecheck green, and the CI pipeline green.
