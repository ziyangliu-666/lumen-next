# ASS deck against the slop and clarity checklist (2026-10-23)

Checklist: `~/Downloads/NUS-SE34-Coursework/presenting/slop-and-clarity-checklist.md` (items 1 to 22).

Material read:

- `build.js` (slide titles, on-slide text, speaker notes) and `out/Team15-Lumen-Platform.pptx` (25 slides; the embedded GIFs are byte-identical to `out/*.gif`).
- Every GIF that `build.js` uses: the last frame and the frames at 25 %, 50 % and 75 % of the play time. `platform.gif` comes from `std_platform`, `pipeline.gif` from `cicd`.
- `script.md` (the spoken words, with the time cues).

Reader model: a lecturer who sees each slide for about one minute and was not in our meetings.

How to read each entry:

- "#n" is the checklist item.
- "Element" quotes the exact text or names the picture element.
- "TOP n" marks one of the ten most important fixes. The list of ten is in the next section.
- Problems that repeat on many slides are in "Deck-wide problems" and are counted once.

Pixel sizes are at 1080p. The diagram GIFs are 1747 px wide and fill 12.13 in, so one GIF pixel is one screen pixel. `lumen-at-work.gif` is 1310 px wide and is scaled up by 1.33. The `rec-*.gif` recordings are 1874 px wide and are scaled down by 0.93.

## The ten most important fixes

1. TOP 1 (#20, #16). The narration is two to four times longer than the picture. Re-time each GIF step to the words, or cut the words. See D1.
2. TOP 2 (#13, #15). Every picture slide has two titles: the slide title and a GIF caption that changes every 2 to 3 s. Keep one. See D2.
3. TOP 3 (#16, #19). Slide 17 says that no foreign key crosses a context. The picture and the migrations show three that do.
4. TOP 4 (#19, #16, #17). Slides 19 and 20 disagree: "12 min 30 s" against "20m45s" for the same run, and one failed run against two red "X" runs.
5. TOP 5 (#9). Slides 2 and 3 use lead agent, reader, call tree, task, step, agent and budget cap with no definition. Every later slide depends on them.
6. TOP 6 (#5). One thing has many names: question, session, run, task, job, turn. Pick one word for each thing and use only that word. See D5.
7. TOP 7 (#10, #11, #16). The AD-xx codes have no meaning for the lecturer, come out of order, and contradict each other: AD-02 (slide 6) draws the single queue that AD-03 (slide 13) calls a deadlock.
8. TOP 8 (#16). The producer is a person on slides 3, 4 and 9, but slide 24 says "the watch app publishes its agent". The web app user asks on slide 3, but has no line to UC2 on slide 4.
9. TOP 9 (#12, #16). Slide 2, the first picture, has text of 13 to 16 px and ends on reader 1's page with the call tree cut off.
10. TOP 10 (#14, #19). The effort numbers look staged: five equal "80 h" rows that equal the plan exactly, while slide 18 shows the only branch was made on 19 October.

## Deck-wide problems

### D1. The words do not fit the pictures (#20, #16). TOP 1

Element: the script cues in `script.md` against the GIF play times.

Why: a step in a GIF lasts 1.3 to 6 s. The words that the script puts on that step need 4 to 20 s at 2.5 words a second. The picture moves on while the speaker still describes the earlier step. Over a whole slide the gap is large:

| Slide | GIF play time | Words in "What to say" | Time the words need | Worst cue |
|---|---|---|---|---|
| 2 | 46 s | 169 | 68 s | [35 s] 51 words in 11 s |
| 3 | 23 s | 119 | 48 s | [5.8 s] 27 words in 4.3 s |
| 5 | 9 s | 78 | 31 s | [5.9 s] 37 words in 3.1 s |
| 7 | 25 s | 143 | 57 s | [20.1 s] 50 words in 4.8 s |
| 8 | 26 s | 146 | 58 s | [0 s] 41 words in 5.1 s |
| 9 | 25 s | 144 | 58 s | [22.2 s] 48 words in 2.6 s |
| 10 | 25 s | 141 | 56 s | [11.7 s] 33 words in 4.5 s |
| 11 | 22 s | 144 | 58 s | [3.7 s] 39 words in 2.5 s |
| 13 | 27 s | 175 | 70 s | [24.9 s] 29 words in 2.0 s |
| 14 | 18 s | 139 | 56 s | [12 s] 50 words in 6.4 s |
| 17 | 26 s | 168 | 67 s | [14.5 s] 31 words in 1.7 s |
| 19 | 21.5 s | 141 | 56 s | [6 s] 33 words in 3.2 s |
| 21 | 21 s | 126 | 50 s | [6 s] 23 words in 3.0 s |
| 22 | 22 s | 150 | 60 s | [5.6 s] 37 words in 4.4 s |

Also: `script.md` says each GIF "then loops". None of the GIFs has a loop block (no NETSCAPE2.0 extension). Check in PowerPoint whether they play once or loop. If they loop, the picture restarts in the middle of a sentence. If they play once, the speaker describes steps that are already gone.

Fix: for each scene, set the length of each step to (words on that step / 2.5) + 1 s, and make the GIF play once and hold. Or cut the words on each cue to fit the step. Do one or the other, not a mix. Write in `script.md` what the speaker says over the held last frame.

### D2. Two titles on every picture slide (#13, #15). TOP 2

Element: the slide title at 34 pt (about 68 px) and, directly under it, the GIF caption at about 46 px. Example, slide 7: "3 · Logical architecture", then "Logical architecture", then "Component diagram: five services behind the Traefik API gateway", which changes to "Clients depend on the API gateway", and so on.

Why: the lecturer reads two large lines that say different things. The GIF line changes every 2 to 3 s and competes with the speaker. On slides 7, 19, 21 and 24 the grey outline label and the slide title are the same words.

Fix: keep one title. Either cut the caption line from the top of each GIF and let the speaker say the step, or cut the slide title and keep the GIF line fixed on the slide's point. If step text must stay, put it small at the bottom of the picture.

### D3. Navigation marks carry little information (#13)

Element: the six thin bars at the foot of each slide (no labels), the slide number at the top right, and the grey outline label at the top left.

Why: three navigation marks on one slide. The bars have no words, so the lecturer cannot tell which bar is "Physical".

Fix: delete the bars, or put the six part names under them in 12 pt.

### D4. The outline labels confuse the item order (#10, #11, #16)

Element: the grey label at the top left.

Why:

- The labels on slides 12, 15, 16, 20 and 23 are not outline items: "4 · Recorded on the server", "4 · Recorded through the API", "4 · Availability, recorded", "5 · Recorded on GitHub", "6 · Recorded on the server".
- The order jumps: slides 10 to 17 read 4a, 4b, 4b, 4a, 4d, 4d, 4d, 4c. Slide 9 claims item 3 again with the name "Producers and consumers", which is the title of slide 3.
- `build.js` removes the letters from the labels, but the script says them aloud: "Now 4d", "I start with 4c", "First, 5a", "Now 6b".

Fix: move slide 13 to after slide 10 (both 4a) and slide 17 to before slide 14 (4c before 4d). Label recordings with the item they prove, for example "4 · Physical architecture, recorded". Either show the letters again or delete them from the script.

### D5. One thing, many names (#5). TOP 6

Element and why, one row for each thing:

- One user request: "question" (API, slide 9), "session" (`sessionId`, table `sessions`, the "Sessions" panel on slide 2, the service name), "run" (slide 2 notes, "the run, live" on slide 3).
- One agent's part of the work: "task" (slide 2 notes, table `tasks`), "job" (slides 6, 7, 13, 22), "turn" (queue names `lumen.turns.0`, route `/internal/turns/:id/step`).
- The worker service: "worker", "modules/steering" (slide 6), "the agent loop" (slide 7).
- The second app: "literature watch app", "Watch app", "Consumer app", "second app" (slide 5).
- The producer: "producer", "agent author", "owner_account_id", and on slide 24 "the watch app".
- Money: "cost", "spend", "ledger entry", "own_cost", "budget cap", "cap", "Wallet".
- The image scan: "Trivy gate", "image scan", "gate".

Fix: write a five-line glossary in `script.md` and use only these words on slides and in speech. Suggested set: "question" for the request; "call tree" for its tree of agents; "task" for one agent's node; "job" for one entry on a queue; "step" for one model or tool call. Say once on slide 14: "The API calls a question a session." Relabel `lumen.turns.0` as "level 0 queue".

### D6. Core words are never defined (#9). TOP 5

Element: slide 2 speech "This first row is the lead agent", "Here, on the right, is the call tree", notes "every task shows what it cost"; slide 3 picture "call tree", "steps and cost", "budget cap", speech "publishes agents".

Why: every later slide (6, 7, 8, 13, 14, 17, 21, 22) builds on these words.

Fix: on slide 2, say: "An agent is a model with instructions and tools. The lead agent gets the question and splits it. A reader is a helper agent that the lead starts for one paper. The call tree is the lead and its helpers; each row is a task." On slide 3, say: "A step is one model or tool call, and it has a cost. The budget cap is the most an account can spend before a person approves more." See the term table at the end.

### D7. Speaker notes are not the script, and they are long (#8)

Element: the pptx notes (from `build.js`) differ from "What to say" in `script.md`. 24 note sentences are over 20 words. The longest: slide 10, 35 words ("Two autoscalers watch two kinds of load: HPA adds ... and its CPU stays low."); slide 15, 31 words; slide 19, 31 words; slide 7, 30 words; slide 23, 30 words.

Why: a speaker who reads Presenter View says the longer version, which does not match the cues.

Fix: copy each slide's "What to say" into `s.addNotes()`. Then split every sentence over 20 words.

### D8. The same fact is told two or three times (#21)

Element:

- The deadlock: slide 13, slide 21 panel 1.
- The Trivy gate: slide 19, slide 20, slide 21 panel 2, demo step 5.
- Worker autoscaling: slides 10, 12, 22, 23, and demo step 3, which goes back to slides 22 and 23.
- Deleting a worker: slide 16 and demo step 4.
- Asking in the browser: slide 2 and demo step 1.

Fix: on slide 21, give findings 1 and 2 one line each with "(slide 13)" and "(slide 19)", and spend the time on finding 3. In demo step 3, do not go back to slides 22 and 23; run only the live `kubectl` lines.

### D9. Dramatic colons and semicolons in GIF captions and slide lines (#3)

Element: "Consumers: an app asks with an API key; people ask in the web app" (3), "The answer, findings and cost go back; people watch the run live" (3), "Session puts a job on the queue; a free worker takes it" (7), "AD-11: jobs wait, so KEDA adds workers; their CPU stays low" (10), "HPA on CPU; KEDA on queue length" (10), "the same Helm chart; about USD 1.3 a day" (10), "a queue per level; each worker runs one job per level" (13), "ER diagram: PostgreSQL 16; money is numeric(12,6)" (17), "The image passes the gate; the deploy steps run one after another" (19), "One worker falls behind; the queue grows" (22), "ask a question in the browser; watch the call tree grow" (24), "delete a worker during a question; it still ends" (24).

Why: slide 24's line is almost the checklist's own example of this item.

Fix: two sentences each, or "and". Example for slide 24: "Delete a worker during a question. The question ends anyway."

## Slide by slide

### Slide 1: Lumen Platform

In 10 s: Team 15 presents Lumen Platform, an AI for research, with a live address.

- #17. Element: `lumen.54-179-112-87.sslip.io`. Why: an IP address in the host name looks temporary. Fix: keep it (it is real), but put the grey word "live:" in front so the lecturer reads it as a working address.
- #16. Element: script "The number at the top left of each slide is the item of the outline that the slide answers." Why: five labels are not outline items (D4). Fix: fix D4, or drop the sentence.

### Slide 2: What Lumen does (lumen-at-work.gif)

In 10 s: a dark web app; text appears on the left and a list on the right. The tree idea does not reach the lecturer, because the text is too small to read.

- #12. TOP 9. Element: the arXiv list, the findings text and the call tree rows. Why: about 10 to 12 px in the 1310 px GIF, so 13 to 16 px on screen. Fix: record again at 1747 px width with browser zoom 150 %, or crop to the right half (call tree and findings) for the second half of the GIF.
- #16. TOP 9. Element: the last frame shows reader 1's own page ("reader 1 · Finished · $0.0082 spent by reader 1"); the call tree is cut after "reader 2". Why: the speaker says at [35 s] "the lead agent finishes" and "three readers", but reader 3 is off screen and the page is not the lead's. Fix: end the recording on the run page of the lead, with the full call tree (lumen, reader 1 to 3) and "Findings 3" in view.
- #9. TOP 5. Element: "lead agent", "call tree", "reader agents", notes "every task shows what it cost". Why: no definition (D6). Fix: the three sentences in D6.
- #7. Element: "So that is Lumen: a research AI." Why: a summary sentence, and the checklist's own example. Fix: delete it. Start with "For this course, we turned it into a platform."
- #16. Element: script at 11 s "each at $0.0015". Why: the frame at 11.5 s shows $0.0000 for each reader. Fix: say "each reader starts at zero cost".
- #5. Element: the "Sessions" panel and "the run page". Why: a third and fourth name for a question (D5). Fix: crop the panel or say nothing about it.

### Slide 3: Producers and consumers (platform.gif)

In 10 s: a platform in the middle, an author on the left who publishes, two kinds of users on the right who ask. This slide works.

- #9. TOP 5. Element: "publish an agent", boxes "call tree", "steps and cost", "budget cap". Why: agent, step and budget cap have no definition here; "agent" is defined only in the demo (slide 24 script). Fix: the slide 3 sentences in D6.
- #1. Element: the three boxes under "each question runs as". Why: only "call tree" completes the sentence; "budget cap" is not something a question runs as. The row reads as a filler triad. Fix: change the line to "the run engine keeps:" or keep only "call tree" in the box and say the other two.
- #4. Element: caption "Every step stays under the account's budget cap". Why: slide 4 has UC4 "Approve spend over cap", so a step can pass the cap. Fix: "A step that would pass the budget cap waits for a person's approval."
- #9. Element: "the session, worker and billing services". Why: services appear four slides before slide 7 explains them. Fix: "three of our services (slide 7)".
- #3. Element: two semicolon captions (D9).
- #19. Element: script "Our literature watch app is about 210 lines of code." Why: no source on screen. Fix: name the file and say "about 210 lines in apps/watch".

### Slide 4: Use cases (usecases.gif)

In 10 s: a UML use case diagram with six use cases and four actors.

- #16. TOP 8. Element: "People in the web app" connect only to UC3 and UC4. Why: slide 3 says people ask in the web app, and slide 2 shows them asking. UC2 has no line to them. Fix: add the line People to UC2.
- #9. Element: "Operator", "Approve spend over cap". Why: the operator is explained only in "If asked"; "cap" is the budget cap from slide 3. Fix: "Operator (our team)" under the figure; "Approve spend over the budget cap".
- #9. Element: "UC6 Watch the literature". Why: the lecturer cannot tell what the watch app does. Fix: "UC6 Get a digest for each watched topic".
- #16. Element: the frame at 17 s. Why: the caption says "The operator reads usage too (UC5)" while People, UC3 and UC4 are still lit. Fix: change the highlight at the same time as the caption.

### Slide 5: Plan and effort (milestones.gif)

In 10 s: a Gantt chart; five people; everything checked.

- #14, #19. TOP 10. Element: "80 h" five times, ten check marks; script "Each member spent about ten person-days, 80 hours, so 400 hours in total, as the proposal planned." Why: actual effort that equals the plan to the hour, for all five people, looks invented. No source is named. Fix: show planned and actual side by side from a time log, or say plainly "we planned 80 h each; we did not log hours".
- #19, #16. TOP 10. Element: bars from 8 October; slide 18 "branched off main on 19 October", "48 commits", "1 pull request". Why: a lecturer who sees both asks where the work of 8 to 18 October went. Fix: on slide 5 or 18, say where the earlier work lives (for example, commits on main before the branch) and give the number of commits for each member.
- #16. Element: outline label "Status, milestones and effort". Why: the chart has no milestones. Fix: add three milestone diamonds from the proposal with dates.
- #5. Element: "second app, usage"; caption "Contracts first" against the bar "architecture". Fix: "literature watch app, usage"; one word for contracts or architecture.
- #9. Element: "KEDA autoscaling". Why: KEDA is first explained on slide 10. Fix: "worker autoscaling".
- #10. Element: captions "1.", "2.", "3.". Why: they clash with the outline number "2" at the top left. Fix: drop the numbers.

### Slide 6: Logical architecture decisions (decisions.gif)

In 10 s: three before-and-after drawings with codes AD-01, AD-02, AD-04.

- #10, #16. TOP 7. Element: "AD-01", "AD-02", "AD-04". Why: the codes mean nothing outside the team. AD-03 is missing here and appears on slide 13. AD-02's "after" draws one shared RabbitMQ queue, which slide 13 calls a deadlock. Fix: put names in place of codes ("Split into services", "Queue between session and workers", "Only session writes steps"). Draw AD-02 with the three level queues, or add "refined by the per-level queues, slide 13".
- #2. Element: "Five services, one per module"; "one image, an entry point per service". Fix: "Each module became its own service. All services share one container image."
- #6. Element: "A durable queue, not a direct call". Fix: "Session puts jobs on a durable queue."
- #4. Element: "a slow model call never holds a request"; "a worker that dies loses no step". Why: absolute claims. Fix: "The web request returns before the model answers." "Steps already sent are safe when a worker dies."
- #5, #10. Element: "worker — modules/steering" and the file paths "modules/identity" and so on. Why: the worker comes from a module with another name; file paths are the only label. Fix: delete the paths, or write "worker (was the steering module)".
- #9. Element: "module", "image", "entry point", "job", "durable", "step". Fix: define "job" and "durable queue" in one spoken sentence each.

### Slide 7: Logical architecture (logical.gif)

In 10 s: a layered component diagram; clients, one gateway, five services, data. This slide works.

- #13, #15. TOP 2. Element: "3 · Logical architecture", "Logical architecture", and the GIF line. See D2.
- #9. Element: "one database, tables per context", "AMQP", "internal routes", "the agent loop". Why: "context" is defined on the next slide. AMQP is not needed. Fix: "tables per owner service"; delete "AMQP".
- #16. Element: no line between Session and Billing. Why: slide 8 shows "spend recorded" and "approval needed" from Session to Billing. Fix: draw the real dependency from Session to Billing.
- #11, #1. Element: script "The proposal listed eight services. Traefik is the gateway, the live stream runs inside session, and the model client runs inside the worker." Why: it assumes the lecturer remembers the proposal's list; "live stream" is not on any slide; three clauses. Fix: "The proposal had eight services. We merged three of them into the gateway, session and worker."
- #10. Element: "If asked" answer "two kernels never run at the same time". Fix: "two copies of session never run at the same time".
- #3. Element: caption "Session puts a job on the queue; a free worker takes it" (D9).

### Slide 8: Bounded contexts (contextmap.gif)

In 10 s: a context map with Session in the middle and event names on arrows.

- #9. Element: "aggregates", "«core domain»", "domain events", "Step, a value", "upstream", class names "QuestionIntent", "LedgerEntry", "Wallet", "ApiKey". Fix: one legend line: "aggregate = what one transaction keeps consistent". Replace "QuestionIntent" with "question (which agent)".
- #16. Element: notes "Each context talks to the others only through domain events" and script "every domain event goes through it". Why: slide 7 and slide 14 show HTTP calls to session's internal routes, and the arrow "account, API key" goes from Identity to Project without Session. Fix: "Contexts call each other only at these arrows. Session is in five of the seven."
- #16. Element: title "five bounded contexts and six domain events" with seven labelled arrows. Fix: draw "account, API key" as a dashed upstream arrow and say it is not an event.
- #20. Element: [0 s] 41 words in a 5.1 s window (D1).
- #7. Element: "That is our logical architecture." Fix: start the handover with the next speaker's name.

### Slide 9: Public API flow (interaction.gif)

In 10 s: a sequence diagram with seven numbered calls between an app, the platform and an author.

- #10, #11. Element: label "3 · Producers and consumers". Why: the same words as slide 3's title, and a second slide for item 3 (D4). Fix: "3 · Domain-driven design: the public API".
- #16. TOP 8. Element: lifeline "Producer: agent author". Why: in the demo (slide 24) the watch app publishes the agent. Fix: in the demo, say "As the agent author, I publish literature-scout. Then the watch app asks with it."
- #16. Element: caption "7. The producer and the operator read usage". Why: no operator on the diagram. Fix: "7. The producer reads usage".
- #16. Element: only the producer creates a key (call 1). Why: slide 3 says the app asks with its API key. Fix: add a note "the app's key comes from the web app (UC3)".
- #2, #4. Element: "Publish, list, ask and read all use one API. An app needs nothing else." Fix: "An app uses only these seven calls."
- #15, #19. Element: script after [22.2 s]: SHA-256, five scopes, 60 a minute, burst of 20, 429. Why: five facts in 2.6 s, none on screen. Fix: move them to "If asked".
- #16. Element: the frame at about 19 s. Why: caption "The producer phase" while the consumer box is lit. Fix: switch the highlight with the caption.

### Slide 10: Physical architecture decisions (physdecisions.gif)

In 10 s: three panels: a small cluster on one EC2 machine, pods that grow, one database cylinder. Too much for one minute.

- #10. TOP 7. Element: "AD-09, AD-11 and AD-06". Why: out of order, with gaps; the lecturer looks for AD-05, AD-07, AD-08, AD-10. Fix: names in place of codes.
- #9. Element: "EKS", "k3s", "Helm chart", "HPA", "KEDA", "pod", "EC2 t3.medium", "ledger entry". Why: this is the first slide that must explain them. Fix: one spoken line each: "EKS is AWS's managed Kubernetes. k3s is a small Kubernetes on one machine. A Helm chart is our install package. A pod is one running copy of a service. HPA adds pods when CPU is high. KEDA adds worker pods when jobs wait."
- #15. Element: about 35 boxes in three panels. Fix: two slides: "Where it runs" (AD-09) and "How it scales" (AD-11). Move AD-06 to slide 17, which is about persistence.
- #6. Element: "k3s on one EC2 t3.medium, not EKS". Fix: "k3s on one EC2 t3.medium. The same chart installs on EKS."
- #3, #2. Element: "HPA on CPU; KEDA on queue length", "the same Helm chart; about USD 1.3 a day", "One PostgreSQL, tables per context" (D9).
- #19. Element: "about USD 1.3 a day". Why: no source. Fix: add a grey source line: AWS on-demand price for t3.medium in ap-southeast-1, with the date.
- #16. Element: last frame of AD-11: 8 jobs and 4 worker pods under "KEDA: 5 jobs per worker". Why: 2 jobs per worker is below the rule, so the picture shows KEDA adding pods it does not need. Fix: show 20 waiting jobs at 4 pods.
- #10. Element: "tasks.own_cost", "ledger_entries". Fix: "step cost", "ledger".

### Slide 11: Deployment diagram (deployment.gif)

In 10 s: one AWS machine; Kubernetes inside; pods inside that; clients outside.

- #9. Element: "StatefulSet", "namespace lumen", "security group", "2Gi volume", "ingress", and Let's Encrypt (script). Fix: "StatefulSet + 2Gi volume" becomes "keeps its data on a 2 GB disk". Say once what a security group is (the AWS firewall).
- #16. Element: Traefik and KEDA drawn inside the frame "namespace lumen". Why: slide 12 lists the pods of namespace lumen, and neither is there; the script admits Traefik runs outside. Fix: draw Traefik and KEDA outside the namespace frame.
- #20. Element: [3.7 s] 39 words in a 2.5 s window (D1).

### Slide 12: Pods on the server (recorded) (rec-pods.gif)

In 10 s: a terminal; seven pods "Running"; an autoscaler table.

- #12. Element: the terminal text fills the top-left 78 % by 58 % of the frame, about 45 %. Why: the font is about 20 px; the lower 40 % is empty. Fix: record at about 100 columns so the text is larger and fills the frame.
- #9. Element: "keda-hpa-worker", "0/5 (avg), 0/5 (avg) + 1 more...". Why: explained only in slide 23's "If asked". Fix: say here "one number for each queue level; five is the target".
- #10. Element: label "4 · Recorded on the server" (D4).

### Slide 13: Decision: one queue per tree level (queues.gif)

In 10 s: one queue makes a waiting cycle; three queues break it. This story works.

- #10, #11. TOP 7. Element: "AD-03", label "4 · Key architectural decision" after two 4b slides, and the place of the slide in the physical part. Why: it is a logical decision that fixes AD-02 from slide 6. Fix: move it next to slide 6, or right after slide 10, and use a name, not a code.
- #10, #5. Element: "lumen.turns.0", "lumen.turns.1", "lumen.turns.2". Why: "turn" is an internal word for a job. Fix: "level 0 queue (leads)", "level 1 queue (readers)", "level 2 queue (their helpers)".
- #9. Element: "tree level". Why: nobody says that level 0 is the lead and level 1 the readers. Fix: the labels above.
- #16. Element: the frame at 20 s, caption "The readers run beside the leads". Why: the level-1 slots in both workers are empty; the readers are still in the queue. Fix: show readers in the level-1 slots at that step.
- #4. Element: "all questions finish", "every question finishes", "the work always drains". Fix: "both questions finish".
- #3. Element: "a queue per level; each worker runs one job per level" (D9).

### Slide 14: UC2 sequence diagram (sequence.gif)

In 10 s: a UML sequence diagram from an app through project and session to the queue, a worker and OpenAI.

- #10. Element: title "UC2 sequence diagram". Why: UC2 was on screen ten slides earlier. Fix: "Ask a question: sequence diagram".
- #10. Element: "POST /internal/directory/start", "publish lumen.turns.0", "POST /internal/turns/:id/step". Fix: "start the question", "put job on level 0 queue", "send step".
- #5. TOP 6. Element: "201 {sessionId}" for a question. Fix: say "The API calls a question a session" once here.
- #16. Element: GET /api/v1/questions/:id goes straight to session, with no key check drawn. Why: the POST shows "check the API key"; the lecturer asks if reads are open. Fix: draw who checks the key on the GET.

### Slide 15: UC2 through the public API (recorded) (rec-ask.gif)

In 10 s: curl posts a question, then the status "ended", then an answer about prime numbers.

- #16. Element: `"agent": null`. Why: slide 14 and the script say "ask a question with a chosen agent". Fix: record again with an agent slug in the request.
- #17. Element: "How many prime numbers are there below 100?", the answer "I will verify this by listing all primes" and the raw "**25**". Why: a school question with raw Markdown looks like a test stub for a research platform. Fix: ask a short research question, and print the answer with `jq -r .answer | head -5`.
- #22. Element: from about 7 s to 15.7 s. Why: the screen shows only "sleep 4" and the script has no words. Fix: cut the sleep from the GIF, or say "We wait four seconds while a worker runs it."
- #19. Element: "gpt-4.1-nano" here, "gpt-4.1" on slide 2. Why: the change has no reason. Fix: "The public server uses the smaller gpt-4.1-nano to keep the cost low."

### Slide 16: Availability: deleting a worker (recorded) (rec-kill.gif)

In 10 s: a pod is force-deleted; the status goes from "running" to "ended"; a new pod appears.

- #17. Element: "Warning: Immediate deletion does not wait for confirmation that the running resource has been terminated..." Why: a warning on screen looks like a failure. Fix: send stderr to /dev/null in the recording, or say "kubectl warns because we skip the grace period".
- #16. Element: "RabbitMQ gives it to another worker". Why: only one worker pod existed; the job went to the new pod that Kubernetes started. Fix: "Kubernetes starts a new worker, and RabbitMQ gives the open job to it."
- #22. Element: 13.4 s to 19.4 s. Why: nothing new on screen and one short sentence. Fix: shorten that wait in the GIF.

### Slide 17: Database schema (er.gif)

In 10 s: a dense ER diagram of 13 tables in five frames.

- #16, #19. TOP 3. Element: notes "dashed lines are ids that cross a context, with no foreign key, so a later split stays mechanical"; script "If asked": "no foreign key crosses a context". Why: false. The picture itself draws solid foreign keys across frames: findings to tasks and sessions (project to session), ledger_entries.task_id to tasks (billing to session), platform_agents.owner_account_id to accounts (project to identity). The migrations agree (`apps/server/src/core/db/migrations/001_core_base.sql` lines 69 to 80, `091_platform_registry.sql` line 7). Only projects.account_id is a dashed id (`005_projects_read_model.sql` drops that key). Fix: say "Most links that cross a context are plain ids. Three foreign keys still cross; a split must replace them." List the three.
- #15. Element: 13 tables and about 60 column names. Fix: show the tables in the story (accounts, projects, sessions, tasks, steps, findings, ledger_entries) with keys only; list the rest in one grey line.
- #10. Element: "own_cost", "pending", "attempt_id", "resume_pending", "platform_question_intents". Fix: cut these columns from the picture.
- #3. Element: "ER diagram: PostgreSQL 16; money is numeric(12,6)" (D9).
- #11. Element: label "4 · Persistence" after three "Detailed design" slides (D4).

### Slide 18: Branches and images (branches.gif)

In 10 s: one long branch off main, one short branch merged back, and a deploy chain to AWS.

- #19, #16. TOP 10. Element: "branched off main on 19 October", "48 commits on ass/platform", "1 pull request merged into it". Why: against the Gantt (8 to 21 October), this says most work happened in two days, and a team of five reviewed one pull request. The script also says "the pull request review is the gate". Fix: see slide 5; give the real place of the earlier work and say how other changes were reviewed.
- #10, #17. Element: "codex/platform-approval-acceptance". Why: a raw branch name; the "codex/" prefix tells the lecturer an AI tool made the branch, with no context. Fix: label it "feature branch: approval acceptance tests".
- #10. Element: "ass/platform", "lumen-next:<commit sha>", "deploy/k8s/Dockerfile", "k3s ctr images import". Fix: "integration branch (ass/platform)", "image tagged with the commit", "import into k3s".

### Slide 19: CI/CD pipeline (pipeline.gif)

In 10 s: a pipeline flowchart; checks in parallel, a gate, deploy, live scans; all green.

- #19. TOP 4. Element: "all jobs passed in 12 min 30 s". Why: slide 20 shows "20m45s" for the same run, 39441445313. The 2026-10-22 clarity review already found this. Fix: "The jobs ran for 12 min 30 s. With time in GitHub's queue, the run took 20 min 45 s."
- #16. TOP 4. Element: script "In the first run, the gate found 5 critical CVEs". Why: slide 20 shows two failed runs before the fix (39439752963 and 39440170020). Fix: "Two runs stopped at the gate."
- #9. Element: "Trivy", "CVE", "smoke load", "health check". Fix: "Trivy scans the image for known security flaws (CVEs)."
- #3. Element: "The image passes the gate; the deploy steps run one after another" (D9).

### Slide 20: Pipeline runs (recorded) (rec-pipeline.gif)

In 10 s: a list of six runs, two with a red X, then one run's jobs, all checked.

- #17. TOP 4. Element: two red "X" marks. Why: the narration does not explain them. Fix: "The two red runs are the ones the gate stopped."
- #19. TOP 4. Element: ELAPSED "20m45s" for 39441445313 (see slide 19).
- #10. Element: truncated titles "feat(platform): the worker runs a roo...", "workflow_dispatch", job IDs. Fix: list fewer columns (for example `gh run list --json conclusion,displayTitle,databaseId`), or crop.
- #8. Element: script "You can see every job and its result: CodeQL, verify, the dependency audit, deploy, the ZAP scan, the k6 smoke load and the summary." (24 words). Fix: "Every job has a check mark."

### Slide 21: Technical findings (findings.gif)

In 10 s: three panels, each a problem and its fix.

- #21. Element: panels 1 and 2. Why: they repeat slides 13 and 19 (D8). Fix: one line each with the slide number.
- #1. Element: a third three-column template (after slides 6 and 10). Fix: see #21; one main panel and two short lines.
- #10. Element: "(AD-03)", "deploy/k8s/Dockerfile", "docker.io package". Fix: "(slide 13)", "the platform image".
- #4. Element: "readers always run". Fix: "readers get their own slot".
- #16. Element: the frame at 16 s. Why: caption "3. The chart sets 60 s" while the bar still counts down "255 s". Fix: change the caption when the bar reaches 60 s.
- #9. Element: "the chart". Fix: "our Helm chart".

### Slide 22: Scalability: load test (scaling.gif)

In 10 s: waiting jobs rise, worker pods go from 1 to 4, then back; no request failed.

- #16. Element: legend "target: 5 waiting jobs per worker" against a dashed line at 10, 15 and 20. Why: the line reads as a target of 20 jobs. Fix: "KEDA target: 5 jobs × workers".
- #16. Element: bars of 22 to 29 stay above the line at 4 workers. Why: the lecturer sees KEDA not keeping up and is not told that 4 is the maximum. Fix: write "maximum 4 workers" next to the pod panel.
- #16. Element: the bars stop at 120 s with 16 jobs, then nothing. Why: the narration says the queue "drains", but the chart shows a cliff. Fix: draw the last samples down to 0, and mark "load ends".
- #16. Element: the frame at 190 s. Why: the target line is at 5 (one worker) but the panel says "worker pods (KEDA): 2". Fix: move the step of the line and the panel together.
- #14, #19. Element: "135 questions / median 6.1 s / 0 of 1,040 failed". Why: three equal numbers; "1,040" of what is not said. Fix: lead with the point: "0 of 1,040 HTTP requests failed (135 questions and their status reads)", and the median smaller.
- #19. Element: script "We went from one to four workers in 49 seconds." Why: not on screen. Fix: add "1 to 4 workers in 49 s" to the pod panel.
- #6. Element: notes "so it measures the platform's scaling and not the model". Fix: "so it measures the platform's scaling."
- #3. Element: "One worker falls behind; the queue grows" (D9).

### Slide 23: KEDA scaling (recorded) (rec-scale.gif)

In 10 s: a table that grows line by line; REPLICAS goes 1, 2, 1.

- #16. Element: REPLICAS reach 2, while slide 22 and the script call it "the same autoscaler" after a 1-to-4 test. Fix: "A smaller run: one to two workers."
- #9. Element: "10/5 (avg)", "4500m/5", "+ 1 more...". Why: explained only in "If asked". Fix: say "10 jobs per worker against a target of 5" when the line appears.
- #17. Element: the columns shift right from line 3; script note "The recording shortens the waits between the lines". Why: ragged columns and hidden time cuts look edited. Fix: add a small "time shortened" line, and record with a fixed column width.
- #22. Element: [11.4 s] to [25.4 s], one 9-word sentence. Fix: add "Each line is one check, about every 10 seconds" or cut lines.
- #7. Element: "That is persistence, DevOps and scalability." Fix: go straight to the handover.
- #12. Element: the table fills the top 55 % of the frame. Fix: as slide 12.

### Slide 24: Live demo

In 10 s: the live address and five things the demo will show.

- #3. Element: "delete a worker during a question; it still ends", "ask a question in the browser; watch the call tree grow" (D9).
- #16. TOP 8. Element: "the watch app publishes its agent and asks; then read usage". Why: the producer is the agent author everywhere else. Fix: "The agent author publishes an agent. The watch app asks with it. The author reads usage."
- #21. Element: "the recorded load test, then KEDA live", run sheet step 3 "go back to slide 22". Why: the third showing of the same test (D8). Fix: "KEDA, live".

### Slide 25: Thank you

In 10 s: the end; questions; the address.

- #4, #19. Element: "If asked": "Every number on the slides comes from the evidence files and the pipeline runs." Why: "12 min 30 s" does not match the pipeline run (slide 19). Fix: fix slide 19 first, then keep the sentence.

## Other important fixes (after the ten)

- Slide 15: record with a chosen agent and a research question (#16, #17).
- Slide 8: drop "only through domain events" (#16).
- Slide 11: draw Traefik and KEDA outside namespace lumen (#16).
- Slide 22: label the target line and show the drain (#16).
- D4: reorder slides 13 and 17 and fix the recording labels (#10, #11).
- D7: make the speaker notes the script (#8).
- Slide 24: rewrite the semicolon line that copies the checklist example (#3).

## Terms used before they are explained

"First used" is where the lecturer first sees or hears the term. "Now explained" is where the deck or script explains it today. "Explain on" is the slide where one plain sentence should go.

| Term | First used | Now explained | Explain on |
|---|---|---|---|
| agent | 3 (picture, speech) | 24 (demo script only) | 2 |
| lead agent, lead | 2 (speech [5 s]) | never | 2 |
| reader, reader agent | 2 (speech [11 s]) | partly, 2 | 2 |
| call tree | 2 (speech [5 s]) | never | 2 |
| task | 2 (notes) | never | 2 |
| finding | 2 (speech [23 s]) | partly, 2 | 2 |
| step | 3 (picture "steps and cost") | never | 3 |
| budget cap, cap | 3 (picture) | partly, 4 (UC4 speech) | 3 |
| session (the service) | 3 ("session, worker and billing services") | 7 ("Session: the call tree") | 3 |
| session (= a question) | 2 (UI "Sessions"), 14 (`sessionId`) | never | 14 |
| worker | 3 | 7 ("the agent loop") | 3 |
| literature watch app | 3 | 24 (demo script) | 3 |
| operator | 4 | 4 "If asked" only | 4 |
| KEDA | 5 (Gantt bar) | never expanded | 10 (and rename the slide 5 bar) |
| contracts | 5 (caption) | never | 5, or drop |
| module | 6 | never | 6 |
| container image, entry point | 6 | never | 6 |
| job | 6 | never | 6 |
| durable queue | 6 | never | 6 |
| AD-01, AD-02, AD-04 | 6 | never | 6 (replace with names) |
| steering (modules/steering) | 6 | never | 6, or drop |
| internal routes | 7 | never | 7 |
| AMQP | 7 | never | drop |
| context, bounded context | 7 ("tables per context") | 8 | 7, or say "per service" on 7 |
| aggregate, core domain, domain event, value, upstream | 8 | never (script uses them) | 8 |
| QuestionIntent, LedgerEntry, Wallet | 8 | never | 8, or replace |
| API key scopes, SHA-256, burst, 429 | 9 (speech) | never | 9 "If asked" |
| AD-09, AD-11, AD-06 | 10 | never | 10 (replace with names) |
| EKS, k3s, Helm chart | 10 | never | 10 |
| HPA | 10 | never expanded | 10 |
| pod | 10 | never | 10 |
| ledger entry | 10 | never | 10 |
| StatefulSet, namespace, security group, ingress | 11 | never | 11 |
| kubectl, "0/5 (avg)", "+ 1 more" | 12 | 23 "If asked" | 12 |
| AD-03 | 13 | never | 6 (with the other logical decisions) |
| tree level, level 0/1/2 | 13 | never | 13 |
| turn (lumen.turns.N) | 13 | never | 13 (replace with "level N queue") |
| UC2 (reused) | 14 | 4 | 14 (title "Ask a question") |
| par, loop fragments | 14 | never | 14 (one word each, if asked) |
| acknowledged job | 16 | 16 (script) | 16, as now |
| PK, FK, crow's foot | 17 | partly, 17 legend | 17 |
| ass/platform | 18 | 18 (script) | 18, as now |
| commit sha, scp, helm upgrade | 18 | never | 18 |
| Trivy, CVE | 19 | never | 19 |
| smoke load, health check | 19 | partly, 19 picture | 19 |
| 4500m (Kubernetes milli-units) | 23 | 23 "If asked" | 23 speech |

## Count per checklist item

A count is one entry in this file. A deck-wide entry (D1 to D9) counts once, even when it covers many slides.

| Item | Name | Count |
|---|---|---|
| 1 | Triads | 3 |
| 2 | "One X, one Y" slogans | 3 |
| 3 | Dramatic colons and semicolons | 9 |
| 4 | Puffery, absolute claims | 6 |
| 5 | Synonym swaps | 6 |
| 6 | Negative parallelism | 3 |
| 7 | Summary sentences | 3 |
| 8 | Long sentences | 2 |
| 9 | Undefined terms | 17 |
| 10 | Internal names | 18 |
| 11 | Context jumps | 5 |
| 12 | Too small to read | 3 |
| 13 | Decoration | 3 |
| 14 | Equal-weight stat tiles | 2 |
| 15 | Too much at once | 5 |
| 16 | Mismatch | 33 |
| 17 | Looks broken or staged | 6 |
| 18 | Looks like a secret | 0 |
| 19 | Numbers without source or not matching | 13 |
| 20 | Pace | 3 |
| 21 | Repetition | 3 |
| 22 | Silence | 3 |
| | Total | 149 |

## Change log (applied on 23 October, after this review)

The fixes above were applied, with three rules from the team: the effort numbers (80 h per member, 400 h) stay; no content admits weakness; no internal code reaches the audience. An independent review followed (`2026-10-23-independent-review.md`), and its fixes were applied too. Nothing is committed.

Deck-wide:

- One title per slide. `draw.py` no longer draws the step words at the top of a GIF; the slide title in `build.js` is the only title. The empty band of each drawn GIF sits under the slide title.
- Narration fits the pictures. Each step hold was set from the words of its cue. `draw.py` now runs at 25 frames a second (40 ms frames), because a GIF stores whole centiseconds: at 30 fps the GIFs played 10 % fast. `make.py` writes each step's start to `out/steps/<name>.txt`, and the cues in `script.md` come from there. No cue now holds more words than fit at 2.3 words a second, and no spoken sentence is over 20 words.
- Speaker notes are the script. `build.js` reads each slide's "What to say" from `script.md`.
- No internal codes on screen or in speech: no decision numbers, no use case numbers, no pull request number, no branch names, no file paths as labels, no class names, no queue names. Decisions carry names (Services, Job queue, Step writes; Hosting, Scaling, Database).
- One word for each concept, with a word list at the top of `script.md`: question, agent, lead agent, reader, call tree, task, job, step, budget cap. Each is explained where it first appears.
- Slide order: the queue decision is slide 13, at the start of Li Zhuoyang's part, because he built the worker and the queues. Slide 6 says that he shows it. Speakers: Liu 1 to 8, Lu 9 to 12, Li 13 to 16, He 17 to 23, Peng 24.
- Outline labels: recordings carry the outline item they prove. The page number is gone from the title and end slides.
- `preview.py` draws each GIF's held last frame.

Pictures:

- Slide 2: a new cut, `lumen-at-work-crop.gif` (`make.py atwork`): both panes enlarged 1.4 times, so the call tree text is about 18 px; it ends on the last frame that shows all three readers.
- Slide 3: "for each question:" over call tree, steps and cost, budget cap; "three services: session, worker, billing".
- Slide 4: no use case numbers; "Get topic digests", "Approve extra spend", "Operator (our team)"; a line from people in the web app to "Ask a question"; ovals reordered so no line crosses an oval.
- Slide 5: bars "watch app, usage" and "worker autoscaling". No milestone diamonds and no dated milestones in the words, because the git history does not support the report's dates. The plan chart and 80 h per member stay.
- Slide 6: module labels say what each module did; "RabbitMQ job queues"; captions without slogans or negative parallels.
- Slide 13 (queue decision): rows "level 0: leads", "level 1: readers", "level 2: their helpers"; "both questions finish".
- Slide 8: no AMQP; "tables grouped by owner"; a line from Worker to PostgreSQL (the worker reads the chosen agent).
- Slide 9: plain aggregate names; the Identity arrow is dashed, "who asks (upstream)".
- Slide 10: the step inside the platform has no number; six numbered API calls.
- Slide 11: no codes; "task cost", "ledger"; "KEDA: waiting jobs".
- Slide 12: a dashed "namespace lumen" frame that leaves out Traefik and KEDA; "data on a 2 GB disk", "the job queues".
- Slides 13, 20, 23: cut recordings (`make.py recpods recscale recpipeline`): larger text; slide 20 drops the workflow, branch, event, id and age columns and the job ids.
- Slide 14: plain message labels ("start the question", "job to level 0 queue", "send the step", "model call", "201 {question id}"); the note says each call carries its API key.
- Slide 17: four columns that carry no story removed; the legend says "a 2 GB disk". The words now match the migrations: four foreign keys cross between owners.
- Slide 18: no branch names or numbers; "integration branch", "tests for spend approvals", "pull request", "image, tagged with its commit".
- Slide 19: the story says the first two runs stopped at the gate; the result reads "first to last job: 12 min 30 s / run: 20 min 45 s", which matches the recording (the run waited 8 minutes for the run before it).
- Slide 21: no file names or codes; "(slide 13)".
- Slide 22: "KEDA target: 5 jobs × workers", "worker pods: n (max 4)", "queue empty" when the queue drains, a result box led by "0 requests failed".
- Slide 24: if the live demo fails, the speaker plays the narrated backup video `out/Team15-Demo-Backup.mp4` (about 6 minutes), shared in Zoom with computer sound. The notes, the script and the speaker guide say so; the video is referenced, not embedded.

Not changed, for a team decision:

- Slides 15 and 16: the recordings show `"agent": null`, a `jq` line wrap, raw Markdown in the answer and kubectl's "Warning" line, and their text is about 16 px. The words now match them; a new recording would remove them.
- Slide 24: the live demo commands show shell variable names (`$API`, `$AUTH`, `WATCH_FILE`). They hide the API key.
