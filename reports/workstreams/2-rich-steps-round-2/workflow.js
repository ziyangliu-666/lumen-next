export const meta = {
  name: 'verify-rich-steps-round-2',
  description:
    'Second round on session/rich-steps: check that the fix commit closed the first round findings and introduced nothing new, refute each finding, and drive the rebuilt stack in a browser',
  phases: [
    {
      title: 'Review',
      detail: 'three reviewers on the fix commit: server, page, and mutation testing in a worktree',
    },
    { title: 'Refute', detail: 'one skeptic per blocker or should-fix' },
    { title: 'Live', detail: 'one agent drives the rebuilt application in a real browser' },
  ],
};

const CONTEXT = `
Repository: /Users/rufus/lumen-next (TypeScript monolith: Fastify server in apps/server, React in apps/web, shared types in packages/contracts). Branch: session/rich-steps, two commits on origin/main: 5020d2b (feature: a Step carries an optional StepDetail {tool,durationMs,cost,rows,output,childTaskIds}; the Session page draws it) and a0a2caa (FIXES after a first review round). This is ROUND 2. See the fix with: git -C /Users/rufus/lumen-next show a0a2caa ; the whole branch with: git -C /Users/rufus/lumen-next diff origin/main...session/rich-steps
What the fix commit claims: (1) a costed step and its charge are ONE transaction via Trace.appendCostedStep (pgTrace.ts, memoryTrace.ts); (2) Kernel.delegate() writes the delegate step itself and stops the children it opened if that write fails; appendStep refuses kind 'delegate' and detail.childTaskIds; (3) modules/session/stepDetail.ts: checkedDetail() validates shape (throws), storable() strips NUL and repairs lone surrogates, output cut at 20000 chars and rows at 50 with a line that says so; (4) LUMEN_DEMO_PACE_MS parsed strictly by paceFromEnv; (5) web: reducer keeps detail; stream scrolls inside a fixed-height card with the composer pinned; Stop button while running; focus moves to the stream on opening a task; findings refetched whenever the socket reopens; clock ticks at once; the empty row is marked by weight and sr-only words; long text wraps; output <pre> scrolls and is focusable; (6) parts.test.tsx renders every block with react-dom/server; vitest.config.ts now includes *.test.tsx and the '@' alias; (7) docs/ARCHITECTURE.md section 4 and diagrams updated.
Known and accepted, do NOT report: a worker has no abort signal, so a stopped task's in-flight step still lands and its cost is still recorded (true on main too; the steering slice owns the agent loop). Finding status (confirmed/open/dropped) is the projects slice's. The untracked file zy-kw.mjs is not part of the branch.
Rules that matter: everything committed is English; a slice is used only through its public index; contract changes are additive; the browser never adds money; pages use theme classes only (no inline style, no hex colour).
The working tree at /Users/rufus/lumen-next belongs to the person you report to: do NOT edit, commit, stash, or switch branches there. Report only defects you can show with a concrete scenario. Do not pad: an empty findings list is a good answer.
`;

const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'integer' },
          severity: { type: 'string', enum: ['blocker', 'should-fix', 'nit'] },
          scenario: { type: 'string' },
          evidence: { type: 'string' },
        },
        required: ['title', 'file', 'severity', 'scenario', 'evidence'],
      },
    },
    checked_and_fine: { type: 'array', items: { type: 'string' } },
  },
  required: ['findings', 'checked_and_fine'],
};
const VERDICT = {
  type: 'object',
  properties: {
    refuted: { type: 'boolean' },
    reason: { type: 'string' },
    corrected_severity: { type: 'string', enum: ['blocker', 'should-fix', 'nit', 'not-a-defect'] },
  },
  required: ['refuted', 'reason', 'corrected_severity'],
};

const LENSES = [
  {
    key: 'server',
    prompt: `Lens: SERVER. Read kernel.ts, trace.ts, pgTrace.ts, memoryTrace.ts, stepDetail.ts, demoWorker.ts, main.ts under apps/server/src (modules/session and root). Verify each server claim above is TRUE, then hunt what the fix broke: does appendCostedStep in PgTrace really roll back the step when the spend recorder throws, and does MemoryTrace behave the same (no step, no cost) so the two cannot drift; is the step index allocation safe when two steps of one task are appended concurrently inside transactions; are events published only after commit; can checkedDetail be bypassed (cost negative, NaN, huge; a row field that is an object; tool with only NUL characters; output exactly at the bound; a surrogate pair split exactly at the cut); does delegate()'s failure path leave any child running or queued, and does it rethrow to the worker; is anything in the public index (modules/session/index.ts) exported that should not be. You may run tests in a throwaway worktree: git -C /Users/rufus/lumen-next worktree add /tmp/wf2-server session/rich-steps --detach ; ln -s /Users/rufus/lumen-next/node_modules /tmp/wf2-server/node_modules ; cd /tmp/wf2-server && DATABASE_URL=postgres://lumen@localhost:54329/lumen npx vitest run apps/server/src/modules/session . PROVE a suspicion with a quick failing test before you report it. Remove the worktree when done: git -C /Users/rufus/lumen-next worktree remove --force /tmp/wf2-server`,
  },
  {
    key: 'web',
    prompt: `Lens: THE PAGE. Read apps/web/src/pages/session/Session.tsx, parts.tsx, tree.ts, parts.test.tsx, tree.test.ts, apps/web/src/core/api.ts, vitest.config.ts. Verify each web claim above is TRUE in the code, then hunt what the fix broke: effects in Session.tsx (stale closures, an effect that refetches in a loop, the findings merge dropping or duplicating a finding when 'finding.recorded' races the refetch, requestAnimationFrame after unmount); the auto-scroll rule (does it fight a reader who scrolled up; does it run for steps of a task that is not shown); the fixed height h-[calc(100vh-11rem)] on short or narrow screens; Stop shown for a session that is 'waiting'; Composer disabled states; every non-stock Tailwind class used exists in apps/web/src/styles/theme.css; the eslint-disable on the <pre> is justified; UI rules (no inline style, no hex, only components from apps/web/src/ui). Check docs/ARCHITECTURE.md section 4 and its diagrams, and apps/server/src/modules/session/README.md, against the code: anything still stale?`,
  },
  {
    key: 'tests',
    prompt: `Lens: ARE THE TESTS REAL. Work in a throwaway worktree: git -C /Users/rufus/lumen-next worktree add /tmp/wf2-tests session/rich-steps --detach ; ln -s /Users/rufus/lumen-next/node_modules /tmp/wf2-tests/node_modules ; run with cd /tmp/wf2-tests && DATABASE_URL=postgres://lumen@localhost:54329/lumen npx vitest run <path>. First run the whole suite once and report the count. Then MUTATION TEST by hand, one at a time, reverting each, and report for each whether a test FAILED (name it) or all passed (a finding): (a) kernel.appendStep: call writeStep then trace.addCost separately instead of appendCostedStep; (b) pgTrace.appendCostedStep: run the insert outside the transaction; (c) memoryTrace.appendCostedStep: append the step before charging; (d) kernel.appendStep: remove the delegate/childTaskIds guard; (e) kernel.delegate: remove the try/catch that stops the children; (f) stepDetail.storable: remove toWellFormed(); (g) stepDetail: raise MAX_ROWS handling so the 'more rows' line is not added; (h) demoWorker paceFromEnv: accept anything via Number(); (i) web api.ts reducer: drop detail; (j) tree.ts childrenByStep: ignore detail.childTaskIds; (k) tree.ts took(): remove the rounding-first step; (l) parts.tsx: render nothing for rows; (m) parts.tsx: remove the sr-only 'found nothing' words; (n) parts.tsx Composer: always show Send; (o) parts.tsx receiptOf: show cost even when zero. Also flag tests that depend on timing or assert nothing. Finish with git -C /Users/rufus/lumen-next worktree remove --force /tmp/wf2-tests`,
  },
];

phase('Review');
const reviewed = await pipeline(
  LENSES,
  (lens) =>
    agent(`${CONTEXT}\n${lens.prompt}`, {
      label: `review:${lens.key}`,
      phase: 'Review',
      schema: FINDINGS,
    }),
  async (result, lens) => {
    const serious = result.findings.filter((f) => f.severity !== 'nit');
    const judged = await parallel(
      serious.map(
        (f) => () =>
          agent(
            `${CONTEXT}\nA reviewer (lens: ${lens.key}) reported this defect. Try to REFUTE it: read the code, run it if you can (use your own worktree under /tmp/wf2-refute-<something>, never the main working tree, and remove it after). If you cannot show it is wrong, say it stands and correct the severity.\nTitle: ${f.title}\nFile: ${f.file}:${f.line ?? ''}\nScenario: ${f.scenario}\nEvidence: ${f.evidence}`,
            {
              label: `refute:${lens.key}:${(f.file || '').split('/').pop()}`,
              phase: 'Refute',
              schema: VERDICT,
            },
          ).then((verdict) => ({ ...f, lens: lens.key, verdict })),
      ),
    );
    return {
      lens: lens.key,
      judged: judged.filter(Boolean),
      nits: result.findings.filter((f) => f.severity === 'nit'),
      fine: result.checked_and_fine,
    };
  },
);

phase('Live');
const live = await agent(
  `${CONTEXT}
You are the LIVE TESTER. The application built from a0a2caa is ALREADY RUNNING in Docker at http://localhost:4000 with Postgres (real sign-in; the demo worker paces each step at about 900 ms, so a first turn takes about 5 s). Do not rebuild or stop it. Drive it in a real headless browser. Puppeteer is available without installing anything:
  import { createRequire } from 'node:module';
  const puppeteer = createRequire('/opt/homebrew/lib/node_modules/@mermaid-js/mermaid-cli/node_modules/')('puppeteer');
Write scripts under /tmp/wf2-live/. Sign up at /#/signin (click the control whose text matches /create|sign up/i, then #auth-name, #auth-email, #auth-password, #auth-confirmation, submit); fresh email each time, password 'correct horse battery 9'. Landing is /#/ (a textarea, then submit); it navigates to ?session=<id>#/session. Composer: input[name=say], button[aria-label=Send], button[aria-label=Stop] while running. Note CSS uppercases labels, so match innerText case-insensitively. Take screenshots to /tmp/wf2-live/*.png and LOOK at them with the Read tool. Test each and report what you observed:
 1. LIVE: poll the DOM every 200 ms during a first turn. Steps appear one by one; clock ticks; status running -> done; Stop while running, Send after.
 2. Tool blocks: name, time, cost (none on the free lead search, $0.0100 on a reader search), rows, the empty row marked, output block.
 3. DELEGATED lists exactly its own children (3, then 1 after a second turn) with live statuses.
 4. RELOAD MID-RUN about 2 s in: after it ends every step is present once, in order, with detail; compare with GET /api/sessions/<id> fetched from the page.
 5. FINDINGS after reload mid-run: the rail count equals the number recorded (3), no duplicates.
 6. STOP mid-run on a second turn: status stopped; composer returns to Send; can a third turn be said afterwards and does it behave sensibly?
 7. SCROLL: after 3 turns the stream is longer than the card. The page itself must not scroll at 1400x900; the card scrolls; the composer stays visible; new steps come into view when at the bottom and do NOT yank a reader who scrolled up.
 8. SECOND ACCOUNT in a fresh incognito context opens the first user's session URL: no content of the session may show.
 9. 390 px wide, prefers-color-scheme light: no horizontal overflow, readable, composer reachable.
10. KEYBOARD: Tab reaches tree rows, delegated children and the output block; Enter opens a task and focus lands on the stream.
11. Console errors and failed requests (ignore /favicon.ico).
12. Compare with the spec: render file:///Users/rufus/lumen-next/docs/spec/index.html at 1500 px and screenshot around id="p4". List remaining visible differences that could be drawn today, most important first.
Report findings in the schema (file = the page file you believe responsible, or 'runtime'); put what worked in checked_and_fine.`,
  { label: 'live:browser', phase: 'Live', schema: FINDINGS },
);

const all = reviewed.filter(Boolean);
const confirmed = all.flatMap((r) => r.judged.filter((f) => f.verdict && !f.verdict.refuted));
const refuted = all.flatMap((r) => r.judged.filter((f) => f.verdict && f.verdict.refuted));
log(
  `${confirmed.length} survived refutation, ${refuted.length} refuted, live tester reported ${(live?.findings ?? []).length}`,
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
  nits: all.flatMap((r) =>
    r.nits.map((f) => ({
      lens: r.lens,
      title: f.title,
      file: f.file,
      line: f.line,
      scenario: f.scenario,
    })),
  ),
  fine: all.flatMap((r) => r.fine.map((line) => `${r.lens}: ${line}`)),
  live,
};
