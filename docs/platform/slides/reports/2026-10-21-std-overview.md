# Overview pictures in standard notation (group "overview")

File: `docs/platform/slides/scenes_std_overview.py`. I added `"scenes_std_overview"` to MODULES in `make.py`.
Scene keys: `std_platform`, `usecases`, `decisions`, `contextmap`, `interaction`.
Render one at a time: `python3 docs/platform/slides/make.py <key>`.

Name clash: `scenes_story.platform` also writes `out/platform.png`, as the first frame of `platform.gif`. For that reason my scene key is `std_platform`, not `platform`. My module comes last in MODULES, so if you run `make.py` with no arguments, my static `platform.png` overwrites the story one. If the deck still uses `platform.gif`, rename one of the two files.

I checked every picture zoomed in. In the PNGs, no text touches a line or a box edge. In the GIF, a tag can cover a label for a moment while it moves. In the held frames, nothing overlaps.

## 1. out/platform.png (slide 1b: platform thinking), static

What it shows:
- On the left, a UML actor "Producer" (agent author). An arrow labelled "publish an agent" goes to the "Agent registry".
- In the middle, the "Lumen platform" boundary holds two components:
  - the Agent registry;
  - "Run engine: the seed" (the session, worker and billing services), with three parts: task tree, steps and cost, budget cap.
- An arrow labelled "the agent's instructions" goes from the registry to the run engine.
- On the right, under "Consumers", there are two consumers:
  - The Literature watch app. Its arrows are "ask with an API key" and "answer + findings + cost".
  - The Web app, with an actor "People". Its arrows are "ask, signed in" and "the run, live".

Facts used and their source:
- The seed is the run engine (session, worker, billing): report 3.1.4, Platform roles.
- Instructions go in front of the question: AD-08.
- The web app uses a cookie and the watch app uses an API key: AD-07 and 3.1.4.
- The live view is `/ws`: 1.4.1.

Speaker notes: "Lumen is a platform with two sides. Producers are agent authors: they publish an agent in the registry. Consumers ask questions, either from an app with an API key, like our literature watch, or as people in the web app. The seed is the run engine. It runs every question as a task tree, records each step with its cost, and stops at the account's budget cap. The consumer gets back the answer, the findings and the cost."

## 2. out/usecases.png (slide 1c: scope), static

What it shows:
- A UML use case diagram. The system boundary is "Lumen platform".
- Six use cases are ovals:
  - UC1 Publish an agent
  - UC2 Ask a question
  - UC3 Manage API keys
  - UC4 Approve spend over cap
  - UC5 Read usage
  - UC6 Watch the literature
- Four actors are stick figures, each linked to its use cases:
  - Producer: UC1 and UC5
  - Operator: UC5
  - Consumer app: UC2 and UC6
  - Account owner: UC3 and UC4

Facts used and their source: report 1.4.1. The table says "Consumer" for UC2, UC3, UC4 and UC6. As the brief asked, I split this actor in two:
- The Consumer app asks and watches (UC2, UC6).
- The Account owner manages keys and approves spend (UC3, UC4).

Speaker notes: "This is our scope: the six use cases of the proposal, all built. A producer publishes an agent and reads its usage. An app asks questions with a chosen agent, and the literature watch asks saved questions on a schedule. The account owner manages API keys and approves any step that would pass the cap. The operator reads usage for every account and agent."

## 3. out/decisions.png (slide 3a: key decisions, logical), static

The picture has three panels. Each panel has its AD number, a small diagram, a caption in Semibold and one note line.

- **AD-01 "Five services, cut along the slices"**
  - Diagram: the slices on main (identity, projects, session, steering, billing) each have an arrow to a service (identity, project, session, worker, billing).
  - Note: "same image, a new entry point each".
- **AD-02 "A durable queue, not a direct call"**
  - Diagram: session goes to a "RabbitMQ queue of turns", which fans out to three workers.
  - Under it, the alternative is faint and crossed out: session to worker as a "direct HTTP call".
  - Note: "a slow model call never holds a request".
- **AD-04 "Session is the only writer of the trace"**
  - Diagram: the worker sends "POST /internal/turns/:id/step" (one call per step) to session. Session writes the trace with "SQL, the only writer". The trace is in PostgreSQL.
  - Note: "a worker that dies loses no step".

Facts used and their source:
- Report 3.1.1, AD-01, AD-02 and AD-04.
- Report 3.1: one image, a different command for each service.
- Report 3.1.3: the `/internal/turns/:turnId/{step,...}` routes.

Speaker notes: "Three decisions shaped the logical design. First, we cut the five services along the slices that already existed, so each slice kept its ports and its tests. Second, a turn goes from session to the workers on a durable RabbitMQ queue, not a direct call. A slow model call never holds a web request, and if a worker dies, its turn stays on the queue for another worker. Third, only session writes the trace: workers report each step over /internal, so a worker that dies loses no step."

## 4. out/contextmap.png (slide 3c: DDD), static

What it shows:
- At the top, one line of four small boxes with arrows shows how we derived the contexts: "use cases UC1 to UC6", then "nouns users say: agent, question, step, cap", then "5 bounded contexts", then "their aggregates".
- Under it is the context map. Session is marked «core domain» and sits in the centre. Each context lists its aggregates:
  - Projects: Project, Finding; Agent registry: Agent, QuestionIntent
  - Identity: Account, ApiKey
  - Session: Session (the root), its Task tree, Step (a value)
  - Execution: the worker loop; it keeps no state
  - Billing: Wallet, LedgerEntry, Approval
- Each relationship is labelled with a domain event:
  - Projects to Session: question asked
  - Session to Projects: finding recorded
  - Session to Execution: turn queued
  - Execution to Session: step recorded
  - Session to Billing: spend recorded, approval needed
  - Identity is upstream of Projects ("account, API key").

Facts used and their source: report 3.1.4 (the bounded contexts table, the aggregates, the domain events table). The report has six contexts: Registry and Project are separate, and the worker context is called "Steering". As the brief asked, I drew five:
- Registry is folded into Projects. Both run in the project service.
- The worker context is called "Execution", the same word that `scenes_lean.derive` uses.

Speaker notes: "We found the contexts from the use cases. We took the nouns our users say, grouped the ones that belong together, and each group became a bounded context with its aggregates. Session is the core domain: it owns the task tree and every step. The contexts talk through domain events: a question asked starts a session, a turn queued goes to execution, and every step recorded comes back to session. Spend recorded and approval needed go to billing, and finding recorded goes back to the project."

## 5. out/interaction.gif (slide 3c: producers and consumers), animated, 29.8 s, 234 frames

What it shows: a UML sequence diagram with three lifelines: Consumer app (literature watch), Lumen platform (API v1, with an activation bar) and Producer (agent author). Each step lights its message and moves a white tag along it. When the step ends, the message stays in grey.

| Step | Title at the top | Message | Tag |
|---|---|---|---|
| intro | A producer publishes; a consumer asks; one API | (empty diagram) | |
| 1 | A producer creates an API key | `POST /api/v1/keys`, then a dashed reply | "API key" comes back |
| 2 | The producer publishes an agent | `POST /api/v1/agents` | "agent" goes, "201" comes back |
| 3 | A consumer lists the agents | `GET /api/v1/agents` | "agent" comes back |
| 4 | The consumer asks with a chosen agent | `POST /api/v1/questions` | "question" goes, "201" comes back |
| 5 | The platform runs the question | a self-call: "runs it, the agent's instructions first" | "question" goes round the loop |
| 6 | The consumer reads the answer, findings and cost | `GET /api/v1/questions/:id` | "answer" comes back |
| 7 | The producer and the operator read usage | `GET /api/v1/usage` | "usage" comes back |
| end | Publish, list, ask, read: all on the public API v1 | all seven, grey | |

The loop restarts from the empty diagram.

Facts used and their source:
- Report 3.1.4, "How the platform interacts with producers and consumers", steps 1 to 7.
- `evidence/2026-10-20-public-api-flow.md`: `POST /api/v1/keys` returns the key, and the agent and question routes return 201.

Speaker notes: "This is the whole platform contract, seven calls on the public API. A producer creates a key and publishes an agent. A consumer app lists the agents and asks a question with the one it chose, and gets a session id at once. The platform runs the question with the agent's instructions in front, and the app reads the answer, the findings and the cost. Producers and the operator read usage from the same API: sessions, cost, and the median time to rest per agent."

# Animations of the four static pictures

The four static pictures are now GIFs. Each one has three phases: a build, one real flow, and a calm hold of at least 3.6 s with nothing lit. The scene keys are the same as before. The `.png` of each scene is now the GIF's first frame.

- The diagrams now start under the step-title band, at y = 1.0 in. For this reason, each layout has less height than in the static version. The names, the notation and the facts do not change.
- A connector at rest is grey. While something moves on it, the connector is white and flows, and the parts that act now are lit (white border, raised fill).
- A tag that travels stops short of both ends of its connector, so it never covers the words in a box.
- Labels beside a connector stand 0.4 in off the line, so the tag does not cover them.
- In the context map, an event's label appears only after its tag arrives.
- I checked 12 frames spread over each loop, plus zoomed crops at the tight places. In the final renders, no text touches a line, a box edge or other text.

## out/platform.gif (slide 1b), 22.4 s
1. Build: "The platform: an agent registry and the run engine". The Lumen platform boundary appears, with the Agent registry and "Run engine: the seed" (task tree, steps and cost, budget cap).
2. Build: "Producers publish agents to it". The Producer actor and the "publish an agent" connector appear.
3. Build: "Consumers ask: an app with an API key, or people". The Literature watch app, the Web app, People and their four connectors appear.
4. Flow 1: "A producer publishes an agent". The tag "agent" goes from the producer to the registry, and the registry lights.
5. Flow 2: "The literature watch asks, with its API key". The tag "question" goes from the watch app to the run engine.
6. Flow 3: "The run engine takes the agent's instructions". The tag "agent" goes down from the registry to the engine.
7. Flow 4: "The seed runs it under the account's cap". The task tree, then steps and cost, then budget cap light in turn.
8. Flow 5: "The answer, its findings and its cost come back". The tag "answer" goes to the watch app.
9. Hold: "Producers publish, consumers ask, the seed runs it".

## out/usecases.gif (slide 1c), 19.4 s
1. Build: "Four actors use the platform". The four stick figures appear.
2. Build: "The system boundary: Lumen platform".
3. Build: each use case appears lit, with its links, one at a time:
   - "UC1 Publish an agent: the producer"
   - "UC2 Ask a question: an app"
   - "UC6 Watch the literature: an app, on a schedule"
   - "UC3 Manage API keys: the account owner"
   - "UC4 Approve spend over cap: the account owner"
   - "UC5 Read usage: the producer and the operator"
4. Flow: "Flow: the consumer app asks a question (UC2)". UC2 and its link light, and the tag "question" travels from the Consumer app to UC2.
5. Flow: "The answer returns: ended in 4.9 s, cost USD 0.01". The tag "answer" travels back. The numbers come from evidence/2026-10-20-public-api-flow.md.
6. Hold: "Six use cases, four actors, all built".

## out/decisions.gif (slide 3a), 22.1 s
1. AD-01: "each existing slice becomes a service". The five slices on main appear. Then each slice gets its arrow and its service, one at a time: identity, project, session, worker (from steering), billing. Then the caption "Five services, cut along the slices" appears.
2. AD-02: "a turn waits on a durable queue", then "any free worker takes the next turn".
   - Three "turn" tags go one after another from session into the RabbitMQ queue. Each waits there, then goes to a different worker, and that worker lights.
   - The crossed-out "direct HTTP call" stays dim the whole time.
   - Then the caption "A durable queue, not a direct call" appears.
3. AD-04: "the worker reports each step to session". A "step" tag goes down the POST /internal/turns/:id/step connector. Then "session alone writes it to the trace": the tag goes down the SQL connector to the trace, and the trace lights. Then the caption "Session is the only writer of the trace" appears.
4. Hold: "Three key decisions of the logical design".

## out/contextmap.gif (slide 3c, DDD), 26.4 s
1. Build: "How we found the contexts". The four strip boxes appear one at a time: use cases UC1 to UC6, then the nouns users say, then 5 bounded contexts, then their aggregates.
2. Build: "Five bounded contexts; Session is the core domain". The five context boxes appear.
3. Build: "Each context keeps its own aggregates". The aggregate lines appear.
4. Build: "They talk only through domain events". The six event connectors and the Identity upstream link appear, with no event labels yet.
5. Flow: the events of one question, in order. Each tag travels while the two contexts light, and then the event's label appears:
   1. "A question asked in a project opens a session": the tag "question", label "question asked".
   2. "Session queues a turn for execution": the tag "turn", label "turn queued".
   3. "Execution reports each step back to session": the tag "step", label "step recorded".
   4. "Session records the spend in billing": the tag "spend", label "spend recorded".
   5. "A step over the cap needs an approval": the tag "approval", label "approval needed".
   6. "A finding goes back to the project": the tag "finding", label "finding recorded".
6. Hold: "Five contexts, one core domain, six domain events".

# Review fixes, 22 October: usecases.gif and the new physdecisions.gif

Both GIFs use the current draw.py: 30 fps, and they play once. Each one ends on its full diagram. I rendered them one at a time and checked 12 frames spread over each GIF. For physdecisions.gif, I also checked zoomed crops of all three panels. No text touches a line, a box edge or other text.

## out/usecases.gif (slide 1c), 19.3 s
These changes answer the review:
- **Demo-mode number removed.** The step "The answer returns: ended in 4.9 s, cost USD 0.01" is gone. The return step is now "The app reads the answer, the findings and the cost", with no number.
- **Number order.** The build goes UC1, UC2, UC3, UC4, UC5, UC6.
- **Actor names.** The actors now use the names in platform.gif: "Producer (agent author)", "Operator", "Literature watch app" and "People in the web app".

One thing stays the same: the ovals are still grouped by actor. The producer's and the operator's use cases (UC1, UC5) are in the left column. The two consumers' use cases (UC2, UC6 for the watch app; UC3, UC4 for people in the web app) are in the right column. I tried strict number order on the page as well, and every such layout makes links cross. In the build, the use cases still come in number order.

The steps:
1. Build: "Four actors use the platform", then "The system boundary: Lumen platform".
2. Build: each use case appears lit, with its links: "UC1 Publish an agent: the producer", "UC2 Ask a question: the literature watch app", "UC3 Manage API keys: people in the web app", "UC4 Approve spend over cap: people in the web app", "UC5 Read usage: the producer and the operator", "UC6 Watch the literature: the literature watch app".
3. Flow: "Flow: the literature watch app asks a question (UC2)". The tag "question" goes to UC2.
4. Flow: "The app reads the answer, the findings and the cost". The tag "answer" comes back.
5. Hold, at least 3.6 s: "Six use cases, four actors, all built".

## out/physdecisions.gif (slide 4a), new scene `physdecisions`, 23.7 s
The layout is the same as decisions.gif: three panels, each with its AD number, a small standard diagram that moves, one caption line and one note line. Each panel also shows the rejected alternative, greyed and crossed out.

- **AD-09.** The diagram:
  - A "Helm chart" box has an arrow down to a UML node "EC2 t3.medium" (2 vCPU, 4 GB). Inside it is a nested node "k3s".
  - The alternative is a crossed-out, greyed arrow from the chart to "EKS".
  - Title "AD-09: one Helm chart installs every pod on k3s": the nine pods appear one by one in k3s (identity, project, session, worker, billing, postgres, rabbitmq, traefik, keda), the same set as deployment.png.
  - Caption "k3s on one EC2 t3.medium, not EKS". Note "the laptop chart, unchanged; USD 1.3 a day".
- **AD-11.** The diagram:
  - "HPA on CPU" (identity, project, billing): a CPU bar with a 70% mark, and three pod slots. Title "AD-11: HPA adds pods when CPU passes 70%": the bar rises past 70% and the count goes "1 pod (1 to 3)", "2 pods", "3 pods". Then the CPU settles.
  - "KEDA on queue length" (worker): a "turns" queue labelled "queueLength 5", and four pod slots. Title "AD-11: KEDA adds workers as turns wait in the queue": the queue fills and the count goes from 1 to 4 pods.
  - The alternative: the worker's CPU bar stays low and greyed, with a crossed-out arrow to a greyed "HPA" box.
  - Caption "HPA on CPU; KEDA on queue length". Note "a worker waits on the model, so its CPU is low".
- **AD-06.** The diagram:
  - The session service writes into one PostgreSQL frame. Inside it are four context frames, each with its own tables: session (steps, tasks), billing (ledger_entries), identity (accounts), project (projects, findings).
  - The alternative is a crossed-out, greyed arrow from session to "own database" ("per service").
  - Title "AD-06: one PostgreSQL; each context owns its tables". Then "AD-06: the step, its cost and the ledger entry in one transaction": a "step" tag goes from session into the database, the "steps, tasks" row lights, then "ledger_entries" lights with it.
  - Caption "One PostgreSQL, tables per context". Note "step, cost and ledger entry in one transaction".
- Hold, at least 3.6 s, on the full diagram: "Three decisions shape the physical architecture".

Facts and their sources:
- Report 3.2.1:
  - AD-09: t3.medium, about USD 1.3 a day, and the same chart as on the laptop (k3d).
  - AD-11: HPA at 70% CPU with 1 to 3 replicas; KEDA with `QueueLength` 5 and 1 to 4 replicas; a worker waits on the model.
- Report 3.1.1, AD-06; and report 3.2.3 for the tables and their owners.
- The single transaction is in `apps/server/src/modules/session/pgTrace.ts`, `appendCostedStep`: the step, the task's cost and billing's ledger entry commit together or not at all.
- `deploy/k8s/lumen/values.yaml`: `queueLength: 5`.
- `deploy/k8s/aws/README.md`: t3.medium, 2 vCPU, 4 GB.

Speaker notes (4a): "Three decisions shape the physical side. We run k3s on one EC2 t3.medium instead of EKS: the Helm chart that runs on a laptop installs every pod unchanged, for about 1.3 US dollars a day. We scale with two autoscalers: HPA on CPU for identity, project and billing, and KEDA on queue length for the worker, because a worker waits on the model and its CPU stays low while turns pile up. And all contexts share one PostgreSQL, each with its own tables, so a step, its cost and its ledger entry commit in one transaction."
