# Review: the deck from the audience's seat (subagent, 2026-10-21)

Verbatim report from a subagent asked to judge the dark halftone deck as a
presentation coach, for an audience of ASS lecturers who have never seen the
project.

---

I judged each animation from the captured frames, as a lecturer would see it once. Some steps were not captured: tree 2–3, services 1, 2 and 5, and platform 3. Where those frames are missing, I judged from the speaker notes.

## 1. Where a viewer gets lost

**Common problems**
- **Two titles on every animated slide.** The slide heading and the animation title say nearly the same thing ("One queue per level of the tree" over "One queue for each level of the tree"). The eye reads both and loses a second each time.
- **Nothing moves along a line.** Every box is white and dotted, and every line has the same weight. The only "active" signal is slightly thicker dots, which a projector will not show. The FastMM frames (`fm_arch`, `fm_bypass`, `fm_replay`) work for three reasons:
  - They have one accent colour for the active path.
  - They have arrowheads.
  - They have a legend and different shapes for different kinds of thing (thread, queue, disk).
- **The loop ends on the summary frame.** Frame 00 equals the last frame, so the audience often sees the end state under the intro title.
- **Labels are too small.** Labels like "lead slot", "to the server" and "what this app may do" are about 12 px after the GIF is scaled into the slide.

**Per animation**
- **problem:** Step 1 starts at "part 2", so part 1 has already scrolled off before anyone reads it. In step 4 the cost box still says "?" next to the Lumen tree, so the solution does not answer problem 3. The label "lead agent" sits on top of the branch lines.
- **tree:** This is the clearest animation. Two problems remain:
  - "your question" is a placeholder under the title "A real question", so the viewer expects the real text.
  - "steps" and "findings" are identical blocks with no content, so the viewer cannot tell them apart.
- **platform:** No arrows connect producers, the platform and consumers, so "three roles" are three columns that never interact. In step 1, three agents appear under "A producer publishes an agent" (one producer, three agents). "scout/review/math" are not introduced. The API key sits in the consumer column as if it were a consumer. Step 4 says "the second app" but the box says "literature watch app".
- **services:** The title says "Five services", but the viewer counts six boxes plus a gateway. The worker never visibly does anything in step 4: the queue empties and nothing lights up. Two things are missing:
  - The database has no line to anything.
  - No return path goes from the worker to session, although the notes say every step goes back through session.
- **depth:** This is the most important animation and the weakest one.
  - In step 2 the two worker boxes go empty, so the viewer never sees leads holding the workers. The deadlock is the whole point.
  - The vocabulary switches from "worker" to "slot" with no bridge.
  - Lead jobs and reader jobs look identical in the queue.
  - The working fix is never visible: step 3 shows 0 done and step 4 shows empty boxes with 3 done.
  - The real system has three queues (`lumen.turns.0/1/2`), but the picture shows two.
- **hosting:** The gateway disappears and an "HTTPS" box takes its place. "Off at night" is a new claim that invites a question about availability. GitHub has no line to the server. There are two workers here, but one in services and one to four in scale.
- **keys:** Clear. Three things to fix:
  - The "429 slow down" box is clipped at the bottom edge.
  - The viewer cannot see which requests were refused.
  - The gateway, where the check happens, is not shown. An architecture audience wants to know where enforcement happens.
- **scale:** The step 4 title "Four workers keep up" contradicts the picture: the bars stay high until the load ends. The bars have no y-axis value. Two further problems:
  - "1 of 4" reads as a score, not as a maximum.
  - Queue and workers sit in two separate panels with no shared time axis, so the cause and effect (queue > 5 per worker, so a worker is added) is invisible.
- **kill:** Clear. The key idea ("a job leaves the queue only when its worker says it is done") is not drawn: the queue looks empty while worker A holds the jobs. "12.6 s" has no reference, such as the 6.1 s median. The 3 to 8 cent cost is only in the notes.
- **pipeline:** The title says "Seven checks", but deploy is not a check, and the viewer counts eight boxes. The viewer cannot see pass or fail, because only the border gets bolder. Tool names are missing. The step "updated when it is built" and its subtitle "removed Docker" are two different fixes in one step.

## 2. Story order against the course outline

**Missing**
- **DDD:** no bounded contexts, no aggregates, no context map. The outline asks for this by name.
- **Logical versus physical:** there is no split. "Architecture" mixes them, and logical gets one decision slide where the outline gives it 7 minutes.
- **Persistence design:**
  - what PostgreSQL stores (steps, cost ledger, keys as hashes)
  - per-service tables in one database
  - RabbitMQ durability
- **Network:** VPC, security group, ingress controller, which ports are public, how internal calls are protected.
- **One detailed use case:** a sequence diagram for "ask a question" from gateway to worker and back.
- **Source code and artifact strategy:** branches, monorepo, image registry, tags.
- **Milestones and hours:** the hours are still `[TEAM TO FILL]`.
- **Pipeline in the demo:** the outline asks to show or run the pipeline. The demo list does not include it.

**Wrong place**
- "Three limits" belongs in Project conduct under "outstanding issues", not at the end.
- The platform animation (producers and consumers) belongs in Logical architecture. Keep one sentence of it in Overview.
- The keys animation belongs with producers and consumers (logical), or with network (physical). It does not belong as a stand-alone "Security" slide.
- Scale and kill come before DevOps, but the outline places scalability in the demo. Put them after the pipeline, as "what the demo will show", or as backup if the live run fails.

**Can cut**
- The four section-divider slides. The kicker line already names the part.
- The duplicate slide headings.
- Shorten the problem animation to steps 1 and 4.

**Suggested order**
1. Title
2. Problem and tree
3. Conduct with limits and hours
4. Logical: contexts, platform, services, depth, keys
5. Physical: hosting with network, persistence, use-case sequence
6. DevOps: repo and artifacts, pipeline
7. Scale and kill as a demo lead-in
8. Demo

## 3. Step titles

**problem**
1. "Today: five parts of a question take five rounds"
2. "A long chat drops its first messages without warning"
3. "Nobody sees the cost until the bill"
4. "Lumen: a lead splits it, readers work at once, cost shown live"

**tree**
1. Use the real question as the box text.
2. "A lead agent plans the work"
3. "Three readers work in parallel"
4. "Every step is recorded with its cost: $0.02 of a $1.00 cap"
5. "Three findings and one answer come back: $0.03 total"

**platform**
1. "A producer publishes an agent: instructions for one kind of question"
2. "A consumer app gets an API key and picks an agent"
3. "The platform runs it, records each step and bills it"
4. "So the literature watch app is 210 lines: no database, no model, no billing"

**services**
1. "The gateway sends a question to the project service"
2. "Project opens a session"
3. "Session puts the work in a RabbitMQ queue"
4. "A worker takes it and runs the agent"
5. "Each step goes back through session to the screen"
6. "More waiting work means more workers"

**depth**
1. "One shared queue: two leads take both workers"
2. "Their readers wait in the queue: no worker is free, so nothing moves"
3. "Our fix: a separate queue and separate slots for each level"
4. "The lead waits in its slot; readers run in theirs"
5. "The deepest level waits for nothing, so all 3 questions finish"

**hosting**
1. "One t3.medium in AWS Singapore, about $1.30 a day"
2. "k3s runs every service and restarts what fails"
3. "Traffic enters through HTTPS and the gateway"
4. "PostgreSQL and RabbitMQ keep the data on the node's disk"
5. "A push to GitHub deploys after the checks pass"

**keys**
1. "Inside its scopes, the key works: 201, 200"
2. "On the web app's own pages, the gateway refuses it: 403"
3. "Past 60 a minute or 20 at once: 429"

**scale**
1. "Ten users ask questions without pause"
2. "One worker falls behind; the queue grows"
3. "Above 5 waiting jobs per worker, KEDA adds one: 1 to 4 in 50 s"
4. "Four workers hold the queue steady"
5. "The load stops; the queue drains; back to 1"
6. Summary: "135 questions, median 6.1 s, 0 of 1,040 requests failed"

**kill**
1. "Worker A holds three jobs; they stay in the queue until A says done"
2. "We force-delete worker A"
3. "Nobody said done, so the three jobs return to the queue"
4. "Kubernetes starts worker B; B takes them"
5. "The question ends in 12.6 s (median 6.1 s); the cost is 8¢, not 3¢"

**pipeline**
1. "Every push runs six checks around one deploy"
2. "Run 1: Trivy finds 5 critical issues; the deploy stops"
3. "Fix: drop Docker from the worker image"
4. "Run 2: all checks pass; live in 12.5 min"

## 4. Words

**Remove**
- the duplicate slide headings
- "One decision" (say which decision)
- "slot" without a definition
- "runs it: steps, cost, cap"
- "of 4" (use "max 4")
- "off at night"
- "the second app"
- "libraries", "small load", "attack test" as bare labels
- "scout / review / math" unless the slide explains them

**Must be on a slide**
- Infrastructure names: RabbitMQ, PostgreSQL, KEDA with its threshold "5 jobs per worker", k3s, gateway (on the hosting slide).
- Tool names next to the checks: npm audit, CodeQL, Trivy, OWASP ZAP, k6.
- The kill numbers: "acknowledged", "3¢ → 8¢" and the 6.1 s reference.
- Bounded-context names.
- Hours per member.
- A y-axis value on the queue chart.

## 5. The five changes that would help most, ranked

1. **Add the missing outline sections.** Lecturers mark against the outline:
   - DDD contexts with producers and consumers (logical)
   - network and persistence (physical)
   - one "ask a question" sequence diagram
   - the source and artifact strategy
2. **Rebuild the depth animation so the deadlock is visible.** Leads stay inside the workers while readers pile up. Readers get a different shape. The fixed run is shown working, and the frame for "slot = a place inside a worker" is shown before the fix.
3. **Use one accent colour, arrowheads and a legend, as FastMM does.** The active path and the travelling job must stand out from the static boxes.
4. **Put queue and workers on one time axis in the scale chart.** Add a y-axis value and the "5 per worker" rule, and fix the step 4 title.
5. **Remove the double heading and end every loop on the last step, not the summary.** Also keep one set of names on every slide:
   - gateway and worker count on every architecture slide
   - "literature watch app", never "the second app"
   - "seven checks" or the real count of boxes
