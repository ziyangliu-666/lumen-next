export const meta = {
  name: 'verify-rich-steps',
  description:
    'Independent review of the session/rich-steps branch from four lenses, adversarial verification of each finding, and one live test against the running stack',
  phases: [
    {
      title: 'Review',
      detail:
        'four reviewers, one lens each, read-only except the test-quality reviewer who mutates code in a worktree',
    },
    { title: 'Refute', detail: 'one skeptic per finding, told to disprove it' },
    { title: 'Live', detail: 'one agent drives the running application in a real browser' },
  ],
};

const CONTEXT = `
Repository: /Users/rufus/lumen-next (TypeScript monolith: Fastify server in apps/server, React in apps/web, shared types in packages/contracts). Branch under review: session/rich-steps, one commit (5020d2b) on top of origin/main. See the change with: git -C /Users/rufus/lumen-next diff origin/main...session/rich-steps
What it does: a Step gains an optional 'detail' (StepDetail: tool, durationMs, cost, rows, output, childTaskIds). Migration 008 adds a jsonb column. WorkerReport.appendStep(taskId, kind, text, detail?) — a detail.cost is also charged to the task in the same call. Kernel.delegate() now writes the delegate step itself, after opening the children, naming them in detail.childTaskIds. demoWorker became a factory demoWorker({paceMs}). The Session page (apps/web/src/pages/session/parts.tsx, tree.ts) draws tool name, time, cost, rows, output, and lists a delegate step's named children. The web reducer (apps/web/src/core/api.ts) now keeps the whole step.appended event.
The target look is the annotated spec, page 04 "Session", in docs/spec/index.html (search for id="p4"); the text of it describes blocks YOU, THINKING, SEARCH (rows: source chip, query, result, one "nothing" row highlighted), DELEGATED, RUN (terminal output), REPLY, a CALL TREE and FINDINGS in a narrow right column, and a one-row composer at the foot.
Rules that matter: everything committed is English; a slice is used only through its public index; contract changes are additive ("add, never repurpose"); the browser never adds money; pages use theme classes only (no inline style, no hex colour).
The working tree at /Users/rufus/lumen-next is checked out on session/rich-steps and belongs to the person you report to: do NOT edit, commit, stash, or switch branches there.
`;

const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'one sentence: the defect' },
          file: { type: 'string', description: 'repo-relative path' },
          line: { type: 'integer' },
          severity: { type: 'string', enum: ['blocker', 'should-fix', 'nit'] },
          scenario: {
            type: 'string',
            description: 'concrete input or state, then the wrong result',
          },
          evidence: {
            type: 'string',
            description: 'what you read or ran that shows it; quote code or output',
          },
        },
        required: ['title', 'file', 'severity', 'scenario', 'evidence'],
      },
    },
    checked_and_fine: {
      type: 'array',
      items: { type: 'string' },
      description: 'things you examined and found correct, one line each',
    },
  },
  required: ['findings', 'checked_and_fine'],
};

const VERDICT = {
  type: 'object',
  properties: {
    refuted: {
      type: 'boolean',
      description: 'true if the finding is wrong, not reproducible, or not a defect',
    },
    reason: { type: 'string' },
    corrected_severity: { type: 'string', enum: ['blocker', 'should-fix', 'nit', 'not-a-defect'] },
  },
  required: ['refuted', 'reason', 'corrected_severity'],
};

const LENSES = [
  {
    key: 'contract',
    prompt: `Lens: the CONTRACT and everyone who depends on it. Is every change in packages/contracts additive? Does anything that compiled against the old Step / step.appended / WorkerReport still compile and behave? Check the other consumers: apps/server/src/modules/projects, billing, identity, and the unmerged branch origin/steering/sandbox-foundations (git show origin/steering/sandbox-foundations:<path>) which will implement Worker. Is the rule "a detail.cost is charged by appendStep, do not also call addSpend" a trap a worker author will fall into, and is it documented where they will read it (apps/server/src/core/domain/worker.ts)? Is StepDetail the right shape against docs/ARCHITECTURE.md section 4 (the richer Step designed there) — what did it leave out that the spec page needs? Do docs (docs/ARCHITECTURE.md, apps/server/src/modules/session/README.md) still say what the code does?`,
  },
  {
    key: 'server',
    prompt: `Lens: SERVER CORRECTNESS. Read apps/server/src/modules/session/kernel.ts, pgTrace.ts, memoryTrace.ts, demoWorker.ts, the migration 008, apps/server/src/main.ts. Hunt for: (1) appendStep with a cost — the step is written, then addSpend runs; if addSpend throws (database down, ledger refuses) the step exists with a receipt but no charge: is that possible, and what does the user see? (2) delegate(): children are opened, then the delegate step is written, then children run; what if writeStep throws after children were opened? what if the budget refuses? are children left queued for ever? (3) the jsonb write: JSON.stringify of detail — undefined fields, very large output (is there any size limit? a worker could write megabytes into one step and every snapshot would carry it), invalid shapes from a worker (rows not an array) — is anything validated? (4) ordering: is the delegate step's index still before the children's first events on the socket; does a page that joins mid-run see a consistent picture? (5) the pace in demoWorker and main.ts env parsing. (6) restore() after a crash between opening children and writing the delegate step. You may run the server tests in a throwaway worktree: git -C /Users/rufus/lumen-next worktree add /tmp/wf-server session/rich-steps --detach ; ln -s /Users/rufus/lumen-next/node_modules /tmp/wf-server/node_modules ; then DATABASE_URL=postgres://lumen@localhost:54329/lumen npx vitest run apps/server (a Postgres 17 is running there; each suite uses its own schema). Write a quick failing test to PROVE a suspicion before you report it, where that is practical. Remove the worktree when done: git -C /Users/rufus/lumen-next worktree remove --force /tmp/wf-server`,
  },
  {
    key: 'web',
    prompt: `Lens: THE PAGE. Read apps/web/src/pages/session/Session.tsx, parts.tsx, tree.ts, apps/web/src/core/api.ts and their tests, and the spec text for page 04 in docs/spec/index.html. Hunt for: (1) fidelity — list concretely what the spec's Session page shows that this page still does not (be specific: block, field, position), separating "needs data the contract lacks" from "could be drawn today"; (2) reducer correctness in api.ts: the new "keep the whole event" spread — does any event field leak into a Step that should not; duplicate detection by (taskId,index); session.snapshot replacing state while findings are kept separately — can findings and steps disagree after a reconnect? (3) childrenByStep: named ids, fallback by order, mixed old and new steps — find an input that gives a wrong or duplicated child; (4) rendering edge cases: a row with very long text, output with 500 lines or a very long line (overflow?), durationMs 0 or missing, cost 0, a tool step with no detail at all, a delegate step naming a child that has not arrived on the socket yet (task.opened arrives before or after the step?); (5) accessibility: buttons have names, aria-current use, keyboard reachability of tree rows, colour not the only carrier of the 'empty' row; (6) the UI rules: no inline style, no hex colour, theme classes that actually exist in apps/web/src/styles/theme.css (check every class used that is not stock Tailwind: text-faint, border-rule-strong, bg-sunken, text-decide, border-decide, text-keep, text-gap, text-ink, text-body).`,
  },
  {
    key: 'tests',
    prompt: `Lens: ARE THE TESTS REAL. The author says 546 tests pass. Your job is to find behaviour the branch claims that no test would catch if it broke. Work in a throwaway worktree so you can mutate code: git -C /Users/rufus/lumen-next worktree add /tmp/wf-tests session/rich-steps --detach ; ln -s /Users/rufus/lumen-next/node_modules /tmp/wf-tests/node_modules . Run with: cd /tmp/wf-tests && DATABASE_URL=postgres://lumen@localhost:54329/lumen npx vitest run <path> (Postgres 17 is running; suites use their own schemas). Do MUTATION TESTING by hand on at least eight behaviours, one at a time, reverting each: (a) kernel.appendStep: remove the addSpend call for detail.cost; (b) kernel.appendStep: remove the recordable() rounding; (c) kernel.appendStep: remove the childTaskIds guard; (d) kernel.delegate: write the delegate step with an empty childTaskIds; (e) pgTrace.appendStep: pass null instead of JSON.stringify(detail); (f) pgTrace toStep: always omit detail; (g) memoryTrace: drop detail; (h) web api.ts reducer: go back to copying only taskId,index,kind,text; (i) tree.ts childrenByStep: ignore detail.childTaskIds; (j) tree.ts took(): return elapsed() always; (k) parts.tsx: render nothing for rows. For each mutation report whether some test FAILED (name it) or everything still passed (that is a finding: a behaviour with no test). Also look for tests that assert nothing meaningful, that pass for the wrong reason, or that depend on timing (setTimeout races, fixed waits). Finish with git -C /Users/rufus/lumen-next worktree remove --force /tmp/wf-tests`,
  },
];

phase('Review');
const reviewed = await pipeline(
  LENSES,
  (lens) =>
    agent(
      `${CONTEXT}\n${lens.prompt}\n\nReport only what you verified by reading or running. For each finding give the file and line on the branch, a concrete failure scenario, and the evidence. If an area is fine, put one line in checked_and_fine. Do not pad: five real findings beat fifteen guesses.`,
      { label: `review:${lens.key}`, phase: 'Review', schema: FINDINGS },
    ),
  (review, lens) => {
    const serious = (review?.findings ?? []).filter((f) => f.severity !== 'nit');
    return parallel(
      serious.map(
        (f) => () =>
          agent(
            `${CONTEXT}\nA reviewer (lens: ${lens.key}) reported this finding. Your job is to REFUTE it: read the code on the branch, and run something if you can (read-only on /Users/rufus/lumen-next; a throwaway worktree under /tmp/wf-refute-${lens.key} is allowed, remove it after). Is it actually wrong? Is the scenario reachable? Is the severity inflated? Default to refuted=true only when you have evidence it is wrong; if you confirm it, say refuted=false and sharpen the scenario.\n\nFINDING: ${f.title}\nFILE: ${f.file}${f.line ? ':' + f.line : ''}\nSEVERITY: ${f.severity}\nSCENARIO: ${f.scenario}\nEVIDENCE: ${f.evidence}`,
            {
              label: `refute:${lens.key}:${(f.file || '').split('/').pop()}`,
              phase: 'Refute',
              schema: VERDICT,
            },
          ).then((verdict) => ({ ...f, lens: lens.key, verdict })),
      ),
    ).then((judged) => ({
      lens: lens.key,
      judged: judged.filter(Boolean),
      nits: (review?.findings ?? []).filter((f) => f.severity === 'nit'),
      fine: review?.checked_and_fine ?? [],
    }));
  },
);

phase('Live');
const live = await agent(
  `${CONTEXT}
You are the LIVE TESTER. The application built from this branch is ALREADY RUNNING in Docker at http://localhost:4000 with Postgres (real sign-in; the demo worker paces each step at about 400 ms, so a session takes a few seconds to finish). Do not rebuild or stop it. Drive it in a real headless browser. Puppeteer is available without installing anything:
  import { createRequire } from 'node:module';
  const puppeteer = createRequire('/opt/homebrew/lib/node_modules/@mermaid-js/mermaid-cli/node_modules/')('puppeteer');
Write your scripts under /tmp/wf-live/. Sign up at /#/signin (click the control whose text matches /create|sign up/i, then fields #auth-name, #auth-email, #auth-password, #auth-confirmation, submit); use a fresh email each time, password 'correct horse battery 9'. Landing is /#/ (a textarea, then the submit button); it navigates to ?session=<id>#/session. The composer input is input[name=say], send is button[aria-label=Send]. Tree rows are buttons inside <aside>.
Test and report on each, with what you observed (take screenshots to /tmp/wf-live/*.png and LOOK at them with the Read tool):
 1. WATCH IT LIVE: start a session and poll the DOM every 200 ms for 8 s. Do steps appear one after another while it runs (not all at once at the end)? Does the header clock tick and the status change from running to done? Do tool blocks show name, time, cost, rows, the highlighted empty row, and the output block?
 2. DELEGATED block: does each delegate step list exactly its own children (3 on the first turn; after saying a second turn, 1 on the second), with statuses that update live?
 3. RELOAD MID-RUN: start a session, reload the page about 1.5 s in. After it finishes, is every step present exactly once, in order, with its detail? Compare the DOM with GET /api/sessions/<id> (fetch it from the page with credentials).
 4. RECONNECT: you cannot stop the server; instead open the session in a second tab late (after it finished) and confirm it draws the same thing from the snapshot alone, detail included.
 5. SECOND ACCOUNT: sign up another user in a fresh incognito context and open the first user's ?session=<id>#/session URL. What does the page show? It must not show any content of the session.
 6. NARROW SCREEN and LIGHT THEME: 390 px wide, prefers-color-scheme light: horizontal overflow? is the output block scrollable rather than breaking the layout? readable contrast?
 7. KEYBOARD: can you reach a tree row and a delegated child with Tab and open it with Enter?
 8. Console errors and failed requests (ignore /favicon.ico).
 9. Compare a screenshot of the finished Session page with the spec: render file:///Users/rufus/lumen-next/docs/spec/index.html at 1500 px wide and screenshot the region around the element with id="p4". List the visible differences that remain, most important first.
Report findings in the schema (file may be the page file you believe is responsible, or 'runtime'); put what worked in checked_and_fine.`,
  { label: 'live:browser', phase: 'Live', schema: FINDINGS },
);

const confirmed = reviewed
  .filter(Boolean)
  .flatMap((r) => r.judged.filter((f) => f.verdict && !f.verdict.refuted));
const refuted = reviewed
  .filter(Boolean)
  .flatMap((r) => r.judged.filter((f) => f.verdict && f.verdict.refuted));
log(
  `${confirmed.length} findings survived refutation, ${refuted.length} were refuted, live tester reported ${(live?.findings ?? []).length}`,
);
return {
  confirmed: confirmed.map((f) => ({
    lens: f.lens,
    title: f.title,
    file: f.file,
    line: f.line,
    severity: f.verdict.corrected_severity,
    scenario: f.scenario,
    evidence: f.evidence,
    verifier: f.verdict.reason,
  })),
  refuted: refuted.map((f) => ({ lens: f.lens, title: f.title, why: f.verdict.reason })),
  nits: reviewed
    .filter(Boolean)
    .flatMap((r) =>
      r.nits.map((f) => ({ lens: r.lens, title: f.title, file: f.file, line: f.line })),
    ),
  fine: reviewed.filter(Boolean).flatMap((r) => r.fine.map((line) => `${r.lens}: ${line}`)),
  live: live,
};
