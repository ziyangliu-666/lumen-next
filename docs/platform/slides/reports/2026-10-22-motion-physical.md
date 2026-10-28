# Motion grammar: the physical and DevOps pictures (22 October 2026)

Module: `docs/platform/slides/scenes_motion_physical.py`, added at the end of `MODULES` in `make.py`.
Each scene keeps its old GIF name and scene key, so the deck picks it up. No tag travels along a
line in these pictures; none of them shows a message at run time. Each GIF plays once and ends
on its complete diagram, held, with nothing lit and no step title.

## physdecisions (physdecisions.gif, 27.8 s): refactoring morph, divide and merge, spotlight
1. AD-09, before: the Helm chart's arrow grows to an EKS cluster (managed control plane, three EC2 nodes); the cluster pulses.
2. AD-09, after: the control plane fades, the three nodes merge into one, and the cluster shrinks into one EC2 t3.medium (2 vCPU, 4 GB) with k3s in it; the nine pods grow in.
3. AD-09: the chart's arrow grows to the EC2 node again, and a dashed arrow grows to a small EKS box ("same chart"). Caption: k3s on one EC2 t3.medium, not EKS; USD 1.3 a day.
4. AD-11: the CPU bar rises past 70%; the identity, project and billing pods divide to 3 each.
5. AD-11: the turn queue fills; the worker pod divides to 4 while its CPU bar stays low. Caption: HPA on CPU; KEDA on queue length.
6. AD-06, before: four databases, one per service. After: they move together, lose their cylinder tops and become context frames inside one PostgreSQL.
7. AD-06: one transaction lights steps, tasks.own_cost and ledger_entries together; identity and project dim to 28%.

Speaker notes: Three decisions shape the physical side. The proposal put the chart on EKS; we run the same chart on k3s on one EC2 t3.medium, for about USD 1.3 a day, and the chart can still go to EKS. Two autoscalers watch two kinds of load: HPA adds identity, project and billing pods on CPU, and KEDA adds workers on queue length, because a worker waits on the model and its CPU stays low. One PostgreSQL with a frame per context lets one transaction write the step, its cost and the ledger entry together.

## deployment (deployment.gif, 23.9 s): containment growth, then spotlight
1. The AWS node (EC2 t3.medium, ap-southeast-1) grows in, with its security group (22, 80, 443).
2. The k3s cluster grows in from the AWS node's outline (namespace lumen).
3. Traefik and the five service pods grow in from the cluster's outline, one after another, with their replica ranges; the bus line grows.
4. PostgreSQL and RabbitMQ (StatefulSets) and KEDA grow in.
5. The outside nodes appear (Browser, Watch app, GitHub Actions, OpenAI API); each connector grows from its source and its target pulses.
6. Spotlight: HTTPS 443 to Traefik and the five service pods; the rest dims.
7. Spotlight: GitHub Actions over SSH 22 into k3s.
8. Spotlight: the worker pod over HTTPS to the OpenAI API. End on the full diagram.

Speaker notes: The whole platform runs on one AWS node, an EC2 t3.medium in Singapore. k3s runs inside it, and every service, PostgreSQL, RabbitMQ and KEDA run as pods inside k3s. Users reach it only over HTTPS on 443, through Traefik, which routes to the service pods. GitHub Actions deploys over SSH on 22, and only the worker pod talks to the OpenAI API.

## scaling (scaling.gif, 24.6 s): divide and merge in step with the chart
1. The real chart of the 20 October load test (paced worker, no model calls): bars of waiting jobs, the dashed target line (5 waiting jobs per worker). The cursor sweeps the samples.
2. One worker falls behind; the queue grows.
3. Each time the cursor passes the sample where KEDA added a pod, the worker pod beside the chart divides: the parent stretches, the child slides out (1 to 4).
4. With 4 workers the queue stops growing, then drains.
5. A minute after the load, the cursor passes the samples where KEDA removed pods, and they merge back into worker 1.
6. End: the full peak-and-back chart, one worker pod with three empty places, and the result box: 135 questions, median 6.1 s, 0 of 1,040 failed.

Speaker notes: This is the real load test of 20 October, with the paced worker, so it measures the platform's scaling and not the model. When more than 5 jobs wait per worker, KEDA adds a pod, and you see the worker divide as the cursor passes that moment. Four workers stop the queue from growing and then drain it. A minute after the load ends, the extra pods merge back, and all 135 questions finished with no failed request.

## er (er.gif, 28.1 s): spotlight
1. The five context frames and their tables come in (identity, project, session, billing; worker with no tables).
2. accounts lights: "An account has many API keys", "An account owns the agents it registers", "A project keeps its account_id: an id from identity, no foreign key". Each relationship grows from the one side to the many side with its crow's foot; the related table pulses; the rest dims to 28%.
3. platform_agents: "A question intent names one agent".
4. projects: "A project has many findings, and its sessions keep its id".
5. sessions: "A session has many tasks and many findings".
6. tasks: the call tree (parent_id), steps, findings, the ledger entry, one at a time.
7. The worker frame lights: it owns no tables.
8. End: the full ER, with the legend (foreign key, id with no foreign key) and the caption (PostgreSQL 16, numeric(12,6), RabbitMQ keeps turns in flight, 2Gi volume).

Speaker notes: Each context owns its own tables in the one PostgreSQL database. Solid lines are foreign keys inside a context; dashed lines are ids that cross a context, with no foreign key, so a later split stays mechanical. The tasks table is the centre: its parent_id is the call tree, and each task has its steps, its findings and its ledger entries. The worker owns no tables; it reports every step to session.

## sequence (sequence.gif, 21.0 s): messages grow in time order; par lanes at the same time; the loop one after another
1. The lifelines grow down.
2. The messages grow in order: POST /api/v1/questions, forward, key guard check, POST /internal/directory/start, publish lumen.turns.0.
3. A par fragment appears with two operands.
4. Both lanes grow at the same time: 201 {sessionId} back to the app, and consume on the worker lane.
5. The app lane (GET, forward, 200 {status, answer, findings, cost}) and the worker lane (chat completion, POST /internal/turns/:id/step, INSERT steps) grow together, one pair at a time.
6. The loop runs twice more: its three messages grow again in white, one after another.

Speaker notes: This is use case A, a question asked with a chosen agent. Project checks the API key, session opens and publishes the root turn, and from that moment two lanes run at the same time. The app gets 201 at once and reads the answer whenever it likes, while a worker takes the turn and runs its steps in a loop. Each step goes back to session, which saves it in PostgreSQL.

## branches (branches.gif, 21.7 s): growth
1. main grows; ass/platform grows out of it on 19 October.
2. Commits land on ass/platform (the count rises to 35).
3. The short-lived branch codex/platform-approval-acceptance grows out, and PR #148 grows back in; the merge commit pulses.
4. More commits land: 48 commits, 1 pull request merged.
5. The push arrow grows to the image lumen-next:<commit sha>, then copy over SSH grows to the EC2 host, then helm upgrade --install --wait grows to the live platform; each target pulses.

Speaker notes: ass/platform is our one integration branch; it left main on 19 October. It has 48 commits, and one short-lived branch came back through pull request #148. Every push builds one image tagged with its commit, copies it over SSH into k3s on the EC2 host, and helm puts it live.

## pipeline (pipeline.gif, scene key cicd, 23.1 s): parallel growth, then sequence; the line breaks
1. The flowchart of .github/workflows/platform-deploy.yml appears, faint.
2. First run: the three checks (verify, SCA, SAST) grow at the same time and pass; the join grows into deploy; build image; the line grows to the Trivy gate.
3. 5 critical CVEs: the pass line breaks at the gate, the fail line grows to stop; result: 5 critical CVEs, deploy stopped.
4. The fix: a smaller platform image, with no Docker inside.
5. Next run, with the real durations: the checks grow at the same time, the image passes the gate, then copy, helm and health check grow one after another.
6. DAST and the smoke load grow at the same time; summary. Result: all jobs done in 12 min 30 s.

Speaker notes: A push to ass/platform starts the pipeline, and verify, SCA and SAST run at the same time. In the first run the Trivy gate found 5 critical CVEs in the image, so the deploy stopped before the host. The team built a smaller platform image without Docker, and the next run passed every stage, with DAST and a smoke load against the live address, in 12 min 30 s.

## findings (findings.gif, 22.8 s): before-and-after morphs
1. Per-level queues: one queue (readers wait) feeds the worker slots (all held by leads); the deadlock words appear. The one queue divides into level 0, level 1 and level 2; the slots now say "readers always run" (AD-03).
2. Trivy gate: the Lumen image with Docker grows its line to the gate and stops at a cross. The image shrinks into the platform image with no Docker, and its line grows through the gate to a check.
3. KEDA scale-down: the 300 s bar fills; then it shrinks to 60 s and turns white.
4. End: the three after-diagrams, each with its problem and its solution in words.

Speaker notes: We found three technical problems and fixed each one. One queue for all turns let leads hold every worker slot while their readers waited, so the queue became one queue per level of the task tree. The image with Docker inside failed the Trivy gate, and the smaller platform image passed. KEDA waits 300 s by default before it removes a worker; the chart sets 60 s.

## Layout check fixes (reviews/2026-10-22-layout-check.md)

All eight GIFs are re-rendered, one at a time inside the render lock. I zoomed in on the faulty frames again. Every last frame now keeps its step title (C1, fixed in draw.py). Each GIF keeps its content at least 30 px from the bottom and side edges (C2). All of them use the standard title band (C3). Lengths: physdecisions 26.7 s, deployment 22.8 s, scaling 22.9 s, er 27.2 s, sequence 19.3 s, branches 20.6 s, pipeline 22.2 s, findings 21.9 s.

**physdecisions**
1. The "same chart" label sat between the boxes. Fix: the EKS box moved 0.2 in (29 px) right, and the label sits 0.04 in higher.
2. The k3s cells had 7 px gaps. Fix: cells are 136 px wide with 12 px gaps.
3. The pods had two widths. Fix: every HPA and KEDA pod is 0.55 in (79 px) wide, at one pitch.
4. The AD-11 rhythm was uneven. Fix: the rows are respaced evenly, and the heading sits closer to the turns row.
5. The sub-caption ran 21 px from the edge. Fix: it reads "one transaction: step, cost, ledger entry". The captions moved up, so the picture ends 40 px above the bottom edge.
6. The chart had no arrow for 0.4 s. Fix: the Helm chart's arrow stays while the cluster shrinks.

**deployment**
1. The egress line shared the bus drop. Fix: the worker-to-OpenAI line leaves the worker's top at x 9.86 in (1420 px), right of the bus drop.
2. The SSH 22 arrow pointed at a border from inside. Fix: it ends horizontally on the k3s left border.
3. The gap under OpenAI API was 14 px. Fix: the EC2 node's 3D depth is now 0.09 in (13 px).
4. The data row did not line up. Fix: PostgreSQL, RabbitMQ and KEDA end at the right edges of project, worker and billing.
5. Edges: the outside nodes start at x 0.22 in, OpenAI API ends at 11.89 in, and the AWS node ends 37 px above the bottom.

**sequence**
1. Lifelines ran through labels. Fix: every message label, the self-call label too, sits on a black ground with 4 px padding.
2. Arrows stopped short or overshot. Fix: each tip ends on the side of an activation bar, or on the lifeline itself. The short stub bars on PostgreSQL and RabbitMQ are gone, and "consume" starts on the RabbitMQ lifeline.
3. The par rows were crowded. Fix: the app lane has a 0.29 in (42 px) pitch.
4. The start label was too close to the self-call box. Fix: the start row sits lower, so its label clears the nested bar.
5. The diagram touched the edges. Fix: it sits between x 0.25 and 11.9 in, and the par frame ends 34 px above the bottom.
6. Head gaps were 16 to 24 px. Fix: every gap is at least 36 px.
   - To fit the standard title band and the bottom margin, Traefik is no longer a lifeline.
   - Its two "forward" rows are gone.
   - A UML note on the app's lifeline says that every call passes Traefik, the API gateway.
7. The title was higher than in the other GIFs (C3). Fix: it uses the standard title band.

**er**
1. A connector ran in the 25 px gap between two frames. Fix:
   - The row pitch is now 0.18 in (26 px).
   - sessions-to-findings goes up the column between sessions and tasks, and ends on the left side of findings at session_id. No line runs along the gap between frames.
   - The project frame reaches 0.19 in below its tables, so the crow's foot under findings sits inside the frame.
2. The footer was 7 px from the edge. Fix: it is gone. Its facts moved into the last step title ("PostgreSQL 16, money as numeric(12,6); turns stay in RabbitMQ") and into a third legend line ("files: a 2Gi volume").
3. The diagram filled the canvas. Fix: it sits between x 0.22 and 11.92 in and ends 32 px above the bottom.
4. The accounts-to-agents line ran close to the title. Fix: it runs 25 px below the title glyphs.
5. The title band (C3). Fix: the standard title band. The frame names moved 0.02 in down, so they no longer touch the frame tops.

**branches**
1. The commit dots merged into a bar. Fix: all 46 commits sit at one 0.1 in (14 px) pitch, with dots of about 6 px.
2. The helm label was crowded. Fix: the image box and the EC2 host moved up. The helm label has a 0.5 in gap, and the live box ends 36 px above the bottom.
3. The right half was empty for most of the run. Fix: the deploy column shows dimmed from the first frame and lights as each line reaches it.
4. The branch label was 17 px from the fork. Fix: "codex/platform-approval-acceptance" ends 0.22 in (32 px) before the fork line.

**pipeline**
1. "25 s" was 9 px from the frame. Fix: it moved 0.06 in right.
2. The result chips did not align. Fix: both are centred under the summary box.
3. The broken line read as a stray "<". Fix: the pass line has a clear 0.14 in gap with a small cross in it, and "pass" moved 0.04 in right.
4. The bottom margin (C2). Fix: the whole flowchart is 0.1 in higher, so the deploy frame ends 35 px above the bottom. The trigger starts at x 0.22 in.

**findings**
1. The KEDA panel looked unfinished. Fix: the 300 s bar stays as a dim outline labelled "default". A copy of the bar moves down and shrinks to the 60 s bar, labelled "in the chart".
2. The margins were uneven. Fix: the columns start at x 0.45, 4.45 and 8.45 in. The margins are about 65 px on the left and 70 px on the right.
3. The level boxes were crowded. Fix: they are 0.21 in (30 px) tall with 0.07 in (10 px) gaps.

**scaling**
1. The result chip was narrower than the worker boxes. Fix: it is as wide as the worker boxes, with a 40 px line pitch. It sits 0.15 in under the last worker place and ends 43 px above the bottom.
2. The target line merged with a bar top. Fix: the dashed line has a black edge under it, drawn over the bars.
3. The bar gaps are uneven. No change: the bars stand at the real sample times of the evidence file.

No moving element sits on text in these pictures. They grow lines, divide pods and morph boxes; no tag travels.
