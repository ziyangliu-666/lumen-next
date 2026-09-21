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
      {
        text: 'Wallet shows spend; ledger writes',
        done: false,
        note: 'written in #19, #20, #21; none merged',
      },
      { text: 'Container image builds; DAST runs against staging', done: true, note: '#14' },
    ],
  },
  main: {
    commit: 'bd25121',
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
        'core/db, the trace in Postgres, restore after a restart, delegation, cost roll-up, session.open and reconnect, container and DAST, the ports projects plugs into, and this board (#18). 12 pull requests merged.',
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
      written: 80,
      onMain: 25,
      state: 'review',
      stateLabel: 'Waiting on review, CI green',
      summary:
        'Three pull requests, stacked one on the next, each with CI, SCA and SAST green: #19 the wallet shell against main, #20 the ledger, the Wallet tab and session writing spend inside the task transaction, #21 the BudgetChain with tests for order, short circuit and a fourth policy. None has a human review yet; the automated reviewer reached its quota on all three. Nothing on main yet, and no caller asks the guard before a worker spends.',
      todo: [
        {
          text: 'Today: a draft pull request with the slice shell and GET /api/wallet',
          done: true,
        },
        { text: 'Ledger: record(), monthSpend() in SQL, Wallet tab', done: true },
        { text: 'BudgetChain and the tests that prove the pattern', done: true },
        { text: 'Decide on the admin routes from #15', done: false },
      ],
      prs: [
        { number: 19, label: 'feat(billing): authenticated wallet slice shell' },
        { number: 20, label: 'feat(billing): persist ledger and connect Wallet to task spend' },
        { number: 21, label: 'feat(billing): ordered budget checks with fail-closed policies' },
      ],
      prompt: `You are working in the lumen-next repo on the billing slice (apps/server/src/modules/billing, apps/web/src/pages/settings, apps/web/src/pages/admin), owned by HE RONG. Three pull requests are open and stacked: #19, the wallet shell, against main; #20, the ledger and the Wallet tab, against #19; #21, the budget chain, against #20. CI, SCA and SAST are green on all three, and none of them has been reviewed by a person: the automated reviewer reached its quota. Read CLAUDE.md, docs/CODING_STANDARDS.md, docs/DOD.md and apps/server/src/modules/billing/README.md before you change anything. Everything you commit is English.

Goal: the three land on main in order, and the cap the page shows becomes a cap that holds.

Do, in this order:
1. While they wait for review, do not widen #19, #20 or #21. If main moves, merge main into each branch from the bottom of the stack up, and keep CI green.
2. When #19 merges, point #20 at main; when #20 merges, point #21 at main. One review at a time, in that order.
3. Ask the core owner whether Charge, Decision and BudgetGuard should move from modules/billing/ports.ts to core/domain/budget.ts. If they should, do it in a fourth, small pull request that imports from core and deletes the local copies.
4. Ask the identity owner for an account eligibility check on the public index of modules/identity, and pass it to createBillingSlice as canSpend in main.ts. Until that exists the account handler denies every charge, which is why no caller may ask the guard yet.
5. With the session owner's agreement, and only after step 4: ask budgetGuard.check before a worker spends, at the three points Charge.at names (turn, fan-out, task-open). A deny ends the step with its reason; escalate stays a denial until approvals land in Sprint 3. Test that an over-cap charge stops the step and one under the cap does not.
6. Decide the admin routes: either billing takes GET /api/admin/accounts and the admin page out of #15, or identity keeps them. Write the decision in the billing README and tell the identity owner, so #15 can shrink either way.

Constraints: read another slice only through its public index. No new dependency. Money is added and compared in Postgres numeric, never in JavaScript. Until step 5 is on main, neither the Wallet tab nor the README may describe the cap as something that stops a worker.

Done means: the three pull requests are on main, npm run verify is green with DATABASE_URL set (docker compose up db), and a test proves that a charge over the cap stops the step it was checked for.`,
    },
  ],
};
