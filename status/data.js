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
  updated: '2026-09-23',
  sprint: {
    name: 'Sprint 2',
    starts: '2026-09-15',
    ends: '2026-09-26',
    dod: [
      {
        text: 'Slices run in parallel',
        done: true,
        note: 'all five slices are composed in app.ts on main: session, billing, identity (#23), projects (#24), and steering since #32 merged on 23 Sep (0a96cf3)',
      },
      {
        text: 'A question fans out to workers; the tree is readable and costed',
        done: true,
        note: '#10, #11, the page laid out to the spec in #27, and a step that carries what it did in #28',
      },
      {
        text: 'Sandbox behind its interface',
        done: false,
        note: 'SandboxFs, the steer queue and the files routes landed with #32; Compute, NullCompute and DockerCompute are still in #33, which now conflicts with main',
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
    commit: '2613a84',
    pipelines: 'CI, Security and Deploy green',
    tests: 728,
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
      written: 92,
      onMain: 92,
      state: 'done',
      stateLabel: '#35 on main; #33 and #37 to review',
      summary:
        'core/db, the trace in Postgres, restore after a restart, delegation, cost roll-up, session.open and reconnect, container and DAST, the ports projects plugs into, this board (#18), and the budget seam the kernel asks at three check points (#22). Since then: the composition root moved out of main.ts into app.ts, and the whole application now runs end to end in the gate over HTTP, a cookie and one socket (#25); one answer to who is signed in, after #23 and #24 each shut the front door on the other (#26); the Session page rebuilt the way the spec draws it, with the step stream as the main column and the call tree beside it (#27); and a step that carries what it did (#28), with StepDetail in the contract, a jsonb column in migration 008, a step and its charge written in one transaction, and the page drawing a tool step with its rows, output, time and cost and a delegate step naming its own children. The architecture doc and the session README now say what main does in place of the Sprint 1 text (#29): the contract as it stands, the events and commands on the wire today, and the page layout that #27 and #28 built. On 22 Sep the projects correction was reviewed and merged as #31 (fbec491): the line in migration 005 and the two README paragraphs that said a legacy findings backfill was owed are gone from main, with no SQL statement changed. Two more merged on 23 Sep. #35 (186e734) is the model layer in core: a worker asks a ModelProvider and gets text, tool calls, tokens and what the call cost, and never sees a key, an HTTP client or a vendor wire format. OpenAICompatible covers every vendor that speaks chat completions, with a timeout, bounded retries that honour the vendor Retry-After, and an answer it cannot read refused rather than charged; pricing.ts carries a list price per model with the date it was read, so a model with no row cannot be priced and is not silently free; nullModel is what CI and a keyless demo run against; and modelFromEnv reads LUMEN_MODEL_PROVIDER, LUMEN_MODEL and the vendor key. The demo lead now thinks and replies with the model when one is configured, and the cost goes on the step as detail.cost and so into the ledger. 15 recorded-response tests, plus a live test that spends a few tokens per vendor when a key is in the environment. Then #32, the steering foundation, was reviewed again and merged as 0a96cf3: the two blocking points from the 22 Sep review came back fixed, the platform assertion in sandboxFs.test.ts now skips off Windows without weakening the guard, and /test-health.ps1 is out of the repository .gitignore. Steering registers its routes in app.ts like every other slice, so all five slices are now composed there. Then #34, identity, merged on 23 Sep as 2613a84, and the wiring question it left open on 22 Sep is answered rather than deferred: the two handoff patches are gone from docs/identity and their contents are commits inside the pull request, so main.ts now builds OAuth providers through the identity public index, app.ts forwards them to the slice, and the end-to-end test proves the composition root offers exactly the providers it was given. The shell gained an accountActions slot and nested-route highlighting, and main.tsx routes /settings/account and /settings/keys. Main is 2613a84, with CI and Deploy green on it, 728 tests passing, 98 per cent of lines covered and the ZAP baseline still at 0 fail and 8 warn; the last scheduled Security run on main was green. Four pull requests are open and one is a draft. #33, the rest of the steering stack, carries the worker, Compute and task.steer and now includes the fix for the dropped promise at steerRegistry.ts line 49, with a regression test; it still has the core owner as its requested reviewer and has had no review, and conflicts with main on .env.example, app.ts, main.ts and the steering files, because #32 went in squashed. #36, also steering, adds the six environment variables the server reads that .env.example never named, two of them from #35, and asks the core and identity owners to check the comments on their own; it is documentation only and conflicts with main on .env.example. Three identity pull requests opened on 23 Sep, each on the current tip of main with five green checks: #37, the queued reset and verification mail with migration 009, which asks the core owner to review app.ts, main.ts and the new migration and is the one that names him as its reviewer; #38, which takes out the deprecated arctic library for in-slice OAuth clients and leaves the arctic sentences in docs/ARCHITECTURE.md and docs/CODING_STANDARDS.md to their owner; and #40, the sign-in page, which reports that the shared header overflows a 390 pixel viewport by 24 pixels and does not change it, because the shell belongs to another owner. Draft #39 asks four questions about account deletion that the projects, session and billing owners have to answer with identity. Two team questions are also open on those threads: whether there is a domain to verify for outgoing mail, and what the staging HTTPS domain is and who holds the OAuth client secrets. 21 pull requests merged.',
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
        { text: 'Review #32: the steering sandbox, the steer queue and the files routes', done: true },
        { text: 'Re-review #32 once the blocker and the dropped promise are fixed', done: true },
        { text: 'The model layer in core: one door to a language model, priced per call (#35)', done: true },
        { text: 'Review #33: Compute, the worker, task.steer and the composer row', done: false },
        { text: 'Review #36: the six environment variables .env.example never named', done: false },
        { text: 'Take or refuse the app.ts and main.ts OAuth wiring patch offered by #34', done: true },
        { text: 'Review #37: the identity mail queue, app.ts, main.ts and migration 009', done: false },
        { text: 'Answer #38: the staging HTTPS domain, and who holds the OAuth client secrets', done: false },
        { text: 'Take the arctic sentences out of ARCHITECTURE.md and CODING_STANDARDS.md with #38', done: false },
        { text: 'The shared header overflows a 390px viewport by 24px (#40 reports it)', done: false },
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
5. #32, the steering slice, merged on 23 Sep: it registers its own routes in app.ts and reads projects.requireProject from your public index, with that shape unchanged by the review. #33 is still open on top of it; if its review changes that shape, it is your index that has to say so.

Constraints: touch only the projects documentation and modules/projects, pages/home, pages/landing. No new migration. Use another slice only through its public index. No new dependency. Done means the Sprint 3 work for this slice is agreed and written down, on a branch in this repository, not on a fork, and no file in the repository says a backfill is owed.`,
    },
    {
      id: 'luyi',
      name: 'LU YI',
      slice: 'UC1 identity',
      pattern: 'Strategy with Template Method',
      written: 93,
      onMain: 90,
      state: 'review',
      stateLabel: '#34 on main; #37, #38, #40 open',
      summary:
        'Merged on 21 Sep as #23: password sign-in with the reviewed scrypt, hashed session tokens, an Origin check, parameterised SQL and three migrations, with the cookie resolver composed in app.ts whenever DATABASE_URL is set, and the staging origin and cookie settings beside it. AbstractAuthFlow with PasswordStrategy and SessionStrategy is the Strategy with Template Method, and its tests cover a wrong password, a suspended account, and a storage failure that must not read as a rejection. A password change revokes the other sessions. The end-to-end test (#25) signs in for real, and the container smoke test signs in through the image. OAuth, mail verification and password reset are written and tested but not wired, and account deletion is not written; both are Sprint 3. #15 was closed as superseded. #34 merged on 23 Sep as 2613a84, and with it the first of the Sprint 3 work is on main. It puts oauthProvidersFromEnvironment on the public index: the caller passes the environment, so the slice reads no ambient secret and makes no provider network call, a missing pair disables that provider, a half-filled pair fails startup rather than advertising a sign-in a server cannot finish, the origin must be canonical HTTPS with loopback HTTP only when the caller opts in, and a rejected value is never echoed back. On the page: ProviderSignIn asks the server which providers are enabled and draws only those, AccountSettings and AccountActions are split out for the shell and Settings owners to compose, and accountClient and authClient refresh the shared auth state after a sign-in, a sign-up or an account change, so the header no longer shows a signed-out shell to a signed-in person. The two handoff patches under docs/identity are gone: the core owner approved the app.ts and main.ts wiring and the shell owner the shell.tsx and main.tsx one, both became commits in the pull request, and the end-to-end test proves the composition root offers exactly the providers it was given. Settings.tsx turns its Account tab into a content slot. Environment variables now do turn OAuth on, which is why onMain moves from 85 to 90: the routes, the strategies, the provider configuration and the pages are on main and composed there. What is not on main is mail and account deletion, and no account eligibility check is exported yet, so billing still builds its account handler with a canSpend that refuses everything. Three pull requests opened on 23 Sep, each on the tip of main with five green checks. #37 stops reset and verification mail going out inline: a request is admitted into a PostgreSQL queue by the same two statements for every well-formed address, so the forgot-password answer no longer depends on whether the address is registered, which is the timing-enumeration point raised on #15; a worker claims due rows account-first, sends outside the transaction and deletes an undelivered code; mail is off by default and migration 009 adds the queue table; it asks the core owner, who is its requested reviewer, for app.ts, main.ts and the migration. #38 takes out arctic, deprecated upstream in July 2026, for about 150 lines of in-slice GitHub and Google clients on native fetch with S256 PKCE for Google, and removes the dependency and its lockfile entries; it leaves the arctic sentences in the two shared docs to their owner, and notes it will need a one-line README conflict fix against #37. #40 rebuilds the sign-in page as one column with the providers first, an email divider, a single primary action, and Forgot password shown only when the server reports mail enabled; it touches pages/signin alone and reports, without changing it, that the shared header overflows a 390 pixel viewport by 24 pixels. Draft #39 is the account deletion design and no code: it sets out anonymise with a tombstone against hard delete and asks the projects, session and billing owners four questions, because projects has a foreign key with no cascade and session and billing hold account ids with none. Neither #38 nor #40 has a reviewer requested. Two questions are waiting on the team: whether there is a domain to verify so real mail can be sent, and what the staging HTTPS domain is and who holds the OAuth client secrets.',
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
        { text: 'Sprint 3: wire GitHub and Google OAuth (#34)', done: true },
        { text: 'Sprint 3: mail verification and password reset', done: false },
        { text: 'Sprint 3: account deletion, DELETE /api/me', done: false },
        { text: 'Find owners for the two wiring patches #34 offers, and a reviewer for #34', done: true },
        { text: 'Check the three identity mail variables #36 adds to .env.example', done: false },
        { text: 'Ask for a reviewer on #38 and #40: none is requested on either', done: false },
        { text: 'Settle the .env.example mail variables between #36 and #37', done: false },
        { text: 'Get the four account deletion answers on #39 from projects, session and billing', done: false },
        { text: 'A domain to verify, so reset and verification mail can leave staging', done: false },
      ],
      prs: [
        {
          number: 37,
          label: 'feat(identity): queued reset and verification mail, wired from explicit configuration',
        },
        {
          number: 38,
          label: 'refactor(identity): replace the deprecated arctic library with in-slice OAuth clients',
        },
        {
          number: 40,
          label: 'feat(signin): one focused sign-in column with providers first',
        },
        {
          number: 39,
          label: 'docs(identity): account deletion, a technical draft with four decisions needed (draft)',
        },
      ],
      prompt: `You are working in the lumen-next repo on the identity slice (apps/server/src/modules/identity, apps/web/src/pages/signin), owned by LU YI. Pull request #23 is merged: password sign-in, hashed session tokens, the three migrations and the cookie resolver are on main. The composition root is now apps/server/src/app.ts, not main.ts, and identity is built there whenever there is a database. Pull request #15 is closed as superseded. Pull request #34 is merged, as 2613a84: validated OAuth provider configuration on the public index, ProviderSignIn, AccountSettings and AccountActions, the shared auth state refreshed after a sign-in, a sign-up or an account change, and the two handoff patches folded into the pull request, so main.ts builds the providers and app.ts forwards them. Four of your pull requests are open: #37 queued mail, #38 the in-slice OAuth clients, #40 the sign-in page, and draft #39, the account deletion design. #37, #38 and #40 each have five green checks. Read CLAUDE.md, docs/CODING_STANDARDS.md, docs/DOD.md and apps/server/src/modules/identity/README.md before you change anything. Everything you commit is English. The authentication core was reviewed and is sound: do not rewrite it, and do not widen a pull request.

Goal: give the other slices what they are waiting on, then start the Sprint 3 work.

Do, in this order, one small pull request each:
1. Publish an account eligibility check on the public index of modules/identity: given an account id, may it spend. Billing builds its AccountHandler with a canSpend that refuses everything by default, which is why no caller may ask the budget guard yet. Agree the shape with the billing owner, export it from index.ts, record it in the README, and test a live account, a suspended one and an unknown id.
2. Tell the other four owners what the merge changed for them: with DATABASE_URL set the stub principal no longer works anywhere, and migration 002 adds accounts.suspended and a unique index on the normalised email, so two accounts whose addresses normalise alike fail the startup migration. Ask them to check their own tests and staging settings against both.
3. Sprint 3, GitHub and Google OAuth: the configuration, the buttons, the routes and the composition root wiring are on main with #34, so do not rebuild any of it. What is left is #38, which drops arctic for in-slice clients. No reviewer is requested on it, nor on #40. Ask for one on each, and answer the deployment question you raised on #38 yourself only for the part that is identity's: never put a client secret in the repository or in a comment.
4. Sprint 3: mail verification and password reset is #37, not new work. It answers the timing-enumeration issue raised on #15 by admitting every well-formed address to the queue with the same two statements. It is the one pull request with a requested reviewer, the core owner, because it touches app.ts, main.ts and migration 009. Do not widen it; land it, then settle with #36 which of the two sets the mail lines in .env.example.
5. Account deletion, DELETE /api/me, last. Draft #39 asks the four questions it depends on. Get the answers from the projects, session and billing owners on that thread, then update the draft and write the tests first. Do not turn #39 into code before the answers are there.
6. #40 reports that the shared header overflows a 390 pixel viewport by 24 pixels. That is the shell owner's file. You were right to leave it; tell them, and do not fix it from the sign-in page.

Constraints: no file outside apps/server/src/modules/identity, apps/web/src/pages/signin, the identity migrations under core/db/migrations, and the identity lines of apps/server/src/app.ts and apps/server/src/main.ts. No new dependency: #38 removes arctic rather than replacing it. Done means each pull request is reviewed and merged with CI, Security and Deploy green.`,
    },
    {
      id: 'zhuoyang',
      name: 'LI ZHUOYANG',
      slice: 'UC4 steering and sandbox',
      pattern: 'Command',
      written: 85,
      onMain: 55,
      state: 'review',
      stateLabel: '#32 on main; #33 and #36 conflict',
      summary:
        "#32 merged on 23 Sep as 0a96cf3, so the first half of this slice is on main: SandboxFs, which maps the flat /mnt upload, workspace and output namespace onto the host volume and refuses traversal, a planted symlink, a Windows reserved name, a backslash segment and anything over quota; SteerCommand and SteerQueue, the Command pattern, with the comparison against Strategy and Null Object written down in the module header and eleven tests that exercise it; the two project files routes, where an unsafe path and a missing file answer alike; and the registration in apps/server/src/app.ts, with projects.requireProject taken from the projects public index, so a project's files are refused to every account but its owner. That is the slice registered like every other one, its pattern proven by a test and its cross-slice ownership check closed, which is why onMain moves from 30 to 55. It is not the whole slice: Compute, the worker, task.steer and the composer row are still on a branch, and no page of this slice is on main. Both blocking points from the 22 Sep review came back answered before the merge. The platform assertion in sandboxFs.test.ts now runs under it.skipIf(process.platform !== 'win32') instead of being weakened, and quality is green: on main that file reports 27 tests with one skipped. The personal /test-health.ps1 entry is out of the repository .gitignore. The dropped promise at steerRegistry.ts line 49 belongs to #33 after the split and was fixed there on 23 Sep (f007050): the appendStep call now carries a catch with a comment saying why swallowing it is right, so a steer that cannot land loses itself and not the server, and the regression test uses a plain function rather than a spy, because a spy attaches its own handler and hides the unhandled rejection. #33 is six commits, 2585 lines added and 35 removed across 23 files; quality, build-web and the dependency audit are green and CodeQL was still running at the last look. It has had no review and still has the core owner as its requested reviewer. Because #32 went in squashed, #33 now conflicts with main on .env.example, apps/server/src/app.ts, apps/server/src/main.ts and several steering files, and has to take 0a96cf3 in before it can be read or merged. #36, opened on 23 Sep from steering/env-example-gaps, is documentation only: twelve lines that give .env.example the six variables the server reads and never named, two of them from the model layer #35 put in core, each with its default and a one-line comment, and it asks the core and identity owners to check the comments on their own. It conflicts with main on .env.example as well. Neither branch has moved since, and main has: #34 merged on 23 Sep as 2613a84, so the branch to catch up to is 2613a84, not 0a96cf3. The identity pull request #37 also rewrites the mail configuration the three identity lines of #36 describe, mail is off by default there rather than outbox, and enabling it needs a key, so whichever of the two lands second has to correct those lines.",
      todo: [
        { text: 'Rebase and open the pull request for what exists (#32)', done: true },
        { text: 'Split the worker, Compute and task.steer into #33, stacked on #32', done: true },
        { text: 'Register the steering routes in app.ts, not main.ts (#25)', done: true },
        { text: 'Compute interface, NullCompute, DockerCompute', done: false },
        { text: 'A Worker on the current interface', done: false },
        { text: 'task.steer with the ownership check; composer', done: false },
        { text: 'Green #32 and #33: the sandboxFs platform test fails on the Linux runner', done: true },
        { text: 'Review of #32: do not drop the appendStep promise at steerRegistry.ts line 49', done: true },
        { text: 'Review of #32: take the personal /test-health.ps1 out of the repository .gitignore', done: true },
        { text: 'Rebase #33 on 2613a84: .env.example, app.ts, main.ts and steering files conflict', done: false },
        { text: 'Rebase #36 on 2613a84: .env.example conflicts with the LUMEN_VOLUME_ROOT line', done: false },
        { text: 'Settle the identity mail lines of #36 against #37, which changes their defaults', done: false },
        { text: 'Agree container hardening as Sprint 3 work: non-root user, process and CPU limits', done: false },
      ],
      prs: [
        {
          number: 33,
          label: 'feat(steering): the sandbox behind its interface, a real worker, and task.steer',
        },
        {
          number: 36,
          label: 'docs: list every env var the server reads in .env.example',
        },
      ],
      prompt: `You are working in the lumen-next repo on the steering slice (apps/server/src/modules/steering, the composer row of apps/web/src/pages/session/parts.tsx), owned by LI ZHUOYANG. #32 is merged, as 0a96cf3: SandboxFs, SteerCommand and SteerQueue, the two project files routes and the app.ts wiring are on main, with projects.requireProject closing the ownership check and both blocking review points fixed. Two pull requests are open. #33, from steering/worker-and-compute, carries Compute, NullCompute and DockerCompute, SteerRegistry, the Worker, task.steer and the composer row; quality, build-web and the dependency audit are green on it, CodeQL was still running at the last look, it has had no review, and the core owner is its requested reviewer. #36, from steering/env-example-gaps, is twelve documentation-only lines for .env.example. Read CLAUDE.md, docs/CODING_STANDARDS.md, docs/ARCHITECTURE.md sections 6 to 8, apps/server/src/core/domain/worker.ts, apps/server/src/core/model/provider.ts and apps/server/src/app.ts on main. Everything you commit is English.

Goal: get #33 mergeable and reviewed, then #36 behind it. Do not open a third pull request, and do not add anything new to either of these two.

Do, in this order:
1. #33 conflicts with main and cannot be read or merged until that is fixed. #32 went in squashed, so the four commits it shared with your branch are on main under one new commit and git sees both sides as changed. Bring main into steering/worker-and-compute and resolve .env.example, apps/server/src/app.ts, apps/server/src/main.ts and the steering files against the current tip, 2613a84, not 0a96cf3: identity's #34 has since added the OAuth provider wiring to both app.ts and main.ts, so keep those lines. Keep what #32 already landed and only your new work on top. What is left should be Compute, SteerRegistry, the Worker, task.steer, the composer row and their tests, and nothing else.
2. Do the same for #36. It conflicts on .env.example alone, because #32 added LUMEN_VOLUME_ROOT to the same file. Keep both sets of variables. Then check your three identity lines against #37, which is open: it replaces localMail.ts, makes mail off by default rather than outbox, and adds a key variable. Whichever of the two lands second corrects those lines; say on the thread which you expect that to be.
3. Both blocking points from the review on #32 are answered, on main or on #33: the platform assertion skips off Windows, /test-health.ps1 is out of the repository .gitignore, and steerRegistry.ts no longer drops the appendStep promise. Do not redo any of them, and never weaken the backslash guard to make a test pass.
4. main moved three times on 23 Sep: #35, then #32, then identity's #34, which is why app.ts and main.ts have changed under you again. #35 put a model layer in core: ModelProvider, OpenAICompatible, a price per call and modelFromEnv. The worker in #33 runs a fixed command and asks no model, which is still the right shape for this pull request, because nothing here decides what a user's words are safe to run. Say that on the thread rather than wiring the model in.
5. Run npm run verify with DATABASE_URL set, check all five checks on both pull requests once the rebases are pushed, and ask the core owner to review #33. Ask the core and identity owners to confirm the comments on their own variables in #36.
6. Answer the rest of the review rather than widening either branch. The worker is opt-in behind LUMEN_WORKER=steering and not the new default, because the end-to-end test of #25 asserts the demo worker's three-reader fan-out; DockerCompute's four tests skip because no Docker daemon was reachable, so it is not yet trusted. The container hardening the review raises, a non-root user in the image, a process limit and a CPU bound, is Sprint 3 work: agree it with the core owner, do not add it here.
7. Once #33 is merged, the Sprint 2 outcome, the sandbox behind its interface, is on main. #32 got the routes and the sandbox there; it did not close that outcome, because Compute lives in #33. Agree the Sprint 3 work, a session steerable from the composer that stays inside its cap, with the core owner and the billing owner before starting it, rather than growing this branch.

Constraints: use another slice only through its public index. No new dependency without asking the core owner. Do not change which worker is the default; that is the team's call, not this branch's. Do not touch the call tree column or open a second socket. Done means #33 and then #36 are merged with CI, Security and Deploy green, and a session started with LUMEN_WORKER=steering shows the output of a command as a tool step.`,
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
