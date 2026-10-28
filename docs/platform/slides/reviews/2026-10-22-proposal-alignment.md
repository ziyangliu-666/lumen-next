# Review: deck against proposal v2, and the speaking arrangement

Date: 22 October 2026. Read only; no slide or build file was changed.

Sources:

- Proposal: `03_Proposal-v2_2026-10-06.docx` (text and Figure 9, the schedule).
- Guidelines: `00_Presentation-Guidelines-and-Schedule-Revised.pdf`. The slot is 40 minutes, questions included. The suggested split is 31.5 minutes of talk and 8.5 minutes of questions.
- Report: `Team15-Lumen-Platform-Report.docx`, sections 2.1 to 2.3.
- Deck: `out/Team15-Lumen-Platform.pptx` (25 slides). It is byte-identical to `Team15-Lumen-Platform-Slides.pptx` in the coursework folder.
- Speaker guide: `speaker-guide.md`. It is identical to `Team15-Speaker-Guide.md` in the coursework folder.

Result: the deck is roughly aligned with the proposal. No deck difference is a must-fix. Five small text fixes make the alignment clearer. The speaking arrangement has one must-fix: the load test and KEDA slides go to a member who does not own them in the proposal WBS, and slide 5 credits them to another member.

## Task 1: alignment of the deck with proposal v2

### Aligned, no change needed

| Area | Proposal v2 | Deck |
|---|---|---|
| Members | Five names: HE RONG, LI ZHUOYANG, LIU ZIYANG, LU YI, PENG XUJIAN | Slide 1 and slide 5 show the same five names |
| Effort | "Ten person-days per member, fifty in total, from 8 to 21 October" | Slide 5: 80 h per member (ten days of 8 h), 400 h in total, 8 to 21 October. This is the team's decision, and the report (2.3) says the same |
| Schedule | Figure 9: eleven WBS bars, 8 to 21 October | Slide 5 redraws Figure 9 per member, with the same task order and the same dates, then ticks each part |
| Use cases | Table 3: UC1 to UC6 | Slide 4 shows UC1 to UC6 with the same numbers. Names are shorter but match: "Publish an agent", "Ask a question", "Manage API keys", "Approve spend over cap", "Read usage", "Watch the literature" |
| Platform roles | Table 2: seed, producers, consumers, operator | Slides 3 and 4 show the same four roles. The seed is "the session, worker and billing services" |
| Communication | REST for answers now, RabbitMQ for long work, a worker that dies leaves the job for another | Slides 6, 7, 13, 23 |
| Autoscaling | HPA on CPU, KEDA on queue depth for workers | Slides 10, 21, 22 |
| DevOps stages | Lint, tests, dependency and static analysis, image build, Helm deploy, OWASP ZAP, short load test | Slide 18: verify, SCA, SAST, Trivy gate, deploy, DAST, smoke load |
| Second app | Literature watch, built only on the public API | Slides 3, 7, 9 and demo line 2 |

### Differences

Severity key:

- **Must fix**: a lecturer can see a contradiction inside the talk, or between the talk and the proposal, with no explanation.
- **Should fix**: the difference is fine, but one sentence makes the reason visible.
- **Fine as is**: natural evolution; the deck or the guide already explains it, or the item is safe to leave out.

| # | Slide | Proposal says | Deck says | Severity | Smallest fix |
|---|---|---|---|---|---|
| 1 | 2, "Lumen is an AI that does research" (1a) | "Every team that does this builds the same parts again: a record of each step, a spending cap, a sandbox for commands, sign-in, and a live view of the run." | The notes describe the recorded run only. The business problem is only in the speaker guide's "Stress" column. Outline item 1a asks for the business problem. | Should fix | Add to the end of the slide 2 notes: "The business problem: every research team that uses agents builds the same parts again, a record of each step, a spending cap, sign-in and a live view. Lumen Platform builds these parts once." |
| 2 | 7, "Five services behind one gateway" (3b) | "The platform is eight services", Table 1: API Gateway, Identity, Project, Session, Worker, Model Gateway, Billing, Stream. | Five services: identity, project, session, worker, billing. Slide 6 (AD-01) gives the reason, but no slide maps eight to five. | Should fix | Add to the slide 7 notes: "The proposal listed eight services. Traefik is the gateway, the live stream runs inside session, and the model client runs inside the worker. So five services remain, each with one job and its own tables." |
| 3 | 14, "Asking a question with a chosen agent" (4d) | The use case is UC2: "Run a question on a chosen agent through the public API and watch its steps live." | The notes say "use case A". The report uses "use case A" too, but the audience saw "UC2" on slide 4. | Should fix | In the slide 14 notes, replace "This is use case A, a question asked with a chosen agent." with "This is UC2, a question asked with a chosen agent." |
| 4 | 17, "From a branch to a running image" (5a) | Work from 8 to 21 October (Figure 9). | "ass/platform is our one integration branch; it left main on 19 October." Slide 5 says the work started on 8 October, so the date invites the question "what happened before 19 October?". | Should fix | In the slide 17 notes, replace "ass/platform is our one integration branch; it left main on 19 October. It has 48 commits," with "ass/platform is our one integration branch. It has 48 commits,". |
| 5 | 24, "Now, on the public server" (6a, 6b) | UC4 and UC5 are in scope; UC5 is "Read usage: sessions, cost and latency per account and per agent." | Slide 4 says "all six use cases are built". The demo lines show UC1, UC2 and UC6. UC3 and UC5 appear in the slide 9 diagram. UC4 (approval over the cap) appears on no slide and in no demo line. | Should fix | Change demo line 2 to "the literature watch app publishes its agent, asks through the API, and reads usage". If UC4 runs well in rehearsal, add to line 1: "approve one step over the cap". |
| 6 | 10, "Three choices shape the deployment" (4a), and 11 (4b) | "k3d on a laptop, a managed cluster (EKS) for the demo." | k3s on one EC2 t3.medium, "the same chart can still go to EKS". | Fine as is | None. Slide 10 states the decision and the reason. |
| 7 | 10 (4a) and 16, "The schema, by context" (4c) | "Each service has its own Postgres database." | One PostgreSQL, tables per context, no foreign keys across contexts. | Fine as is | None. Slide 10 gives the reason (one transaction for step, cost and ledger entry), and slide 16 shows that a split stays mechanical. |
| 8 | 7, 11 | Stream scales on open connections; Model Gateway talks to OpenAI and DeepSeek. | Session holds the stream (one replica); only the worker calls the OpenAI API. | Fine as is | Covered by fix 2. The guide has a Q&A answer (AISS-08, AD-11). |
| 9 | 3, "Producers, consumers, one platform" (1b) | Producers publish "agents, tools and model adapters"; UC1 registers "its endpoint and manifest". | A producer publishes an agent (its instructions). | Fine as is | None. The guide has a Q&A answer (AD-08). |
| 10 | 17, 18 (5a, 5b) | "Each service has its own pipeline"; "A merge to main deploys to staging". | One pipeline, one image for all five services; a push to ass/platform deploys to the public server. | Fine as is | None. AD-01 and AD-12 explain one image. The guide has a Q&A answer for staging. |
| 11 | 21, "KEDA adds workers as the queue grows" (6b) | "Targets: 200 concurrent sessions, 1,000 open streams, 95% of step events delivered in under one second." The test runs again with a worker pod and a stream pod killed. | 10 virtual users, 135 questions, 0 of 1,040 requests failed, 1 to 4 workers. Slide 23 deletes a worker. The deck does not repeat the proposal's targets. | Fine as is on the slides | No slide change. Change the Q&A answer in the guide (see Task 2, item 7). |
| 12 | None | OpenTelemetry traces, Prometheus metrics, network policies, sandbox containers, client library, Stripe top-up, GitHub and Google sign-in. | Not on any slide. | Fine as is | None. Do not add these to the deck. |
| 13 | 2, 15 | Model vendors OpenAI and DeepSeek. | gpt-4.1 (slide 2) and gpt-4.1-nano (slide 15). | Fine as is | None. |

## Task 2: the speaking arrangement

### Time estimate

The estimate uses 130 words per minute for the notes, plus the full GIF run time. The second figure is the lower bound, when the speaker talks over the GIF.

| Member | Slides now | Notes + GIF | Talk over GIF | Guide plan |
|---|---|---|---|---|
| LIU ZIYANG | 1 to 8 | 6.4 min | 3.8 min | 7.5 min |
| LU YI | 9 to 12 | 3.4 min | 2.0 min | 4.5 min |
| LI ZHUOYANG | 13 to 15 | 2.5 min | 1.5 min | 4.5 min |
| HE RONG | 16 to 20 | 3.9 min | 2.2 min | 7 min |
| PENG XUJIAN | 21 to 24 + live demo | 2.8 min + 6 to 8 min | 1.9 min + 6 to 8 min | 8.5 min |
| Total | | 25 to 27 min | 17 to 19 min | 32 min |

The total fits the 40-minute slot with 8 or more minutes for questions. The notes are shorter than the guide's plan, so each speaker has room for the "Stress" points.

### What is reasonable

1. Each member speaks once, in one contiguous block, in deck order. This is correct.
2. The order follows the required outline 1 to 6. Inside part 4 the items run 4a, 4b, 4a, 4d, 4c. This keeps each speaker's block contiguous and still goes top-down. Keep it.
3. LIU ZIYANG (WBS 1 architecture, WBS 2 session) presents overview, conduct and the logical architecture. This is correct: the logical design is WBS 1.
4. LU YI (WBS 3 identity and gateway, WBS 4 public API) presents slide 9, the public API flow. This is correct. Slides 10 to 12 are mostly HE RONG's WBS 10 (Kubernetes, Helm). But the ingress, HTTPS, ports and rate limit on slide 11 are LU YI's (the report's WBS 3 says "ingress, HTTPS, rate limits"). With contiguous blocks, this is a fair compromise. HE RONG answers questions about k3s and Helm.
5. LI ZHUOYANG (WBS 7 worker and queue) presents the queue decision and the UC2 sequence. This is correct.
6. HE RONG (WBS 9 billing, WBS 10 Kubernetes and pipeline) presents persistence and DevOps. This is correct.
7. The handovers fall at natural points: 8 to 9 (logical design to the API that apps use), 12 to 13 (the cluster to the decision inside the worker), 15 to 16 (the request to where its data lands), 20 to 21 (DevOps to the demo).
8. The demo covers 6a and 6b: use cases, scalability, availability and the pipeline. Questions have their own slide and an owner per part.

### What is not reasonable

| # | Problem | Severity | Fix |
|---|---|---|---|
| 1 | PENG XUJIAN presents slides 21 to 23: the load test, KEDA and the worker deletion. In the proposal WBS these are HE RONG's (WBS 11, load tests) and LI ZHUOYANG's (WBS 7 and 8, worker and KEDA). Slide 5 shows "load tests" under He Rong. Then on slide 21 the guide has Peng say "your k6 test". The audience sees two owners for one piece of work. | Must fix | Move slides 21 and 22 into HE RONG's block. Move slide 23 into LI ZHUOYANG's block (see the table below). |
| 2 | PENG XUJIAN's own WBS (5 project service and agent registry, 6 literature watch and usage) is on no slide in his block. Only demo line 2 shows it. | Should fix | Give PENG XUJIAN the live demo, and make demo line 2 his: the watch app publishes its agent, asks, and reads usage (Task 1, fix 5). He opens with one sentence on the registry and the watch app. |
| 3 | LI ZHUOYANG has the shortest block: 2.5 minutes from the notes. | Should fix | Slide 23 (the worker deleted during a question) shows his design: a worker acknowledges a turn only when it is done. Move it to follow slide 15. Change its item label from "6b · Availability, recorded" to "4d · Availability, recorded". |
| 4 | The live demo length is not the same in two places. The guide says "About 6 minutes" for slide 24. The slide 24 notes say "about eight minutes". With 8 minutes, PENG XUJIAN's block is about 11 minutes. | Should fix | In the slide 24 notes, replace "about eight minutes" with "about six minutes". |
| 5 | The guide says "(24 slides)". The deck has 25, and the guide's own table uses slide 25 for questions. | Should fix | Replace "(24 slides)" with "(25 slides)". |
| 6 | The guide gives the k6 test to PENG XUJIAN in three places (the table row 5, his section intro, and "Your k6 test" on slide 21). Table row 4 also gives "11 load tests" to HE RONG. | Should fix | After the move in item 1, remove "k6 test" from row 5 and from Peng's section intro. Move the slide 21 and 22 rows to He Rong's section, and change "Your k6 test" to "The k6 test". |
| 7 | The Q&A answer for "The proposal said 200 concurrent sessions" opens with "Not on one t3.medium". | Should fix | Replace the answer with: "The test shows the mechanism that carries that load: KEDA adds a worker for each five waiting turns, and HPA adds pods on CPU. The same Helm chart runs on EKS, where node autoscaling adds machines as the load grows." The owner of slide 21 answers it. |

### Proposed arrangement

The slide numbers are those of the current deck. Slide 23 moves to follow slide 15; no other slide moves.

| Order | Member | Slides | Outline items | Proposal WBS | Estimate (notes + GIF) | Plan |
|---|---|---|---|---|---|---|
| 1 | LIU ZIYANG | 1 to 8 | 1a, 1b, 1c, 2a, 2b, 3a, 3b, 3c | 1, 2 | 6.4 min | 7 min |
| 2 | LU YI | 9 to 12 | 3c (the API), 4a, 4b | 3, 4 | 3.4 min | 4.5 min |
| 3 | LI ZHUOYANG | 13, 14, 15, 23 | 4a (queues), 4d | 7, 8 | 3.5 min | 4.5 min |
| 4 | HE RONG | 16 to 22 | 4c, 5a, 5b, 5c, 6b (load test, KEDA) | 9, 10, 11 | 5.6 min | 6.5 min |
| 5 | PENG XUJIAN | 24, live demo | 6a, 6b | 5, 6 | 0.5 min + 6 min demo | 7 min |
| | Everyone | 25 | Questions | | | 10.5 min |
| | Total | | | | 25.4 min | 29.5 min talk, 40 min slot |

Part 6 then runs about 8.5 minutes (slides 21 and 22, then the live demo), close to the suggested 8 + 2.

New handovers:

- LI ZHUOYANG to HE RONG, after slide 23: "He Rong built the billing service, the cluster and the pipeline. He will show where the data lives and how a change reaches the server."
- HE RONG to PENG XUJIAN, after slide 22: "Peng Xujian built the agent registry and the literature watch app. He will now run the demo on the public server."

If the team keeps slide 23 in part 6, LI ZHUOYANG's block stays at 2.5 minutes. Then give him the question "What if a worker dies mid-turn?" and the live demo line 4. This is acceptable but less balanced.
