# UC2 integration handoff

These patches are **not applied**. The task owner explicitly chose to preserve
the projects/Home/Landing boundary. No shared source, another slice, auth guard,
dependency manifest or build configuration was changed by this task.

## Owner patches

| Patch | Reviewers and purpose |
| --- | --- |
| [owner-wiring.patch](owner-wiring.patch) | Session and shell owners: expose session lookup/list/start/stop through the public index; persist mode; inject finding persistence and publish after success; register projects and slice migrations; load session/task deep links; notify Home of stream invalidation. |
| [client-wiring.patch](client-wiring.patch) | Shell owner: move the temporary page-local HTTP bridge into the shared API client. No page imports another page. |

Both patches pass `git apply --check --ignore-space-change` against this task's
source. The whitespace option accommodates the Windows CRLF checkout. They are
review proposals, not compiled or integration-tested changes. Apply in order in
the owning task, resolve any upstream drift, format the touched files and run the
full verification/build suite. Neither patch is automatically applied by a script.

```sh
git apply --check --ignore-space-change apps/server/src/modules/projects/integration/owner-wiring.patch
git apply --ignore-space-change apps/server/src/modules/projects/integration/owner-wiring.patch
git apply --check --ignore-space-change apps/server/src/modules/projects/integration/client-wiring.patch
git apply --ignore-space-change apps/server/src/modules/projects/integration/client-wiring.patch
npm run verify
npm run build
```

The session port must read its own trace, not call `projects.projectOf` recursively.
Use `projects.requireProject` to guard direct session creation without querying
session again. Projects chooses the latest session; session owns the subtree stop.
The supplied adapter proposal obtains status from the root task. Session must
confirm that this is the authoritative session status for its execution model.

## Remaining shared decisions

- Promote the implemented project/card/finding DTOs to `packages/contracts` with
  owner review, then replace the local server/web declarations. Existing shared
  contracts do not yet define the agreed UC2 read model.
- Wire `listFindings` into session snapshots and the session findings view; keep
  authorization at the session boundary. The patch supplies the persistence hook,
  but the current demo worker does not generate research findings. Steering must
  call the hook when a real finding is accepted. Mode-specific research execution
  also belongs to session/steering, not to project creation.
- Implement real identity sign-in and its return-to-Landing behavior in identity's
  task. UC2 keeps the draft in sessionStorage and uses the existing stub helper.
  The current SignIn page is still a placeholder.
- Review persistent session spend with session/billing. The proposal sums task
  own-costs for one session; it does not claim to implement ledger-period wallet
  totals or restore the in-memory kernel's budget tracking after a restart.
- Migrate existing data deliberately. Migration 002 permits arbitrary stub IDs
  in projects only; authGuard and accounts are untouched. Restore an identity FK
  only after all owners map to real accounts. Down migration fails on non-UUID
  stub IDs rather than deleting them. Legacy findings have a nullable project ID:
  they remain session-readable, but do not count on Home until session supplies
  the association for a backfill. New writes use millisecond timestamps; review
  old sub-millisecond data before relying on cursor pagination over legacy rows.

## Acceptance checks after owner integration

1. Start from the normal application entry point in memory and PostgreSQL modes;
   verify projects routes exist and built artifacts contain all SQL migrations.
2. Create an Explore and Seed project; preserve the full question, map mode,
   navigate to the existing session without starting a duplicate run.
3. Create two sessions under one project; Stop affects only the latest session's
   subtree. Failed requests retain the last confirmed card. Another account gets
   404 for the project, findings and source session.
4. Emit a real finding, persist it before its single event, reload and restart,
   and verify Home counts plus the session snapshot/source-task link.
5. Check reconnect invalidation, hidden-tab pause, cursor pagination, multiple
   loaded pages, session cost changes, terminal cards and 401 recovery.
6. Run CI, Security and Deploy build; obtain the slice-owner review and merge the
   PR. Local checks alone do not satisfy the repository's full DOD.

## Local evidence

The UC2 tests use the public session kernel with an explicit test-owned lookup
adapter because the production lookup API is absent. Browser review uses the
same kind of temporary composition, not a modification of main.ts. It verified
draft/mode restoration, project creation, Home cards, search, confirmed Stop,
findings rendered as literal text and source URLs. The existing Session page does not yet consume
the deep-link query; that visible limitation is addressed by the owner patch.

Validation on 2026-09-18:

- `npm run verify`: passed; 141 tests passed, 20 database tests skipped without
  `DATABASE_URL`; line coverage 82.08%.
- Disposable PostgreSQL 17, `npx vitest run --coverage --no-file-parallelism`:
  all 161 tests passed; line coverage 98.77%.
- `npm run build`: contracts, server and web passed. This does not register the
  new slice or copy its SQL until the owner patch is applied.
- Both unapplied patches pass the whitespace-tolerant apply check; `git diff --check`
  reports no whitespace errors.
