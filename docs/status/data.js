// The data behind docs/status/index.html. Edit this file and nothing else.
//
// - `written` and `onMain` are percentages of one person's whole slice:
//   pages, server module, tests, the design pattern with a test that proves it,
//   and the wiring into main.ts. Only `onMain` counts as delivered.
// - `state` is one of: done, review, progress, idle.
// - `todo` is that person's list for the sprint. Flip `done` to true as items land.
// - A prompt is pasted into that person's coding agent as it is. Do not put a
//   backtick or a dollar-brace inside a prompt: it would end the string.
window.LUMEN_STATUS = {
  updated: '2026-09-21',
  sprint: {
    name: 'Sprint 2',
    starts: '2026-09-15',
    ends: '2026-09-26',
    dod: [
      { text: 'Slices run in parallel', done: false, note: 'only session has code on main' },
      {
        text: 'A question fans out to workers; the tree is readable and costed',
        done: true,
        note: '#10, #11',
      },
      { text: 'Sandbox behind its interface', done: false, note: 'Compute interface not started' },
      { text: 'Wallet shows spend; ledger writes', done: false, note: 'billing is empty' },
      { text: 'Container image builds; DAST runs against staging', done: true, note: '#14' },
    ],
  },
  main: {
    commit: '1eab4c2',
    pipelines: 'CI, Security and Deploy green',
    tests: 115,
    coverage: 98,
    gate: 65,
    dast: '0 fail, 8 warn',
  },
  project: { starts: '2026-09-02', ends: '2026-10-24' },
  repo: 'https://github.com/ziyangliu-666/lumen-next',
  people: [
    {
      id: 'ziyang',
      name: 'LIU ZIYANG',
      slice: 'UC3 session, core, contracts',
      pattern: 'Composite',
      written: 70,
      onMain: 70,
      state: 'done',
      stateLabel: 'Sprint 2 part done',
      summary:
        'core/db, the trace in Postgres, restore after a restart, delegation, cost roll-up, session.open and reconnect, container and DAST, and the ports projects plugs into. 11 pull requests merged.',
      todo: [
        { text: 'core/db: pool and migrations (#8)', done: true },
        { text: 'Trace in Postgres; restore after a restart (#13)', done: true },
        { text: 'Delegation, cost roll-up, call tree on the page (#10)', done: true },
        { text: 'session.open and reconnect (#11)', done: true },
        { text: 'Container image, staging, DAST (#14)', done: true },
        { text: 'Ports for the projects slice (#17)', done: true },
        { text: 'Review #15 and #16', done: true },
        {
          text: 'BudgetGuard, Charge and Decision in core/domain, called at three check points',
          done: false,
        },
        { text: '@fastify/helmet: clears 5 of the 8 DAST warnings', done: false },
        { text: 'Approval rule on the production environment', done: false },
        { text: 'Progress report 2, 25 Sep', done: false },
      ],
      prs: [],
      prompt: '',
    },
    {
      id: 'peng',
      name: 'PENG XUJIAN',
      slice: 'UC2 projects',
      pattern: 'State',
      written: 65,
      onMain: 25,
      state: 'review',
      stateLabel: 'Reviewed, waiting for changes',
      summary:
        'Five routes, two pages, memory and Postgres stores and tests are written and stay inside the slice. The wiring (#17) is on main and was checked against this branch. No commit since 18 Sep. The pull request comes from a fork, so CI does not run.',
      todo: [
        { text: 'Rebase; migration to core/db/migrations/005_', done: false },
        { text: 'Delete the patches; add the main.ts lines', done: false },
        { text: 'Back off the Home poll; no orphan project', done: false },
        { text: 'State classes need behaviour, not constants', done: false },
      ],
      prs: [{ number: 16, label: 'feat(projects): UC2 project creation and review' }],
      prompt: `You are working in the lumen-next repo on pull request #16 (branch projects/uc2-complete), the projects slice, owned by PENG XUJIAN. Read CLAUDE.md, docs/CODING_STANDARDS.md and the review on PR #16 (gh pr view 16 --comments) before you change anything. Everything you commit is English.

Goal: get #16 mergeable today. The owner's wiring (#17) is already on main.

Do, in this order:
1. Rebase on origin/main.
2. Move modules/projects/migrations/002_projects_read_model.sql to apps/server/src/core/db/migrations/005_projects_read_model.sql. Keep the number 005. Delete the modules/projects/migrations directory and the projectsMigrationsDir export.
3. Delete integration/owner-wiring.patch and integration/client-wiring.patch. Keep integration/README.md as notes.
4. Remove local duplicates that now exist upstream: request and RequestFailure (apps/web/src/core/api.ts), and SessionMode, SessionSummary, Finding (@lumen/contracts). The ProjectSessions port may stay; it already has the shape of SessionDirectory from modules/session.
5. In apps/server/src/main.ts add exactly the lines shown in the comment block there ("Projects, when it lands, goes in like this"). Change nothing else in that file.
6. usePages.ts: a failed fetch that is not a 401 must back off (5 s, 10 s, 20 s, cap 60 s) and stop after 5 failures with a Retry button. Add a test for the schedule.
7. projectService.ts create(): insert the project and start the session so that a failed start leaves no orphan card (one transaction with db.withTransaction, or delete on failure). Add a test.
8. projectStore.test.ts: use openTestDb() and describe.skipIf(!TEST_DATABASE_URL) from core/db/testDb.ts. Do not call node-pg-migrate yourself.
9. State pattern: give the six state classes behaviour that differs by state (what stop() does, the next poll interval, which transition is legal) and a test that an illegal transition is refused. A class that only returns a constant is a lookup table, not State.
10. Push the branch to the main repository, not the fork (git push git@github.com:ziyangliu-666/lumen-next.git projects/uc2-complete), so CI runs. Open the pull request from that branch and close the fork one.

Constraints: touch only modules/projects, pages/home, pages/landing, the one migration file, and the named lines of main.ts. No new dependency. Done means npm run verify is green with DATABASE_URL set (docker compose up db) and CI is green.`,
    },
    {
      id: 'luyi',
      name: 'LU YI',
      slice: 'UC1 identity',
      pattern: 'Strategy with Template Method',
      written: 60,
      onMain: 25,
      state: 'review',
      stateLabel: 'Changes requested',
      summary:
        'Password sign-in is complete and sound: scrypt, hashed session tokens, an Origin check, parameterised SQL. OAuth, mail and reset are written but not wired. The pull request also edits billing, the admin page and core, would stop the staging container, and now conflicts with main. No commit since 18 Sep.',
      todo: [
        { text: 'New branch with identity only', done: false },
        { text: 'Staging env vars; smoke test signs in for real', done: false },
        { text: 'Password change revokes other sessions', done: false },
        { text: 'Store tests run in CI; drop pglite; pin arctic', done: false },
        { text: 'Trim docs/luyi to docs/identity', done: false },
      ],
      prs: [{ number: 15, label: 'feat(identity): authentication and read-only admin access' }],
      prompt: `You are working in the lumen-next repo on pull request #15 (branch identity/auth-flow), the identity slice, owned by LU YI. Read CLAUDE.md, docs/CODING_STANDARDS.md and the review on PR #15 (gh pr view 15 --comments) first. Everything you commit is English. The authentication core was reviewed and is sound: do not rewrite it.

Goal: a pull request that contains only identity and merges by Tuesday.

Do, in this order:
1. Create a new branch identity/password-auth from origin/main. Bring over only: apps/server/src/modules/identity/**, apps/web/src/pages/signin/**, apps/web/src/core/auth.tsx, the StaffGuard change in apps/web/src/main.tsx, the three migrations 002_identity_auth, 003_identity_oauth, 004_identity_mail, the first hunk of core/db/db.ts (T extends object), and the identity wiring in apps/server/src/main.ts.
2. Leave out: every file under modules/billing and pages/admin (HE RONG's), the second hunk of core/db/db.ts (the transaction change; the core owner takes it), and the change to db.test.ts (main already fixed it).
3. docker-compose.staging.yml: set LUMEN_ORIGIN=http://localhost:4000, IDENTITY_SESSION_LIFETIME_MS and IDENTITY_INSECURE_COOKIES=true for the app service. List all three in .env.example with one line each.
4. .github/workflows/deploy.yml smoke test: replace the "authorization: stub" calls with a real signup and login (keep the cookie with curl -c and -b), then the session POST. With the project gate wired, create the project through POST /api/projects first if that route exists on main; otherwise keep the session POST out of the smoke test.
5. main.ts: log one line at startup naming the active resolver. Refuse to start when NODE_ENV=production and DATABASE_URL is unset.
6. accountService.changePassword: revoke every other session of the account, keep the current one. Test it.
7. Tests: move the Postgres tests to openTestDb() and describe.skipIf(!TEST_DATABASE_URL) from core/db/testDb.ts. Remove the IDENTITY_PGLITE_MODULE and IDENTITY_PG_MODULE switches and localPglite.ts. Add arctic to apps/server/package.json with an exact version; remove the dynamic import from tmp/identity-tools.
8. Delete modules/identity/migrations/ (the second copy). core/db/migrations is the only one.
9. Leave account deletion (DELETE /api/me) out of this pull request: it depends on a foreign key the base schema does not have.
10. Docs: keep API.md, OAUTH_SETUP.md, MAIL_SETUP.md, LOCAL_AUTH.md and the seven SVG figures under docs/identity/. Delete every other file that was under docs/luyi/ (working notes, *_PLAN.md, *_HANDOFF.md, archive/, all .docx, .pdf, .png).
11. PR body: say that OAuth, mail verification and password reset are written but not wired (Sprint 3), and that 002 adds accounts.suspended and a unique index on the normalised email. Tell the team that the stub stops working when DATABASE_URL is set.

Constraints: no file outside the list in step 1 and the files named in steps 3 to 5. Done means npm run verify is green with DATABASE_URL set, the identity store tests run (not skip) in CI, and docker compose -f docker-compose.staging.yml up --build reaches healthy.`,
    },
    {
      id: 'zhuoyang',
      name: 'LI ZHUOYANG',
      slice: 'UC4 steering and sandbox',
      pattern: 'Command',
      written: 40,
      onMain: 30,
      state: 'progress',
      stateLabel: 'Code on a branch, no pull request',
      summary:
        'The core HTTP layer from Sprint 1 is on main. SandboxFs, SteerQueue and the files routes sit on steering/sandbox-foundations, last pushed 17 Sep, 7 commits behind main. The Worker, the Compute interface and the composer are not started. WorkerReport changed in #10 and #17.',
      todo: [
        { text: 'Today: rebase and open the pull request for what exists', done: false },
        { text: 'Compute interface, NullCompute, DockerCompute', done: false },
        { text: 'A Worker on the current interface', done: false },
        { text: 'task.steer with the ownership check; composer', done: false },
      ],
      prs: [],
      prompt: `You are working in the lumen-next repo on the steering slice (apps/server/src/modules/steering, the right half of apps/web/src/pages/session/Session.tsx), owned by LI ZHUOYANG. Branch steering/sandbox-foundations exists and is 7 commits behind main. Read CLAUDE.md, docs/CODING_STANDARDS.md, docs/ARCHITECTURE.md sections 6 to 8, and apps/server/src/core/domain/worker.ts on main. Everything you commit is English.

Goal: two small pull requests this week, not one large one.

PR 1, today: land what exists.
1. Rebase steering/sandbox-foundations on origin/main. Your commit edits main.ts; keep only the lines that register the steering routes, following the pattern session uses there.
2. Open the pull request. SandboxFs, SteerCommand, SteerQueue, the files routes and their tests. Nothing new.

PR 2, by Thursday: the Sprint 2 outcome "sandbox behind its interface", and a real Worker.
1. modules/steering/compute.ts: interface Compute { run(command: string, options: { cwd: string; timeoutMs: number }): Promise<{ exitCode: number; stdout: string; stderr: string }> }. NullCompute returns a readable failure and never throws (Null Object). DockerCompute runs the command in a container with SandboxFs.hostMounts as bind mounts, no network, a memory limit and the timeout. A factory compute('docker' | 'none') selects one. Unit-test NullCompute and the factory; test DockerCompute only when Docker is present, and skip, do not fake, when it is not.
2. modules/steering/worker.ts: export a Worker that implements the CURRENT interface: run(task, input, report), where report has appendStep(taskId, kind, text), delegate(taskId, work), addSpend(taskId, amount, reason), recordFinding(taskId, text). No model yet: a lead plans and delegates, a reader runs one command through Compute, writes the output with SandboxFs, records a finding. Between steps it calls SteerQueue.flush('next-step'), and at the end of a turn flush('end-of-turn'); a landed steer becomes a 'you' step.
3. registerCommands(broker): claim task.steer. The handler must check that the task belongs to a session of the principal (session.projects.taskSession and context, from the public index of modules/session). wsBridge.ts does not do this check for task ids; the comment there says the slice must.
4. Export worker and registerCommands from modules/steering/index.ts, and in main.ts pass the worker to createSessionSlice({ broker, db, worker }).
5. Composer (right panel of Session.tsx only): send task.steer for the selected task with when = next-step or end-of-turn, through the stream from @/core/api. Do not open a second socket and do not touch the left panel.

Constraints: use another slice only through its public index. No new dependency without asking the core owner. Done means npm run verify is green and a session started from the page shows a command's output as a tool step.`,
    },
    {
      id: 'herong',
      name: 'HE RONG',
      slice: 'UC5 money and administration',
      pattern: 'Chain of Responsibility',
      written: 25,
      onMain: 25,
      state: 'idle',
      stateLabel: 'No code yet',
      summary:
        'The design document is complete. There is no branch and no pull request. The Sprint 2 outcome "Wallet shows spend; ledger writes" depends on this slice alone. The kernel already has the places for record() and the three budget checks.',
      todo: [
        {
          text: 'Today: a draft pull request with the slice shell and GET /api/wallet',
          done: false,
        },
        { text: 'Ledger: record(), monthSpend() in SQL, Wallet tab', done: false },
        { text: 'BudgetChain and the tests that prove the pattern', done: false },
        { text: 'Decide on the admin routes from #15', done: false },
      ],
      prs: [],
      prompt: `You are working in the lumen-next repo on the billing slice (apps/server/src/modules/billing, apps/web/src/pages/settings, apps/web/src/pages/admin), owned by HE RONG. The slice is empty on main. Read CLAUDE.md, docs/CODING_STANDARDS.md, docs/DOD.md, docs/ARCHITECTURE.md sections 6 and 7 (billing), apps/server/src/core/db/db.ts and core/db/testDb.ts, and modules/session/index.ts as the example of how a slice is built and wired. Everything you commit is English.

Goal: the Sprint 2 outcome "Wallet shows spend; ledger writes", in three small pull requests. Open the first one as a draft today.

PR 1, today: the shell. modules/billing/index.ts exports createBillingSlice({ db }) returning { registerRoutes, record, monthSpend, budgetGuard }. One route, GET /api/wallet, behind requireUser, returning { spent: { dollars: 0 }, cap: { dollars: 0 } }. Register it in main.ts with the two lines the session slice uses. One test with app.inject().

PR 2: the ledger.
1. Migration apps/server/src/core/db/migrations/007_billing_wallets.sql: billing_wallets (account_id text primary key, cap numeric(12,6) not null default 0). ledger_entries already exists in 001. account_id is text, as in sessions.
2. record({ accountId, taskId, amount, reason }) inserts one ledger row. monthSpend(accountId) returns { spent, cap } with the sum done in SQL over the current UTC month. Never add money in JS.
3. GET /api/wallet returns the real figures. GET /api/wallet/ledger?limit&cursor lists the account's entries, newest first. PATCH /api/wallet/cap { cap: { dollars } } validates a finite, non-negative amount with at most six decimals.
4. Tests with openTestDb() and describe.skipIf(!TEST_DATABASE_URL): two concurrent records both count; a month boundary; a foreign account sees nothing.
5. Wallet tab in pages/settings: spent / cap and the ledger table, built from @/ui, money in font-mono with four decimals, request() from @/core/api. The browser never adds.

PR 3: the pattern, test first.
1. If apps/server/src/core/domain/budget.ts exists on main, import BudgetGuard, Charge and Decision from it. If it does not, declare them in modules/billing/ports.ts exactly so:
   type Charge = { accountId: string; taskId: string; estimate: Money; at: 'turn' | 'fan-out' | 'task-open'; reason: string }
   type Decision = { kind: 'allow' } | { kind: 'escalate'; approvalId: string } | { kind: 'deny'; reason: string }
   interface BudgetGuard { check(charge: Charge): Promise<Decision> }
2. BudgetChain implements BudgetGuard over ordered BudgetHandlers: AccountHandler (deny or pass), MonthlyCapHandler (allow when spent + estimate <= cap, else pass), ApprovalHandler (Sprint 3: for now deny with reason 'over the cap'). No handler result means deny. A thrown error propagates; it never becomes allow.
3. Tests that prove the reason for the pattern: handler order and short-circuit; under the cap allows; over the cap does not; adding a fourth handler changes no caller; a store failure is never allow.

The admin routes and page that PR #15 contained are yours to take or rewrite; leave them for a fourth pull request.

Constraints: read another slice only through its public index. No new dependency. Each PR: npm run verify green with DATABASE_URL set (docker compose up db), Conventional Commits, branch billing/<topic>.`,
    },
  ],
};
