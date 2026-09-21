# UC2 integration

PR #17 supplies the session public directory, mode persistence, finding saver,
shared HTTP client and session/task deep links. PR #16's owner review authorizes
the projects migration and startup registration in this branch. The obsolete
patch files and private migration-directory export have been removed.

## Composition

The normal `main.ts` builds session with closures for `requireProject` and
`recordFinding`, then builds projects with `session.projects` and registers its
routes. Existing billing recording remains wired. Metadata-only ownership checks
do not call back into session; session lookups read its own trace. Projects writes
a finding before session publishes its event. No duplicate event or socket is added.

Migration `005_projects_read_model.sql` is in `core/db/migrations`, so startup,
production build copying and `openTestDb()` all use the same migration path.
Number 005 is retained even when 006 has already run; core disables order checks.
The temporary auth guard is unchanged.

Pages use `core/api.request` and `RequestFailure`. Shared `SessionMode`,
`SessionSummary` and `Finding` come from contracts; the directory type comes
from session's public index. Projects-specific cards/pages remain local pending
contract-owner adoption. No nonexistent `createProjectRequest` helper is assumed.

## Failure behavior

Creation is an in-process start followed by compensation on rejection. Delete the
new project only after session confirms no run exists; otherwise retain its
association. Cleanup failure is contained, start is not replayed, and a card with
no confirmed session does not poll. This does not promise an atomic transaction
across two slices. A process crash between insert and start can still leave a
manual-refresh card requiring reconciliation.

Stop delegates to session and reports its confirmed status. Cancellation of
worker execution belongs to session; projects does not implement its own kernel.

## Remaining owner work

- Session snapshots do not yet include persisted findings. Home displays them
  through projects; source links open the existing session/task deep link.
- Real identity sign-in and restoring identity foreign keys remain identity work.
- Legacy findings have nullable project IDs and need an owner-approved backfill
  before they count on Home. Down migration fails on arbitrary non-UUID stub IDs
  rather than deleting data. Review legacy timestamp precision for pagination.
- The shared Deploy workflow still creates a session under the placeholder project
  ID `demo`. The newly wired ownership gate correctly rejects that request.
  Before merging, its owner must replace the authenticated smoke step with a real
  project creation, then fetch the returned session (keep the anonymous 401 check):

  ```sh
  created="$(curl -fsS -X POST http://localhost:4000/api/projects \
    -H 'authorization: stub smoke:user' -H 'content-type: application/json' \
    -d '{"question":"smoke","mode":"explore"}')"
  session_id="$(printf '%s' "$created" | node -e 'let s=""; process.stdin.on("data", c => s += c); process.stdin.on("end", () => console.log(JSON.parse(s).sessionId));')"
  curl -fsS "http://localhost:4000/api/sessions/$session_id" \
    -H 'authorization: stub smoke:user'
  ```

  The workflow is outside the approved shared-file boundary; this branch does not
  silently change it. This is a merge prerequisite, not a failing UC2 route.
- CI and owner approval are required before merge. Fork PR #16 has no workflow
  runs because private-fork workflows are disabled; use an upstream branch as
  the reviewer requested. Local validation does not substitute for those checks.

## Validation commands

```sh
npm run verify
npx vitest run --config apps/web/src/pages/home/vitest.config.ts
npm run build
```

Set `DATABASE_URL` to disposable PostgreSQL to include database tests. Smoke-test
the built normal entry point: create Explore/Seed projects, read cards/findings,
check stranger 404 and anonymous 401, restart and check persistence. The service
integration test uses the real session directory, with no test-owned lookup adapter.

## Verification on 2026-09-21

- Rebased onto main `069a6f2` (including session ports and billing integration).
- `npm run verify` without a database: 182 passed, 34 skipped; 80.45% lines.
- `npm run verify` with disposable PostgreSQL 17: 216 passed, none skipped;
  98.99% lines. Uses normal parallel execution and the shared migration helper.
- Page-local retry policy: all 3 tests passed.
- `npm run build`: passed; built SQL includes 001, 005, 006 and 007.
- Normal built main in memory and PostgreSQL modes: Explore/Seed creation,
  Finished cards, 3 demo findings, session spend 0.03, terminal polling disabled,
  anonymous 401 and stranger 404 (including direct session creation).
- Restarted the PostgreSQL application: both projects, confirmed session status,
  spend and findings were preserved.
- Browser: Landing creates and opens the existing session; Home shows Finished,
  spend and 3 findings with source-task links; network errors retain loaded cards.
