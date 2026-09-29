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

## Sprint 3 agreement

Sprint 2 is closed through PRs #24, #30 and #31. The core owner
[agreed the Sprint 3 scope on 28 September 2026](https://github.com/ziyangliu-666/lumen-next/pull/24#issuecomment-5862310844),
including the following additional story. These are planned acceptance criteria,
not claims that the work or acceptance checks have already been completed.

### Landing and Home integration acceptance

- A signed-in user creates and opens an owned project.
- Home shows authoritative status, spend and findings after steering, after a
  cap wait and resume, and after a server restart.
- A deleted or changed account cannot see another account's records.
- Record the acceptance evidence in this README. Fix only reproducible defects
  within projects, Home or Landing; coordinate public-contract changes with
  their owners.

Composer steering, cap enforcement, restart restoration, OAuth and Stripe remain
with their existing owners. Steering uses `projects.requireProject` through the
public index; no additional projects wiring is owed for #32, #33 or #41.

### Review what ran while away

- `GET /api/projects` returns each project's last-visit time and
  `sinceLastVisit: { sessionsEnded, findingsAdded, spend }`.
- Opening a project records its visit. Home marks cards with changes since the
  last visit, and the next visit clears the mark.
- The last-visit time survives a server restart.
- Test both memory and PostgreSQL stores, and render the mark in a page test.
- Keep the State pattern unchanged. The owner's proposed storage is a
  `projects.last_opened_at` column plus one query, without a new table unless
  a demonstrated need emerges.

This scope record changes documentation only. It introduces no migration or
runtime behavior; the story's implementation is subsequent work.

### Account deletion policy

The projects owner [accepted the policy on #49](https://github.com/ziyangliu-666/lumen-next/pull/49#issuecomment-5827081283):
retain projects and findings associated with the tombstoned account ID. Do not
cascade-delete them, transfer ownership, or attach them to a new account using
the same email or provider. Retention does not anonymize project questions or
finding text. Every authenticated project and finding read must preserve its
account-ID ownership check.

### Acceptance evidence, 29 September 2026

On main base `dfb767f`, #57 and the composed budget wiring in #56 are merged.
`sprint3Acceptance.test.ts` uses `openTestDb()` and the real composed application
with identity cookies, plus a deterministic Worker that records spend/findings:

- Passed: an owner creates a project and opens its session through HTTP; the
  project list reports Finished, one finding and $0.10 spend.
- Passed: closing and recomposing the application over the same database retains
  the card and finding. This is application recreation, not a browser or host
  crash test.
- Passed: another account receives an empty list and 404 for project/finding
  reads. After deletion, the old cookie receives 401; registration with the same
  email does not recover ownership, while project/finding rows remain stored.
- Passed: a zero cap stops a later turn; raising the cap and starting a new turn
  updates the card to Finished with two findings and $0.20 spend.
- Pending: a real cap approval wait and resume. The current composed guard stops
  work; the test explicitly keeps this criterion as TODO. Raising a cap and
  starting another turn is not evidence of an approval resume.

`sessionIntegration.test.ts` also passes with the real session and steering
public slices, a Broker command, memory storage and a scripted model: a queued
`task.steer` reaches the model, a reader records a finding, and the card reports
Finished and $0.05 spend. This checks the server integration, not a live model
or browser composer.

Browser acceptance on 29 September used the production build at
`http://localhost:4100`, PostgreSQL, real identity cookies and the demo worker
with no external model. Passed: signed-out Home links to Landing; signing in
shows the correct account and empty state; Landing creates an Explore project
and opens its session; Home shows Finished, $0.0300 and three findings; expanding
findings shows source links, and a source link opens the correct reader task.
After stopping and restarting the server process, reloading Home preserves the
card, spend and findings. Signing out and revisiting Home shows the signed-out
prompt without the old card. This is a completed browser pass for the demo flow,
not browser evidence of real-model steering, cap approval or account deletion.
The source Session page's findings rail is still empty after restart although
Home's persisted findings are present; that Session-page limitation is outside
this slice and is not counted as a projects fix.

The last-visit story remains unimplemented. The
[coordination request](https://github.com/ziyangliu-666/lumen-next/pull/24#issuecomment-5884072955)
asks core to confirm migration 011, the exact historical-spend public port and
visit API, and how to supply the shared logger. Existing SessionDirectory
summaries expose cumulative spend only. No migration, private cross-slice SQL,
State change or production logging change is included in these acceptance tests.

Validation: the targeted PostgreSQL suite passes three cases with one explicit
approval-resume TODO; the session/steering suite passes two cases. Full
`npm run verify` with `DATABASE_URL` passes format, lint and typecheck but is not
green: the latest run has 884 passing tests, 11 skipped and one TODO, with 5-second
timeouts in billing's `adminIntegration.test.ts` and identity's
`accountDeletion.test.ts`. A diagnostic coverage run with two workers also
timed out in those cases. Their source and timeout settings are unchanged.
Both files subsequently passed in an isolated run (eight tests). PR #60 at
`846acdb` passed remote quality, Web build, dependency audit and CodeQL; its
review-request job was skipped because the PR is a draft. These results suggest
local timing sensitivity but do not turn the failed full local runs into passes.
`npm run build` also passed before the browser acceptance.

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

If session creation rejects, the service deletes the newly inserted project
before returning 503. It does not query session or replay start. A cleanup error
propagates to the shared error handler rather than claiming compensation succeeded.
This is the requested delete-on-failure strategy, not an atomic cross-slice
transaction; session owns any partially written session records.

## Storage and pages

Memory and PostgreSQL stores implement the same port. SQL reads and writes only
the owned projects/findings tables. Migration `005_projects_read_model.sql` lives in `core/db/migrations` and is applied on normal startup. It accommodates
arbitrary temporary account IDs without changing authGuard, and adds finding
project associations and pagination indexes.

Landing preserves question/mode in tab storage. Home and Landing obtain the
account and identity/stub mode from the shared `useCurrentAccount()` hook. Home
mounts its project list only after the account is ready, links signed-out visitors
to Landing, and distinguishes lookup failures from signed-out state. Changing
the account or mode remounts the list; a later 401 still clears private data. Home supports loaded-project search/status filters,
pagination, safe literal finding text and source-session links. Queued/running cards refresh every five seconds; waiting cards every fifteen
seconds; terminal and unconfirmed cards refresh manually or on window focus.
Fetches abort on unmount, hidden tabs pause polling, and errors retain loaded
data. A 401 clears private data. Transient failures back off 5/10/20/40 seconds,
then pause on the fifth consecutive failure until Retry; 401 pauses immediately; all other failures use the bounded schedule. Focus does
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
