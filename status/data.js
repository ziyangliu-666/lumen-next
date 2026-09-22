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
  updated: '2026-09-22',
  sprint: {
    name: 'Sprint 2',
    starts: '2026-09-15',
    ends: '2026-09-26',
    dod: [
      {
        text: 'Slices run in parallel',
        done: false,
        note: 'session, billing, identity (#23) and projects (#24) are composed in app.ts; steering is registered in #32, not yet on main',
      },
      {
        text: 'A question fans out to workers; the tree is readable and costed',
        done: true,
        note: '#10, #11, the page laid out to the spec in #27, and a step that carries what it did in #28',
      },
      {
        text: 'Sandbox behind its interface',
        done: false,
        note: 'Compute, NullCompute and DockerCompute are written in #32; not on main',
      },
      {
        text: 'Wallet shows spend; ledger writes',
        done: true,
        note: '#19, #20, #21 merged 21 Sep',
      },
      { text: 'Container image builds; DAST runs against staging', done: true, note: '#14' },
    ],
  },
  main: {
    commit: 'fbec491',
    pipelines: 'CI, Security and Deploy green',
    tests: 590,
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
        'core/db, the trace in Postgres, restore after a restart, delegation, cost roll-up, session.open and reconnect, container and DAST, the ports projects plugs into, this board (#18), and the budget seam the kernel asks at three check points (#22). Since then: the composition root moved out of main.ts into app.ts, and the whole application now runs end to end in the gate over HTTP, a cookie and one socket (#25); one answer to who is signed in, after #23 and #24 each shut the front door on the other (#26); the Session page rebuilt the way the spec draws it, with the step stream as the main column and the call tree beside it (#27); and a step that carries what it did (#28), with StepDetail in the contract, a jsonb column in migration 008, a step and its charge written in one transaction, and the page drawing a tool step with its rows, output, time and cost and a delegate step naming its own children. The architecture doc and the session README now say what main does in place of the Sprint 1 text (#29): the contract as it stands, the events and commands on the wire today, and the page layout that #27 and #28 built. On 22 Sep the projects correction was reviewed and merged as #31 (fbec491): the line in migration 005 and the two README paragraphs that said a legacy findings backfill was owed are gone from main, with no SQL statement changed. #32, the steering slice, is now open with the core owner as its requested reviewer. 18 pull requests merged.',
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
        { text: 'Review #31: the obsolete backfill notes, no SQL change', done: true },
        { text: 'Review #32: the steering slice, the sandbox, the worker and task.steer', done: false },
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
      onMain: 88,
      state: 'done',
      stateLabel: '#31 merged; projects on main',
      summary:
        'Merged on 21 Sep as #24, reopened on a branch in this repository after the fork pull request #16 was closed, so that CI could run. Five routes, memory and Postgres stores, Landing and Home, and migration 005 in the shared core/db/migrations. The six State classes now carry behaviour rather than constants: each decides the label, the tone, the actions, the refresh policy and which transitions are legal, and a started card is refused a return to Queued. Creation deletes the project when the session fails to start, so no orphan card is left, and a failed read that is not a 401 backs off and stops after five failures. Projects is composed in app.ts through the public SessionDirectory of the session slice, and the end-to-end test (#25) drives a project from the question to its findings. Legacy findings still have a null project id and wait on an owner-approved backfill. The first of the two follow-ups merged on 22 Sep as #30 (820d16d): Home takes the account and the mode from useCurrentAccount instead of reading sign-in from a 401, a signed-out visitor is pointed at Landing, the list is keyed by mode and account id so a changed account cannot reuse old pages, and the 401 path stays for a cookie that expires while the page is open. Seven rendering tests cover loading, a failed account lookup, signed out and ready in both modes, and a later 401, and the README records the rule. CI and Deploy are green on main at that commit. The legacy findings backfill is closed without a migration: the core owner answered on #24 on 22 Sep that every finding written since migration 005 already carries a project id, and the only databases that ran 001 to 004 without it are CI runs and the staging container, both recreated from scratch, so the repair rule agreed on that thread is kept for the day a real database needs it rather than run now. #31 did what that answer asked instead, and merged on 22 Sep as fbec491: it deletes the line in migration 005 that said legacy findings stay session-readable and the two README paragraphs that said a backfill was owed. Two lines added and four removed across three files; no SQL statement and no behaviour changed. Its five checks were green and the core owner reviewed and merged it. The branch is deleted and nothing in the repository now says a backfill is owed, so this slice has no loose end left in Sprint 2.',
      todo: [
        { text: 'Rebase; migration to core/db/migrations/005_', done: true },
        { text: 'Delete the patches; add the main.ts lines', done: true },
        { text: 'Back off the Home poll; no orphan project', done: true },
        { text: 'State classes need behaviour, not constants', done: true },
        { text: 'Home asks useCurrentAccount (#26), not a 401 inside usePages (#30)', done: true },
        { text: 'Backfill legacy findings with a project id, so they count on Home', done: false },
        { text: 'No backfill after all: remove the notes that say one is owed (#31)', done: true },
        { text: 'Agree the Sprint 3 work for projects with the core owner', done: false },
      ],
      prs: [],
      prompt: `You are working in the lumen-next repo on the projects slice (apps/server/src/modules/projects, apps/web/src/pages/landing, apps/web/src/pages/home), owned by PENG XUJIAN. Pull requests #24 and #30 are merged: the routes, both stores, Landing and Home, migration 005, the six State classes, and Home taking the account and the mode from useCurrentAccount are all on main. The fork pull request #16 is closed. The composition root is now apps/server/src/app.ts, not main.ts, and projects is registered there. Read CLAUDE.md, docs/CODING_STANDARDS.md, apps/server/src/modules/projects/README.md and apps/web/src/core/auth.tsx before you change anything. Everything you commit is English.

Goal: Sprint 2 is closed for this slice. Keep it closed, and agree what this slice does in Sprint 3 before you open a branch.

Do, in this order:
1. Do not write a backfill migration, and do not reopen the question. The core owner answered on #24 on 22 Sep: every finding written since migration 005 carries a project id, and the only databases that ran 001 to 004 without it are recreated from scratch, so there is no data to repair. The SQL rule you proposed was accepted as the rule to apply if a real database with a null project id ever appears, not as work that is owed now.
2. Pull request #31 is merged, as fbec491. The line in migration 005 that said legacy findings stay session-readable is gone, and so are the two README paragraphs that said a backfill was owed. No SQL statement and no behaviour changed. Nothing in the repository still says a backfill is owed; check that before you write anything new that mentions it.
3. If anyone asks where the agreed rule now lives, record it in the projects README as the rule to apply should such a database ever appear, and say plainly that none exists today. That is a documentation change, not a migration.
4. Sprint 3 in docs/DOD.md is a session steerable from the composer that stays inside its cap, restore after a restart, GitHub and Google OAuth, and Stripe top-up in test mode. None of those is obviously the projects slice. Agree with the core owner which part, if any, touches modules/projects, pages/home or pages/landing, and write the answer down, before you open a branch.
5. Keep an eye on #32, the steering slice: it registers its own routes in app.ts and reads projects.requireProject from your public index. If its review changes that shape, it is your index that has to say so.

Constraints: touch only the projects documentation and modules/projects, pages/home, pages/landing. No new migration. Use another slice only through its public index. No new dependency. Done means the Sprint 3 work for this slice is agreed and written down, on a branch in this repository, not on a fork, and no file in the repository says a backfill is owed.`,
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
      written: 85,
      onMain: 30,
      state: 'review',
      stateLabel: '#32 open, quality check failing',
      summary:
        "The core HTTP layer from Sprint 1 is on main (#5); nothing else of this slice is, so main still holds only the steering README and its index. Pull request #32, opened 22 Sep from steering/sandbox-foundations, carries the rest of UC4 in four commits, 2536 lines added across 23 files, rebased on main and no longer behind it. It moves the old main.ts wiring into apps/server/src/app.ts, where every other slice is registered, and closes the ownership hole its own DESIGN.md had flagged by taking projects.requireProject from the projects public index: a project's files are refused to every account but its owner. On top of that: SandboxFs, which maps the flat /mnt upload, workspace and output namespace onto the host volume and refuses traversal, a planted symlink, a Windows reserved name and anything over quota; SteerCommand and SteerQueue, the Command pattern, with the comparison against Strategy and Null Object written down in the module header; the two project files routes, where an unsafe path and a missing file answer alike; Compute with NullCompute and DockerCompute behind it, which is Sprint 2's own outcome, the sandbox behind its interface; SteerRegistry, which brackets a run so a task.steer arriving at any moment can find the queue inside it; a Worker on the interface #28 left, with no model, that delegates one reader, runs a fixed command through Compute and records a finding; task.steer with the task ownership check that wsBridge.ts says the owning slice must make; and the composer row, which steers whichever task the stream is showing while the root is busy. The worker is opt-in behind LUMEN_WORKER=steering rather than the new default, because the end-to-end test of #25 asserts the demo worker's fan-out. Four of the five checks are green. quality fails on one test, sandboxFs.test.ts line 199, which asserts Windows path.resolve behaviour for a backslash segment and does not hold on the Linux runner: 659 of 660 tests pass, and the guard it documents is not the test that failed. The core owner is the requested reviewer.",
      todo: [
        { text: 'Rebase and open the pull request for what exists (#32)', done: true },
        { text: 'Register the steering routes in app.ts, not main.ts (#25)', done: false },
        { text: 'Compute interface, NullCompute, DockerCompute', done: false },
        { text: 'A Worker on the current interface', done: false },
        { text: 'task.steer with the ownership check; composer', done: false },
        { text: 'Green #32: the sandboxFs platform test fails on the Linux runner', done: false },
      ],
      prs: [
        {
          number: 32,
          label: 'feat(steering): sandbox path virtualization, the steer queue, and the files routes',
        },
      ],
      prompt: `You are working in the lumen-next repo on the steering slice (apps/server/src/modules/steering, the composer row of apps/web/src/pages/session/parts.tsx), owned by LI ZHUOYANG. Pull request #32 is open from steering/sandbox-foundations, rebased on main and carrying the whole slice: SandboxFs, SteerCommand and SteerQueue, the files routes, Compute with NullCompute and DockerCompute, SteerRegistry, the Worker, task.steer, and the composer row. Four of its five checks are green. Read CLAUDE.md, docs/CODING_STANDARDS.md, docs/ARCHITECTURE.md sections 6 to 8, apps/server/src/core/domain/worker.ts and apps/server/src/app.ts on main. Everything you commit is English.

Goal: get #32 to green and merged. Do not open a second pull request, and do not add anything new to this one.

Do, in this order:
1. Fix the one failing test. quality fails at apps/server/src/modules/steering/sandboxFs.test.ts line 199, in the case named "shows the platform behaviour the guard above is written for": it asserts that resolving a path whose segments are separated by backslashes escapes the scope root. That is Windows path.resolve behaviour. On the Linux runner a backslash is an ordinary filename character, the resolved path stays under the root, and the assertion fails. The guard itself is not wrong and this test is not what proves it. Make the assertion platform-aware, or skip it off Windows the way the symlink tests already skip rather than fake, and say in the test why. Never weaken the guard to make a test pass.
2. Push and check that all five checks are green on #32.
3. Answer the review. The points most likely to be raised are the ones your own commit message names, so have the answer ready rather than widening the pull request: the worker is opt-in behind LUMEN_WORKER=steering and not the new default, because #25's end-to-end test asserts the demo worker's three-reader fan-out; DockerCompute's four tests skip because no Docker daemon was reachable; and the reader runs a fixed command, not one built from the task's title, because there is no model here to decide what a user's words are safe to run.
4. Rebase on main if it moves. It took #31 on 22 Sep, a documentation-only change to the projects slice.
5. Once #32 is merged, the Sprint 2 outcome "sandbox behind its interface" is on main and steering is composed in app.ts like every other slice. Agree the Sprint 3 work, a session steerable from the composer that stays inside its cap, with the core owner and the billing owner before starting it, rather than growing this branch.

Constraints: use another slice only through its public index. No new dependency without asking the core owner. Do not change which worker is the default; that is the team's call, not this branch's. Do not touch the call tree column or open a second socket. Done means #32 is merged with CI, Security and Deploy green, and a session started with LUMEN_WORKER=steering shows the output of a command as a tool step.`,
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
