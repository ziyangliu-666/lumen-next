# Independent review of the ASS deck (2026-10-23)

Deck: `out/Team15-Lumen-Platform.pptx`, 25 slides, built by `build.js`.

Checklist: `~/Downloads/NUS-SE34-Coursework/presenting/slop-and-clarity-checklist.md`, items 1 to 22.

Team rules: rules 1 to 8 of the review brief.

## Method

- I read `build.js`, `script.md`, `speaker-guide.md` and the speaker notes inside the pptx.
- For each of the 22 GIFs, I looked at the frames at 25 %, 50 %, 75 % and 100 % of the play time. I also looked at each `out/preview/slide-NN.png`.
- I counted the words after each cue in `script.md`. I compared the words with the time to the next cue, at 2.3 words a second. I report an overrun when one cue is 1 s or more too long, or when a run of cues falls 2 s or more behind.
- I checked facts against the migrations, the Helm chart, the ingress routes, the worker code, the load-test evidence and the git history.
- Pixel sizes are at 1080p. A preview pixel is 1.31 screen pixels.

How to read a finding:

- "#n" is a checklist item. "Rn" is a team rule.
- "Element" quotes the exact text, or names the picture element.
- "Fix" gives the exact change.
- A problem that is on many slides is in "Deck-wide problems" and is counted once.

## The ten most important remaining problems

1. **Slide 17, R8.** The speaker says that three foreign keys cross between owners. The picture and the migrations show four: `findings.session_id` also points to `sessions`. The speaker guide repeats "three" in a likely answer.
2. **Slide 5, R8 and #19.** The speaker says "We fixed the contracts by 12 October. The services ran on Kubernetes by 16 October." The repository shows the service contract, the session and worker services and the Helm chart first committed on 20 October. The integration branch left main on 19 October. The live demo opens GitHub, so a lecturer can see these dates.
3. **Slide 8 (and slide 14), #16.** The component diagram has no line from Worker to PostgreSQL. The worker reads the chosen agent from `platform_agents` and writes `session_id` into `platform_question_intents` (`services/platform/registry.ts`, `claim`). The answer on slide 14 says "The worker reads that row". The picture and the answer disagree.
4. **Slide 10, R8.** The speaker says "An app uses only these seven calls." Only six of the seven numbered arrows are calls on the public API. Arrow 5 is the platform's own work.
5. **Deck-wide, R7.** The GIFs run 2 % to 5 % faster than the cue times in `script.md`. Late cues arrive up to 1.7 s early. The script says "They can be off by half a second". Slides 7, 12 and 17 are also too long for their cues (3 s, 3 s and 5 s behind). The two effects add up.
6. **Slide 22, R8.** The box says "1 to 4 workers in 49 s". On the chart, the dashed target steps from 1 to 4 workers in about 26 s (47 s to 73 s). The 49 s counts from the first job, at 24 s, but nothing on the chart says so.
7. **Slides 2, 15, 16, #12.** The text in three recordings is about 15 to 16 px. On slide 2, the call tree rows and the findings, which the speaker points at, are hard to read from the back of a room.
8. **Slide 18, R8.** "48 commits on the integration branch" is stale. `git rev-list --count 320aa39..HEAD` gives 57 today, and the number grows with each commit.
9. **Slides 2, 5, 6, #9 and R3.** Five terms appear before any plain-words explanation: "task" (slide 2), "contracts" (slide 5), "job", "worker" and "agent loop" (slide 6).
10. **Slides 15 and 16, #17.** Slide 15 wraps the command `jq` into "j" and "q" on two lines. Slide 16 shows a kubectl "Warning:" line. Both look broken in a still frame.

## Deck-wide problems

### D1. The GIFs play faster than the cue times (R7)

- Element: every drawn GIF. `draw.py` sets 30 frames a second, so each frame should be 33.3 ms. A GIF stores time in steps of 10 ms, so each frame is stored as 30 ms. Example: `logical.gif` has 486 frames of 30 ms. It plays in 53.4 s, but `out/steps/logical.txt` ends at 55.1 s.
- Measured play time against step time: logical 0.969, usecases 0.969, milestones 0.952, queues 0.976, interaction 0.976, branches 0.976, physdecisions 0.977, er 0.979, scaling 0.979, contextmap 0.980, decisions 0.981, sequence 0.981, findings 0.982, platform 0.984, deployment 0.986, pipeline 0.987.
- Why it is a problem: the last cues on slides 7, 8 and 11 arrive 1.5 to 1.7 s before the script says. A speaker who waits for the picture is late. A speaker who reads the times is early. The script promises ±0.5 s.
- Fix: in `draw.py`, write frame durations that average 33.3 ms. For example, repeat the pattern 30, 30, 40 ms. Then rebuild the GIFs. The cue times in `script.md` stay correct. The other fix is to scale each cue time in `script.md` by the factor above.

### D2. Handover words over a held frame (R7)

- Element: the last words on slides 9, 13, 16 and 23, for example "Next, Lu Yi. Lu Yi built identity, the gateway, the API keys and the public API. Lu Yi now shows how apps use the platform, and where it runs."
- Why it is a problem: R7 says that the words over a held last frame describe that frame. The handover describes the next speaker. It is 29 words, about 13 s, over a still picture.
- Fix: cut each handover to one sentence of about 10 words, for example "Next, Lu Yi, on the public API and where it runs." Say it after the last sentence about the picture.

## Slide by slide

### Slide 1: Lumen Platform (title)

A lecturer understands in 10 seconds: Team 15 presents Lumen Platform, an AI for research. It runs live at the address on the slide.

- **#13.** Element: the page number "1" at the top right. `build.js` `newSlide()` sets `s.slideNumber` on every slide, the title slide too. The preview PNG does not draw it, but PowerPoint does. Why: the number carries no information on a title slide. It also sits next to nothing, so it looks like a stray mark. Fix: in `build.js`, set `s.slideNumber` inside `head()`, not inside `newSlide()`. Then slides 1 and 25 have no number.

### Slide 2: What Lumen does: one question, a tree of agents

A lecturer understands in 10 seconds: a real research run. A lead agent hands papers to three readers. The call tree on the right shows each agent's cost and state.

- **#12.** Element: the call tree rows ("lumen $0.0260 Running", "reader 1 $0.0082 Finished") and the two finding cards. They are about 12 px in the preview, so about 16 px on screen. The arXiv result rows are smaller. Why: the speaker points at the call tree and the findings. A lecturer at the back cannot read them. Fix: crop the recording to the right pane only (Findings and Call tree), so it is about twice as large. Or add a zoomed crop of the call tree from 5 s to 30 s.
- **#17.** Element: the dark halftone blotches over the right pane, and the dotted pattern over "$0.0082 spent by rea…" in the header. Why: in a still frame they look like a rendering fault, not like the app's background. Fix: re-record with the background scene turned off, or crop the header row out.
- **R3, #9.** Element: "[5 s] On the right is the call tree." and "[14 s] … Each row is a task with its cost." Why: "call tree" and "task" are said with no plain-words meaning. "Task" is never explained in the deck. Fix: "[5 s] On the right is the call tree, one row per agent. The first row is the lead agent, which gets the question." (21 words, 9.1 s, fits 9 s.) "[14 s] The lead gave three reader agents one paper each. Each row is a task, one agent's work, with its cost." (20 words, 8.7 s, fits 11 s.)

### Slide 3: Producers and consumers

A lecturer understands in 10 seconds: producers publish agents into a registry. Apps and people ask questions. A run engine in the middle runs each question as a call tree, with costs and a budget cap.

None found. I checked the "about 210 lines" claim: `apps/watch/watch.mjs` has 210 lines of code without comments and blank lines.

### Slide 4: Use cases

A lecturer understands in 10 seconds: a UML use case diagram with four actors and six use cases.

None found.

### Slide 5: Plan, milestones and effort

A lecturer understands in 10 seconds: five members, 80 hours each, ten working days. Every bar has a check mark. Three milestones are reached.

- **R8, #19.** Element: script "[7.4 s] We fixed the contracts by 12 October. The services ran on Kubernetes by 16 October." and the diamonds "contracts fixed" and "services on Kubernetes". Why: the git history does not support these two dates. `docs/platform` first appears on 20 October ("the minimal service contract"). The worker service, the session service and the Helm chart are first committed on 20 October. The integration branch left main at `320aa39` on 19 October. The live demo opens the GitHub repository, so a lecturer can check. Fix: if the work before 20 October has a record (for example local commits that were squashed, or a meeting log), name it in the speaker guide as the answer to "Where can we see this?". If it has no record, say only the dates that the repository shows: "[7.4 s] We fixed the service interfaces first, then built the services and put them on Kubernetes. The pipeline passed, and the platform went live on AWS on 20 October." Keep the diamonds, and remove the dates 12 and 16 October from the words.
- **R3.** Element: "We fixed the contracts". Why: "contracts" is team language. A lecturer can read it as legal contracts. Fix: say "the interfaces between the services", as in the fix above.

### Slide 6: Logical architecture decisions

A lecturer understands in 10 seconds: three before-and-after decisions. Modules became services. A queue sits between session and the workers. Only session writes the steps.

- **R3, #9.** Element: "worker", "job" and "agent loop". The screen shows "agent loop module". The script says "session called a worker directly" and "puts each job on a durable queue". Why: none of the three is explained in plain words, here or before. Fix: "[8.9 s] Each module became a service. The worker runs the agent loop, each agent's model and tool calls." (17 words, 7.4 s, fits 7.8 s; the caption on screen already says "all services share one container image".) At "[19.7 s]", say "Now session puts each job, one piece of work for a worker, on a durable queue in RabbitMQ." Move "Durable means that the queue keeps its jobs when a program stops." to "[29.3 s]", and cut "A web request returns before the model answers." there, because the caption on screen says it.
- **R7.** Element: "[56.5 s] There is one queue for each level of the call tree. The next slide shows why." Why: the held frame shows one queue box. The words describe something that is not on the frame. Fix: "[56.5 s] The label says job queues, plural. The next slide shows why there are three."

### Slide 7: Decision: one queue per level of the call tree

A lecturer understands in 10 seconds: one shared queue deadlocks, because leads hold every worker while their readers wait. One queue per level breaks the cycle.

- **R7.** Element: the cues from "[22.7 s]" to "[46.8 s]". They hold 75 words, which need 32.6 s, in 29.3 s. "[34.8 s]" alone has 30 words in 12 s. With D1, the speaker is about 4 s behind the picture at "[46.8 s]". Fix: "[25.5 s] Readers wait for workers." "[27.8 s] Every worker holds a lead." "[30.4 s] The waits form a cycle, so no question can finish." "[34.8 s] The fix is one queue per level of the call tree. Level 0 holds leads, and level 1 readers. Each worker takes a job from each level." (26 words, 11.3 s.) "[57.4 s] Level 2 is for agents that readers start. Here it stays empty."

### Slide 8: Five services behind the API gateway

A lecturer understands in 10 seconds: a component diagram. Two clients, one gateway, five services, and PostgreSQL, RabbitMQ and the model below.

- **#16.** Element: the Worker box has dashed lines to Session, RabbitMQ and Model, but none to PostgreSQL. Why: the worker reads the chosen agent and writes the claim on `platform_question_intents` (`apps/server/src/services/platform/registry.ts`, `claim`, called from `services/worker.ts` line 101). The answer on slide 14, "The worker reads that row with the first job", says so. A lecturer who hears that answer sees a picture that disagrees. Fix: in the logical scene, add a dashed arrow from Worker down to PostgreSQL, labelled "reads the chosen agent". On slide 14, change the answer to "The worker reads that row from PostgreSQL with the first job, and marks it as taken, so two workers never take it." Add the same lifeline message to the sequence diagram if there is room.
- **#16.** Element: "[0 s] … It has four tiers, and each dependency points down." Why: two dependencies point sideways: Project to Session and Worker to Session. Fix: "It has four tiers. Each dependency points down, or sideways to session."

### Slide 9: Bounded contexts

A lecturer understands in 10 seconds: five bounded contexts found from the use cases. Session is in the middle, as the core domain. Labelled arrows are events between contexts.

- **R3, #9.** Element: "5 bounded contexts", "«core domain»" and "steps, as values". Why: the speaker defines aggregate and domain event, but not bounded context, core domain or value. A course lecturer knows the words. The rule asks for each one in plain words. Fix: "[10.3 s] … That gave five bounded contexts, parts of the model where each word keeps one meaning." "[47.4 s] … It owns the call tree, the part that makes Lumen different, so it is our core domain." On screen, change "steps, as values" to "steps, never changed once saved". Check the cue times after the change.
- The handover at "[57.8 s]" is D2.

### Slide 10: Public API: the calls in order

A lecturer understands in 10 seconds: a sequence diagram of the public API. A producer makes a key and publishes an agent. A consumer lists agents, asks and reads. The producer reads usage.

- **R8.** Element: "[38.2 s] An app uses only these seven calls." and the speaker guide "Seven calls: create a key, publish an agent, list, ask, run, read the answer, read usage." Why: arrow 5, "runs the agent on the question", is the platform calling itself. It is not a call on the public API. The screen shows six HTTP calls. Fix: on the picture, remove the number from "runs the agent on the question" and renumber 6 and 7 to 5 and 6. Say "[38.2 s] An app uses only these six calls." In the speaker guide, write "Six calls: create a key, publish an agent, list, ask, read the answer, read usage."

### Slide 11: Physical architecture decisions

A lecturer understands in 10 seconds: three before-and-after decisions. One EC2 machine with k3s in place of EKS. HPA on CPU and KEDA on waiting jobs. One PostgreSQL with tables by owner.

None found. I checked "about 1.3 US dollars a day" (t3.medium in Singapore, 0.0528 dollars an hour) and "CPU above 70%" (`values.yaml`, `cpuPercent: 70`).

### Slide 12: Deployment diagram

A lecturer understands in 10 seconds: a UML deployment diagram. One EC2 node holds k3s with Traefik, five services, PostgreSQL, RabbitMQ and KEDA. Outside are the browser, the watch app, GitHub Actions and OpenAI.

- **R7.** Element: the cues from "[0 s]" to "[45.8 s]". They hold 113 words, which need 49.1 s, in 45.8 s. Five of six cues overrun. With D1 the speaker is about 4 s behind at "[45.8 s]". Fix: "[0 s] This UML deployment diagram shows one AWS machine, an EC2 t3.medium in Singapore." "[7.8 s] k3s runs inside it. The dashed frame, namespace lumen, holds our pods." "[14.2 s] Under each service is its pod count. Identity, project and billing run one to three, with HPA. The worker runs one to four, with KEDA." "[26.8 s] PostgreSQL keeps its data on a 2 gigabyte disk. RabbitMQ holds the job queues." "[34.2 s] Outside are the clients, GitHub Actions and OpenAI."

### Slide 13: Pods on the server (recorded)

A lecturer understands in 10 seconds: a real terminal. Seven pods run. Four autoscalers exist, three on CPU and one for the worker.

- **R7.** Element: the 23 words before the first cue, "This is a recording of the real server. We run kubectl on the server over SSH, because the Kubernetes API is not public." Why: they need 10 s, but the pod list appears at 2.9 s and the whole recording ends at 10.5 s. The cue "[2.9 s] Here are our seven pods" comes 7 s late. Fix: say only "A recording on the real server." before the first cue. Delete the SSH sentence. The answer "Why can you not reach kubectl directly?" already covers it.
- **#16.** Element: "It shows one number for each queue level". The screen shows "0/5 (avg), 0/5 (avg) + 1 more...". Why: the lecturer sees two numbers and "+ 1 more", not three numbers. Fix: "It shows one number for each queue level: two here, and the third as '+ 1 more'."
- The handover is D2.

### Slide 14: Ask a question: sequence diagram

A lecturer understands in 10 seconds: one question from the watch app, step by step. The app gets 201 at once. In parallel, a worker runs the steps and session saves them.

- The missing worker read of PostgreSQL is part of the slide 8 finding, and is counted there.

### Slide 15: Ask a question through the public API (recorded)

A lecturer understands in 10 seconds: a curl call returns a question id. A second call shows "ended" and a cost. The answer says 25 primes.

- **#12.** Element: all terminal text. It is about 11 to 12 px in the preview, so about 15 px on screen. Why: under the 18 px limit. "status": "ended" and "cost", which the speaker points at, are in this size. Fix: re-record with a larger font and a narrower terminal (about 100 columns), so the GIF scales up, not down.
- **#17.** Element: the first command wraps after "| j" and the next line starts with "q". Why: the split word looks like an error. Fix: shorten the command in the tape. Drop `| tee /tmp/q.json` and read the id with `jq -r .sessionId` in a second step, or widen the terminal.
- **R7.** Element: "[15.7 s] We read it by its id: status "ended", and the cost." 11 words, 4.8 s, in 3.3 s. Fix: "[15.7 s] It has ended, with this cost." (6 words, 2.6 s.)

### Slide 16: Availability: deleting a worker (recorded)

A lecturer understands in 10 seconds: a question starts, the only worker pod is force-deleted, the status goes from running to ended, and a new worker pod runs.

- **#17.** Element: "Warning: Immediate deletion does not wait for confirmation that the running resource has been terminated. The resource may continue to run on the cluster indefinitely." Why: the checklist lists warnings as a sign of something broken. It also takes two lines. Fix: in the tape, add `2>/dev/null` to the `kubectl delete` command, and re-record. Keep "[13.4 s] … the pod is deleted."
- **#12.** Element: all terminal text, about 15 px on screen. Fix: as on slide 15.
- **#16.** Element: the status lines come every 2 s, but the loop reads every 4 s. The new pod shows "AGE 59s" about 33 s after the delete. Why: the recording runs the loop at double speed and does not say so. A careful lecturer sees that the times do not add up. Fix: "[19.4 s] We read the question every four seconds, shown at double speed. It is still running." (16 words, 7.0 s, fits 8.0 s.)
- **R7.** Element: "[27.4 s]" holds 47 words, 20.4 s, in 19.2 s. Fix: cut "How does this work?" (43 words, 18.7 s).
- The handover is D2.

### Slide 17: Database schema

A lecturer understands in 10 seconds: an ER diagram. Tables are grouped by the service that owns them. "tasks" with a parent link is the centre.

- **R8.** Element: "[50.5 s] Solid lines are foreign keys. Three of them cross between owners. Findings and ledger entries point to tasks, and agents point to accounts." Also the speaker guide: "Three foreign keys cross between owners" and "only three foreign keys cross between owners, so a later split replaces those three keys with ids". Why: there are four. `findings.session_id references sessions(id)` (`001_core_base.sql` line 70), and the picture draws it as a solid line from findings to sessions. Fix: "[50.5 s] Solid lines are foreign keys. Four cross between owners. Findings point to sessions and tasks. Ledger entries point to tasks, and agents to accounts. Money is numeric 12, 6." In the speaker guide, change "three" to "four" in both places, and name the four keys.
- **R7.** Element: the cues from "[10.6 s]" to "[45.2 s]". They hold 92 words, which need 40 s, in 34.6 s. Eight of nine cues overrun. With D1 the speaker is about 6 s behind. Fix: "[10.6 s] An account has API keys." "[12.7 s] It owns the agents it publishes." "[15.2 s] A dashed line is an id with no foreign key, as in projects." "[22.1 s] A question names an agent." "[24.2 s] Sessions keep their project's id." "[28.5 s] Each question is one row in sessions." "[33.2 s] Tasks is the centre. Its parent id forms the call tree, so the cost roll-up is plain SQL." "[40.9 s] Each task has its steps." "[43.4 s] Readers record findings."

### Slide 18: Branches and images

A lecturer understands in 10 seconds: platform work lives on one integration branch off main. Each push builds an image tagged with its commit, copies it over SSH, and Helm puts it live.

- **R8, #19.** Element: "48 commits on the integration branch" and "[19.4 s] In total the branch has 48 commits". Why: `git rev-list --count 320aa39..HEAD` gives 57 today. Each new commit makes the number more wrong. Fix: give the count a date, for example "48 commits by 22 October", and compute it from that date with `git rev-list --count --before=<date> 320aa39..HEAD`. Say the same words.
- **#9.** Element: the label "approval tests" on the feature branch. Why: nothing explains it. A lecturer can read it as "tests that approve the merge". Fix: change the label to "one change: tests for spend approvals", or remove it.

### Slide 19: CI/CD pipeline

A lecturer understands in 10 seconds: three checks in parallel, a deploy with a Trivy gate, then a live scan and a smoke load. All jobs pass in the last run.

- **#19.** Element: the white box "jobs: 12 min 30 s". Why: the lecturer cannot get 12 min 30 s from the times on screen. The longest path (5 min 05 s + 5 min 30 s + 1 min 40 s + 4 s) is 12 min 19 s. The sum of all jobs is 17 min 01 s. Fix: label it "first job to last: 12 min 30 s". Say "[50.2 s] Every job passed. From the first job to the last took 12 minutes 30 seconds."
- **R3.** Element: "Smoke load" and "[42 s] … a short smoke load with k6". Why: "smoke" is not explained. Fix: "[42 s] Then DAST, a live scan with OWASP ZAP, and a smoke load, a short k6 load test against the live address."

### Slide 20: Pipeline runs (recorded)

A lecturer understands in 10 seconds: six real runs from the GitHub command line, two failed. The detail of one run shows every job with a check mark.

- **R7.** Element: "[5.2 s] The two red runs are the ones the gate stopped. Above them is the fixed run." 16 words, 7.0 s, in 5.6 s. Fix: "[5.2 s] The gate stopped the two red runs. Above them is the fix." (12 words, 5.2 s.)
- **#16.** Element: `gh run view 39441445313 | head -12`. Why: the run is named only by its number. Nothing on screen links it to the "fix(platform): a platform image witho…" row. Fix: "[10.8 s] And here is the fixed run in detail." The speaker points at the 20m45s row first.

### Slide 21: Three problems we found and fixed

A lecturer understands in 10 seconds: three problems, each with its solution: a queue deadlock, a failed image scan and a slow KEDA scale-down.

- **#21.** Element: panels 1 and 2. Why: the deadlock (slide 7) and the image scan (slide 19) were each told in full before. The speaker guide already says "the first two were shown before". Fix: keep the panels, but say one sentence for both: "[0 s] The first two you saw on slides 7 and 19." Spend the time on the third.

### Slide 22: Load test: 1 to 4 workers, no failed request

A lecturer understands in 10 seconds: under load the queue grows, KEDA adds workers up to four, the queue drains, and no request fails.

- **R8, #16.** Element: "1 to 4 workers in 49 s" and "[21.6 s] … from one to four in 49 seconds." Why: on the chart, the dashed target goes from 5 to 20 between about 47 s and 73 s, which is about 26 s. The 49 s is from the first job (14:19:37) to the fourth worker (14:20:26) in `docs/platform/evidence/2026-10-20-load-and-scaling.md`. Fix: write "1 to 4 workers within 49 s of the first job" in the box. Say "from one to four within 49 seconds of the first job."
- **#16.** Element: the legend "jobs waiting (three queues)" against "KEDA target: 5 jobs × workers". Why: the bars add the three queues and count taken jobs too (`scenes_proof.py`, `_scaling`). KEDA checks each queue on its own (`values.yaml`, "KEDA scales on the longest of them"). The picture suggests that KEDA compares the sum. Fix: change the legend to "jobs in the three queues, taken or waiting". Add at "[21.6 s]": "KEDA checks each queue against this target."

### Slide 23: KEDA scaling (recorded)

A lecturer understands in 10 seconds: a live watch of the worker autoscaler. Jobs per worker rise to 10 over 5, replicas go to 2, and back to 1.

- **#11.** Element: "[0 s] Here is the same autoscaler, in a smaller run." Why: "a smaller run" of what? The lecturer was not told what load made this recording. Fix: "[0 s] Here is the same autoscaler on the public server, with a short burst of questions."
- **#17.** Element: from the third row on, the MINPODS, MAXPODS, REPLICAS and AGE columns shift right. Why: the table looks broken. Fix: record with fixed columns, for example `kubectl get hpa keda-hpa-worker -n lumen --watch -o custom-columns=TARGETS:.status.currentMetrics[0].external.current.averageValue,REPLICAS:.status.currentReplicas`. If you keep this recording, crop it to the NAME, TARGETS and REPLICAS columns.
- The handover is D2.

### Slide 24: Live demo

A lecturer understands in 10 seconds: the live address and the five things the demo will show.

- **R1.** Element: the speaker notes "Follow the run sheet in script.md, slide 24." Why: R1 covers the notes, and `script.md` is an internal file name. Fix: "Follow the run sheet in the speaking script, slide 24."

### Slide 25: Thank you

A lecturer understands in 10 seconds: the talk is over, questions now, and the address to try.

- The page number "25" is part of the slide 1 finding, and is counted there.

## Counts

Each finding is counted once, under its main item or rule. D1 and D2 count once each.

| Checklist item | Findings |
|---|---|
| 1 Triads | 0 |
| 2 Slogans | 0 |
| 3 Dramatic colons | 0 |
| 4 Puffery | 0 |
| 5 Synonym swaps | 0 |
| 6 Negative parallelism | 0 |
| 7 Summary sentences | 0 |
| 8 Long sentences | 0 |
| 9 Undefined terms | 1 (slide 18) |
| 10 Internal names | 0 |
| 11 Context jumps | 1 (slide 23) |
| 12 Too small to read | 3 (slides 2, 15, 16) |
| 13 Decoration | 1 (slide 1) |
| 14 Equal-weight stat tiles | 0 |
| 15 Too much at once | 0 |
| 16 Mismatch | 6 (slides 8 twice, 13, 16, 20, 22) |
| 17 Looks broken or staged | 4 (slides 2, 15, 16, 23) |
| 18 Looks like a secret | 0 |
| 19 Numbers | 1 (slide 19) |
| 20 Pace | 0 (counted under R7) |
| 21 Repetition | 1 (slide 21) |
| 22 Silence | 0 |
| **Checklist total** | **18** |

| Team rule | Findings |
|---|---|
| R1 No internal codes | 1 (slide 24 notes) |
| R2 One name per concept | 0 |
| R3 Terms explained | 5 (slides 2, 5, 6, 9, 19) |
| R4 No admitted weakness | 0 |
| R5 One title per slide | 0 |
| R6 Effort numbers | 0 (not reviewed, by rule) |
| R7 Narration fits the picture | 10 (D1, D2, slides 6, 7, 12, 13, 15, 16, 17, 20) |
| R8 Numbers agree with the screen | 5 (slides 5, 10, 17, 18, 22) |
| **Rules total** | **21** |

Total: 39 findings. Slides with none found: 3, 4, 11, 14 (its one problem is counted on slide 8), 25 (counted on slide 1).
