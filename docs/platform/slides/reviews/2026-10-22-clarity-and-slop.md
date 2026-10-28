# Team 15 deck: clarity, requirement fit and AI slop (22 October 2026)

Reviewer roles: the course lecturer, who has not seen the project, and a design editor.
Inputs: `out/slides.json` (24 slides), the speaker notes in `build.js`, at least 8 frames
and the full-size last frame of each of the 21 GIFs, the course guideline, `report/report.md`
and `evidence/`.

Three facts from the evidence change how several slides read:

- The 20 October load test (1 to 4 workers in 49 s, 135 questions, median 6.1 s, 0 of 1,040
  failed) ran with the paced demo worker. The evidence says: "Workers in demo mode
  (LUMEN_DEMO_PACE_MS=1500), so no model was called." The real-model run of 21 October went
  from 1 to 2 workers only (median 4.1 s, p95 27.0 s).
- The "4.9 s, USD 0.01" answer also comes from demo mode. The evidence says that the
  answers there "are placeholders".
- The report lists six bounded contexts, outstanding issues AISS-01 to AISS-09, and the
  physical decisions AD-06, AD-09 and AD-11. The deck shows none of these on a picture.

## Per slide

### 1. Title: "Lumen Platform"
- Understanding: clear. Title, one-line subtitle, names and the URL.
- Requirement fit: not a guideline item. It is correct as a cover.
- Slop: none.

### 2. 1a, "Lumen is an AI that does research" (lumen-at-work.gif, 33 s)
- Understanding: a lecturer sees a dark product UI with a long prompt in small text. The
  point (one lead agent hands work to three readers in parallel) shows only in the call tree,
  and the last frame cuts that tree off after "reader 2". The last frame shows reader 1's
  sub-page, not the lead's answer. Frame 3 shows two scroll positions at once (ghosted,
  double text).
- Requirement fit: 1a asks for the context and the business problem. The slide shows the
  product, but it never states the problem (who needs research done, and what is hard).
- Slop: the notes say "recorded on 22 October with gpt-4.1"; every other slide says
  gpt-4.1-nano. The prompt asks for the "three most cited" papers, and the findings are
  2026 preprints (BRIDGE, OptGraph). A sharp lecturer will see that the answer misses the
  prompt.

### 3. 1b, "Producers, consumers, one platform" (platform.gif)
- Understanding: good. Producer on the left, consumers on the right, the platform in the
  middle. "the seed" is not defined on the picture, and it is the main box label.
- Requirement fit: answers 1b. It shows both sides and the core interaction.
- Slop: two titles fight. The slide says "Producers, consumers, one platform"; the GIF ends
  on "Producers publish, consumers ask, the seed runs it". Steps 1 to 5 move a white token
  ("agent", "question", "answer") along arrows. The same ask-and-answer flow comes back on
  slides 7, 9, 13 and 14.

### 4. 1c, "Six use cases, all running" (usecases.gif)
- Understanding: good UML use-case diagram, large text.
- Requirement fit: 1c asks for the scope. The slide shows what is in scope only. It does
  not say what the proposal had and the team did not build (model gateway, stream service,
  EKS, producer endpoints: AISS-08, AISS-01, AISS-03, AISS-09).
- Slop: a middle step titled "The answer returns: ended in 4.9 s, cost USD 0.01" is a
  demo-mode number on a scope diagram. The order UC2, UC6, UC3, UC4 looks random. The actors
  differ from slide 3: here "Consumer app", "Account owner" and "Operator"; there "Literature
  watch app", "Web app" and "People".

### 5. 2a and 2b, "We worked to the proposal's plan" (milestones.gif)
- Understanding: a clear Gantt chart, readable.
- Requirement fit: weak. 2a asks for the status "including outstanding issues"; the picture
  shows only check marks. 2b asks for the actual milestones and the actual effort. Every
  member shows "80 h", which is the proposal's estimate. The title admits that the slide
  shows the plan.
- Slop: five identical "80 h" values look invented. The date axis skips weekends (8, 9, 12,
  13 ...) with even spacing and no mark. The final title "Every part was built and
  deployed to AWS by 21 October" conflicts with the report, which lists open issues.

### 6. 3a, "Three decisions shape the services" (decisions.gif)
- Understanding: three columns, each with a picture and one line. A lecturer can read it,
  but "slices (main)", "steering", "turn", "trace" and "same image, a new entry point each"
  are not explained.
- Requirement fit: answers 3a. Each decision has a picture and a reason. The alternatives
  and trade-offs from the report (AD-01: fewer services than the proposal; AD-02: one more
  moving part) are not shown.
- Slop: the labels jump from AD-02 to AD-04. AD-03 appears five slides later. The audience
  will ask where AD-03 went.

### 7. 3b, "Five services behind one gateway" (logical.gif, 22 s)
- Understanding: the four tiers read well. Identity and billing have no arrow at all, so the
  picture does not say who calls them.
- Requirement fit: answers 3b as a component view.
- Slop: the GIF title "one queue between session and workers" contradicts its own RabbitMQ
  box, "one queue per level of the task tree", and slide 12. Steps 4 and 5 type a fake log
  ("the worker's agent, live / thinking: split into 3 sub-questions / reading: 3 papers on
  arXiv / writing: the answer, with sources"). This text is not a recording. It is
  decoration that looks like evidence.

### 8. 3c, "Five bounded contexts" (contextmap.gif)
- Understanding: the core domain is clear, and the events have names. "Session, the root /
  its Task tree / Step, a value" is DDD shorthand that a reader must decode. The strip "use
  cases -> nouns users say -> 5 bounded contexts -> their aggregates" is small and adds
  little.
- Requirement fit: partial for 3c. It shows contexts, aggregates and events. It does not
  show the relationship types of a context map (customer/supplier, conformist,
  anti-corruption layer, published language).
- Slop: three different counts in one project. This slide has five contexts ("Projects"
  includes the agent registry, and "Execution" replaces "Steering"). Slide 15 says "Four
  contexts". The report lists six (Identity, Registry, Project, Session, Steering, Billing).

### 9. 3c, "How apps use the platform" (interaction.gif)
- Understanding: a clear sequence of seven API calls. In the last frame all arrows are
  grey, so nothing stands out. The producer creates the key in call 1, but the consumer app
  uses a key whose origin the picture does not show.
- Requirement fit: answers the second part of 3c (how the platform interacts with producers
  and consumers).
- Slop: this is the third drawing of the same ask-and-answer flow. The GIF title "Publish,
  list, ask, read: all on the public API v1" restates the slide title.

### 10. 4a and 4b, "One AWS node, one k3s cluster" (deployment.gif)
- Understanding: a good UML deployment diagram. "1-3 HPA" and "1-4 KEDA" are cryptic
  without a legend.
- Requirement fit: covers the nodes, technologies and cloud services in 4b. The network is
  thin: no Elastic IP, no DNS (sslip.io), no certificate (Let's Encrypt), no VPC or subnet.
  The decision "k3s, not EKS" is only in the speaker notes. The single node is a single
  point of failure (AISS-03), and the picture does not say so.
- Slop: names drift. Here "Browser" and "Watch app"; elsewhere "Web app" and "Literature
  watch app". The picture puts "2Gi volume" on PostgreSQL. Slide 15 says that the 2Gi
  volume holds the agents' files.

### 11. 4b, "Every service is running" (rec-pods.gif)
- Understanding: two kubectl tables. The text is about 9 pt on the slide, and the lower half
  of the picture is empty. Nothing marks what to look at.
- Requirement fit: supports 4b as proof.
- Slop: half of the 10 s is typing animation. "0/5 (avg), 0/5 (avg) + 1 more..." is
  unexplained.

### 12. 4a, "One queue for each level of the task tree" (queues.gif, 29 s)
- Understanding: the deadlock story is good and clear while it plays. The last frame ends on
  "lumen.turns.2 stays empty: readers do not delegate". The solved half is empty, so the
  frame that stays on screen shows a deadlock above and nothing below.
- Requirement fit: wrong section. 4a asks for decisions that shape the physical
  architecture. AD-03 is a runtime and logical decision. The real physical decisions in the
  report (AD-06 one shared database, AD-09 k3s on one EC2, AD-11 HPA for CPU and KEDA for
  the queue) are not on any picture. The outline order is 4a, 4b, 4b, 4a, 4d, 4d, 4c.
- Slop: slide 19 repeats this content as finding 1. The terms change between the two
  slides: "lead/reader" and "level" here, "parent/child" and "depth" there.

### 13. 4d, "Asking a question with a chosen agent" (sequence.gif)
- Understanding: a good sequence diagram with the async 201 and the per-step loop. "key
  guard" and "POST /internal/directory/start" are not explained.
- Requirement fit: answers 4d. Billing and the budget cap are missing from the
  representative use case, although slide 3 calls the cap part of every run.
- Slop: the last title "On the public host: the answer in 4.9 s, for USD 0.01" puts a
  demo-mode number next to an "OpenAI API" lifeline that this run never called. The notes
  say "use case A"; slide 4 calls it UC2. The GET goes from Traefik to session, but slide 7
  shows the gateway with an arrow to project only.

### 14. 4d, "The same use case, for real" (rec-ask.gif)
- Understanding: curl and jq output. The text is small, and the answer is a list of primes.
- Requirement fit: meant as proof of 4d, but it is not the same use case. The response shows
  `"agent": null`, so no agent was chosen. Cost 0.000168 and 1.7 s do not match "4.9 s, USD
  0.01" on the slide before.
- Slop: the title "for real" is a slogan. It also implies that the slide before was not real.

### 15. 4c, "The schema, by context" (er.gif)
- Understanding: 11 tables and about 50 columns. The text is about 10 pt on the slide. A
  lecturer can find the owner frames, but not the point in 10 seconds.
- Requirement fit: answers 4c. One database, tables per context, a self-referencing task
  tree, numeric money.
- Slop: the picture contradicts the notes. The notes say "Across contexts, a service keeps
  only the other context's id". The picture draws solid foreign-key lines across contexts:
  projects to accounts, platform_agents to accounts, findings to sessions and tasks,
  ledger_entries to tasks. Only projects to sessions is dashed. The title "Four contexts"
  conflicts with slide 8. Step titles such as "One question: the intent row comes first"
  narrate inserts that the audience cannot follow at this text size.

### 16. 5a, "From a branch to a running image" (branches.gif)
- Understanding: the right half (image, scp, import, helm) is clear. The left half is a
  neat staircase: five members, two commits each, five nested PRs.
- Requirement fit: answers 5a for code and image. It says nothing about how artifacts are
  versioned or kept beyond "one image per commit".
- Slop: the symmetry looks generated. The remote has only `ass/platform`; the branches
  `ass/identity`, `ass/project`, `ass/worker` and `ass/deploy` do not exist there, and the
  merged PRs come from `codex/*` and `claude/*` branches. "main: Lumen" is not explained.

### 17. 5b, "Six checks around one deploy" (pipeline.gif)
- Understanding: the best diagram in the deck. The gate, the stop path and the per-job
  times are all visible.
- Requirement fit: answers 5b fully.
- Slop: "live in 12 min 30 s" is the span from the first job to the end of the summary job,
  not the time to live (the deploy finished earlier). "Run 39441445313" in a step title is
  noise. SCA, SAST and DAST are not expanded.

### 18. 5b, "The real pipeline runs" (rec-pipeline.gif)
- Understanding: `gh run list` and `gh run view`. Readable but small. Two red X runs are not
  explained.
- Requirement fit: supports 5b and 6b (maintainability).
- Slop: run 39441445313 shows "20m45s" here and "12 min 30 s" on slide 17. The audience
  sees two different times for one run. "The real pipeline runs" implies that slide 17 was
  not real.

### 19. 5c, "What we found, and what we changed" (findings.gif)
- Understanding: three columns, problem above, fix below. Clear.
- Requirement fit: answers 5c.
- Slop: finding 1 repeats slide 12. The run id "39439752963" and the commit "2b5e460" are
  noise on a picture. "Lumen image" and "platform image" are not defined. "KEDA's HPA" puts
  two acronyms together without a definition.

### 20. 6b, "KEDA adds workers as the queue grows" (scaling.gif)
- Understanding: bars, a dashed line and four worker boxes. The legend says "target: 5 jobs
  per worker", but the dashed line steps 5, 10, 15, 20: it is the target times the number of
  workers. The last frame shows one worker, so the peak of four is gone when the animation
  stops. The y axis has no unit.
- Requirement fit: answers 6b for scalability, and in part for performance (one box: 135
  questions, median 6.1 s, 0 of 1,040 failed). There is no latency distribution and no p95.
- Slop: the data matches the evidence. But the run used the demo worker with no model call,
  and neither the picture nor the notes say so. The notes call it "a real load test".

### 21. 6b, "KEDA adds workers, for real" (rec-scale.gif)
- Understanding: one kubectl watch. The replicas column goes 1, 2, 1. The text is small, and
  "4500m/5 (avg)" is cryptic.
- Requirement fit: proof for 6b.
- Slop: the title promises the slide before "for real", but the recording reaches two
  workers, not four. This is the real-model run, and slide 20 is the demo run. The lecturer
  sees a contradiction.

### 22. 6b, "A worker is deleted; the question still ends" (rec-kill.gif, 51 s)
- Understanding: the story is clear from the commands. Eight identical "ended" lines take a
  third of the picture.
- Requirement fit: answers 6b for availability.
- Slop: 51 s is the longest GIF in the deck, and most of it is polling. The evidence shows
  that the forced kill doubled the cost (USD 0.08 against USD 0.03) because redelivered
  turns run again. That is an honest finding, and the deck does not show it.

### 23. 6a and 6b, "Now, on the public server"
- Understanding: clear demo plan: five lines, large text.
- Requirement fit: answers 6a and 6b. Performance is not in the list, although the
  guideline names "scripted performance testing".
- Slop: none.

### 24. "Thank you"
- Understanding: clear.
- Requirement fit: not a guideline item.
- Slop: none.

## Patterns across the deck

- Two titles on every diagram slide. The slide title and the GIF's last-frame title say the
  same thing in different words (slides 3, 4, 6, 7, 8, 9, 10, 13, 15, 16, 17, 19, 20).
- One template for every picture: numbered step titles, a white token that moves along an
  arrow, a highlighted box. It fits the flows (slides 3, 13) and the pipeline. It does not
  fit the schema (slide 15) or the Gantt chart (slide 5).
- The ask-and-answer flow appears five times (slides 3, 7, 9, 13, 14).
- Undefined words on pictures: seed, slice, steering, turn, trace, key guard, directory,
  intent row, AMQP, HPA, KEDA, SCA, SAST, DAST, lumen.turns.N.
- One thing, several names: Web app / Browser / People; Literature watch app / Watch app /
  Consumer app; level / depth; lead and reader / parent and child; trace / steps / call
  tree; ended / at rest / finished; UC2 / use case A; gpt-4.1 / gpt-4.1-nano / LLM / OpenAI
  API.
- Numbers without a visible source: "4.9 s, USD 0.01", "1 to 4 in 49 s", "live in 12 min
  30 s", "80 h" five times.

## The 12 most important fixes, ranked

1. **Slides 20 and 21: one load test, labelled honestly.** On slide 20, add the label "paced
   demo worker, no model call, 20 Oct" to the chart. Remove "real" from the notes. Change
   the slide 21 title from "KEDA adds workers, for real" to "With the real model: 1 to 2
   workers". Better: show the real-model run on both slides (1 to 2 workers, median 4.1 s,
   p95 27.0 s, 0% failed).

2. **Slides 13 and 14: same use case, same numbers.** Remove "the answer in 4.9 s, for USD
   0.01" from the last title of sequence.gif. Use "The app gets 201 at once and reads the
   answer later". Record rec-ask.gif again with an agent slug in the POST body, so that the
   output shows the agent. If you cannot record it again, change the slide 14 title to
   "A question through the public API" and remove "for real".

3. **Slide 5: show the status and the actual effort.** Replace the title "We worked to the
   proposal's plan" with "Status on 21 October". Remove the check marks. Add one row of open
   issues under the chart: session has one replica (AISS-01); one shared database
   (AISS-02); one node (AISS-03); agents are instructions only (AISS-09). Give actual hours
   per member, or label the column "planned".

4. **Slide 12: put the physical decisions here.** Replace the AD-03 queue animation with the
   three physical decisions in the decisions.gif layout: AD-09 k3s on one EC2 (not EKS),
   AD-11 HPA on CPU and KEDA on queue length, AD-06 one shared PostgreSQL. Give each its
   trade-off in one line. Explain the deadlock once, on slide 19. Then move slide 12 before
   slide 10, so that the order is 4a, 4b, 4c, 4d.

5. **Slides 8 and 15 and the report: one context model.** Choose the count and the names
   once (the report has six). Rename "Projects" and "Execution" to match. Change the slide
   15 title from "Four contexts" to a title that names the owners, for example "Each
   service owns its tables; the worker has none". Make the cross-context lines in er.gif
   match the notes: dashed where only an id is kept. If those are real foreign keys, change
   the notes and say "one shared database (AD-06)".

6. **Slide 7: remove the fake log and fix the title.** Delete the typed text "the worker's
   agent, live / thinking ... / reading ... / writing ...". Delete the GIF title "Five
   services, one gateway, one queue between session and workers", which contradicts "one
   queue per level". Draw the calls to identity and billing, or say why there are none.

7. **Slide 4: scope, not a flow.** Remove the UC2 question-and-answer animation and the
   "ended in 4.9 s, cost USD 0.01" step. Add one grey line under the diagram: "Not built:
   model gateway, separate stream service, EKS, producer endpoints". Use the same actor
   names as slide 3.

8. **All diagram slides: one title.** Remove the final in-picture title from each GIF, or
   remove the slide title. Do not keep both. Start with slides 3, 4, 7, 8 and 15, where the
   two titles differ the most.

9. **Slide 3: stop the token animation.** Show the platform picture static and complete. The
   flow already plays on slides 9 and 13. Define "the seed" in the box label ("Run engine:
   session, worker, billing"), or remove the word.

10. **Terms across the deck.** Pick one name for each thing and use it on every slide: Web
    app, Literature watch app, level, lead and reader, steps, ended, UC2, gpt-4.1-nano.
    Remove from the pictures the words that the audience does not need: "slices (main)",
    "steering", "trace", "key guard", "/internal/directory/start", run ids and commit
    hashes.

11. **Recorded slides 2, 11, 14, 18, 21 and 22: crop and enlarge.** Crop each terminal to
    the rows that matter and remove the empty lower half, so that the text is at least
    14 pt. On slide 22, keep the first two "ended" lines and remove the rest. On slide 2,
    end on the lead's final answer with the whole call tree (lead and three readers). On
    slide 18, explain 20m45s against 12 min 30 s (queue time), or change slide 17 to "jobs
    ran for 12 min 30 s".

12. **Slide 16: draw the real branches.** Remove the symmetric five-member staircase. The
    branch names in it do not exist on the remote. Show what happened: short-lived feature
    branches, PRs into `ass/platform`, `main` merged in, one image per commit. A real count
    of merged PRs is better than invented symmetry.
