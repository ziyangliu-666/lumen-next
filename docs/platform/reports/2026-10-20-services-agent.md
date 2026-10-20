# Report: identity, project and billing services (subagent, 2026-10-20)

Verbatim report from the subagent that wrote `apps/server/src/services/identity.ts`,
`project.ts` and `billing.ts`.

---

I created the three service files. `tsc` passes and my three files pass `eslint` and `prettier`. The checks over the whole `apps/server/src/services` folder still fail, because three shared helper files have lint and format problems. I did not change any existing file and did not commit.

## Files created
- `apps/server/src/services/identity.ts`
- `apps/server/src/services/project.ts`
- `apps/server/src/services/billing.ts`

I added no tests. None of the code is a pure helper, so a test would need a database.

## Where each port comes from

**identity**
- In-process over the shared database: the identity slice, wired as in `app.ts`. That includes `eraseAccountSecrets`, `removeOwnOpenAiKey`, the OAuth providers and mail from `identityConfig()`.
- `SessionAccess` always answers false.
- The mail worker starts after listen. On shutdown the order is server close, then mail worker stop, then db close.
- It makes no HTTP calls.

**project**
- In-process: the identity slice, used only for `principalResolver`. Mail and OAuth are left out because no identity routes are registered.
- Over HTTP: `SessionDirectory` comes from `remoteSessionDirectory(internalCaller(sessionUrl(), internalKey()))`.
- It registers only the projects routes.

**billing**
- In-process from the identity slice: `principalResolver`, `canSpend`, `adminAccounts`, `adminChanges`, and the keys `write`/`read`/`remove` wiring through `withActiveAccount` and `withActiveAccountRead`.
- `secretCipherFromEnvironment` and `stripeFromEnvironment` are wired when they are configured. The Stripe origin must equal the identity origin, the same check as in `app.ts`.
- Over HTTP: `approvalResume.requestResume` calls `internalCaller(sessionUrl(), internalKey())('/internal/approvals/resume', input)`.
- It registers only the billing routes.

Each service reads and validates its environment before it opens the database, and each one ends with `run(log, start)`.

## Checks (from the worktree root)
- `npx prettier --write` on the 3 files: no changes.
- `npx tsc -p apps/server --noEmit`: exit 0.
- `npx eslint apps/server/src/services`: exit 1. The problems are only in the shared helpers:
  - `shared/turnRoutes.ts:53:64`: error `@typescript-eslint/no-base-to-string` on `String(body['title'])`.
  - `shared/directory.ts:64:123`: warning, missing return type.
- `npx eslint` on my 3 files only: exit 0.
- `npx prettier --check apps/server/src/services`: exit 1. `shared/directory.ts`, `shared/rabbit.ts` and `shared/remoteReport.ts` are not formatted.
- `npx prettier --check` on my 3 files only: exit 0.

## Problems in the shared helpers and the contract
1. **No route serves `/internal/approvals/resume`.** No file in `apps/server/src/services` has it. `session.ts` must register it, with the internal key check, and call `session.approvals.requestResume`. Until then an approval on the Wallet page fails.
2. **Migrations:** the contract ("Data") says only `session` runs migrations and the others wait. `shared/env.ts` `database()` migrates from every service under an advisory lock. One of the two must change.
3. **Directory routes:** contract section 4 names `GET /internal/tasks/:taskId/session` and `GET /internal/sessions/:sessionId/context`. `shared/directory.ts` uses `POST /internal/directory/{start,list,stop,context,task-session}`.
4. **Adapter file names:** the contract lists `internalAuth.ts`. The real file is `internal.ts`, and `directory.ts`, `serve.ts`, `env.ts` and `turnRoutes.ts` are not in the list.
5. **Duplicated code:** `shared/` has no helper that builds the identity slice from `(db, log, config)`, so each of the three services repeats about ten lines. It also has no `SessionAccess` that always answers false, so each file defines its own.
