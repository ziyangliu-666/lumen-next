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
