// The data behind docs/status/index.html. Edit this file and nothing else.
//
// - `written` and `onMain` are percentages of one person's whole slice:
//   pages, server module, tests, the design pattern with a test that proves it,
//   and the wiring into the composition root (apps/server/src/app.ts, since #25).
//   Only `onMain` counts as delivered.
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
        note: 'session, billing, identity (#23) and projects (#24) are composed in app.ts; steering is not',
      },
      {
        text: 'A question fans out to workers; the tree is readable and costed',
        done: true,
        note: '#10, #11, the page laid out to the spec in #27, and a step that carries what it did in #28',
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
    commit: '65baeaf',
    pipelines: 'CI, Security and Deploy green',
    tests: 583,
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
      written: 90,
      onMain: 90,
      state: 'done',
      stateLabel: 'Sprint 2 part done',
      summary:
        'core/db, the trace in Postgres, restore after a restart, delegation, cost roll-up, session.open and reconnect, container and DAST, the ports projects plugs into, this board (#18), and the budget seam the kernel asks at three check points (#22). Since then: the composition root moved out of main.ts into app.ts, and the whole application now runs end to end in the gate over HTTP, a cookie and one socket (#25); one answer to who is signed in, after #23 and #24 each shut the front door on the other (#26); the Session page rebuilt the way the spec draws it, with the step stream as the main column and the call tree beside it (#27); and a step that carries what it did (#28), with StepDetail in the contract, a jsonb column in migration 008, a step and its charge written in one transaction, and the page drawing a tool step with its rows, output, time and cost and a delegate step naming its own children. The architecture doc and the session README now say what main does in place of the Sprint 1 text (#29): the contract as it stands, the events and commands on the wire today, and the page layout that #27 and #28 built. 18 pull requests merged.',
      todo: [
        { text: 'core/db: pool and migrations (#8)', done: true },
        { text: 'Trace in Postgres; restore after a restart (#13)', done: true },
        { text: 'Delegation, cost roll-up, call tree on the page (#10)', done: true },
        { text: 'session.open and reconnect (#11)', done: true },
        { text: 'Container image, staging, DAST (#14)', done: true },
        { text: 'Ports for the projects slice (#17)', done: true },
        { text: 'Review #15 and #16', done: true },
        { text: 'Review #23: identity only, rebased, CI green', done: true },
        {
          text: 'BudgetGuard, Charge and Decision in core/domain, called at three check points',
          done: true,
        },
        { text: 'The whole application end to end in the gate (#25)', done: true },
        { text: 'The Session page as the spec draws it (#27)', done: true },
        {
          text: 'Pass billing budget guard in app.ts once a new account has a default cap',
          done: false,
        },
        {
          text: 'childTaskIds in the contract, so a delegate step names its own children (#28)',
          done: true,
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
      written: 88,
      onMain: 85,
      state: 'review',
      stateLabel: '#30 open, CI green, in review',
      summary:
        'Merged on 21 Sep as #24, reopened on a branch in this repository after the fork pull request #16 was closed, so that CI could run. Five routes, memory and Postgres stores, Landing and Home, and migration 005 in the shared core/db/migrations. The six State classes now carry behaviour rather than constants: each decides the label, the tone, the actions, the refresh policy and which transitions are legal, and a started card is refused a return to Queued. Creation deletes the project when the session fails to start, so no orphan card is left, and a failed read that is not a 401 backs off and stops after five failures. Projects is composed in app.ts through the public SessionDirectory of the session slice, and the end-to-end test (#25) drives a project from the question to its findings. Legacy findings still have a null project id and wait on an owner-approved backfill. Since the merge, the first of the two follow-ups is open as #30 on branch projects/home-current-account (one commit, 21 Sep, three files): Home takes the account and the mode from useCurrentAccount instead of reading sign-in from a 401, a signed-out visitor is pointed at Landing, the list is keyed by mode and account id so a changed account cannot reuse old pages, and the 401 path stays for a cookie that expires while the page is open. Seven rendering tests cover loading, a failed account lookup, signed out and ready in both modes, and a later 401. Quality, web build, dependency audit and CodeQL are green on it; it waits on an owner review, and the automated reviewer did not run because its quota was exhausted.',
      todo: [
        { text: 'Rebase; migration to core/db/migrations/005_', done: true },
        { text: 'Delete the patches; add the main.ts lines', done: true },
        { text: 'Back off the Home poll; no orphan project', done: true },
        { text: 'State classes need behaviour, not constants', done: true },
        { text: 'Home asks useCurrentAccount (#26), not a 401 inside usePages', done: false },
        { text: 'Backfill legacy findings with a project id, so they count on Home', done: false },
      ],
      prs: [{ number: 30, label: 'Home asks the shared current account: open, CI green, in review' }],
      prompt: `You are working in the lumen-next repo on the projects slice (apps/server/src/modules/projects, apps/web/src/pages/landing, apps/web/src/pages/home), owned by PENG XUJIAN. Pull request #24 is merged: the routes, both stores, Landing and Home, migration 005 and the six State classes are on main. The fork pull request #16 is closed. The composition root is now apps/server/src/app.ts, not main.ts, and projects is registered there. Read CLAUDE.md, docs/CODING_STANDARDS.md, apps/server/src/modules/projects/README.md and apps/web/src/core/auth.tsx before you change anything. Everything you commit is English.

Goal: close the two loose ends the merge left, one small pull request each.

Do, in this order:
1. Written and waiting on review: pull request #30, on branch projects/home-current-account, makes Home take the account and the mode from useCurrentAccount instead of deciding from a 401 inside usePages, keeps the 401 path for a cookie that expires while the page is open, and points a signed-out visitor at Landing. CI is green on it. Do not write it a second time; answer its review, and rebase it if main moves under it.
2. Backfill the legacy findings. Migration 005 added findings.project_id as nullable, so a finding written before it has no project and never reaches Home. Agree the rule with the core owner, write it as a new migration under apps/server/src/core/db/migrations, and test that a finding whose session has a project is given that project, and that one with a stub session id is left alone rather than deleted.
3. If either step changes a State class, add the before and after to CARD_STATE.md, so the Sprint 4 refactor record stays true.

Constraints: touch only modules/projects, pages/home, pages/landing and the one new migration. Use another slice only through its public index. No new dependency. Done means npm run verify is green with DATABASE_URL set (docker compose up db), and CI is green on a branch in this repository, not on a fork.`,
    },
    {
      id: 'luyi',
      name: 'LU YI',
      slice: 'UC1 identity',
      pattern: 'Strategy with Template Method',
      written: 85,
      onMain: 85,
      state: 'done',
      stateLabel: '#23 merged; identity on main',
      summary:
        'Merged on 21 Sep as #23: password sign-in with the reviewed scrypt, hashed session tokens, an Origin check, parameterised SQL and three migrations, with the cookie resolver composed in app.ts whenever DATABASE_URL is set, and the staging origin and cookie settings beside it. AbstractAuthFlow with PasswordStrategy and SessionStrategy is the Strategy with Template Method, and its tests cover a wrong password, a suspended account, and a storage failure that must not read as a rejection. A password change revokes the other sessions. The end-to-end test (#25) signs in for real, and the container smoke test signs in through the image. OAuth, mail verification and password reset are written and tested but not wired, and account deletion is not written; both are Sprint 3. #15 was closed as superseded.',
      todo: [
        { text: 'New branch with identity only', done: true },
        { text: 'Staging env vars; smoke test signs in for real', done: true },
        { text: 'Password change revokes other sessions', done: true },
        { text: 'Store tests run in CI; drop pglite; pin arctic', done: true },
        { text: 'Trim docs/luyi to docs/identity', done: true },
        { text: 'Close #15 once #23 merges', done: true },
        {
          text: 'Publish an account eligibility check on the public index, for billing canSpend',
          done: false,
        },
        { text: 'Sprint 3: wire GitHub and Google OAuth', done: false },
        { text: 'Sprint 3: mail verification and password reset', done: false },
        { text: 'Sprint 3: account deletion, DELETE /api/me', done: false },
      ],
      prs: [],
      prompt: `You are working in the lumen-next repo on the identity slice (apps/server/src/modules/identity, apps/web/src/pages/signin), owned by LU YI. Pull request #23 is merged: password sign-in, hashed session tokens, the three migrations and the cookie resolver are on main. The composition root is now apps/server/src/app.ts, not main.ts, and identity is built there whenever there is a database. Pull request #15 is closed as superseded. Read CLAUDE.md, docs/CODING_STANDARDS.md, docs/DOD.md and apps/server/src/modules/identity/README.md before you change anything. Everything you commit is English. The authentication core was reviewed and is sound: do not rewrite it, and do not widen a pull request.

Goal: give the other slices what they are waiting on, then start the Sprint 3 work.

Do, in this order, one small pull request each:
1. Publish an account eligibility check on the public index of modules/identity: given an account id, may it spend. Billing builds its AccountHandler with a canSpend that refuses everything by default, which is why no caller may ask the budget guard yet. Agree the shape with the billing owner, export it from index.ts, record it in the README, and test a live account, a suspended one and an unknown id.
2. Tell the other four owners what the merge changed for them: with DATABASE_URL set the stub principal no longer works anywhere, and migration 002 adds accounts.suspended and a unique index on the normalised email, so two accounts whose addresses normalise alike fail the startup migration. Ask them to check their own tests and staging settings against both.
3. Sprint 3: wire GitHub and Google OAuth. The strategies, the providers and the attempt store are written and tested but registered nowhere. Put them behind the same cookie and Origin rules as password sign-in, and keep the pinned arctic 3.7.0.
4. Sprint 3: mail verification and password reset. The inline reset delivery still has the timing-enumeration issue raised on #15: answer the same way, and in the same time, whether or not the address is known, and test that.
5. Account deletion, DELETE /api/me, last. It has to say what becomes of the projects, sessions and ledger rows of the account, so agree that with the projects, session and billing owners before you write it.

Constraints: no file outside apps/server/src/modules/identity, apps/web/src/pages/signin, the identity migrations under core/db/migrations, and the identity lines of apps/server/src/app.ts. No new dependency beyond the pinned arctic 3.7.0. Done means each pull request is reviewed and merged with CI, Security and Deploy green.`,
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
        'The core HTTP layer from Sprint 1 is on main (#5). SandboxFs, SteerQueue and the files routes sit on steering/sandbox-foundations, last pushed 17 Sep, now 19 commits behind main. The Worker, the Compute interface and the composer are not started. WorkerReport changed in #10 and #17, and again in #28: appendStep now takes an optional StepDetail, a detail.cost is charged in the same call, and delegate() writes the delegate step itself, so a worker may not name child tasks. The composition root moved from main.ts to apps/server/src/app.ts in #25, where the comment beside the registrations says steering is the one slice still to come. The Session page was rebuilt in #27: the composer is one row at the foot of the step stream, and it is left as the region of this slice.',
      todo: [
        { text: 'Today: rebase and open the pull request for what exists', done: false },
        { text: 'Register the steering routes in app.ts, not main.ts (#25)', done: false },
        { text: 'Compute interface, NullCompute, DockerCompute', done: false },
        { text: 'A Worker on the current interface', done: false },
        { text: 'task.steer with the ownership check; composer', done: false },
      ],
      prs: [],
      prompt: `You are working in the lumen-next repo on the steering slice (apps/server/src/modules/steering, the composer row of apps/web/src/pages/session/Session.tsx), owned by LI ZHUOYANG. Branch steering/sandbox-foundations exists and is 19 commits behind main. Read CLAUDE.md, docs/CODING_STANDARDS.md, docs/ARCHITECTURE.md sections 6 to 8, apps/server/src/core/domain/worker.ts and apps/server/src/app.ts on main. The composition root moved out of main.ts into app.ts in #25: every slice is registered there now, and the comment beside the registrations says steering is the one still to come. Everything you commit is English.

Goal: two small pull requests this week, not one large one.

PR 1, today: land what exists.
1. Rebase steering/sandbox-foundations on origin/main. Your commit edits main.ts; move those lines to apps/server/src/app.ts and keep only the ones that register the steering routes, following the pattern session uses there.
2. Open the pull request. SandboxFs, SteerCommand, SteerQueue, the files routes and their tests. Nothing new.

PR 2, by Thursday: the Sprint 2 outcome "sandbox behind its interface", and a real Worker.
1. modules/steering/compute.ts: interface Compute with run(command, options) where options carries cwd and timeoutMs, resolving to exitCode, stdout and stderr. NullCompute returns a readable failure and never throws (Null Object). DockerCompute runs the command in a container with SandboxFs.hostMounts as bind mounts, no network, a memory limit and the timeout. A factory compute('docker' | 'none') selects one. Unit-test NullCompute and the factory; test DockerCompute only when Docker is present, and skip, do not fake, when it is not.
2. modules/steering/worker.ts: export a Worker that implements the CURRENT interface in apps/server/src/core/domain/worker.ts, which #28 changed: run(task, input, report), where report has appendStep(taskId, kind, text, detail), delegate(taskId, work), addSpend(taskId, amount, reason), recordFinding(taskId, text). The optional detail is the contract's StepDetail: tool, durationMs, cost, rows, output. A detail.cost is charged to the task in the same call, so do not call addSpend for it as well; never pass childTaskIds, because delegate() writes the delegate step itself and names the children it opened. No model yet: a lead plans and delegates, a reader runs one command through Compute, writes the output with SandboxFs, hands that output to appendStep as detail.output with the tool and the measured duration, records a finding. Between steps it calls SteerQueue.flush('next-step'), and at the end of a turn flush('end-of-turn'); a landed steer becomes a 'you' step.
3. registerCommands(broker): claim task.steer. The handler must check that the task belongs to a session of the principal (session.projects.taskSession and context, from the public index of modules/session). wsBridge.ts does not do this check for task ids; the comment there says the slice must.
4. Export worker and registerCommands from modules/steering/index.ts, and in apps/server/src/app.ts pass the worker to the createSessionSlice call that is already there. Change nothing else in that call.
5. Composer (the row at the foot of the step stream in Session.tsx, and nothing else on that page): send task.steer for the selected task with when = next-step or end-of-turn, through the stream from @/core/api. Do not open a second socket and do not touch the call tree column.

Constraints: use another slice only through its public index. No new dependency without asking the core owner. Done means npm run verify is green and a session started from the page shows the output of a command as a tool step.`,
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
        'The three stacked pull requests merged on 21 Sep: #19 the wallet shell, #20 the ledger, the Wallet tab and session writing spend inside the task transaction, #21 the BudgetChain with tests for order, short circuit and a fourth policy. Core published Charge, Decision and BudgetGuard in core/domain/budget.ts (#22); billing still keeps its own copies in ports.ts, and the composition root, now apps/server/src/app.ts, does not pass the guard yet, because the chain fails closed and a new account has no cap of its own. No caller asks the guard before a worker spends. The end-to-end test (#25) reads the wallet and the ledger after a real session, so what the Wallet tab reports is now checked in the gate.',
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
        { text: 'A default cap for a new account, so app.ts can pass the guard', done: false },
        { text: 'Decide on the admin routes from #15', done: false },
      ],
      prs: [],
      prompt: `You are working in the lumen-next repo on the billing slice (apps/server/src/modules/billing, apps/web/src/pages/settings, apps/web/src/pages/admin), owned by HE RONG. The three stacked pull requests are merged: #19 the wallet shell, #20 the ledger and the Wallet tab, #21 the budget chain. Core then published the shared shapes in apps/server/src/core/domain/budget.ts (#22), and the session kernel asks a BudgetGuard at a turn, before a fan-out and as each delegated task opens. The composition root moved out of main.ts into apps/server/src/app.ts in #25; it does not pass the billing guard yet, and says why: the chain fails closed and a new account has no cap of its own, so every session would be refused. Read CLAUDE.md, docs/CODING_STANDARDS.md, docs/DOD.md, apps/server/src/core/domain/budget.ts, apps/server/src/app.ts and apps/server/src/modules/billing/README.md before you change anything. Everything you commit is English.

Goal: the cap the page shows becomes a cap that holds.

Do, in this order, one small pull request each:
1. Import Charge, Decision, BudgetGuard and CheckPoint from core/domain/budget.ts and delete the copies at the top of modules/billing/ports.ts. Keep Spend and WalletSummary there. The shapes are the same, so this is an import and a deletion, not a redesign.
2. Give a new account a cap, so that wiring the guard does not refuse every session. Agree the number with the core owner, put it in the wallet migration or the store with a comment saying which, and test that an account with no row of its own is allowed a charge under that cap and refused one over it.
3. Ask the identity owner for the account eligibility check that is now on their list, and pass it to createBillingSlice as canSpend in app.ts. Until it exists the account handler denies every charge, which is why no caller may ask the guard yet.
4. With the agreement of the session and core owner, and only after steps 2 and 3: pass billing.budgetGuard to createSessionSlice as budget in app.ts, where #22 left the comment saying why it is not passed. A deny ends the step with its reason; escalate stays a denial until approvals land in Sprint 3. Test that an over-cap charge stops the step and one under the cap does not.
5. Decide the admin routes. #23 left out GET /api/admin/accounts and the admin page, and #15 is now closed, so they have no home unless billing takes them. Write the decision in the billing README and tell the identity owner.

Constraints: read another slice only through its public index. No new dependency. Money is added and compared in Postgres numeric, never in JavaScript. Until step 4 is on main, neither the Wallet tab nor the README may describe the cap as something that stops a worker.

Done means: steps 1 to 4 are on main, npm run verify is green with DATABASE_URL set (docker compose up db), and a test proves that a charge over the cap stops the step it was checked for.`,
    },
  ],
};
