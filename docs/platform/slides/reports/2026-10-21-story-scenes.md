# Report: the problem, tree, platform, contexts and keys animations (subagent, 2026-10-21)

Verbatim report from the subagent that wrote `scenes_story.py`.

---

I created `scenes_story.py` with all five scenes. `python3 make.py problem tree platform contexts keys` runs cleanly. I checked every step still and fixed what I found:
- the `problem` chat rows covered the title;
- the "readers" label hit the cost counter;
- the check mark hit "literature watch app";
- in `tree`, the "readers" and "steps" headers ran together;
- in `keys`, the "20" tag at the bar end floated away from anything.

I changed no other file and did not stage or commit anything.

**problem** (24.5 s)
1. Today: five parts of a question take five rounds
2. A long chat drops its first messages without warning
3. Nobody sees the cost until the bill
4. Lumen: a lead splits it, readers work at once, cost shown live

- Ten chat rows push up under a line labelled "the model reads only below this line". In step 2, two more rows ("a follow-up on part 1", "an answer without part 1") push the part 1 rows past the line, and they fade out.
- In step 3, a "bill: after the work" block drops in. In step 4, the cost counter ticks from $0.00 to $0.03.
- Not clear: in steps 1–3 the middle of the right side is empty. Only the counter and the bill are on the right until Lumen appears.

**tree** (18.1 s)
1. You ask a question
2. A lead agent plans the work
3. Three readers work in parallel
4. Every step is recorded with its cost: $0.02 of a $1.00 cap
5. Three findings and one answer come back: $0.03 total

- Not clear: this scene puts two different runs together, as the brief asked. The prime-number question and its answer come from the real-model run, which cost USD 0.000123. The $0.03 and the 3 findings come from the demo question. The $0.01 and $0.02 on the way to $0.03 are only for illustration.

**platform** (16.4 s)
1. A producer publishes an agent: instructions for one kind of question
2. A consumer app gets an API key and picks an agent
3. The platform runs it, records each step and bills it
4. The app only asks; the platform does the rest

- The engine shows "USD 0.01", the cost of the real literature watch run.
- Not clear: the picture has three arrows, not two. The web app uses a cookie, not an API key, so it has its own arrow without the key gate.

**contexts** (26.2 s)
1. The platform splits into five bounded contexts
2. A question is asked in Projects; Session takes it
3. Session queues a turn for Execution
4. Execution sends back each step it records
5. Session reports the spend to Billing
6. If a step would pass the cap, Billing asks for approval
7. The finding goes back to the project
8. One question: six events across five contexts

- After an event passes, its name stays in grey, so the last step shows the whole context map. The legend is three short lines, not one line, to fit beside Billing.
- Not clear:
  - The scene is slightly over the 25 s target.
  - Identity has no event arrow.
  - "worker turns" is not a real aggregate name.

**keys** (17.7 s)
1. A key carries scopes: what an app may do
2. Inside its scopes, the key works: 201, 200
3. On the web app's own pages, the gateway refuses it: 403
4. Past 20 at once or 60 a minute: 429

- In step 4, twenty requests stream into a 20-cell bar labelled "requests at once (max 20)", with a counter. Then "429 slow down" appears inverted. Nothing touches the edges.
- Not clear:
  - The evidence shows that 21 requests passed before the 429. The picture stops at 20, the configured limit.
  - The "403 refused" result is drawn beside the web app page box, but the job stops at the gateway.

`problem` and `tree` each draw four halftone spheres, as the brief asked. This breaks the README rule of "at most one halftone object per slide". You must decide whether to keep them or change the rule.
