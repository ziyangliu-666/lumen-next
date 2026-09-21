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
      {
        text: 'Slices run in parallel',
        done: false,
        note: 'session and billing on main; identity #23 waits on review; projects and steering are not',
      },
      {
        text: 'A question fans out to workers; the tree is readable and costed',
        done: true,
        note: '#10, #11',
      },
      { text: 'Sandbox behind its interface', done: false, note: 'Compute interface not started' },
      {
        text: 'Wallet shows spend; ledger writes',
        done: true,
        note: '#19, #20, #21 merged 21 Sep',
      },
      { text: 'Container image builds; DAST runs against staging', done: true, note: '#14' },
    ],
  },
  main: {
    commit: '069a6f2',
    pipelines: 'CI, Security and Deploy green',
    tests: 149,
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
      written: 75,
      onMain: 75,
      state: 'done',
      stateLabel: 'Sprint 2 part done',
      summary:
        'core/db, the trace in Postgres, restore after a restart, delegation, cost roll-up, session.open and reconnect, container and DAST, the ports projects plugs into, this board (#18), and the budget seam the kernel asks at three check points (#22). 13 pull requests merged.',
      todo: [
        { text: 'core/db: pool and migrations (#8)', done: true },
        { text: 'Trace in Postgres; restore after a restart (#13)', done: true },
        { text: 'Delegation, cost roll-up, call tree on the page (#10)', done: true },
        { text: 'session.open and reconnect (#11)', done: true },
        { text: 'Container image, staging, DAST (#14)', done: true },
        { text: 'Ports for the projects slice (#17)', done: true },
        { text: 'Review #15 and #16', done: true },
        { text: 'Review #23: identity only, rebased, CI green', done: false },
        {
          text: 'BudgetGuard, Charge and Decision in core/domain, called at three check points',
          done: true,
        },
        {
          text: 'Pass billing budget guard in main.ts once a new account has a default cap',
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
      written: 75,
      onMain: 25,
      state: 'review',
      stateLabel: '#23 open, CI green, needs review',
      summary:
        'The slice was re-cut on identity/password-auth and opened as #23: identity only, rebased on main 069a6f2, wired into main.ts behind DATABASE_URL, with the staging origin and cookie settings and a deploy smoke test that signs in for real. Password sign-in keeps the reviewed scrypt, hashed session tokens, Origin check and parameterised SQL; a password change now revokes the other sessions. CI, CodeQL and the dependency audit are green and the review is requested from the core owner. Deploy has not run on the branch, so the container build and DAST are unproven. OAuth, mail and reset are written but not wired, and account deletion is left out (Sprint 3). #15 stays open as a superseded draft.',
      todo: [
        { text: 'New branch with identity only', done: true },
        { text: 'Staging env vars; smoke test signs in for real', done: true },
        { text: 'Password change revokes other sessions', done: true },
        { text: 'Store tests run in CI; drop pglite; pin arctic', done: true },
        { text: 'Trim docs/luyi to docs/identity', done: true },
      ],
      prs: [
        { number: 23, label: 'feat(identity): password authentication and staging integration' },
        { number: 15, label: 'Superseded draft, left open until #23 merges' },
      ],
      prompt: `You are working in the lumen-next repo on pull request #23 (branch identity/password-auth), the identity slice, owned by LU YI. The re-cut branch is open and green: identity only, rebased on main 069a6f2, wired into main.ts, with CI, CodeQL and the dependency audit passing and the review requested from the core owner. Read CLAUDE.md, docs/CODING_STANDARDS.md and the review on #23 (gh pr view 23 --comments) before you change anything. Everything you commit is English. The authentication core was reviewed and is sound: do not rewrite it, and do not widen the scope again.

Goal: get #23 reviewed, proven in a container, and merged this sprint.

Do, in this order:
1. Answer the review on #23. Fix what is asked inside identity and push to the same branch. If a request reaches another owner's files, say so on the pull request instead of editing them.
2. Before the merge, tell the other four owners two things: the stub principal stops working for every slice once DATABASE_URL is set, and migration 002 adds accounts.suspended and a unique index on the normalised email, so two accounts whose emails normalise alike fail the startup migration. Ask them to check their own tests and staging settings against both.
3. The Deploy workflow has not run on this branch, so the container build, the compose health check and DAST are unproven. Run Deploy against identity/password-auth and fix what it reports. The native process run is not a substitute.
4. Keep OAuth, mail verification and password reset unwired, and account deletion (DELETE /api/me) out of this pull request. They are Sprint 3, and the inline reset delivery still has the timing-enumeration issue raised on #15.
5. Leave #15 open until #23 merges, then close it as superseded. The billing and admin routes inside it are the billing owner's decision, so do not move them here.

Constraints: no file outside apps/server/src/modules/identity, apps/web/src/pages/signin, apps/web/src/core/auth.tsx, the StaffGuard line in apps/web/src/main.tsx, the three identity migrations under core/db/migrations, the identity lines of apps/server/src/main.ts, and the staging and deploy settings the branch already carries. No new dependency beyond the pinned arctic 3.7.0. Done means #23 is approved, CI, Security and Deploy are green on it, and it is merged into main.`,
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
        'The core HTTP layer from Sprint 1 is on main. SandboxFs, SteerQueue and the files routes sit on steering/sandbox-foundations, last pushed 17 Sep, now 12 commits behind main. The Worker, the Compute interface and the composer are not started. WorkerReport changed in #10 and #17.',
      todo: [
        { text: 'Today: rebase and open the pull request for what exists', done: false },
        { text: 'Compute interface, NullCompute, DockerCompute', done: false },
        { text: 'A Worker on the current interface', done: false },
        { text: 'task.steer with the ownership check; composer', done: false },
      ],
      prs: [],
      prompt: `You are working in the lumen-next repo on the steering slice (apps/server/src/modules/steering, the right half of apps/web/src/pages/session/Session.tsx), owned by LI ZHUOYANG. Branch steering/sandbox-foundations exists and is 12 commits behind main. Read CLAUDE.md, docs/CODING_STANDARDS.md, docs/ARCHITECTURE.md sections 6 to 8, and apps/server/src/core/domain/worker.ts on main. Everything you commit is English.

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
      onMain: 70,
      state: 'done',
      stateLabel: 'Wallet and ledger on main',
      summary:
        'The three stacked pull requests merged on 21 Sep: #19 the wallet shell, #20 the ledger, the Wallet tab and session writing spend inside the task transaction, #21 the BudgetChain with tests for order, short circuit and a fourth policy. Core published Charge, Decision and BudgetGuard in core/domain/budget.ts (#22); billing still keeps its own copies in ports.ts, and main.ts does not pass the guard yet, because the chain fails closed and a new account has no cap of its own. No caller asks the guard before a worker spends.',
      todo: [
        {
          text: 'Today: a draft pull request with the slice shell and GET /api/wallet',
          done: true,
        },
        { text: 'Ledger: record(), monthSpend() in SQL, Wallet tab', done: true },
        { text: 'BudgetChain and the tests that prove the pattern', done: true },
        {
          text: 'Import Charge, Decision and BudgetGuard from core/domain; delete the ports.ts copies',
          done: false,
        },
        { text: 'A default cap for a new account, so main.ts can pass the guard', done: false },
        { text: 'Decide on the admin routes from #15', done: false },
      ],
      prs: [],
      prompt: `You are working in the lumen-next repo on the billing slice (apps/server/src/modules/billing, apps/web/src/pages/settings, apps/web/src/pages/admin), owned by HE RONG. The three stacked pull requests are merged: #19 the wallet shell, #20 the ledger and the Wallet tab, #21 the budget chain. Core then published the shared shapes in apps/server/src/core/domain/budget.ts (#22), and the session kernel asks a BudgetGuard at a turn, before a fan-out and as a delegated task opens. main.ts does not pass billing's guard yet: the chain fails closed and a new account has no cap of its own, so every session would be refused. Read CLAUDE.md, docs/CODING_STANDARDS.md, docs/DOD.md, apps/server/src/core/domain/budget.ts and apps/server/src/modules/billing/README.md before you change anything. Everything you commit is English.

Goal: the cap the page shows becomes a cap that holds.

Do, in this order, one small pull request each:
1. Import Charge, Decision, BudgetGuard and CheckPoint from core/domain/budget.ts and delete the copies at the top of modules/billing/ports.ts. Keep Spend and WalletSummary there. The shapes are the same, so this is an import and a deletion, not a redesign.
2. Give a new account a cap, so that wiring the guard does not refuse every session. Agree the number with the core owner, put it in the wallet migration or the store with a comment saying which, and test that an account with no row of its own is allowed a charge under that cap and refused one over it.
3. Ask the identity owner for an account eligibility check on the public index of modules/identity, and pass it to createBillingSlice as canSpend in main.ts. Until that exists the account handler denies every charge, which is why no caller may ask the guard yet.
4. With the session and core owner's agreement, and only after steps 2 and 3: pass billing.budgetGuard to createSessionSlice as budget in main.ts, where #22 left the comment saying why it is not passed. A deny ends the step with its reason; escalate stays a denial until approvals land in Sprint 3. Test that an over-cap charge stops the step and one under the cap does not.
5. Decide the admin routes. Identity's replacement pull request #23 leaves out GET /api/admin/accounts and the admin page, so they have no home unless billing takes them; #15 still holds them and stays open as a superseded draft. Write the decision in the billing README and tell the identity owner.

Constraints: read another slice only through its public index. No new dependency. Money is added and compared in Postgres numeric, never in JavaScript. Until step 4 is on main, neither the Wallet tab nor the README may describe the cap as something that stops a worker.

Done means: steps 1 to 4 are on main, npm run verify is green with DATABASE_URL set (docker compose up db), and a test proves that a charge over the cap stops the step it was checked for.`,
    },
  ],
};
