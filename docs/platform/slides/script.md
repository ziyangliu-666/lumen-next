# Speaking script: Lumen Platform, ASS presentation

This script covers the deck `out/Team15-Lumen-Platform.pptx` (Team 15, 25 slides), for Monday 26 October 2026, 11:25 to 12:05.

How to read each slide section:

- **What to say** holds the exact words to say to the lecturers. A time in square brackets, for example [6 s], is a cue: say the next words when the picture reaches that second. Do not read the cue aloud.
- Each picture is a GIF that starts when the slide opens and then loops. The first loop carries the story. When you talk longer than one loop, the later words refer to the last frame, which shows the whole picture.
- The times come from the GIF frames. They can be off by half a second.
- Speak at about 130 words a minute. If a lecturer interrupts, answer in two or three sentences, say "I will continue", and go on. Cut words, not slides.

| Order | Speaker | Slides | Time |
|---|---|---|---|
| 1 | LIU ZIYANG | 1 to 8 | 7 min |
| 2 | LU YI | 9 to 12 | 4.5 min |
| 3 | LI ZHUOYANG | 13 to 16 | 4.5 min |
| 4 | HE RONG | 17 to 23 | 8 min |
| 5 | PENG XUJIAN | 24, the live demo | 7 min |
| | everyone | 25, questions | the rest |

---

## LIU ZIYANG: slides 1 to 8, about 7 minutes

You designed the service boundaries and the contracts, and you built the session service. In the questions, you answer about the overview, the plan and the logical architecture.

### Slide 1: Lumen Platform

- Outline item: none (title slide)
- Speaker: LIU ZIYANG
- Time: 25 s

**What is on the screen.** A black slide with no picture. At the top, in grey: "Architecting Scalable Systems · Team 15". In the middle, in large white letters: "Lumen Platform". Under it, in grey: "An AI for research, built as a scalable platform". Lower down, the five names: He Rong, Li Zhuoyang, Liu Ziyang, Lu Yi, Peng Xujian. At the bottom, in grey monospace: the public address `lumen.54-179-112-87.sslip.io`.

**What happens, in order.** Nothing moves.

**What to say.**

> Good morning. We are Team 15, and this is Lumen Platform. We follow the order of the presentation outline. The number at the top left of each slide is the item of the outline that the slide answers. The address at the bottom is live. You can open it during the talk.

**Point at.**
1. The title, "Lumen Platform".
2. The address at the bottom.

**If asked.**
- *Is the address live now?* Yes. It is the public server on AWS, and we use it in the live demo at the end.

### Slide 2: What Lumen does

- Outline item: 1a · Context and business problem
- Speaker: LIU ZIYANG
- Time: 80 s

**What is on the screen.** A real screencast of the Lumen web app, recorded on 22 October with gpt-4.1. It is 46 s long. The app is black and white. At first you see the home page: the greeting "Good afternoon, Ada.", a text box, and a list of recent questions under it; a large dotted globe is on the right. Then the run page opens. The run page has two halves:

- On the left: the question at the top, then the work of the agent: "Thinking", the arXiv search with a list of papers, and "Delegated 3 in parallel" with three reader rows.
- On the right, from top to bottom: "Findings" with a count, "Files", "Call tree", and "Sessions". The call tree shows "lumen" (the lead agent) and, under it, "reader 1", "reader 2" and "reader 3". Each row shows its cost in dollars and its state, "Running" or "Finished".

At the top of the run page, a bar shows the project name, the state, the money spent and the time elapsed.

**What happens, in order.**
- 0 s: the home page. The question is typed into the box: search arXiv for papers on retrieval-augmented generation, delegate to three reader agents in parallel, and record the title, year and main idea of each paper as a finding.
- 5 s: the run page opens. The lead agent shows "Thinking". The call tree has one row: "lumen", $0.0028, Running.
- 11 s: the arXiv search results appear on the left, with paper ids. "Delegated 3 in parallel" shows three readers. The call tree grows: reader 1, reader 2 and reader 3 appear under lumen, each at $0.0015, Running.
- 15 s: the view opens reader 1's own task: its instruction is to read the abstract of one paper.
- 23 s: reader 1 finishes at $0.0082. "Findings" goes to 1: the OptGraph paper, "Recorded by reader 1".
- 26 s: reader 2 finishes at $0.0086. Findings goes to 2: the BRIDGE paper.
- 30 s: findings goes to 3: the OptiChat paper, recorded by reader 3.
- About 35 s: the lead agent, lumen, shows Finished at $0.0401. The picture holds to 46 s, then loops.

**What to say.**

> [0 s] We built Lumen, an AI that helps with research. What you see here is a real run, recorded on 22 October with gpt-4.1. We ask for three key papers on retrieval-augmented generation.
>
> [5 s] Here, on the right, is the call tree. This first row is the lead agent, with its cost.
>
> [11 s] Now the lead agent searches arXiv. You can see the papers on the left. Then it hands one paper each to three reader agents. Here they are in the call tree: reader one, reader two, reader three. They work in parallel.
>
> [23 s] Each reader records its paper as a finding. Here, at the top right, the findings count goes up: one, two, three. Every task shows what it cost.
>
> [35 s] When the readers are done, the lead agent finishes. The whole run cost about four cents.
>
> So that is Lumen: a research AI. For this course, we turned it into a platform. Other apps can use the same research AI through one public API. Now I show you who uses it.

**Point at.**
1. The call tree on the right, when the three reader rows appear.
2. The findings count at the top right, when it goes from 1 to 3.
3. The cost on the lumen row at the end, $0.0401.

**If asked.**
- *Is this recording real or a mock-up?* It is a real run of the Lumen web app on 22 October, with the model gpt-4.1. The papers, the costs and the findings on the screen are the real output.
- *Why make it a platform?* So that other apps can use the research AI without building it again. Our second app, the literature watch, uses only the public API.

### Slide 3: Producers and consumers

- Outline item: 1b · Platform thinking
- Speaker: LIU ZIYANG
- Time: 55 s

**What is on the screen.** A diagram in three columns, 23 s per loop.

- Left: a stick figure, "Producer", with "agent author" under it.
- Middle: a large frame, "Lumen platform". Inside it, at the top, a box "Agent registry: the agents that producers publish". Under it, a box "Run engine", with the line "the session, worker and billing services" and three small boxes: "call tree", "steps and cost", "budget cap".
- Right: the label "Consumers", with a box "Literature watch app" and, under it, a box "Web app" with a stick figure "People".

At the end, arrows join them: "publish an agent" from the producer to the registry; "the agent's instructions" from the registry down to the run engine; "ask with an API key" from the watch app; "ask, signed in" from the web app; and back to the consumers, "answer + findings + cost" and "the run, live".

**What happens, in order.**
- 0 s: "Producers and consumers around the Lumen platform". Everything is shown.
- 2.4 s: "Producers: an agent author publishes agents to the registry". The producer and the registry light up.
- 5.8 s: "Consumers: an app asks with an API key; people ask in the web app". The watch app and the web app light up.
- 10.1 s: "The run engine takes the agent's instructions". The arrow from the registry to the run engine appears.
- 12.6 s: "Each question runs as a call tree". The box "call tree" lights up.
- 14.0 s: "Each step is recorded with its cost". The box "steps and cost" lights up.
- 15.4 s: "Every step stays under the account's budget cap". The box "budget cap" lights up.
- 16.7 s: "The answer, findings and cost go back; people watch the run live". The consumers light up.
- 20.8 s: "The Lumen platform between producers and consumers". All arrows show. Loop at 23.4 s.

**What to say.**

> [0 s] The platform sits between two groups of users.
>
> [2.4 s] On the left is the producer, the agent author. A producer publishes agents to this registry.
>
> [5.8 s] On the right are the consumers. An app, like our literature watch, asks with its API key. People ask in the web app after they sign in.
>
> [10.1 s] In the middle is the run engine. It takes the agent's instructions, and it runs each question as a call tree.
>
> [14 s] It records each step with its cost. And it keeps every step under the account's budget cap.
>
> [16.7 s] The answer, the findings and the cost go back.
>
> So a new app does not build any of this again. Our literature watch app is about 210 lines of code.

**Point at.**
1. The producer on the left and the registry.
2. The run engine and its three boxes.
3. The two consumers on the right.

**If asked.**
- *What exactly does a new app save?* The literature watch has no database, no model calls and no billing of its own. The platform gives it sign-in and keys, the agent runtime, the cost cap and approvals, and scaling.

### Slide 4: Use cases

- Outline item: 1c · Scope
- Speaker: LIU ZIYANG
- Time: 40 s

**What is on the screen.** A UML use case diagram, 23 s per loop. A frame, "Lumen platform", is the system boundary. Inside it are six ovals:

- Left column: "UC1 Publish an agent" and "UC5 Read usage".
- Right column: "UC2 Ask a question", "UC6 Watch the literature", "UC3 Manage API keys", "UC4 Approve spend over cap".

Four actors stand outside: on the left, "Producer (agent author)" at the top and "Operator" at the bottom; on the right, "Literature watch app" at the top and "People in the web app" at the bottom.

**What happens, in order.**
- 0 s: "Four actors and the system boundary of the Lumen platform".
- 2.4 s: "The producer publishes an agent (UC1) and reads usage (UC5)". The producer and those two ovals light up; lines join them.
- 7.2 s: "The literature watch app asks (UC2) and watches the literature (UC6)".
- 12.0 s: "People in the web app manage API keys (UC3) and approve spend (UC4)".
- 16.8 s: "The operator reads usage too (UC5)".
- 20.1 s: "Use case diagram: six use cases and four actors". Every line shows. Loop at 22.6 s.

**What to say.**

> [0 s] This is the UML use case diagram of the platform. The frame is the system boundary. We take one actor at a time.
>
> [2.4 s] Here, the producer publishes an agent, and reads its usage.
>
> [7.2 s] The literature watch app asks a question, and watches the literature.
>
> [12 s] People in the web app manage their API keys. When a question needs more money than the budget cap, they approve the spend.
>
> [16.8 s] The operator reads usage too.
>
> [20.1 s] Six use cases and four actors. All six use cases are built, and they run on the public server.

**Point at.**
1. The producer and UC1.
2. The two actors on the right and their four ovals.
3. The whole diagram at the end.

**If asked.**
- *Who is the operator?* The operator is our team, with staff accounts. The operator reads usage for every account and every agent.
- *What does "approve spend over cap" mean?* When a question would pass the account's budget cap, it waits. A person approves the extra spend in the web app, and the question goes on.

### Slide 5: Plan and effort

- Outline item: 2a · 2b · Status, milestones and effort
- Speaker: LIU ZIYANG
- Time: 35 s

**What is on the screen.** A Gantt chart, 9 s per loop. Five rows, one for each member, each with "80 h" at the left:

- Liu Ziyang: architecture, then session service.
- Lu Yi: identity, gateway, then public API.
- Peng Xujian: projects, then second app, usage.
- Li Zhuoyang: worker, queue, then KEDA autoscaling.
- He Rong: billing, then Kubernetes, pipeline, then load tests.

The axis at the bottom shows the working days 8, 9, 12, 13, 14, 15, 16, 19, 20, 21, "October 2026".

**What happens, in order.**
- 0 s: "1. The proposal's plan: ten days for each member, 8 to 21 October". All bars are grey.
- 2.8 s: "2. Contracts first, then the services, then scale and the pipeline". A white cursor line moves along the days, and each bar lights up as the cursor reaches it.
- 5.9 s: "3. Gantt chart: all tasks done and deployed to AWS by 21 October". Every bar shows a check mark. Loop at 9.0 s.

**What to say.**

> [0 s] This is the plan from our proposal. Each member has ten person-days, from 8 to 21 October.
>
> [2.8 s] We did the architecture and the service contracts first. Then each member built a service. Then came autoscaling, the public API and the pipeline.
>
> [5.9 s] Here you see a check on every bar. Every part is built, and it runs on AWS. Each member spent about ten person-days, which is 80 hours. That is 400 hours in total, as the proposal planned.

**Point at.**
1. The "80 h" column on the left.
2. The check marks on the last frame.

**If asked.**
- *How did you track the effort?* We worked to the work breakdown of the proposal, with ten person-days for each member. The table on this slide is that plan, and every item on it is done.
- *Who did what?* Each row is one member and the parts that member built. Each member presents those parts today.

### Slide 6: Logical architecture decisions

- Outline item: 3a · Key architectural decisions
- Speaker: LIU ZIYANG
- Time: 55 s

**What is on the screen.** Three columns, labelled AD-01, AD-02 and AD-04, each drawn as a "before" and an "after". 23 s per loop.

- AD-01, left: at first a box "one process: Lumen" with five rows: modules/identity, modules/projects, modules/session, modules/steering, modules/billing. After: five service boxes, identity, project, session, worker and billing, each next to its module. Caption: "Five services, one per module / one image, an entry point per service".
- AD-02, middle: at first "session" with an arrow "direct HTTP call" to "worker". After: a queue of cells, "RabbitMQ queue of jobs", between session and three worker boxes. Caption: "A durable queue, not a direct call / a slow model call never holds a request".
- AD-04, right: at first "worker" with a line "writes each step" down to "steps PostgreSQL". After: worker, then "session", then the steps, with "sends each step" and "the only writer". Caption: "Only session writes the steps / a worker that dies loses no step".

**What happens, in order.**
- 0 s: "AD-01 before: five modules in one Lumen process".
- 1.8 s: "AD-01 after: each module becomes a service".
- 5.4 s: "AD-02 before: session calls a worker directly".
- 7.0 s: "AD-02 after: a durable queue replaces the direct call".
- 9.5 s: "AD-02: more workers can start, and any worker takes the next job". Jobs move through the queue, and two more worker boxes appear.
- 13.7 s: "AD-04 before: the worker writes each step to the database".
- 15.3 s: "AD-04 after: each step goes through session".
- 18.9 s: "AD-04: session is the only writer of the steps".
- 21.6 s: "Three key decisions of the logical design". Loop at 23.2 s.

**What to say.**

> [0 s] Now 3, the logical architecture. Here are our three key decisions, each as before and after.
>
> [1.8 s] AD-01. Each module of Lumen becomes a service. Every service uses the same image, with its own entry point.
>
> [5.4 s] AD-02. Before, session calls a worker directly.
>
> [7 s] Here a durable queue replaces the direct call. A slow model call never holds a web request.
>
> [9.5 s] More workers can start behind the queue. Any worker can take the next job.
>
> [13.7 s] AD-04. Before, the worker writes each step to the database itself.
>
> [15.3 s] Now each step goes through session.
>
> [18.9 s] Session is the only writer of the steps. So a worker that dies loses no step.

**Point at.**
1. The five service boxes in the AD-01 column.
2. The queue cells between session and the workers in AD-02.
3. "the only writer" in AD-04.

**If asked.**
- *Why five services and not the eight in the proposal?* The five follow the modules that already had clear ports and tests, which is AD-01. The live stream runs inside session, and model calls go through the worker's model module, which prices each call.
- *Why does the worker report steps over HTTP and not write to the database?* Session is the only writer of the steps, so a worker that dies loses no step. The cost roll-up and the budget checks also stay in one place.

### Slide 7: Logical architecture

- Outline item: 3b · Logical architecture
- Speaker: LIU ZIYANG
- Time: 65 s

**What is on the screen.** A UML component diagram in four tiers, from top to bottom, 25 s per loop. The tier names are on the left: clients, edge, services, data.

- clients: "Web app" and "Literature watch app".
- edge: one wide box, "API gateway (Traefik)".
- services: five boxes, from left to right: "Identity: sign-in, API keys", "Project: projects, registry", "Session: the call tree", "Worker: the agent loop", "Billing: the budget cap".
- data: "RabbitMQ AMQP" and "Model external API", and under them one wide box, "PostgreSQL: one database, tables per context".

Dashed arrows point down from each tier to the next. Dashed arrows go from Project to Session and from Worker to Session. During the run, small white tags move along the lines: "question", "job", "prompt", "step", "answer".

**What happens, in order.**
- 0 s: "Four tiers: clients, the API gateway, five services, the data".
- 1.6 s: "Clients depend on the API gateway".
- 3.9 s: "The gateway routes to the five services".
- 6.2 s: "Project and worker call session's internal routes".
- 8.5 s: "Services depend on PostgreSQL, RabbitMQ and the model".
- 11.9 s: "Run time: the watch app asks a question". A "question" tag goes from the watch app to the gateway.
- 14.0 s: "Project passes the question to session". The tag goes from Project to Session.
- 14.9 s: "Session puts a job on the queue; a free worker takes it". A "job" tag goes to RabbitMQ.
- 16.6 s: "The worker calls the model". A "prompt" tag goes from Worker to the model.
- 18.4 s: "Each step goes back to session, which saves it". A "step" tag goes from Worker to Session.
- 20.1 s: "The app reads the answer". An "answer" tag goes up from Session to the gateway.
- 22.6 s: "Component diagram: five services behind the Traefik API gateway". Loop at 24.9 s.

**What to say.**

> [0 s] This is the logical architecture. It has four tiers, and every dependency points down.
>
> [1.6 s] The clients see only one thing, the API gateway.
>
> [3.9 s] The gateway routes to five services.
>
> [6.2 s] Only Project and Worker call session's internal routes.
>
> [8.5 s] The services depend on PostgreSQL, RabbitMQ and the model.
>
> [11.9 s] Now follow the white tag at run time. The watch app asks a question.
>
> [14 s] Project passes the question to session. Session puts a job on the queue, and a free worker takes it.
>
> [16.6 s] The worker calls the model.
>
> [18.4 s] Each step goes back to session, which saves it.
>
> [20.1 s] And the app reads the answer.
>
> The queue lets the worker scale on its own. The proposal listed eight services. Traefik is the gateway, the live stream runs inside session, and the model client runs inside the worker. So five services remain, each with one purpose and its own tables.

**Point at.**
1. The gateway box, the one door for the clients.
2. The white tag as it moves: question, job, prompt, step, answer.
3. RabbitMQ between Session and Worker.

**If asked.**
- *Why can session not scale like the worker?* Session runs one replica with the Recreate strategy, so two kernels never run at the same time during a rollout. The heavy work is the agent loop, and that runs in the workers, which scale from one to four on the queue.
- *How do services trust each other?* Every internal route checks a shared internal key, and Traefik never routes internal paths from outside.

### Slide 8: Bounded contexts

- Outline item: 3c · Domain-driven design
- Speaker: LIU ZIYANG
- Time: 65 s

**What is on the screen.** A DDD context map, 26 s per loop.

- At the top, a chain of four boxes with arrows: "use cases UC1 to UC6" → "nouns users say: agent, question, step, budget cap" → "5 bounded contexts" → "their aggregates".
- Under the chain, five context boxes. Left: "Project" (Project, Finding; Agent registry: Agent, QuestionIntent) and, under it, "Identity" (Account, ApiKey). Middle: "«core domain» Session" (Session, the root; its tree of Tasks; Step, a value). Right: "Worker" (the agent loop; it keeps no state) and, under it, "Billing" (Wallet, LedgerEntry, Approval).
- Arrows with event names: "question asked" from Project to Session; "finding recorded" from Session to Project; "account, API key" up from Identity to Project; "job queued" from Session to Worker; "step recorded" from Worker to Session; "spend recorded" and "approval needed" from Session to Billing.

**What happens, in order.**
- 0 s: "How we found the contexts". The chain at the top builds up, one box at a time.
- 2.8 s: "Five bounded contexts, each with its own aggregates". The five boxes appear.
- 5.1 s: "Project sends question asked and receives finding recorded".
- 9.6 s: "Identity is upstream: it says who asks, with which API key".
- 12.6 s: "Worker receives job queued and sends step recorded".
- 17.1 s: "Billing receives spend recorded and approval needed".
- 21.5 s: "Session, the core domain: every domain event goes through it". Session lights up, and all its arrows are white.
- 24.2 s: "Context map: five bounded contexts and six domain events". Loop at 26.4 s.

**What to say.**

> [0 s] Here is how we found the contexts. From the six use cases, we took the nouns that users say: agent, question, step, budget cap. We grouped them where one word keeps one meaning. That gave five bounded contexts, and their aggregates.
>
> [5.1 s] Project sends "question asked", and receives "finding recorded".
>
> [9.6 s] Identity is upstream. It says who asks, and with which API key.
>
> [12.6 s] The worker receives "job queued" and sends "step recorded". It keeps no state.
>
> [17.1 s] Billing receives "spend recorded" and "approval needed".
>
> [21.5 s] Session comes last, because every domain event goes through it. Session is our core domain.
>
> The contexts talk to each other only through domain events. Each arrow shows who sends and who receives.
>
> That is our logical architecture. LU YI built identity, the gateway, the API keys and the public API. LU YI will now show how apps use the platform, and where it runs.

**Point at.**
1. The chain at the top: use cases, nouns, contexts, aggregates.
2. Session in the middle, "«core domain»".
3. The event names on the arrows.

**If asked.**
- *How did you choose the aggregates?* We took as an aggregate what one transaction must keep consistent. A call tree rolls up its cost, and a wallet never passes its budget cap without an approval.
- *Why is Session the core domain?* Every domain event goes through it, and it owns the call tree, which is what makes Lumen different. The other contexts support it.

**Handover.** "That is our logical architecture. LU YI built identity, the gateway, the API keys and the public API. LU YI will now show how apps use the platform, and where it runs."

---

## LU YI: slides 9 to 12, about 4.5 minutes

You built identity, the gateway, HTTPS, the rate limits, the API keys and the public API v1. In the questions, you answer about the public API, security and the deployment.

### Slide 9: Public API flow

- Outline item: 3c · Producers and consumers
- Speaker: LU YI
- Time: 70 s

**What is on the screen.** A UML sequence diagram, 25 s per loop. Three lifelines with boxes at the top: on the left "Consumer app: literature watch", in the middle "Lumen platform: API v1", on the right "Producer: agent author". A bracket on the far left marks each phase: "producer", "consumer", then "producer" again. Seven numbered calls, each with a dashed return arrow:

1. POST /api/v1/keys (producer to platform)
2. POST /api/v1/agents (producer to platform)
3. GET /api/v1/agents (consumer to platform)
4. POST /api/v1/questions (consumer to platform)
5. "runs the agent on the question" (a self-call on the platform)
6. GET /api/v1/questions/:id (consumer to platform)
7. GET /api/v1/usage (producer to platform)

**What happens, in order.**
- 0 s: "Producers and consumers use one public API".
- 2.2 s: "The producer phase".
- 3.5 s: "1. A producer creates an API key".
- 5.8 s: "2. The producer publishes an agent".
- 8.2 s: "The consumer phase".
- 9.5 s: "3. A consumer lists the agents".
- 11.8 s: "4. The consumer asks with a chosen agent".
- 14.1 s: "5. The platform runs the question".
- 16.2 s: "6. The consumer reads the answer, findings and cost".
- 18.5 s: "The producer phase" again.
- 19.9 s: "7. The producer and the operator read usage".
- 22.2 s: "Sequence diagram: producer and consumer calls on the public API v1". Loop at 24.8 s.

**What to say.**

> Now the rest of 3c: how producers and consumers use the platform. This sequence diagram shows real calls on our public API, version 1, in the order they happen.
>
> [2.2 s] First, the producer. Here, at the top right, the producer creates an API key. Then it publishes an agent.
>
> [8.2 s] Now the consumer, on the left. It lists the agents. Then it asks a question with one of them.
>
> [14.1 s] The platform runs the agent on the question.
>
> [16.2 s] The consumer reads the answer, the findings and the cost.
>
> [18.5 s] Last, the producer reads usage. The operator can read it too.
>
> [22.2 s] So publish, list, ask and read all use one API. An app needs nothing else. An API key is stored only as a SHA-256 hash. It has five scopes. Each key can make 60 requests a minute, with a burst of 20. After that, the platform answers 429.

**Point at.**
1. Call 1 and call 2, the producer phase.
2. Call 4, the question.
3. Call 7, usage.

**If asked.**
- *Why API keys and not JWT?* A key can be revoked at once, and a lookup for each request is cheap at this size. An app can store, scope and revoke a key without a password.
- *What happens when an app sends too many requests?* The API key check answers 429 with a Retry-After header. The literature watch waits for that time and then asks again.

### Slide 10: Physical architecture decisions

- Outline item: 4a · Key architectural decisions
- Speaker: LU YI
- Time: 65 s

**What is on the screen.** Three columns, labelled AD-09, AD-11 and AD-06, each drawn as before and after. 25 s per loop.

- AD-09, left: at first "Helm chart" above an "«AWS» EKS cluster" with a "managed control plane" and three "EC2" nodes. After: one node "EC2 t3.medium, 2 vCPU, 4 GB", with "k3s" inside it and nine small boxes: identity, project, session, worker, billing, postgres, rabbitmq, traefik, keda. A dashed arrow "same chart" goes from the Helm chart to a box "EKS". Caption: "k3s on one EC2 t3.medium, not EKS / the same Helm chart; about USD 1.3 a day".
- AD-11, middle: two panels. "HPA: CPU above 70%" with a CPU bar and pod rows for identity, project and billing. "KEDA: 5 jobs per worker" with a row of job cells, a worker pod row and a CPU bar. Caption: "HPA on CPU; KEDA on queue length / a worker waits on the model, so its CPU is low".
- AD-06, right: at first four database cylinders: identity DB, project DB, session DB, billing DB. After: one cylinder "PostgreSQL" with four frames inside: identity, project, session, billing. Caption: "One PostgreSQL, tables per context / one transaction: step, cost, ledger entry".

**What happens, in order.**
- 0 s: "AD-09, before: the proposal put the chart on an EKS cluster".
- 2.1 s: "AD-09, after: the cluster shrinks to one EC2 node, with k3s on it".
- 5.5 s: "AD-09: the same Helm chart installs on either one".
- 8.5 s: "AD-11: CPU passes 70%, so HPA adds identity, project and billing pods". The CPU bar fills, and each row grows from one pod to three.
- 11.7 s: "AD-11: jobs wait, so KEDA adds workers; their CPU stays low". The job cells fill, and the worker row grows to four pods while its CPU bar stays short.
- 16.2 s: "AD-06, before: a database for each service".
- 17.8 s: "AD-06, after: one PostgreSQL; each context keeps its own tables".
- 20.1 s: "AD-06: one transaction writes the step, its cost and the ledger entry". The session and billing frames light up together.
- 22.5 s: "Physical architecture decisions AD-09, AD-11 and AD-06". Loop at 25.5 s.

**What to say.**

> Now 4, the physical architecture. Three decisions shape it.
>
> [0 s] AD-09. Our proposal put the Helm chart on an EKS cluster.
>
> [2.1 s] Here the cluster shrinks to one EC2 t3.medium, with k3s on it. It costs about 1.3 US dollars a day.
>
> [5.5 s] The same Helm chart installs on either one. So the chart can still go to EKS.
>
> [8.5 s] AD-11. Two autoscalers watch two kinds of load. When CPU passes 70 percent, HPA adds identity, project and billing pods.
>
> [11.7 s] The worker is different. Here the jobs wait, and KEDA adds workers, but their CPU stays low. A worker waits on the model, so we scale it on the queue length with KEDA.
>
> [16.2 s] AD-06. The proposal had a database for each service.
>
> [17.8 s] We run one PostgreSQL. Each context keeps its own tables.
>
> [20.1 s] So one transaction writes the step, its cost and the ledger entry together.

**Point at.**
1. The arrow "same chart" to EKS.
2. The worker row in AD-11 that grows while its CPU bar stays short.
3. The session and billing frames inside one PostgreSQL.

**If asked.**
- *Why not EKS, as in the proposal?* One t3.medium with k3s costs about USD 1.3 a day while it runs, and k3s ships the same Traefik, storage and metrics-server as our laptop cluster. The chart does not change, so the same chart installs on EKS.
- *Why scale the worker on queue length and not on CPU?* A worker waits on the model most of the time, so its CPU stays low while the queue grows. The queue shows the agent load first.

### Slide 11: Deployment diagram

- Outline item: 4b · Physical architecture
- Speaker: LU YI
- Time: 70 s

**What is on the screen.** A UML deployment diagram, 22 s per loop.

- A large 3D node: "«AWS» EC2 t3.medium · ap-southeast-1". At its foot: "security group: 22, 80, 443 open".
- Inside it, a node "«Kubernetes» k3s cluster", "namespace lumen".
- Inside k3s, on the left: "Traefik: ingress, HTTPS, rate limit". On the right, a top row of five service pods with their replica ranges: "identity 1-3 HPA", "project 1-3 HPA", "session 1", "worker 1-4 KEDA", "billing 1-3 HPA". A bottom row: "PostgreSQL: StatefulSet + 2Gi volume", "RabbitMQ: StatefulSet", "KEDA: autoscaler".
- Outside the node, on the left: "«device» Browser", "«client» Watch app", "«CI/CD» GitHub Actions". At the top right: "OpenAI API".
- Lines: "HTTPS 443" from the browser and the watch app to Traefik; "SSH 22" from GitHub Actions into k3s; "HTTPS" from the worker up to the OpenAI API.

**What happens, in order.**
- 0 s: "One AWS node: an EC2 t3.medium in Singapore". The node draws itself.
- 2.0 s: "k3s runs inside it, in the namespace lumen".
- 3.7 s: "Inside k3s: Traefik and the five service pods".
- 6.2 s: "PostgreSQL and RabbitMQ as StatefulSets, and KEDA".
- 7.9 s: "Outside the node: the clients, CI/CD and the model API". The outside nodes and their lines appear.
- 11.4 s: "HTTPS on 443 to Traefik, which routes to the service pods". The browser, the watch app, Traefik and the five pods light up.
- 14.2 s: "GitHub Actions deploys over SSH 22 into k3s".
- 16.5 s: "The worker pod calls the OpenAI API over HTTPS".
- 18.9 s: "UML deployment diagram: the platform in k3s on one EC2 node". Loop at 21.9 s.

**What to say.**

> [0 s] This is the UML deployment diagram. The whole platform runs on one AWS node, an EC2 t3.medium in Singapore.
>
> [2 s] k3s runs inside it.
>
> [3.7 s] Inside k3s, you see Traefik and the five service pods. Under each pod is its replica range. Identity, project and billing run one to three pods with HPA. The worker runs one to four with KEDA. Session runs one.
>
> [6.2 s] PostgreSQL and RabbitMQ run as StatefulSets. PostgreSQL has a 2 gigabyte volume. KEDA runs here too.
>
> [11.4 s] Users reach the platform only over HTTPS, on port 443. Traefik ends HTTPS with a Let's Encrypt certificate, and it routes by path to the service pods.
>
> [14.2 s] GitHub Actions deploys over SSH, on port 22.
>
> [16.5 s] And only the worker pod talks to the OpenAI API.
>
> Here, at the bottom of the node, you can see the security group. Only ports 22, 80 and 443 are open.

**Point at.**
1. The replica ranges under the pods.
2. The "HTTPS 443" line into Traefik.
3. "security group: 22, 80, 443 open" at the bottom.

**If asked.**
- *What if the IP address changes?* The host name comes from the Elastic IP on sslip.io, so the IP stays fixed while the instance lives. The certificate is a real Let's Encrypt certificate for that name.
- *Why is port 80 open?* Traefik redirects HTTP on port 80 to HTTPS. All traffic to the services goes over HTTPS on 443.

### Slide 12: Pods on the server (recorded)

- Outline item: 4b · Recorded on the server
- Speaker: LU YI
- Time: 65 s

**What is on the screen.** A terminal recording on the real public server, black with white text, 10.5 s long. Each command line starts with the grey prompt "lumen $".

1. `kubectl get pods -n lumen`. The answer lists seven pods, each "1/1 Running" with 0 restarts: billing, identity, postgres-0, project, rabbitmq-0, session, worker.
2. `kubectl get hpa -n lumen`. The answer lists four autoscalers: billing, identity and project with "cpu: 2%/70%", min 1, max 3; and "keda-hpa-worker" for the worker with "0/5 (avg)", min 1, max 4.

**What happens, in order.**
- 0 s: the first command is typed.
- 2.9 s: the list of seven pods appears.
- About 4 s: the second command is typed.
- 6.5 s: the autoscaler table appears. The picture holds to 10.5 s, then loops.

**What to say.**

> This is a recording of the real server. We run kubectl on the server over SSH, because the Kubernetes API is not public.
>
> [2.9 s] Here are the pods. You can see the five services: billing, identity, project, session and worker. You also see PostgreSQL and RabbitMQ. All of them are running.
>
> [6.5 s] And here are the autoscalers. HPA watches CPU for identity, project and billing, with a target of 70 percent and up to three pods. The last line is KEDA for the worker. It compares the waiting jobs with a target of five per worker, and it allows up to four workers.
>
> That is where the platform runs. LI ZHUOYANG built the worker service, the job queues and the KEDA autoscaling. LI ZHUOYANG will now show the queue design, one use case in detail, and what happens when a worker dies.

**Point at.**
1. The column "Running" in the pod list.
2. The line "keda-hpa-worker" with "0/5 (avg)" and max 4.

**If asked.**
- *Why can we not reach kubectl directly?* The Kubernetes API is not public. The security group opens only 22, 80 and 443, so we run kubectl on the host over SSH.
- *Where is Traefik in this list?* Traefik comes with k3s, so it runs outside our namespace. This list shows only the namespace lumen.

**Handover.** "That is where the platform runs. LI ZHUOYANG built the worker service, the job queues and the KEDA autoscaling. LI ZHUOYANG will now show the queue design, one use case in detail, and what happens when a worker dies."

---

## LI ZHUOYANG: slides 13 to 16, about 4.5 minutes

You built the worker service, the job queues and the KEDA autoscaling of the workers. In the questions, you answer about the queues, the worker and availability.

### Slide 13: Decision: one queue per tree level

- Outline item: 4a · Key architectural decision
- Speaker: LI ZHUOYANG
- Time: 85 s

**What is on the screen.** A queue diagram and a wait-for graph, 27 s per loop.

- Left: at first a label "one shared queue" with a long row of cells, then two boxes "worker 1" and "worker 2". White tags move through it: "lead" and "reader".
- Right, after a few seconds: a panel "waits for" with three boxes, "lead", "reader" and "worker", and the arrows between them: "waits for" (lead to reader), "waits for a free worker" (reader to worker), "busy with" (worker to lead).
- After the fix, the left side shows "a queue per level; each worker runs one job per level": three rows, "level 0 lumen.turns.0", "level 1 lumen.turns.1", "level 2 lumen.turns.2", and each worker has three boxes, one per level.

**What happens, in order.**
- 0 s: "AD-03: one shared queue; two questions start two lead agents".
- 1.5 s: "Each worker runs one job, and each takes a lead".
- 3.1 s: "Each lead starts three readers and holds its worker while it waits". Six reader tags fill the queue.
- 5.0 s: "A lead waits for its readers". The wait-for panel appears.
- 7.5 s: "A reader waits for a free worker".
- 9.6 s: "Every worker is busy with a lead".
- 11.7 s: "The waits close into a cycle, so no question can finish". Dots run round the triangle.
- 14.6 s: "The fix: a queue per level; each worker runs one job per level". The one queue splits into three.
- 17.1 s: "A reader no longer waits behind a lead, so the cycle breaks". The arrow "waits for a free worker" fades.
- 18.5 s: "The readers run beside the leads".
- 23.5 s: "Level 2 stays empty: readers do not delegate". The text "6 of 6 readers done" shows.
- 24.9 s: "With a queue per level, all questions finish". Both leads get a check mark, and "all questions finish" shows. Loop at 26.9 s.

**What to say.**

> Thank you. I start with AD-03, a deadlock that we found in design, before it could happen.
>
> [0 s] Here is one shared queue for all jobs. Two questions start two lead agents.
>
> [1.5 s] Each worker runs one job, and each worker takes a lead.
>
> [3.1 s] Each lead starts three reader agents. And it holds its worker while it waits for them.
>
> [5 s] Now look at the panel on the right. A lead waits for its readers.
>
> [7.5 s] A reader waits for a free worker.
>
> [9.6 s] But every worker is busy with a lead.
>
> [11.7 s] So the waits close into a cycle. No question can finish.
>
> [14.6 s] Our fix is a queue for each level of the call tree. Each worker runs one job of each level.
>
> [17.1 s] Now a reader no longer waits behind a lead. The cycle breaks.
>
> [18.5 s] The readers run beside the leads. The deepest level never waits, so the work always drains.
>
> [24.9 s] The leads write their answers, and every question finishes. In the real system, each worker runs up to four jobs of each level, and KEDA watches all three queues.

**Point at.**
1. The triangle on the right when it closes into a cycle.
2. The three queues, level 0, level 1 and level 2.
3. The check marks on the leads at the end.

**If asked.**
- *How many jobs can one worker run?* Four of each level at a time. LUMEN_WORKER_SLOTS sets it, and RabbitMQ gives each channel that many jobs at a time.
- *What runs on level 2?* Level 2 takes depth 2 and deeper. A reader does not delegate in this example, so level 2 stays empty here.

### Slide 14: UC2 sequence diagram

- Outline item: 4d · Detailed design
- Speaker: LI ZHUOYANG
- Time: 70 s

**What is on the screen.** A UML sequence diagram, 18 s per loop. The title on the picture is "UC2: ask a question with a chosen agent". Seven lifelines, from left to right: Watch app, project, session, PostgreSQL, RabbitMQ, worker, OpenAI API. The messages, from top to bottom:

- POST /api/v1/questions (Watch app to project), then "check the API key" (project to itself).
- POST /internal/directory/start (project to session).
- publish lumen.turns.0 (session to RabbitMQ).
- A frame "par" with two lanes. Upper lane: "201 {sessionId}" back to the watch app; GET /api/v1/questions/:id to session; "200 {status, answer, findings, cost}" back. Lower lane: "consume" (RabbitMQ to worker), then a frame "loop [each step]": "chat completion" (worker to OpenAI API), "POST /internal/turns/:id/step" (worker to session), "INSERT steps" (session to PostgreSQL).
- A note at the lower left: "Every call of the app passes Traefik, the API gateway".

**What happens, in order.**
- 0 s: "UC2: ask a question with a chosen agent". The lifelines are grey.
- 1.6 s: "The app sends the question; project checks the key".
- 3.5 s: "Session starts the question and puts the first job on the queue".
- 5.4 s: "par: from here, two lanes run at the same time". The par frame and the note appear.
- 6.7 s: "The app gets 201 at once, while a worker takes the job".
- 8.7 s: "The app reads the answer while the worker runs its steps".
- 12.0 s: "loop: the worker runs one step after another".
- 15.2 s: "The app gets 201 at once and reads the answer while the worker runs". Loop at 18.4 s.

**What to say.**

> Now 4d, the detailed design of one use case: an app asks a question with a chosen agent. That is UC2 in our use case diagram.
>
> [1.6 s] The watch app sends the question. Project checks the API key.
>
> [3.5 s] Session starts the question. It puts the first job on the first queue, level zero.
>
> [5.4 s] From this moment, two lanes run at the same time.
>
> [6.7 s] In the upper lane, the app gets 201 at once. In the lower lane, a worker takes the job.
>
> [8.7 s] The app reads the answer whenever it likes.
>
> [12 s] Meanwhile the worker runs its steps in a loop. It calls the model, and it sends each step to session. Session saves the step in PostgreSQL.
>
> So nothing waits on the model inside a web request. And as the note says, every call of the app passes Traefik, the gateway.

**Point at.**
1. "publish lumen.turns.0".
2. The "par" frame and its two lanes.
3. The "loop [each step]" frame at the bottom right.

**If asked.**
- *How do the agent's instructions reach the worker?* The question first writes a row that names the agent. The worker reads it with the first job and puts the agent's instructions in front of the question.
- *What does the app get back at once?* It gets 201 with the session id. It then reads the status, the answer, the findings and the cost with GET /api/v1/questions/:id.

### Slide 15: UC2 through the public API (recorded)

- Outline item: 4d · Recorded through the API
- Speaker: LI ZHUOYANG
- Time: 50 s

**What is on the screen.** A terminal recording on the public server, 23 s long, with the prompt "lumen $". The API key never shows; the commands show only "$AUTH".

1. `curl -s "$API/questions" ... -d '{"question":"How many prime numbers are there below 100?"}' | tee /tmp/q.json | jq`. The answer is JSON with "sessionId", "projectId" and "agent": null.
2. `SID=$(jq -r .sessionId /tmp/q.json); sleep 4`.
3. `curl -s "$API/questions/$SID" ... | jq '{status, cost, startedAt, endedAt}'`. The answer: "status": "ended", "cost": 0.000168, and the start and end times.
4. `jq -r .answer /tmp/a.json`. The answer text: there are 25 prime numbers below 100, with the list of the primes.

**What happens, in order.**
- 0 s: the POST command is typed.
- 5.2 s: the session id appears.
- About 7 s: the SID line is typed, and the shell waits four seconds.
- 15.7 s: the status "ended" and the cost appear.
- 19.0 s: the answer text appears. The picture holds to 23 s, then loops.

**What to say.**

> Here is the same flow on the public server, from the command line.
>
> [0 s] We send a POST to slash API slash v1 slash questions, with an API key. The question is: how many prime numbers are there below 100?
>
> [5.2 s] The platform answers at once with a session id.
>
> [15.7 s] A few seconds later, we read the question by its id. Here you can see the status, "ended", and the cost of the question.
>
> [19 s] And here is the answer from the model, gpt-4.1-nano: there are 25 prime numbers below 100. It is a real answer, with a real cost.

**Point at.**
1. The "sessionId" in the first answer.
2. "status": "ended" and "cost".
3. The answer text at the bottom.

**If asked.**
- *What is the cost unit?* The cost is in US dollars. This question cost 0.000168 dollars.
- *Why is the agent null here?* This call asks without a chosen agent. With an agent, the call adds the agent's slug, and the platform puts that agent's instructions first.

### Slide 16: Availability: deleting a worker (recorded)

- Outline item: 4d · Availability, recorded
- Speaker: LI ZHUOYANG
- Time: 65 s

**What is on the screen.** A terminal recording on the public server, 50.6 s long, with the prompt "lumen $".

1. A POST that asks: "Find three recent papers on pattern-avoiding permutations and summarise each in one line." The shell prints the session id.
2. `kubectl delete pod -n lumen -l app.kubernetes.io/name=worker --force --grace-period=0`. The answer: a warning about immediate deletion, then `pod "worker-578cbf6fdb-9x26t" force deleted`.
3. A loop that reads the question every four seconds and prints `{status, cost}`. The first four lines say "running", cost 0.000255. Then the lines say "ended", cost 0.000467.
4. `kubectl get pods -n lumen -l app.kubernetes.io/name=worker`. The answer: one new worker pod, `worker-578cbf6fdb-j8q7f`, Running, age 59s.

**What happens, in order.**
- 0 s: the question is typed.
- 7.1 s: the session id appears.
- About 9 s: the delete command is typed.
- 13.4 s: "force deleted" appears.
- 19.4 s: the first status line, "running". A new line comes every 2 s in the recording.
- 27.4 s: the first "ended" line.
- 46.6 s: the new worker pod appears. The picture holds to 50.6 s, then loops.

**What to say.**

> Now availability. Here a question starts.
>
> [9 s] While it runs, we force-delete the worker that runs it. There is no grace period.
>
> [13.4 s] Here you see that the pod is deleted.
>
> [19.4 s] Now we read the question every few seconds. It is still running.
>
> [27.4 s] And here it ends. The cost goes up, because the work goes on.
>
> Why does this work? A worker acknowledges a job only when the job is done. This job was not acknowledged. So RabbitMQ gives it to another worker, and the question still ends.
>
> [46.6 s] At the end you see the new worker pod. Kubernetes started it in place of the old one.
>
> That is the worker and the queue. HE RONG built billing, the Kubernetes setup, the pipeline and the load test. HE RONG will now show the schema, the DevOps pipeline and the scaling test.

**Point at.**
1. "force deleted".
2. The line where "running" changes to "ended".
3. The new pod name and its age at the end.

**If asked.**
- *What if a worker dies in the middle of a job?* The worker acknowledges a job only after the job is done. RabbitMQ gives an unacknowledged job to another worker, as this recording shows.
- *What if the connection to RabbitMQ breaks?* The service process ends, and Kubernetes restarts the pod. A job that was not acknowledged goes back on its queue.

**Handover.** "That is the worker and the queue. HE RONG built billing, the Kubernetes setup, the pipeline and the load test. HE RONG will now show the schema, the DevOps pipeline and the scaling test."

---

## HE RONG: slides 17 to 23, about 8 minutes

You built the billing service, the Kubernetes setup, the Helm chart, the pipeline and the k6 load test. In the questions, you answer about persistence, DevOps and the load test.

### Slide 17: Database schema

- Outline item: 4c · Persistence
- Speaker: HE RONG
- Time: 85 s

**What is on the screen.** An ER diagram in crow's-foot notation, 26 s per loop. Thin frames group the tables by context; the context name is small at the top left of each frame.

- identity (left): "accounts" (id, email, display_name, role) and "platform_api_keys" (id, account_id, prefix, key_hash, scopes, revoked_at).
- project (top middle): "projects", "findings", "platform_agents", "platform_question_intents".
- session (bottom middle): "sessions", "tasks" (id, session_id, parent_id, agent, depth, status, own_cost, pending), "steps" (task_id, index, kind, text, detail).
- billing (bottom right): "billing_wallets" (account_id, cap), "ledger_entries" (id, account_id, task_id, amount), "billing_approvals".
- worker (top right): a small frame with "no tables".
- Each table shows PK and FK marks. Solid lines are foreign keys inside a context. Dashed lines are ids that cross a context, with no foreign key. A legend at the bottom left says "foreign key", "id, no foreign key", and "files: a 2Gi volume".

**What happens, in order.**
- 0 s: "Five contexts in one PostgreSQL; four of them own tables". The tables draw themselves.
- 3.3 s: "An account has many API keys".
- 4.9 s: "An account owns the agents it publishes".
- 6.6 s: "A project keeps its account_id: an id from identity, no foreign key".
- 8.7 s: "A question can name one agent".
- 10.3 s: "A project has many findings, and its sessions keep its id".
- 12.4 s: "A session has many tasks and many findings".
- 14.5 s: "A task has child tasks: parent_id is the call tree". A line loops from tasks back to itself.
- 16.2 s: "A task has many steps, in order".
- 17.8 s: "A reader's task records findings".
- 19.5 s: "Each model call of a task is a ledger entry".
- 21.5 s: "The worker runs the agents and owns no tables".
- 23.1 s: "ER diagram: PostgreSQL 16; money is numeric(12,6)". Loop at 26.0 s.

**What to say.**

> Thank you. I start with 4c, persistence. This is our ER diagram.
>
> [0 s] We have one PostgreSQL 16 database. Each context owns its own tables. The frames show the contexts.
>
> [3.3 s] Solid lines are foreign keys inside a context. An account has many API keys.
>
> [6.6 s] Dashed lines are ids that cross a context, with no foreign key. Here a project keeps its account id from identity. So a later split into one database per service stays mechanical.
>
> [12.4 s] A session has many tasks.
>
> [14.5 s] The tasks table is the centre. Its parent id is the call tree. So the call tree is one table with a parent link, and the cost roll-up is plain SQL.
>
> [16.2 s] Each task has its steps, in order. A reader's task records findings.
>
> [19.5 s] Each model call of a task is a ledger entry in billing.
>
> [21.5 s] The worker owns no tables. It reports every step to session.
>
> [23.1 s] Money is stored as numeric 12, 6. The jobs in flight live in RabbitMQ, and files live on a 2 gigabyte volume.

**Point at.**
1. The frames around each context.
2. The tasks table and its parent_id loop.
3. The dashed line from projects to accounts.

**If asked.**
- *Why one shared database and not one per service?* The tables are already grouped by owner, and no foreign key crosses a context, so the split is mechanical. One database also lets one transaction write the step, its cost and the ledger entry together.
- *How is an approval used only once?* It is decided in one transaction with SELECT FOR UPDATE. The billing pods claim delivery rows with FOR UPDATE SKIP LOCKED and a 30-second lease.

### Slide 18: Branches and images

- Outline item: 5a · Source and artifacts
- Speaker: HE RONG
- Time: 60 s

**What is on the screen.** A branch graph on the left and a deploy chain on the right, 20 s per loop.

- Left, three rows: "main: Lumen, the base product"; "ass/platform: the platform's branch"; "a feature branch", named "codex/platform-approval-acceptance". A counter under the graph: "48 commits on ass/platform" and "1 pull request merged into it". A label "branched off main on 19 October", and a tag "PR #148" where the feature branch merges back.
- Right, a chain from top to bottom: "push" into a box "lumen-next:<commit sha>: image, built from deploy/k8s/Dockerfile"; then "copy over SSH (scp)" to a node "«AWS» EC2 host: k3s ctr images import"; then "helm upgrade --install --wait" to a box "Lumen platform, live".

**What happens, in order.**
- 0 s: "main holds Lumen, the base product".
- 1.7 s: "ass/platform branches off main on 19 October".
- 2.8 s: "Commits land on ass/platform". The counter rises.
- 5.2 s: "A short-lived branch holds one change".
- 6.7 s: "Pull request #148 merges it back into ass/platform".
- 9.0 s: "More commits land; each one is pushed". The counter reaches 48.
- 10.4 s: "A push builds one image: lumen-next:<commit sha>".
- 12.5 s: "The image goes over SSH into k3s on the EC2 host".
- 14.6 s: "helm upgrade --install --wait puts it live".
- 16.7 s: "Git branches and the deploy path of each commit on ass/platform". Loop at 19.7 s.

**What to say.**

> Now 5, DevOps. First, 5a: the source and the artifacts.
>
> [1.7 s] ass/platform is our one integration branch. It branches off main on 19 October.
>
> [5.2 s] One change came on a short-lived branch.
>
> [6.7 s] It merged back through pull request 148.
>
> [9 s] In total, ass/platform has 48 commits.
>
> [10.4 s] Every push builds one image. The tag of the image is its commit.
>
> [12.5 s] The pipeline copies the image over SSH into k3s on the EC2 host.
>
> [14.6 s] And helm puts it live.
>
> So we need no image registry. Each running version maps to exactly one commit.

**Point at.**
1. "PR #148".
2. The image box "lumen-next:<commit sha>".
3. "Lumen platform, live" at the bottom right.

**If asked.**
- *How do you roll back?* We run helm rollback on the server, or we push a revert. Every deploy is a Helm release with its history.
- *Where is staging?* A merge into ass/platform is the approval to deploy, and the pull request review is the gate. Our local k3d cluster runs the same chart.

### Slide 19: CI/CD pipeline

- Outline item: 5b · DevOps pipeline
- Speaker: HE RONG
- Time: 75 s

**What is on the screen.** A flowchart of the pipeline file `.github/workflows/platform-deploy.yml`, 21.5 s per loop.

- Left: "trigger: push to ass/platform, or a manual run".
- Next, three parallel boxes: "verify: lint, types, tests"; "SCA: dependency audit, npm audit"; "SAST: static analysis, CodeQL".
- Middle, a frame "deploy" with steps from top to bottom: "build image", a diamond "Trivy gate" with "fail" to "stop" and "pass" down, "copy and import", "helm upgrade --wait", "health check".
- Right: "DAST: live scan, OWASP ZAP" and "Smoke load: 2 users for 30 s, k6", then "summary".
- In the second run, each box shows its time: verify 5 min 05 s, SCA 33 s, SAST 2 min 54 s, deploy 5 min 30 s (build image 2 min 50 s, Trivy gate 25 s, copy and import 1 min 04 s, helm upgrade 22 s), DAST 1 min 40 s, smoke load 1 min 15 s, summary 4 s.

**What happens, in order.**
- 0 s: "The pipeline: .github/workflows/platform-deploy.yml".
- 2.0 s: "The first run: verify, SCA and SAST run at the same time and pass". Three check marks.
- 6.0 s: "5 critical CVEs: the Trivy gate stops the deploy". A cross on the line under the gate.
- 9.2 s: "The fix: a smaller platform image, with no Docker inside". "stop" lights up.
- 10.8 s: "The next run: the fixed image". The times appear in the boxes.
- 14.1 s: "The image passes the gate; the deploy steps run one after another".
- 16.2 s: "DAST and a smoke load run at the same time against the live address".
- 18.3 s: "CI/CD pipeline: all jobs passed in 12 min 30 s". A white label "all jobs done in 12 min 30 s". Loop at 21.5 s.

**What to say.**

> 5b, the pipeline.
>
> [0 s] A push to ass/platform starts it.
>
> [2 s] Verify, SCA and SAST run at the same time. Verify runs lint, types and tests. SCA is npm audit. SAST is CodeQL.
>
> [6 s] Then the image goes through the Trivy gate. In the first run, the gate found 5 critical CVEs in the image. Here the gate stops the deploy, before the image reaches the host.
>
> [9.2 s] So we built a smaller platform image, with no Docker inside.
>
> [10.8 s] In the next run, the image passes the gate. The deploy steps run one after another: copy, import, helm, health check.
>
> [16.2 s] Then DAST, with OWASP ZAP, and a smoke load with k6 run against the live address at the same time.
>
> [18.3 s] Every stage passed, and all jobs were done in 12 minutes 30 seconds. The gate did its job: the critical CVEs never reached the host.

**Point at.**
1. The three parallel checks on the left.
2. The Trivy gate diamond.
3. The label "all jobs done in 12 min 30 s".

**If asked.**
- *What does the Trivy gate check?* It scans the image and stops the deploy on a CRITICAL finding that has a fix. The Trivy action is pinned to a commit, not a tag.
- *Are database migrations safe when two versions run?* Every service runs the migrations at startup under an advisory lock. Pods that start together migrate one after another.

### Slide 20: Pipeline runs (recorded)

- Outline item: 5b · Recorded on GitHub
- Speaker: HE RONG
- Time: 40 s

**What is on the screen.** A terminal recording, 15 s long, with the prompt "lumen $".

1. `gh run list --workflow platform-deploy.yml --limit 6`. A table of six runs with the columns STATUS, TITLE, WORKFLOW, BRANCH, EVENT, ID, ELAPSED, AGE. Each run is on branch ass/platform. A check mark or a cross marks each run.
2. `gh run view 39441445313 | head -12`. The run "fix(platform): a platform image witho..." with every job and a check mark: SAST - CodeQL in 2m54s, verify in 5m5s, SCA - dependency audit in 33s, deploy in 5m30s, DAST - ZAP baseline in 1m40s, Smoke load - k6 in 1m15s, summary in 4s.

**What happens, in order.**
- 0 s: the first command is typed.
- 5.2 s: the list of six runs appears.
- About 7 s: the second command is typed.
- 10.8 s: the jobs of run 39441445313 appear. The picture holds to 14.8 s, then loops.

**What to say.**

> Here are the real runs, from the GitHub command line.
>
> [5.2 s] This is the list of runs on ass/platform. Each line is one run, with its result.
>
> [10.8 s] And here is one run in detail, the run with the fixed image. You can see every job and its result: CodeQL, verify, the dependency audit, deploy, the ZAP scan, the k6 smoke load and the summary. Each job has a check mark. The times match the flowchart on the slide before.

**Point at.**
1. The run id 39441445313 in the list.
2. The column of check marks in the job list.

**If asked.**
- *Which run did the gate stop?* Run 39439752963. The gate found 5 critical CVEs there, and the next run with the fixed image, 39441445313, passed every job.
- *Can we see the runs ourselves?* Yes. The runs are in the GitHub Actions page of the repository, under the workflow "Platform deploy".

### Slide 21: Technical findings

- Outline item: 5c · Technical findings
- Speaker: HE RONG
- Time: 70 s

**What is on the screen.** Three panels from left to right, 21 s per loop. Each panel has a name, a small grey source, a picture, the problem in grey, the word "solution" with an arrow, and the change in white.

- "Per-level queues, found in design": "one queue, readers wait" into "workers, all busy with leads". After: three rows "level 0, level 1, level 2" into "workers, readers always run". Solution: "One queue per level of the call tree (AD-03)."
- "Trivy gate, image scan": "Lumen image, with Docker" into a diamond "gate". After: "platform image, no Docker", through the gate with a check. Problem: "5 critical CVEs, most in the docker.io package. The gate stopped the deploy." Solution: "deploy/k8s/Dockerfile: smaller, patched at build. The next run passed."
- "KEDA scale-down, load test": a bar from "load ends", labelled "300 s, default", and under it "60 s, in the chart". Problem: "KEDA waits 300 s by default before it removes a worker." Solution: "The chart sets 60 s, so the workers go back to 1 a minute after the load."

**What happens, in order.**
- 0 s: "1. One queue for all jobs: the leads hold every worker".
- 1.4 s: "1. Their readers wait in the same queue: a deadlock".
- 3.1 s: "1. The one queue splits into a queue per level".
- 6.0 s: "2. The Lumen image carries Docker: the gate stops it".
- 9.0 s: "2. The image shrinks: no Docker inside, and it passes".
- 12.4 s: "3. By default, KEDA waits 300 s before it removes a worker". The bar fills.
- 15.4 s: "3. The chart sets 60 s, a fifth of the default".
- 18.1 s: "Three technical findings and their fixes". Loop at 21.1 s.

**What to say.**

> 5c, our technical findings. We found three problems, and we fixed each one.
>
> [0 s] First, one queue for all jobs. The leads held every worker, while their readers waited in the same queue.
>
> [3.1 s] So the one queue became a queue for each level of the call tree.
>
> [6 s] Second, our first image had Docker inside. The Trivy gate stopped it, with 5 critical CVEs, most of them in the Docker package.
>
> [9 s] We built a smaller image without Docker, patched at build time. The next run passed.
>
> [12.4 s] Third, we found this one in the load test. By default, KEDA waits 300 seconds before it removes a worker.
>
> [15.4 s] Our chart sets 60 seconds, a fifth of the default. So the workers go back to one a minute after the load.

**Point at.**
1. The "solution" line in each panel.
2. The bar that shrinks from 300 s to 60 s.

**If asked.**
- *Why did the image have Docker inside?* The base product runs code in a sandbox, so its image carries a Docker engine. The platform workers do not need it, so the platform image leaves it out and installs the security updates at build time.
- *Why 60 seconds?* With the default, the extra workers stay for five minutes after the load. With 60 seconds, the workers go back to one a minute after the load, and KEDA still checks the queues every 10 seconds.

### Slide 22: Scalability: load test

- Outline item: 6b · Scalability
- Speaker: HE RONG
- Time: 95 s

**What is on the screen.** A bar chart of the real load test, 22 s per loop. A grey line at the top: "load test, 20 October, with a fixed delay in place of each model call". A legend: grey square "jobs waiting (three queues)", dashed line "target: 5 waiting jobs per worker".

- The chart: y axis 0 to 30 jobs; x axis 0 s to 180 s. Grey bars show the waiting jobs. A white vertical cursor moves from left to right. The dashed target line steps up from 5 to 10, 15 and 20 as workers are added, then steps down.
- Right: "worker pods (KEDA)" with a count and four boxes, "worker 1" to "worker 4".
- At the end, a white box: "135 questions, median 6.1 s, 0 of 1,040 failed".

**What happens, in order.**
- 0 s: "Ten users ask questions without pause". The cursor starts at 0 s.
- 3.6 s: "One worker falls behind; the queue grows". A bar passes the dashed line at 5.
- 5.6 s: "Above 5 jobs per worker, KEDA adds a worker pod". A new worker box appears as the cursor passes that moment; the count rises to 4.
- 10.0 s: "With 4 workers, the queue stops growing, then drains". The highest bar is near 29.
- 13.2 s: "A minute after the load, KEDA removes the extra pods".
- 18.5 s: "Load test of 20 October: 1 to 4 workers, and no request failed". The result box appears. Loop at 21.8 s.

**What to say.**

> Now 6b, scalability. This is our real load test of 20 October. We put a fixed delay in place of each model call. So the test measures the platform's scaling, not the model.
>
> [0 s] Ten users ask questions without a pause. The grey bars are the jobs that wait on the three queues. The dashed line is KEDA's target: five waiting jobs per worker.
>
> [3.6 s] One worker falls behind, and the queue grows.
>
> [5.6 s] When more than five jobs wait per worker, KEDA adds a pod. Here on the right, a new worker pod appears as the cursor passes that moment. We went from one to four workers in 49 seconds.
>
> [10 s] With four workers, the queue stops growing. Then it drains.
>
> [13.2 s] A minute after the load ends, KEDA removes the extra pods. One worker remains.
>
> [18.5 s] All 135 questions finished. The median time was 6.1 seconds. And not one of the 1,040 requests failed.

**Point at.**
1. The dashed target line as it steps up.
2. The worker boxes on the right when they appear.
3. The result box at the end.

**If asked.**
- *The proposal said 200 concurrent sessions.* This test shows the mechanism that carries that load: KEDA adds a worker for each five waiting jobs, and HPA adds pods on CPU. The same Helm chart runs on EKS, where node autoscaling adds machines as the load grows.
- *Why a fixed delay and not the real model?* The delay makes the test measure the platform, not the speed of the model provider, and it costs nothing. The scaling path is the same: the jobs go through the same queues and the same KEDA trigger.

### Slide 23: KEDA scaling (recorded)

- Outline item: 6b · Recorded on the server
- Speaker: HE RONG
- Time: 55 s

**What is on the screen.** A terminal recording on the public server, 29 s long, with the prompt "lumen $". One command: `kubectl get hpa keda-hpa-worker -n lumen --watch`. Then a table that grows by one line at a time, with the columns NAME, REFERENCE, TARGETS, MINPODS, MAXPODS, REPLICAS, AGE. In TARGETS, the first number is the jobs per worker against the target, for example "0/5 (avg)". MINPODS is 1 and MAXPODS is 4 on every line.

**What happens, in order.**
- 0 s: the watch command is typed.
- 3.4 s: the header and the first line: "0/5 (avg)", REPLICAS 1.
- 5.4 s: "4/5 (avg)", REPLICAS 1.
- 7.4 s: "10/5 (avg)", REPLICAS 1. The jobs per worker pass the target.
- 9.4 s: "4/5 (avg)", REPLICAS 2. KEDA added a worker.
- 11.4 s to 23.4 s: the jobs per worker go 4500m, 5, 5, 4, 2500m, 0, 0, while REPLICAS stays 2.
- 25.4 s: "0/5 (avg)", REPLICAS 1. The extra worker is gone. The picture holds to 29.4 s, then loops. The recording shortens the waits between the lines.

**What to say.**

> Here is the same autoscaler on the public server.
>
> [3.4 s] KEDA compares the jobs per worker with the target of five. You can read it in this column.
>
> [7.4 s] Here the jobs per worker reach 10 over 5.
>
> [9.4 s] On the next line, the replicas go from one to two.
>
> [11.4 s] With two workers, the jobs per worker come down.
>
> [25.4 s] After the load, the replicas go back to one.
>
> That is persistence, DevOps and scalability. PENG XUJIAN built the project service, the agent registry, usage and the literature watch app. PENG XUJIAN will now show the platform live.

**Point at.**
1. The TARGETS column, "10/5 (avg)".
2. The REPLICAS column when it goes from 1 to 2, and back to 1.

**If asked.**
- *What does "4500m" mean?* It is Kubernetes notation for 4.5. It means 4.5 waiting jobs per worker on average.
- *What does "+ 1 more" mean in TARGETS?* KEDA watches all three job queues, one trigger for each. The column shows two of them and says that one more follows.

**Handover.** "That is persistence, DevOps and scalability. PENG XUJIAN built the project service, the agent registry, usage and the literature watch app. PENG XUJIAN will now show the platform live."

---

## PENG XUJIAN: slide 24, the live demo, about 7 minutes

You built the project service, the agent registry, usage and the literature watch app. In the questions, you answer about the registry, usage and the watch app.

### Slide 24: Live demo

- Outline item: 6a · 6b · Live demo
- Speaker: PENG XUJIAN
- Time: 7 min

**What is on the screen.** No picture. A framed box with the address `https://lumen.54-179-112-87.sslip.io` in large monospace. Under it, five lines, with a grey label on the left:

- Use case: ask a question in the browser; watch the call tree grow
- Use case: the watch app publishes its agent and asks; then read usage
- Scalability: the recorded load test, then KEDA live
- Availability: delete a worker during a question; it still ends
- Maintainability: open the last pipeline run on GitHub

**What happens, in order.** You leave the slide on the screen for the first sentence. Then you switch to the browser and the terminal, and you follow the run sheet below.

#### Before the session (the evening before and 30 minutes before)

Do these on the presenting computer. Owner: LIU ZIYANG with PENG XUJIAN.

1. Start the EC2 instance the evening before, and open the public address once.
2. Check the model provider's spending limit.
3. Worker mode. The workers run the real model for the whole demo. No mode switch is needed, and nobody runs a load test live.
4. Browser, tab 1: the public address, signed in with the demo account, on the home page.
5. Browser, tab 2: the GitHub Actions page of the workflow "Platform deploy" in the repository ziyangliu-666/lumen-next.
6. Terminal, at the repository root, with large font. Run these lines, so that the API key is never shown on screen:

   ```sh
   export TAPES=$PWD/docs/platform/slides/tapes
   source "$TAPES/env.sh"          # sets LUMEN_URL, API, AUTH, JSON; kubectl runs on the server over SSH
   export LUMEN_API_KEY=$(cat ~/.lumen-platform/demo-key)
   echo '[{"topic": "pattern avoidance in permutations", "agent": "literature-scout"}]' > /tmp/watches.json
   clear
   ```

   The demo key needs the scopes questions:read, questions:write, agents:read, agents:write and usage:read. Test each command of the run sheet once.
7. Open slide 24 in the deck. Keep the deck open, so you can go back to the recorded slides.

#### The run sheet

| Time | Line |
|---|---|
| 0:00 to 0:20 | Opening |
| 0:20 to 1:50 | 1. Ask in the browser |
| 1:50 to 3:40 | 2. The literature watch app |
| 3:40 to 5:00 | 3. Scalability: the recorded load test, KEDA live |
| 5:00 to 6:15 | 4. Delete a worker |
| 6:15 to 6:45 | 5. The pipeline |
| 6:45 to 7:00 | Close |

**Opening (0:00 to 0:20).** The slide stays on the screen.

> Thank you. I built the project service and the agent registry. The agent registry lets a producer publish an agent. The literature watch app is a second app, built only on the public API. I will now show the platform live, at the address on this slide. We follow the five lines here.

**Step 1: ask a question in the browser (0:20 to 1:50).**

- Do: switch to browser tab 1. Click the text box on the home page. Type: `Search arXiv for papers on retrieval-augmented generation. Delegate to three reader agents that work in parallel, one paper each, and record the title, year and main idea of each paper as a finding.` Press Enter.
- What appears: the run page opens. On the left, "Thinking", then the arXiv search with a list of papers, then "Delegated 3 in parallel". On the right, the call tree: "lumen", then reader 1, reader 2 and reader 3, each with its cost and "Running". The findings count rises as each reader finishes. At the top, the money spent and the time elapsed.
- What to say:

> Here is the web app, on the public server. I type a research question and send it.
>
> The run page opens. Here, on the right, is the call tree. This first row is the lead agent. It is thinking, and you can already see its cost.
>
> Now the lead agent searches arXiv. Here are the papers. It delegates one paper each to three readers. Here they are in the call tree, and they run in parallel.
>
> When a reader finishes, its finding appears here, at the top right. Every row in the call tree shows what it cost. Each step that you see here is saved by session, in PostgreSQL.

- If it fails: if the page does not load or the run does not start within 20 seconds, say "The network is slow here, so I show you the recorded run." Go back to slide 2.

**Step 2: the literature watch app publishes its agent, asks, and reads usage (1:50 to 3:40).**

- Do: switch to the terminal. Type and run each command:

  ```sh
  node apps/watch/publish-agent.mjs
  WATCH_FILE=/tmp/watches.json node apps/watch/watch.mjs
  curl -s "$API/usage" -H "$AUTH" | jq
  ```

- What appears:
  - The first command prints "Published the agent literature-scout." or, when it exists already, "The agent literature-scout exists already. Nothing to do."
  - The second command asks one question for the one topic in the watch list, and prints a Markdown digest: the answer, the findings, the cost and the time taken. The topic can take a minute or two.
  - The third command prints the usage JSON: "asConsumer", and "asProducer" with, for each agent, its slug, its sessions, its cost and its median seconds to rest.
- What to say:

> Now the second app. The literature watch uses only the public API and an API key. It has no database, no model calls and no billing of its own.
>
> First, the producer side. This command publishes the agent "literature-scout" to the registry. An agent is a slug, a name, a description and its instructions.
>
> Now the consumer side. The watch asks the platform one question for each topic on its list, with that agent. While it runs, the platform does the same work that you saw in the browser: a call tree, steps with their cost, and the budget cap.
>
> Here is the digest: the answer, the findings, the cost and the time it took.
>
> Last, the producer reads usage. Here, for each agent, you see the number of sessions, the cost and the median time to an answer.

- If it fails: if the watch does not print a digest within 90 seconds, press Ctrl+C and say "I will not keep you waiting. Here is the same flow, recorded." Go back to slide 9 for the API calls and slide 15 for the recorded question. Then continue with step 3.

**Step 3: the load test, recorded, and KEDA, live (3:40 to 5:00).**

- Do: switch to the deck and go back to slide 22, the load test chart. After about 30 seconds, go to slide 23, the recorded KEDA watch. Then switch to the terminal and run:

  ```sh
  kubectl get scaledobject,hpa -n lumen
  kubectl get pods -n lumen -l app.kubernetes.io/name=worker
  ```

- What appears: slide 22 shows the bars of waiting jobs and the worker count going from 1 to 4. Slide 23 shows the recorded watch, with the replicas going up. In the terminal, the first command lists the scaled object of the worker (minimum 1, maximum 4) and the CPU autoscalers of identity, project and billing. The second command lists the worker pods that run now.
- What to say:

> Now scalability. We ran the k6 load test on this server on 20 October, and He Rong showed it a moment ago. Here it is again. Ten users ask without a pause. Above five waiting jobs per worker, KEDA adds a worker: from one to four in 49 seconds, and back to one after the load. 135 questions, and no request failed.
>
> Here is the same autoscaler, recorded on this server. The replicas follow the queue.
>
> Now I show it live. Here is KEDA's scaled object for the worker: at least one replica, at most four. Here are the CPU autoscalers for identity, project and billing. And here are the worker pods that run now. When the queue grows past five jobs per worker, KEDA adds a pod, as you saw in the recording.

- If it fails: if kubectl does not answer, stay on slide 23 and say "This is the same autoscaler, recorded on this server."

**Step 4: delete a worker during a question; it still ends (5:00 to 6:15).**

- Do: in the terminal, type and run each command:

  ```sh
  SID=$(curl -s "$API/questions" -H "$AUTH" -H "$JSON" -d '{"question":"Count the Dyck paths of semilength 6."}' | jq -r .sessionId); echo $SID
  VICTIM=$(kubectl get pods -n lumen -o name | tr -d '\r' | grep '^pod/worker-' | head -1); echo $VICTIM
  kubectl delete $VICTIM -n lumen --force --grace-period=0
  for i in $(seq 12); do curl -s "$API/questions/$SID" -H "$AUTH" | jq -c '{status, cost}'; sleep 4; done
  kubectl get pods -n lumen -l app.kubernetes.io/name=worker
  ```

  Press Ctrl+C on the loop as soon as two lines say "ended".
- What appears: the session id; the name of one worker pod; "force deleted"; then lines with "status":"running" and a cost; then lines with "status":"ended" and a higher cost. The last command shows the worker pods, with a new one at a young age.
- What to say:

> Now availability. I ask one more question through the API. Here is its session id.
>
> Now I take one worker pod, and I force-delete it, with no grace period. Here it is deleted.
>
> Here we read the question every four seconds. It is still running.
>
> And here it ends. A worker acknowledges a job only when the job is done. So RabbitMQ gave the open job to another worker, and the question still ended.
>
> And here is the new worker pod that Kubernetes started.

- If it fails: if the status is not "ended" after the twelve reads, say "Here is the same test, recorded on this server." Go back to slide 16.

**Step 5: open the last pipeline run on GitHub (6:15 to 6:45).**

- Do: switch to browser tab 2, the GitHub Actions page of "Platform deploy". Click the top run. The run page shows its jobs as a graph: verify, SCA and SAST, then deploy, then DAST and the smoke load, then summary.
- What to say:

> Last, maintainability. Here is our pipeline on GitHub. This is the last run on ass/platform. Here you can see every job: the tests, the dependency audit, CodeQL, the deploy with the Trivy gate, the ZAP scan and the smoke load. Every push to our branch runs all of these, and only a passing image goes live.

- If it fails: if GitHub does not load, say "Here are the runs, recorded." Go back to slide 20, and then slide 19 for the flowchart.

**Close (6:45 to 7:00).**

- Do: in the terminal, press Ctrl+C if a command still runs. Switch back to the deck and go to slide 25.

> That was the platform, live. Thank you. We are happy to take questions.

**If the network or the server fails completely.** Say one sentence: "The network does not reach the server, so I show you the same runs that we recorded on it." Then show slides 12, 15, 16, 20 and 23, in that order, with one or two sentences each. Then go to slide 25.

**Point at.**
1. In step 1, the call tree when the reader rows appear.
2. In step 3, the REPLICAS column when it rises.
3. In step 4, the line where "running" changes to "ended".

**If asked.**
- *What can a producer publish?* An agent is a slug, a name, a description and instructions of at most 4000 characters. A consumer chooses the agent for each question.
- *How does the watch app use the platform?* Only through the public API v1, with its own API key, like any other consumer. It is about 210 lines.

**Handover.** "Thank you. We are happy to take questions."

---

## Everyone: slide 25, questions

### Slide 25: Thank you

- Outline item: none (end slide)
- Speaker: everyone. The owner of a part answers about it.
- Time: the rest of the 40 minutes, about 8 to 9 minutes

**What is on the screen.** A black slide with no picture. In large white letters: "Thank you". Under it, in grey: "Questions?". Under that, in grey monospace: `https://lumen.54-179-112-87.sslip.io`.

**What happens, in order.** Nothing moves.

**What to say.**

> Thank you. We are happy to take questions. The platform stays live at this address, so you can try it after the presentation.

**Who answers what.**

| Topic | Answers |
|---|---|
| The problem, the plan, the services, the contexts, session | LIU ZIYANG |
| The public API, API keys, the gateway, HTTPS, the deployment | LU YI |
| The queues, the worker, KEDA, availability | LI ZHUOYANG |
| The database, billing, the pipeline, the load test | HE RONG |
| The agent registry, usage, the watch app, the demo | PENG XUJIAN |

**Point at.** The address, when a lecturer asks where to try the platform.

**If asked.**
- *Can we try it after the presentation?* Yes. The address on this slide is the public server, with a real HTTPS certificate.
- *Where is the detail of a number?* Every number on the slides comes from the evidence files and the pipeline runs. The report gives each one, with its source.
