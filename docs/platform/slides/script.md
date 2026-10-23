# Speaking script: Lumen Platform, ASS presentation

This script covers the deck `out/Team15-Lumen-Platform.pptx` (Team 15, 25 slides), for Monday 26 October 2026, 11:25 to 12:05.

How to read each slide section:

- **What to say** holds the exact words to say to the lecturers. A time in square brackets, for example [6 s], is a cue: say the next words when the picture reaches that second. Do not read the cue aloud.
- Each picture is a GIF. It starts when the slide opens, plays once, and then holds its last frame. The words after the last cue go over that held frame, and they describe it.
- The times come from the GIF frames. They can be off by half a second.
- Speak at about 140 words a minute. If a lecturer interrupts, answer in two or three sentences, say "I will continue", and go on. Cut words, not slides.
- The speaker notes in the deck are the "What to say" words of this script. `build.js` copies them.

Words used in this talk, one meaning each:

- **question**: what a user or an app asks. The public API returns its id as "sessionId"; we say "question id".
- **agent**: a model with instructions and tools. A producer publishes agents.
- **lead agent**: the agent that gets the question and splits the work.
- **reader**: a helper agent that a lead starts for one part of the work, here one paper.
- **call tree**: the lead and the helpers it started, as a tree.
- **task**: one node of the call tree: one agent's part of the work, with its cost.
- **job**: one entry on a RabbitMQ queue. A worker takes a job and runs one task's next steps.
- **step**: one model call or tool call of a task, saved with its cost.
- **budget cap**: the most that an account may spend before a person approves more.

| Order | Speaker | Slides | Time |
|---|---|---|---|
| 1 | LIU ZIYANG | 1 to 8 | 7.5 min |
| 2 | LU YI | 9 to 12 | 5 min |
| 3 | LI ZHUOYANG | 13 to 16 | 5 min |
| 4 | HE RONG | 17 to 23 | 8.5 min |
| 5 | PENG XUJIAN | 24, the live demo | 7 min |
| | everyone | 25, questions | the rest |

---

## LIU ZIYANG: slides 1 to 8, about 7.5 minutes

You designed the service boundaries and the contracts, and you built the session service. In the questions, you answer about the overview, the plan and the logical architecture.

### Slide 1: Lumen Platform

- Outline item: none (title slide)
- Speaker: LIU ZIYANG
- Time: 20 s

**What is on the screen.** A black slide with no picture. At the top, in grey: "Architecting Scalable Systems · Team 15". In the middle, in large white letters: "Lumen Platform". Under it, in grey: "An AI for research, built as a scalable platform". Lower down, the five names. At the bottom, in grey monospace: "live:" and the public address `lumen.54-179-112-87.sslip.io`.

**What happens, in order.** Nothing moves.

**What to say.**

> Good morning. We are Team 15, and this is Lumen Platform. We follow the order of the presentation outline. The number at the top left of each slide is the outline item. The address at the bottom is live, and you can open it during the talk.

**Point at.**
1. The title, "Lumen Platform".
2. The address at the bottom.

**If asked.**
- *Is the address live now?* Yes. It is the public server on AWS, and we use it in the live demo at the end.

### Slide 2: What Lumen does: one question, a tree of agents

- Outline item: 1 · Context and business problem
- Speaker: LIU ZIYANG
- Time: 50 s

**What is on the screen.** A real screen recording of the Lumen web app, made on 22 October with the model gpt-4.1. It plays for 30 s and then holds. The recording is cut to the two panes and enlarged, so the call tree is readable. Left: the question, then the work of the agent. Right, from top to bottom: "Findings" with a count, "Files", "Call tree" and "Sessions". The call tree shows "lumen" (the lead agent) and, under it, "reader 1", "reader 2" and "reader 3", each with its cost in dollars and its state, "Running" or "Finished".

**What happens, in order.**
- 0 s: the home page. The question is typed.
- 5 s: the run page opens. The call tree has one row: "lumen", Running.
- 11 s: the arXiv search results appear on the left. "Delegated 3 in parallel" shows three readers. The call tree grows: reader 1, reader 2 and reader 3.
- 15 s: the view opens reader 1's own task: read the abstract of one paper.
- 23 s: reader 1 finishes. "Findings" goes to 1.
- 26 s: reader 2 finishes. "Findings" goes to 2.
- 30 s: the picture holds. The call tree shows lumen and reader 3 running, reader 1 and reader 2 finished.

**What to say.**

> [0 s] Lumen is an AI that does research. Here is a real run.
>
> [5 s] On the right is the call tree, one row per agent. The first row is the lead agent, which gets the question.
>
> [14 s] The lead gave three reader agents one paper each. Each row is a task, one agent's work, with its cost.
>
> [25 s] Each reader records its paper as a finding, here at the top right.
>
> Two readers have finished, and the third is still working. For this course, we turned Lumen into a platform. Other apps use the same research AI through one public API. Now I show who uses it.

**Point at.**
1. The call tree on the right, when the three reader rows appear.
2. The findings count at the top right.

**If asked.**
- *Is this recording real or a mock-up?* It is a real run of the Lumen web app on 22 October, with the model gpt-4.1. The papers, the costs and the findings are the real output.
- *How much did the run cost?* The lead finished at 0.0401 US dollars, about four cents, a few seconds after this frame.
- *Why make it a platform?* So that other apps use the research AI without building it again. Our second app, the literature watch app, uses only the public API.

### Slide 3: Producers and consumers

- Outline item: 1 · Platform thinking
- Speaker: LIU ZIYANG
- Time: 65 s

**What is on the screen.** A diagram in three columns.

- Left: a stick figure, "Producer", with "agent author" under it.
- Middle: a frame, "Lumen platform". Inside it, at the top, a box "Agent registry: the agents that producers publish". Under it, a box "Run engine", with the line "three services: session, worker, billing", the line "for each question:" and three small boxes: "call tree", "steps and cost", "budget cap".
- Right: "Consumers", with a box "Literature watch app" and, under it, a box "Web app" with a stick figure "People".

At the end, arrows join them: "publish an agent", "the agent's instructions", "ask with an API key", "ask, signed in", "answer + findings + cost" and "the run, live".

**What happens, in order.**
- 0 s: everything is shown.
- 3.5 s: the producer and the registry light up, and the arrow "publish an agent" grows.
- 15.4 s: the watch app and the web app light up, and their arrows grow.
- 25.4 s: the arrow from the registry to the run engine grows.
- 30 s: the box "call tree" lights up.
- 37 s: the box "steps and cost" lights up.
- 42.4 s: the box "budget cap" lights up.
- 48.6 s: the arrows back to the consumers grow.
- 55.2 s: everything is shown. The picture holds from 57.8 s.

**What to say.**

> [0 s] The platform sits between two groups of users.
>
> [3.5 s] On the left is the producer, the person who writes an agent. An agent is a model with instructions. The producer publishes it to this registry.
>
> [15.4 s] On the right are the consumers. An app, like our literature watch app, asks with its API key. People ask in the web app.
>
> [25.4 s] In the middle, the run engine takes the agent's instructions.
>
> [30 s] It runs each question as a call tree: the lead agent and the helper agents it starts.
>
> [37 s] It records each step, one model or tool call, with its cost.
>
> [42.4 s] And it checks each step against the budget cap, the most an account may spend.
>
> [48.6 s] The answer, the findings and the cost go back. People watch the run live.
>
> [55.2 s] A new app builds none of this. Our literature watch app is about 210 lines of code.

**Point at.**
1. The producer on the left and the registry.
2. The run engine and its three boxes.
3. The two consumers on the right.

**If asked.**
- *What exactly does a new app save?* The literature watch app has no database, no model calls and no billing of its own. The platform gives it sign-in and keys, the agent runtime, the budget cap and approvals, and scaling.
- *What happens at the budget cap?* A step that would pass the cap waits. A person approves the extra spend in the web app, and the question goes on.

### Slide 4: Use cases

- Outline item: 1 · Scope
- Speaker: LIU ZIYANG
- Time: 45 s

**What is on the screen.** A UML use case diagram. A frame, "Lumen platform", is the system boundary. Inside it are six ovals: "Publish an agent", "Read usage", "Ask a question", "Get topic digests", "Manage API keys", "Approve extra spend". Four actors stand outside: "Producer (agent author)" and "Operator (our team)" on the left; "Literature watch app" and "People in the web app" on the right.

**What happens, in order.**
- 0 s: the whole diagram, without lines.
- 7 s: the producer's two lines grow, to "Publish an agent" and "Read usage".
- 12.3 s: two lines grow, to "Ask a question" and "Get topic digests".
- 19.4 s: three lines grow, to "Ask a question", "Manage API keys" and "Approve extra spend".
- 29.2 s: one line grows, to "Read usage".
- 33.4 s: every line shows. The picture holds from 36 s.

**What to say.**

> [0 s] This is the use case diagram. The frame is the platform. Four actors stand outside it.
>
> [7 s] The producer publishes an agent and reads how much it is used.
>
> [12.3 s] The literature watch app asks questions. For each topic on its list, it writes a digest.
>
> [19.4 s] People in the web app ask questions and manage their API keys. They approve extra spend when a question would pass the budget cap.
>
> [29.2 s] The operator is our team. It reads usage too.
>
> [33.4 s] All six use cases run on the public server.

**Point at.**
1. The producer and "Publish an agent".
2. "People in the web app" and its three lines.

**If asked.**
- *Who is the operator?* Our team, with staff accounts. The operator reads usage for every account and every agent.
- *What is a topic digest?* The watch app keeps a list of topics. For each topic it asks one question with a chosen agent and writes the answer, the findings and the cost as a short Markdown digest.

### Slide 5: Plan and effort

- Outline item: 2 · Status, milestones and effort
- Speaker: LIU ZIYANG
- Time: 45 s

**What is on the screen.** A Gantt chart. Five rows, one for each member, each with "80 h" at the left:

- Liu Ziyang: architecture, then session service.
- Lu Yi: identity, gateway, then public API.
- Peng Xujian: projects, then watch app, usage.
- Li Zhuoyang: worker, queue, then worker autoscaling.
- He Rong: billing, then Kubernetes, pipeline, then load tests.


**What happens, in order.**
- 0 s: all bars are grey.
- 7.5 s: a white line moves along the days. Each bar lights up as the line reaches it, and gets a check mark when the line passes its end.
- 22 s: every bar has a check mark. The picture holds from 25 s.

**What to say.**

> [0 s] This is the plan from our proposal. Each member has ten days, from 8 to 21 October.
>
> [7.5 s] We fixed the interfaces between the services first. Then each member built a service. Then came autoscaling, the public API and the pipeline.
>
> [22 s] Every bar is done, and the platform runs on AWS. Each member spent ten person-days, which is 80 hours. That is 400 hours in total.

**Point at.**
1. The "80 h" column on the left.
2. The check marks on the last frame.

**If asked.**
- *How did you track the effort?* We worked to the work breakdown of the proposal, with ten person-days for each member. Every item on this chart is done.
- *Who did what?* Each row is one member and the parts that member built. Each member presents those parts today.

### Slide 6: Logical architecture decisions

- Outline item: 3 · Key architectural decisions
- Speaker: LIU ZIYANG
- Time: 70 s

**What is on the screen.** Three columns, each a decision drawn as "before" and "after". Grey names at the top: "Services", "Job queue", "Step writes".

- Services: at first a box "one process: Lumen" with five modules (sign-in, projects, call tree, agent loop, billing). After: five service boxes, identity, project, session, worker and billing. Caption: "Each module becomes a service / all services share one container image".
- Job queue: at first "session" with an arrow "direct HTTP call" to "worker". After: "RabbitMQ job queues" between session and three worker boxes. Caption: "Session puts jobs on a durable queue / requests return before the model answers".
- Step writes: at first "worker" with a line "writes each step" to "steps, PostgreSQL". After: worker, then "session", then the steps, with "sends each step" and "the only writer". Caption: "Only session writes the steps / a step that reached session stays saved".

**What happens, in order.**
- 0 s: the first column: five modules in one process.
- 9 s: each module moves up into its own service box.
- 16.9 s: session calls a worker directly.
- 19.9 s: the direct line breaks, and a queue takes its place. Jobs fill the queue.
- 32.2 s: two more workers divide out of the first, and jobs move to them.
- 41.5 s: the worker writes each step to the database.
- 46 s: the line breaks, and each step goes through session.
- 51.4 s: session and its line to the steps light up.
- 59.8 s: the picture holds.

**What to say.**

> [0 s] Here are three decisions of the logical design, each as before and after. First, Lumen was one program with five modules.
>
> [9 s] Each module became a service. The worker runs the agent loop: each agent's model and tool calls.
>
> [16.9 s] Second, session called a worker directly.
>
> [19.9 s] Now session puts each job, one piece of work for a worker, on a durable queue in RabbitMQ. A durable queue keeps its jobs when a program stops.
>
> [32.2 s] More workers can start, and any free worker takes the next job. A web request returns before the model answers.
>
> [41.5 s] Third, the worker wrote each step to the database itself.
>
> [46 s] Now the worker sends each step to session, and session writes it.
>
> [51.4 s] Session is the only writer of the steps. A step that reached session stays saved when a worker stops.
>
> [59.8 s] The label says job queues, plural. Li Zhuoyang shows why there are three, on slide 13.

**Point at.**
1. The five service boxes in the first column.
2. The queue between session and the workers.
3. "the only writer" in the third column.

**If asked.**
- *Why five services and not the eight in the proposal?* The five follow the modules that already had clear interfaces and tests. The live stream runs inside session, and model calls go through the worker, which prices each call.
- *Why does the worker send steps to session and not write to the database?* Session is the only writer, so the cost roll-up and the budget checks stay in one place.

### Slide 7: Five services behind the API gateway

- Outline item: 3 · Logical architecture
- Speaker: LIU ZIYANG
- Time: 75 s

**What is on the screen.** A UML component diagram in four tiers, from top to bottom. The tier names are on the left: clients, edge, services, data.

- clients: "Web app" and "Literature watch app".
- edge: one wide box, "API gateway (Traefik)".
- services: "Identity: sign-in, API keys", "Project: projects, registry", "Session: the call tree", "Worker: the agent loop", "Billing: the budget cap".
- data: "RabbitMQ" and "Model, external API", and under them one wide box, "PostgreSQL: one database, tables grouped by owner".

Dashed arrows point down from each tier to the next, and from Project and from Worker to Session. During the run, white tags move along the lines: "question", "job", "prompt", "reply", "step", "answer".

**What happens, in order.**
- 0 s: the components, without lines.
- 7.8 s: the arrows from the clients to the gateway grow.
- 11.8 s: the arrows from the gateway to the five services grow.
- 16.2 s: the arrows from Project and from Worker to Session grow.
- 22.9 s: the arrows to PostgreSQL, RabbitMQ and the model grow, among them a line from Worker to PostgreSQL.
- 31.4 s: a "question" tag goes from the watch app to the gateway, and on to Project.
- 36.4 s: the tag goes from Project to Session.
- 38.6 s: a "job" tag goes to RabbitMQ and from there to the worker.
- 44 s: a "prompt" tag goes to the model, and a "reply" comes back.
- 46.4 s: a "step" tag goes from Worker to Session, and from Session to PostgreSQL.
- 50.9 s: an "answer" tag goes from Session through the gateway to the app.
- 53.6 s: the picture holds.

**What to say.**

> [0 s] A component diagram in four tiers. Each dependency points down, or sideways to session.
>
> [7.8 s] The clients see one thing: the API gateway, Traefik.
>
> [11.8 s] The gateway routes each path to one of five services.
>
> [16.2 s] Only Project and Worker call session's internal routes. The gateway never routes those from outside.
>
> [22.9 s] The services use one PostgreSQL database, RabbitMQ for the job queues, and the model's external API.
>
> [31.4 s] Now follow one question at run time. The watch app asks.
>
> [36.4 s] Project passes it to session.
>
> [38.6 s] Session puts a job on the queue, and a free worker takes it.
>
> [44 s] The worker calls the model.
>
> [46.4 s] Each step goes back to session, and session saves it.
>
> [50.9 s] The app reads the answer.
>
> [53.6 s] Billing has no line from session. Session checks the budget and records the spend in billing's tables, in the same database transaction.

**Point at.**
1. The gateway box, the one door for the clients.
2. The white tag as it moves: question, job, step, answer.
3. RabbitMQ between Session and Worker.

**If asked.**
- *Why can session not scale like the worker?* Session holds the running call trees in memory, so it runs one copy, and a new version replaces the old one. The heavy work, the agent loop, runs in the workers, which scale from one to four.
- *How do services trust each other?* Every internal route checks a shared internal key, and Traefik never routes internal paths from outside.

### Slide 8: Bounded contexts

- Outline item: 3 · Domain-driven design
- Speaker: LIU ZIYANG
- Time: 75 s

**What is on the screen.** A DDD context map.

- At the top, a chain of four boxes with arrows: "the six use cases" → "nouns users say: agent, question, step, budget cap" → "5 bounded contexts" → "their aggregates".
- Under the chain, five context boxes. Left: "Project" (projects, findings; agent registry: agents, chosen agent) and, under it, "Identity" (accounts, API keys). Middle: "«core domain» Session" (question: the root; its call tree of tasks; steps, never changed). Right: "Worker" (the agent loop, with no saved state) and, under it, "Billing" (budget, ledger of spend; approvals).
- Arrows with event names: "question asked", "finding recorded", "job queued", "step recorded", "spend recorded", "approval needed". A dashed arrow "who asks (upstream)" goes up from Identity to Project.

**What happens, in order.**
- 0 s: the chain at the top builds up, one box at a time.
- 10.4 s: the five boxes and their aggregates appear.
- 22.1 s: "question asked" and "finding recorded" grow.
- 31.4 s: the dashed arrow from Identity grows.
- 36.8 s: "job queued" and "step recorded" grow.
- 43.1 s: "spend recorded" and "approval needed" grow.
- 47.9 s: Session lights up with its five events.
- 58.4 s: the picture holds.

**What to say.**

> [0 s] Here is how we found the contexts. We took the nouns that users say in the six use cases: agent, question, step, budget cap.
>
> [10.4 s] We grouped them so each word keeps one meaning: five bounded contexts. Each box lists its aggregates, the things one transaction keeps consistent.
>
> [22.1 s] Each arrow is a domain event: a fact that one context tells another. Project sends "question asked", and receives "finding recorded".
>
> [31.4 s] Identity is upstream. It tells Project who asks, with which API key.
>
> [36.8 s] The worker receives "job queued" and sends "step recorded". It keeps no saved state.
>
> [43.1 s] Billing receives "spend recorded" and "approval needed".
>
> [47.9 s] Session is part of every event but Identity's. It owns the call tree, what makes Lumen different, so it is the core domain.
>
> [58.4 s] Next, Lu Yi. Lu Yi built identity, the gateway, the API keys and the public API. Lu Yi now shows how apps use the platform, and where it runs.

**Point at.**
1. The chain at the top: use cases, nouns, contexts, aggregates.
2. Session in the middle, "«core domain»".
3. The event names on the arrows.

**If asked.**
- *How did you choose the aggregates?* An aggregate is what one transaction must keep consistent. A call tree rolls up its cost, and a budget never passes its cap without an approval.
- *Why is Session the core domain?* It owns the call tree, which is what makes Lumen different. The other contexts support it.

**Handover.** "Next, Lu Yi. Lu Yi built identity, the gateway, the API keys and the public API. Lu Yi now shows how apps use the platform, and where it runs."

---

## LU YI: slides 9 to 12, about 5 minutes

You built identity, the gateway, HTTPS, the rate limits, the API keys and the public API. In the questions, you answer about the public API, security and the deployment.

### Slide 9: Public API: the calls in order

- Outline item: 3 · Producers and consumers
- Speaker: LU YI
- Time: 60 s

**What is on the screen.** A UML sequence diagram. Three lifelines with boxes at the top: on the left "Consumer app: literature watch", in the middle "Lumen platform: API v1", on the right "Producer: agent author". A bracket on the far left marks each phase: "producer", "consumer", then "producer" again. Six numbered calls, each with a dashed reply, and one step inside the platform:

1. POST /api/v1/keys (producer to platform)
2. POST /api/v1/agents (producer to platform)
3. GET /api/v1/agents (consumer to platform)
4. POST /api/v1/questions (consumer to platform)
- "runs the agent on the question" (the platform, by itself, with no number)
5. GET /api/v1/questions/:id (consumer to platform)
6. GET /api/v1/usage (producer to platform)

**What happens, in order.**
- 0 s: the three lifelines.
- 7 s: the producer phase; calls 1 and 2 grow.
- 15.4 s: the consumer phase; calls 3 and 4 grow.
- 26 s: the step inside the platform grows.
- 29.5 s: call 5 grows.
- 35.3 s: the producer phase again; call 6 grows.
- 38.3 s: the picture holds.

**What to say.**

> [0 s] This sequence diagram shows the real calls on our public API, in the order they happen.
>
> [7 s] First the producer. It creates an API key, then publishes an agent: a name, a description and its instructions.
>
> [15.4 s] Now the consumer, on the left. It has its own API key. It lists the agents, then asks a question with one of them.
>
> [26 s] The platform runs the agent on the question.
>
> [29.5 s] The consumer reads the answer, the findings and the cost.
>
> [35.3 s] Last, the producer reads its usage.
>
> [38.3 s] An app uses only these six calls.

**Point at.**
1. Calls 1 and 2, the producer phase.
2. Call 4, the question.
3. Call 6, usage.

**If asked.**
- *How is an API key kept safe?* The platform stores only a SHA-256 hash of the key. A key has scopes, for example "questions:write", and it can be revoked at once.
- *What happens when an app sends too many requests?* Each key can make 60 requests a minute, with a burst of 20. After that, the platform answers 429 with a Retry-After header, and the watch app waits that long.
- *Why API keys and not JWT?* A key can be revoked at once, and a lookup for each request is cheap at this size.

### Slide 10: Physical architecture decisions

- Outline item: 4 · Key architectural decisions
- Speaker: LU YI
- Time: 80 s

**What is on the screen.** Three columns, each a decision drawn as before and after. Grey names at the top: "Hosting", "Scaling", "Database".

- Hosting: at first a "Helm chart" above an "«AWS» EKS cluster" with a "managed control plane" and three "EC2" nodes. After: one node "EC2 t3.medium, 2 vCPU, 4 GB", with "k3s" inside and nine small boxes: identity, project, session, worker, billing, postgres, rabbitmq, traefik, keda. A dashed arrow "same chart" goes from the Helm chart to a box "EKS". Caption: "k3s on one EC2 t3.medium / the same Helm chart also installs on EKS".
- Scaling: two panels. "HPA: CPU above 70%" with a CPU bar and pod rows for identity, project and billing. "KEDA: waiting jobs" with a row of job cells, a worker pod row and a CPU bar. Caption: "HPA on CPU, KEDA on waiting jobs / a worker waits on the model, so its CPU is low".
- Database: at first four database cylinders, one for each service. After: one cylinder "PostgreSQL" with four frames: identity (accounts), project (projects, findings), session (steps, task cost), billing (ledger). Caption: "One PostgreSQL, tables by owner / one transaction: step, cost and ledger entry".

**What happens, in order.**
- 0 s: the Helm chart and an EKS cluster.
- 11.3 s: the cluster shrinks to one EC2 node, and k3s and its pods appear.
- 21.4 s: the dashed arrow "same chart" grows to EKS.
- 24.5 s: the CPU bar fills past 70 %, and the identity, project and billing rows grow from one pod to three.
- 36.2 s: the job cells fill, and the worker row grows to four pods while its CPU bar stays short.
- 47.6 s: four databases.
- 52.4 s: they merge into one PostgreSQL.
- 57.6 s: the rows "steps", "task cost" and "ledger" light up together.
- 66.3 s: the picture holds.

**What to say.**

> [0 s] Now the physical architecture: three decisions. First, hosting. Our proposal put the Helm chart, our install package for Kubernetes, on EKS, the managed Kubernetes of AWS.
>
> [11.3 s] We run it on one EC2 t3.medium machine instead, with k3s, a small Kubernetes. It costs about 1.3 US dollars a day.
>
> [21.4 s] The same chart installs on EKS without change.
>
> [24.5 s] Second, scaling. HPA, the Kubernetes autoscaler, adds identity, project and billing pods when CPU passes 70 percent. A pod is one running copy of a service.
>
> [36.2 s] A worker waits on the model, so its CPU stays low. So KEDA, an event-driven autoscaler, adds worker pods when jobs wait in the queue.
>
> [47.6 s] Third, the database. The proposal had a database for each service.
>
> [52.4 s] We run one PostgreSQL. Each service keeps its own tables in it.
>
> [57.6 s] So one transaction writes the step, its cost and the ledger entry together. The ledger is billing's record of spend.

**Point at.**
1. The arrow "same chart" to EKS.
2. The worker row that grows while its CPU bar stays short.
3. The three lit rows inside one PostgreSQL.

**If asked.**
- *Where does 1.3 dollars a day come from?* The AWS on-demand price of a t3.medium in Singapore, about 5.3 cents an hour, for 24 hours.
- *Why scale the worker on waiting jobs and not on CPU?* A worker waits on the model most of the time, so its CPU stays low while the queue grows. The queue shows the agent load first.

### Slide 11: Deployment diagram

- Outline item: 4 · Physical architecture
- Speaker: LU YI
- Time: 75 s

**What is on the screen.** A UML deployment diagram.

- A large 3D node: "«AWS» EC2 t3.medium · ap-southeast-1". At its foot: "security group: 22, 80, 443 open".
- Inside it, a node "«Kubernetes» k3s cluster". Inside k3s, on the left: "Traefik: ingress, HTTPS, rate limit". On the right, five service pods with their pod counts: "identity 1–3 HPA", "project 1–3 HPA", "session 1", "worker 1–4 KEDA", "billing 1–3 HPA". Under them: "PostgreSQL: data on a 2 GB disk", "RabbitMQ: the job queues", "KEDA: autoscaler". A dashed frame, "namespace lumen", holds the five services, PostgreSQL and RabbitMQ.
- Outside the node: "«device» Browser", "«client» Watch app", "«CI/CD» GitHub Actions", and at the top right "OpenAI API".

**What happens, in order.**
- 0 s: the EC2 node draws itself.
- 7.8 s: k3s and the dashed namespace frame appear.
- 14.4 s: Traefik and the five service pods appear.
- 27 s: the bottom row appears.
- 34.5 s: the clients, GitHub Actions and the OpenAI API appear, with their lines.
- 38.8 s: the browser, the watch app, Traefik and the five pods light up.
- 46.2 s: GitHub Actions and k3s light up.
- 49.7 s: the worker and the OpenAI API light up.
- 53.2 s: the picture holds.

**What to say.**

> [0 s] This UML deployment diagram shows one AWS machine, an EC2 t3.medium in Singapore.
>
> [7.8 s] k3s runs inside it. The dashed frame, namespace lumen, holds our pods.
>
> [14.4 s] Under each service is its pod count. Identity, project and billing run one to three, with HPA. The worker runs one to four, with KEDA.
>
> [27 s] PostgreSQL keeps its data on a 2 gigabyte disk. RabbitMQ holds the job queues.
>
> [34.5 s] Outside are the clients, GitHub Actions and OpenAI.
>
> [38.8 s] Users reach the platform only over HTTPS on port 443. Traefik routes each path to a service.
>
> [46.2 s] GitHub Actions deploys over SSH on port 22.
>
> [49.7 s] Only the worker pods call the OpenAI API.
>
> [53.2 s] The security group, the AWS firewall, opens only ports 22, 80 and 443.

**Point at.**
1. The pod counts under the services.
2. The "HTTPS 443" line into Traefik.
3. "security group: 22, 80, 443 open" at the bottom.

**If asked.**
- *What if the IP address changes?* The host name comes from a fixed Elastic IP, through sslip.io. The certificate is a real Let's Encrypt certificate for that name.
- *Why is port 80 open?* Traefik redirects HTTP on port 80 to HTTPS. All traffic to the services goes over HTTPS on 443.

### Slide 12: Pods on the server (recorded)

- Outline item: 4 · Physical architecture
- Speaker: LU YI
- Time: 50 s

**What is on the screen.** A terminal recording on the real public server, 10.5 s long. Each command line starts with the grey prompt "lumen $".

1. `kubectl get pods -n lumen`. The answer lists seven pods, each "1/1 Running" with 0 restarts: billing, identity, postgres-0, project, rabbitmq-0, session, worker.
2. `kubectl get hpa -n lumen`. The answer lists four autoscalers: billing, identity and project with "cpu: 2%/70%", at least 1 and at most 3 pods; and "keda-hpa-worker" for the worker with "0/5 (avg)" for each queue, at least 1 and at most 4 pods.

**What happens, in order.**
- 0 s: the first command is typed.
- 2.9 s: the list of seven pods appears.
- About 4 s: the second command is typed.
- 6.5 s: the autoscaler table appears. The picture holds.

**What to say.**

> A recording on the real server.
>
> [2.9 s] Here are our seven pods, all running.
>
> [6.5 s] And here are the autoscalers. HPA watches CPU for identity, project and billing, with a target of 70 percent and up to three pods. The last line is KEDA for the worker. It shows one number for each queue level: two here, and the third as "+ 1 more". Each is the waiting jobs per worker, against a target of five. It allows up to four workers.
>
> Next, Li Zhuoyang. Li Zhuoyang built the worker service, the job queues and the worker autoscaling. Li Zhuoyang now shows the queue design, one use case in detail, and what happens when a worker dies.

**Point at.**
1. The column "Running" in the pod list.
2. The line "keda-hpa-worker", with "0/5 (avg)" and the maximum of 4.

**If asked.**
- *Why can you not reach kubectl directly?* The Kubernetes API is not public. The security group opens only 22, 80 and 443, so we run kubectl on the host over SSH.
- *Where are Traefik and KEDA in this list?* They run in their own namespaces, outside our namespace lumen. This list shows only our pods.

**Handover.** "Next, Li Zhuoyang. Li Zhuoyang built the worker service, the job queues and the worker autoscaling. Li Zhuoyang now shows the queue design, one use case in detail, and what happens when a worker dies."

---

## LI ZHUOYANG: slides 13 to 16, about 5 minutes

You built the worker service, the job queues and the worker autoscaling. In the questions, you answer about the queues, the worker and availability.

### Slide 13: Decision: one queue per level of the call tree

- Outline item: 4 · Key architectural decisions
- Speaker: LI ZHUOYANG
- Time: 90 s

**What is on the screen.** A queue diagram on the left and a wait-for graph on the right.

- Left: at first "one shared queue", a row of cells, and two boxes "worker 1" and "worker 2". White tags "lead" and "reader" move through it.
- Right, after a few seconds: "waits for", with three boxes, "lead", "reader" and "worker", and the arrows "waits for" (lead to reader), "waits for a free worker" (reader to worker) and "busy with" (worker to lead).
- After the fix, the left side shows "one queue per level of the call tree": three rows, "level 0: leads", "level 1: readers", "level 2: their helpers". Each worker has one slot for each level.

**What happens, in order.**
- 0 s: two "lead" tags enter the queue.
- 11.5 s: each worker takes a lead.
- 16.4 s: six "reader" tags fill the queue.
- 23 s: the wait-for panel appears, and its first arrow grows.
- 25.8 s: the second arrow grows.
- 28.1 s: the third arrow grows.
- 30.7 s: dots run round the triangle, and "deadlock" shows.
- 35.2 s: the one queue becomes three, and the leads move up to level 0.
- 47.4 s: the arrow "waits for a free worker" falls away.
- 52.6 s: the readers run in the level 1 slots, two at a time.
- 58.1 s: level 2 has no jobs.
- 65.1 s: both leads get a check mark, and "both questions finish" shows. The picture holds from 67.1 s.

**What to say.**

> [0 s] Thank you. This decision is about a deadlock that we found in design. Here is one shared queue for all jobs. Two questions start two lead agents.
>
> [11.5 s] Each worker runs one job, so each worker takes a lead.
>
> [16.4 s] Each lead starts three readers. It holds its worker while it waits for them.
>
> [23 s] Here, a lead waits for its readers.
>
> [25.8 s] Readers wait for workers.
>
> [28.1 s] Every worker holds a lead.
>
> [30.7 s] The waits form a cycle, so no question can finish.
>
> [35.2 s] The fix is one queue per level of the call tree. Level 0 holds leads, and level 1 readers. Each worker takes a job from each level.
>
> [47.4 s] A reader no longer waits behind a lead, so the cycle breaks.
>
> [52.6 s] The readers run beside the leads.
>
> [58.1 s] Level 2 is for agents that readers start. Here it stays empty.
>
> [65.1 s] Both questions finish. In the real system, each worker runs up to four jobs from each level. The autoscaler watches all three queues.

**Point at.**
1. The triangle on the right when it closes into a cycle.
2. The three queues, level 0, level 1 and level 2.
3. The check marks on the leads at the end.

**If asked.**
- *How many jobs can one worker run?* Four of each level at a time. RabbitMQ gives each worker that many jobs from each queue.
- *What runs on level 2?* Level 2 takes depth 2 and deeper. In this example a reader starts no helper, so level 2 stays empty.

### Slide 14: Ask a question: sequence diagram

- Outline item: 4 · Detailed design
- Speaker: LI ZHUOYANG
- Time: 75 s

**What is on the screen.** A UML sequence diagram. Seven lifelines, from left to right: Watch app, project, session, PostgreSQL, RabbitMQ, worker, OpenAI API. The messages, from top to bottom:

- POST /api/v1/questions (Watch app to project), then "check the API key" (project to itself).
- "start the question" (project to session).
- "job to level 0 queue" (session to RabbitMQ).
- A frame "par" with two lanes. Upper lane: "201 {question id}" back to the watch app; GET /api/v1/questions/:id to session; "200 {status, answer, findings, cost}" back. Lower lane: "consume" (RabbitMQ to worker), then a frame "loop [each step]": "model call" (worker to OpenAI API), "send the step" (worker to session), "INSERT steps" (session to PostgreSQL).
- A note at the lower left: "Every call of the app passes Traefik and carries its API key".

**What happens, in order.**
- 0 s: the lifelines draw themselves.
- 7 s: the question goes to project, and project checks the key.
- 12 s: project starts the question in session, and session puts the first job on the level 0 queue.
- 19.4 s: the par frame and the note appear.
- 25.6 s: the app gets 201, and a worker takes the job.
- 33.4 s: the app reads the answer, while the worker calls the model and sends a step.
- 40.6 s: the loop runs twice: model call, send the step, INSERT.
- 51.1 s: the picture holds.

**What to say.**

> [0 s] This is the detailed design of one use case, Ask a question, as a UML sequence diagram.
>
> [7 s] The watch app sends the question. Project checks the API key.
>
> [12 s] Project asks session to start the question. Session puts the first job on the level 0 queue.
>
> [19.4 s] The par frame means that from here, two lanes run at the same time.
>
> [25.6 s] In the upper lane, the app gets 201 at once. In the lower lane, a worker takes the job.
>
> [33.4 s] The app reads the answer whenever it likes. Session checks the key on this read too.
>
> [40.6 s] Meanwhile the worker runs its steps in a loop. It calls the model and sends each step to session, which saves it in PostgreSQL.
>
> [51.1 s] So no web request waits on the model.

**Point at.**
1. "job to level 0 queue".
2. The "par" frame and its two lanes.
3. The "loop [each step]" frame at the bottom right.

**If asked.**
- *How do the agent's instructions reach the worker?* When the app names an agent, the question first writes a row that names it. The worker reads that row from PostgreSQL with the first job, marks it as taken, and puts the agent's instructions in front of the question.
- *What does the app get back at once?* It gets 201 with the question id. It then reads the status, the answer, the findings and the cost with GET /api/v1/questions/:id.

### Slide 15: Ask a question through the public API (recorded)

- Outline item: 4 · Detailed design
- Speaker: LI ZHUOYANG
- Time: 45 s

**What is on the screen.** A terminal recording on the public server, 23 s long, with the prompt "lumen $". The API key never shows on the screen.

1. A POST to the questions endpoint with the question "How many prime numbers are there below 100?". The answer is JSON with "sessionId", "projectId" and "agent": null.
2. The shell keeps the id and waits four seconds.
3. A GET of the same question, filtered to `{status, cost, startedAt, endedAt}`. The answer: "status": "ended", "cost": 0.000168, and the start and end times.
4. The answer text: there are 25 prime numbers below 100, with the list of the primes.

**What happens, in order.**
- 0 s: the POST command is typed.
- 5.2 s: the question id appears.
- About 7 s: the next line is typed, and the shell waits four seconds.
- 15.7 s: the status "ended" and the cost appear.
- 19.0 s: the answer text appears. The picture holds.

**What to say.**

> [0 s] Here is the same use case, sent with curl and an API key.
>
> [5.2 s] The platform answers at once with the question id. The API calls it "sessionId". No agent is named here, so the default lead agent answers.
>
> [15.7 s] It has ended, with this cost.
>
> [19 s] And here is the answer from the model, gpt-4.1-nano: 25 prime numbers. The public server uses this smaller model to keep the cost low.

**Point at.**
1. The id in the first answer.
2. "status": "ended" and "cost".
3. The answer text at the bottom.

**If asked.**
- *What is the cost unit?* US dollars. This question cost 0.000168 dollars.
- *How does an app choose an agent?* The POST adds the agent's short name. The platform then puts that agent's instructions in front of the question.

### Slide 16: Availability: deleting a worker (recorded)

- Outline item: 4 · Detailed design
- Speaker: LI ZHUOYANG
- Time: 70 s

**What is on the screen.** A terminal recording on the public server, 50.6 s long, with the prompt "lumen $".

1. A POST that asks: "Find three recent papers on pattern-avoiding permutations and summarise each in one line." The shell prints the question id.
2. `kubectl delete pod -n lumen -l app.kubernetes.io/name=worker --force --grace-period=0`. The answer: a kubectl notice about immediate deletion, then `pod "worker-…" force deleted`.
3. A loop that reads the question every four seconds and prints `{status, cost}`. The first four lines say "running", cost 0.000255. Then the lines say "ended", cost 0.000467.
4. `kubectl get pods -n lumen -l app.kubernetes.io/name=worker`. The answer: one new worker pod, Running, age 59s.

**What happens, in order.**
- 0 s: the question is typed.
- 7.1 s: the question id appears.
- About 9 s: the delete command is typed.
- 13.4 s: "force deleted" appears.
- 19.4 s: the first status line, "running". A new line comes every 2 s in the recording.
- 27.4 s: the first "ended" line.
- 46.6 s: the new worker pod appears. The picture holds.

**What to say.**

> [0 s] Now availability. Here a question starts.
>
> [9 s] Now we force-delete the only worker pod.
>
> [13.4 s] kubectl notes that it does not wait, and the pod is deleted.
>
> [19.4 s] We read the question every four seconds, shown at double speed. It is still running.
>
> [27.4 s] And here it ends. The cost goes up, because the work goes on.
>
> A worker acknowledges a job only when the job is done. This job was not acknowledged. So Kubernetes starts a new worker, and RabbitMQ gives the open job to it.
>
> [46.6 s] Here is the new worker pod that Kubernetes started.
>
> Next, He Rong. He Rong built billing, the Kubernetes setup, the pipeline and the load test. He Rong now shows the database, the DevOps pipeline and the scaling test.

**Point at.**
1. "force deleted".
2. The line where "running" changes to "ended".
3. The new pod and its age at the end.

**If asked.**
- *What if the connection to RabbitMQ breaks?* The service process ends, and Kubernetes restarts the pod. A job that was not acknowledged goes back on its queue.
- *What if two workers run?* The other worker takes the open job at once, without waiting for a new pod.

**Handover.** "Next, He Rong. He Rong built billing, the Kubernetes setup, the pipeline and the load test. He Rong now shows the database, the DevOps pipeline and the scaling test."

---

## HE RONG: slides 17 to 23, about 8.5 minutes

You built the billing service, the Kubernetes setup, the Helm chart, the pipeline and the load test. In the questions, you answer about persistence, DevOps and the load test.

### Slide 17: Database schema

- Outline item: 4 · Persistence
- Speaker: HE RONG
- Time: 85 s

**What is on the screen.** An ER diagram in crow's-foot notation. Thin frames group the tables by the service that owns them; the name is small at the top left of each frame.

- identity: "accounts" and "platform_api_keys".
- project: "projects", "findings", "platform_agents", "platform_question_intents".
- session: "sessions", "tasks" (id, session_id, parent_id, agent, depth, status, own_cost, pending), "steps".
- billing: "billing_wallets", "ledger_entries", "billing_approvals".
- worker: a small frame with "no tables".
- Each table shows PK and FK marks. A legend at the bottom left: a solid line is a foreign key; a dashed line is an id with no foreign key; files live on a 2 GB disk.

**What happens, in order.**
- 0 s: the frames and their tables draw themselves.
- 10.6 s: accounts and its API keys.
- 12.8 s: accounts and the agents.
- 15.3 s: the dashed line from projects to accounts.
- 22.3 s: the agents and the question rows.
- 24.4 s: projects, findings and sessions.
- 28.8 s: sessions, tasks and findings.
- 33.5 s: a line loops from tasks back to itself.
- 41.3 s: tasks and steps.
- 43.9 s: tasks and findings.
- 45.7 s: tasks and ledger_entries.
- 50 s: the worker frame.
- 51 s: the legend appears. The picture holds from 54 s.

**What to say.**

> [0 s] This ER diagram shows our one PostgreSQL 16 database. The frames group the tables by the service that owns them. The worker owns none.
>
> [10.6 s] An account has API keys.
>
> [12.8 s] It owns the agents it publishes.
>
> [15.3 s] A dashed line is an id with no foreign key, as in projects.
>
> [22.3 s] A question names an agent.
>
> [24.4 s] Sessions keep their project's id.
>
> [28.8 s] Each question is one row in sessions.
>
> [33.5 s] Tasks is the centre. Its parent id forms the call tree, so the cost roll-up is plain SQL.
>
> [41.3 s] Each task has its steps.
>
> [43.9 s] Readers record findings.
>
> [45.7 s] Each model call of a task is a ledger entry in billing.
>
> [51 s] Solid lines are foreign keys. Four of them cross between owners. Findings point to sessions and to tasks. Ledger entries point to tasks, and agents point to accounts. Money is stored as numeric 12, 6.

**Point at.**
1. The frames around the tables of each service.
2. The tasks table and its parent_id loop.
3. The dashed line from projects to accounts.

**If asked.**
- *Why one shared database and not one per service?* One transaction writes the step, its cost and the ledger entry together. Each service owns its tables, and only four foreign keys cross between owners, so a later split replaces those four keys with ids.
- *How is an approval used only once?* It is decided in one transaction with SELECT FOR UPDATE.

### Slide 18: Branches and images

- Outline item: 5 · Source and artifacts
- Speaker: HE RONG
- Time: 55 s

**What is on the screen.** A branch graph on the left and a deploy chain on the right.

- Left, three rows: "main: Lumen, the base product"; "integration branch: the platform's work"; "a feature branch", "tests for spend approvals". A line under the graph: "every commit lands on the integration branch". A label "branched off main", and a label "pull request" where the feature branch merges back.
- Right, a chain from top to bottom: "push" into a box "image, tagged with its commit: built from the platform Dockerfile"; then "copy over SSH (scp)" to a node "«AWS» EC2 host: imported into k3s"; then "helm upgrade --install --wait" to a box "Lumen platform, live".

**What happens, in order.**
- 0 s: main draws itself.
- 6.1 s: the integration branch leaves main.
- 10.5 s: commits land on the branch.
- 13.1 s: the feature branch grows.
- 16.2 s: the pull request merges it back.
- 19.6 s: more commits land.
- 24.5 s: the image box lights up.
- 28 s: the EC2 host lights up.
- 33.3 s: "Lumen platform, live" lights up.
- 35.6 s: the picture holds.

**What to say.**

> [0 s] Now DevOps. First, the source and the artifacts. Main holds Lumen, the base product.
>
> [6.1 s] The platform work lives on one integration branch off main.
>
> [10.5 s] Commits land on it.
>
> [13.1 s] A short-lived feature branch holds one change,
>
> [16.2 s] and a pull request merges it back after review.
>
> [19.6 s] Every commit lands on this branch, and each push deploys.
>
> [24.5 s] Every push builds one image, tagged with its commit.
>
> [28 s] The pipeline copies the image over SSH into k3s on the EC2 host.
>
> [33.3 s] And helm puts it live.
>
> [35.6 s] So we need no image registry, and each running version maps to one commit.

**Point at.**
1. The pull request.
2. The image box.
3. "Lumen platform, live" at the bottom right.

**If asked.**
- *How do you roll back?* We run helm rollback on the server, or we push a revert. Every deploy is a Helm release with its history.
- *Where is staging?* Our local k3d cluster runs the same chart. A merge into the integration branch deploys to the public server.

### Slide 19: CI/CD pipeline

- Outline item: 5 · DevOps pipeline
- Speaker: HE RONG
- Time: 75 s

**What is on the screen.** A flowchart of the pipeline.

- Left: "trigger: push to the integration branch, or a manual run".
- Next, three parallel boxes: "verify: lint, types, tests"; "SCA: dependency audit, npm audit"; "SAST: static analysis, CodeQL".
- Middle, a frame "deploy" with steps from top to bottom: "build image", a diamond "Trivy gate" with "fail" to "stop" and "pass" down, "copy and import", "helm upgrade --wait", "health check".
- Right: "DAST: live scan, OWASP ZAP" and "Smoke load: 2 users for 30 s, k6", then "summary".
- In the passing run, each box shows its time: verify 5 min 05 s, SCA 33 s, SAST 2 min 54 s, deploy 5 min 30 s, DAST 1 min 40 s, smoke load 1 min 15 s, summary 4 s.

**What happens, in order.**
- 0 s: the flowchart, dim.
- 4.8 s: the three checks grow and pass.
- 16.1 s: the line under the gate breaks, "stop" lights up, and a white label says "two runs stopped: 5 critical CVEs".
- 28.8 s: the picture resets for the next run.
- 32.7 s: the three checks pass, with their times.
- 37.2 s: the deploy steps grow one after another.
- 42.3 s: DAST and the smoke load grow at the same time, then the summary.
- 50.6 s: a white label: "all jobs passed / first to last job: 12 min 30 s / run: 20 min 45 s". The picture holds from 53.8 s.

**What to say.**

> [0 s] Next, the pipeline. A push to the integration branch starts it.
>
> [4.8 s] Verify, SCA and SAST run at the same time. Verify runs lint, types and tests. SCA audits the dependencies, and SAST is CodeQL, a static analysis.
>
> [16.1 s] Then Trivy scans the image for known security flaws, called CVEs. The first two runs stopped here. The image had 5 critical CVEs, so it never reached the host.
>
> [28.8 s] We built a smaller platform image without Docker inside.
>
> [32.7 s] In the next run, the image passes the gate.
>
> [37.2 s] The deploy steps run one after another: copy, import, helm, health check.
>
> [42.3 s] Then DAST scans the live address with OWASP ZAP. A smoke load, a short k6 test, runs at the same time.
>
> [50.6 s] Every job passed. From the first job to the last took 12 minutes 30 seconds. GitHub shows 20 minutes 45 seconds for this run. That time includes 8 minutes of waiting for the run before it.

**Point at.**
1. The three parallel checks on the left.
2. The Trivy gate diamond.
3. The white label at the end.

**If asked.**
- *What does the Trivy gate check?* It scans the image and stops the deploy on a critical finding that has a fix.
- *Are database migrations safe when two versions run?* Every service runs the migrations at startup under a database lock. Pods that start together migrate one after another.

### Slide 20: Pipeline runs (recorded)

- Outline item: 5 · DevOps pipeline
- Speaker: HE RONG
- Time: 40 s

**What is on the screen.** A terminal recording, 15 s long, with the prompt "lumen $". It is cut to the columns that matter.

1. `gh run list --workflow platform-deploy.yml --limit 6`. A table of six runs with the columns STATUS, TITLE and ELAPSED. Four runs have a check mark. Two runs, in the middle, have a red X.
2. `gh run view` of the passing run. Every job with a check mark: SAST - CodeQL in 2m54s, verify in 5m5s, SCA - dependency audit in 33s, deploy in 5m30s, DAST - ZAP baseline in 1m40s, Smoke load - k6 in 1m15s, summary in 4s.

**What happens, in order.**
- 0 s: the first command is typed.
- 5.2 s: the list of six runs appears.
- About 7 s: the second command is typed.
- 10.8 s: the jobs of the passing run appear. The picture holds.

**What to say.**

> [0 s] Here are the real runs, from the GitHub command line.
>
> [5.2 s] The gate stopped the two red runs. Above them is the fix.
>
> [10.8 s] And here is the fixed run in detail. Every job has a check mark, with the same times as the flowchart.

**Point at.**
1. The two red runs in the list.
2. The column of check marks in the job list.

**If asked.**
- *Can we see the runs ourselves?* Yes. The runs are on the GitHub Actions page of the repository, under the workflow "Platform deploy".

### Slide 21: Three problems we found and fixed

- Outline item: 5 · Technical findings
- Speaker: HE RONG
- Time: 60 s

**What is on the screen.** Three panels from left to right. Each panel has a name, a small grey source, a picture, the problem in grey, the word "solution" with an arrow, and the change in white.

- "Per-level queues, found in design": "one queue, readers wait" into "workers, all busy with leads". After: three rows "level 0, level 1, level 2" into "workers, readers run too". Solution: "One queue per level of the call tree (slide 13)."
- "Trivy gate, image scan": "Lumen image, with Docker" into a diamond "gate". After: "platform image, no Docker", through the gate with a check. Problem: "5 critical CVEs, most in the Docker package. The gate stopped the deploy." Solution: "A smaller platform image, patched at build. The next run passed."
- "KEDA scale-down, load test": a bar from "load ends", labelled "300 s, default", and under it "60 s, in the chart". Problem: "KEDA waits 300 s by default before it removes a worker." Solution: "Our Helm chart sets 60 s, so the extra workers leave a minute after the load."

**What happens, in order.**
- 0 s: the first panel and its problem.
- 5.8 s: the queue splits into three, and the solution shows.
- 10.1 s: the second panel: the gate stops the image with Docker.
- 18.5 s: the image shrinks and passes.
- 21.6 s: the third panel: the 300 s bar fills.
- 30.7 s: the bar shrinks to 60 s.
- 41.2 s: the picture holds.

**What to say.**

> [0 s] Three problems. The first two you saw on slides 13 and 19.
>
> [5.8 s] One queue per level of the call tree ended the deadlock.
>
> [10.1 s] The image scan stopped the old image, which carried Docker.
>
> [18.5 s] The smaller image without Docker passed.
>
> [21.6 s] The third we found in the load test. By default, KEDA waits 300 seconds after the load before it removes a worker.
>
> [30.7 s] Our Helm chart sets 60 seconds, a fifth of the default. So the extra workers leave a minute after the load, and KEDA still checks the queues every 10 seconds.

**Point at.**
1. The "solution" line in each panel.
2. The bar that shrinks from 300 s to 60 s.

**If asked.**
- *Why did the image have Docker inside?* The base product runs code in a sandbox, so its image carries a Docker engine. The platform workers do not need it, so the platform image leaves it out and installs the security updates at build time.

### Slide 22: Load test: 1 to 4 workers, no failed request

- Outline item: 6 · Scalability
- Speaker: HE RONG
- Time: 75 s

**What is on the screen.** A bar chart of the real load test. A grey line at the top: "load test, 20 October, with a fixed delay in place of each model call". A legend: grey square "jobs in the three queues", dashed line "KEDA target: 5 jobs × workers".

- The chart: y axis 0 to 30 jobs; x axis 0 s to 180 s and beyond. Grey bars show the waiting jobs. A white vertical cursor moves from left to right. The dashed target line steps up from 5 to 10, 15 and 20 as workers are added, then steps down. When the queue is empty, "queue empty" shows under the chart.
- Right: "worker pods: n (max 4)", with four boxes, "worker 1" to "worker 4".
- At the end, a white box: "0 requests failed / of 1,040 sent / 135 questions / 1 to 4 workers".

**What happens, in order.**
- 0 s: the empty chart, then the cursor starts.
- 13.4 s: a bar passes the dashed line at 5.
- 21.8 s: new worker pods appear as the cursor passes each moment; the count rises to 4.
- 32.6 s: the bars stop growing, then drop, and "queue empty" shows.
- 40.3 s: the target line steps down, and the extra pods merge back.
- 46.2 s: the result box appears. The picture holds from 53.6 s.

**What to say.**

> [0 s] This is our real load test of 20 October. A fixed delay replaced each model call, so the test measures the platform's scaling. Ten users ask questions without a pause.
>
> [13.4 s] The grey bars are the jobs in the three queues. One worker falls behind, and the queues grow.
>
> [21.8 s] The dashed line is KEDA's target: five jobs for each worker. KEDA checks each queue against it, and adds worker pods, up to four.
>
> [32.6 s] Four is the maximum we set. With four workers, the queue stops growing and drains to zero.
>
> [40.3 s] A minute after the load ends, KEDA removes the extra pods. One worker remains.
>
> [46.2 s] All 135 questions finished, with a median of 6.1 seconds. Not one of the 1,040 requests failed.

**Point at.**
1. The dashed target line as it steps up.
2. The worker boxes on the right when they appear.
3. The result box at the end.

**If asked.**
- *How fast did the workers scale?* The first worker was added 23 seconds after jobs began to wait, and the fourth 49 seconds after.
- *The proposal said 200 concurrent sessions.* This test shows the mechanism that carries that load: KEDA adds a worker for each five waiting jobs, and HPA adds pods on CPU. The same Helm chart runs on EKS, where node autoscaling adds machines as the load grows.
- *Why a fixed delay and not the real model?* The delay makes the test measure the platform, not the speed of the model provider. The jobs go through the same queues and the same KEDA trigger.
- *Why 1,040 requests for 135 questions?* Each question is one POST, and the test then reads its status every second until it ends.

### Slide 23: KEDA scaling (recorded)

- Outline item: 6 · Scalability
- Speaker: HE RONG
- Time: 50 s

**What is on the screen.** A terminal recording on the public server, 29 s long, with the prompt "lumen $". One command: `kubectl get hpa keda-hpa-worker -n lumen --watch`. Then a table that grows by one line at a time, with the columns NAME, REFERENCE, TARGETS, MINPODS, MAXPODS, REPLICAS, AGE. In TARGETS, the first number is the waiting jobs per worker on level 0, against the target, for example "0/5 (avg)". MINPODS is 1 and MAXPODS is 4 on every line. The recording shortens the waits between the lines.

**What happens, in order.**
- 0 s: the watch command is typed.
- 3.4 s: the header and the first line: "0/5 (avg)", REPLICAS 1.
- 5.4 s: "4/5 (avg)", REPLICAS 1.
- 7.4 s: "10/5 (avg)", REPLICAS 1.
- 9.4 s: "4/5 (avg)", REPLICAS 2.
- 11.4 s to 23.4 s: the jobs per worker go 4500m, 5, 5, 4, 2500m, 0, 0, while REPLICAS stays 2.
- 25.4 s: "0/5 (avg)", REPLICAS 1. The picture holds.

**What to say.**

> [0 s] The same autoscaler, with a short burst of questions.
>
> [3.4 s] The TARGETS column compares the waiting jobs per worker with the target of five.
>
> [9.4 s] The jobs reached 10 over 5, so the replicas went from one to two. With two workers, the jobs come down. 4500m means 4.5. The recording shortens the waits between the lines.
>
> [25.4 s] After the load, the replicas go back to one.
>
> Next, Peng Xujian. Peng Xujian built the project service, the agent registry, usage and the literature watch app. Peng Xujian now shows the platform live.

**Point at.**
1. The TARGETS column, "10/5 (avg)".
2. The REPLICAS column when it goes from 1 to 2, and back to 1.

**If asked.**
- *What does "+ 1 more" mean in TARGETS?* KEDA watches all three job queues, one trigger for each. The column shows two of them and says that one more follows.

**Handover.** "Next, Peng Xujian. Peng Xujian built the project service, the agent registry, usage and the literature watch app. Peng Xujian now shows the platform live."

---

## PENG XUJIAN: slide 24, the live demo, about 7 minutes

You built the project service, the agent registry, usage and the literature watch app. In the questions, you answer about the registry, usage and the watch app.

### Slide 24: Live demo

- Outline item: 6 · Live demo
- Speaker: PENG XUJIAN
- Time: 7 min

**What is on the screen.** No picture. A framed box with the address `https://lumen.54-179-112-87.sslip.io` in large monospace. Under it, five lines, with a grey label on the left:

- Use case: ask a question in the browser and watch the call tree grow
- Use case: publish an agent, ask with it from the watch app, read usage
- Scalability: KEDA on the live server
- Availability: delete a worker during a question, and the question still ends
- Maintainability: open the last pipeline run on GitHub

**What happens, in order.** You leave the slide on the screen for the first sentence. Then you switch to the browser and the terminal, and you follow the run sheet below.

#### Before the session (the evening before and 30 minutes before)

Do these on the presenting computer. Owner: LIU ZIYANG with PENG XUJIAN.

1. Start the EC2 instance the evening before, and open the public address once.
2. Check the model provider's spending limit.
3. The workers run the real model for the whole demo. Nobody runs a load test live.
4. Browser, tab 1: the public address, signed in with the demo account, on the home page.
5. Browser, tab 2: the GitHub Actions page of the workflow "Platform deploy".
6. Terminal, at the repository root, with a large font. Run these lines, so that the API key is never shown on screen:

   ```sh
   export TAPES=$PWD/docs/platform/slides/tapes
   source "$TAPES/env.sh"          # sets the address, the key header and kubectl over SSH
   export LUMEN_API_KEY=$(cat ~/.lumen-platform/demo-key)
   echo '[{"topic": "pattern avoidance in permutations", "agent": "literature-scout"}]' > /tmp/watches.json
   clear
   ```

   The demo key needs the scopes questions:read, questions:write, agents:read, agents:write and usage:read. Test each command of the run sheet once.
7. Open slide 24 in the deck. Keep the deck open, so you can go back to the recorded slides.
8. Open the backup video `ASS-Architecting-Scalable-Systems/Team15-Demo-Backup.mp4 (coursework repository)` once in the video player, and check its sound. In Zoom, test "Share sound" (computer sound) with it.

#### The run sheet

| Time | Line |
|---|---|
| 0:00 to 0:20 | Opening |
| 0:20 to 1:50 | 1. Ask in the browser |
| 1:50 to 3:40 | 2. Publish an agent, ask with it, read usage |
| 3:40 to 4:40 | 3. KEDA on the live server |
| 4:40 to 6:00 | 4. Delete a worker |
| 6:00 to 6:40 | 5. The pipeline |
| 6:40 to 7:00 | Close |

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
> Now the lead agent searches arXiv. Here are the papers. It hands one paper each to three readers. Here they are in the call tree, and they run in parallel.
>
> When a reader finishes, its finding appears here, at the top right. Every row in the call tree shows what it cost. Session saves each step that you see here in PostgreSQL.

- If it fails: if the page does not load or the run does not start within 20 seconds, say "The network is slow here, so I show you the recorded run." Go back to slide 2.

**Step 2: publish an agent, ask with it from the watch app, and read usage (1:50 to 3:40).**

- Do: switch to the terminal. Type and run each command:

  ```sh
  node apps/watch/publish-agent.mjs
  WATCH_FILE=/tmp/watches.json node apps/watch/watch.mjs
  curl -s "$API/usage" -H "$AUTH" | jq
  ```

- What appears:
  - The first command prints "Published the agent literature-scout." or, when it exists already, "The agent literature-scout exists already. Nothing to do."
  - The second command asks one question for the one topic in the watch list, and prints a Markdown digest: the answer, the findings, the cost and the time taken. The topic can take a minute or two.
  - The third command prints the usage JSON: "asConsumer", and "asProducer" with, for each agent, its short name, its questions, its cost and its median time to an answer.
- What to say:

> First, the producer side. I am the agent author now. This small script publishes the agent "literature-scout" to the registry. An agent is a short name, a name, a description and its instructions.
>
> Now the consumer side. The literature watch app uses only the public API and its own API key. It has no database, no model calls and no billing of its own. It asks the platform one question for each topic on its list, with that agent. The platform does the same work that you saw in the browser: a call tree, steps with their cost, and the budget cap.
>
> Here is the digest: the answer, the findings, the cost and the time it took.
>
> Last, as the agent author, I read usage. Here, for each agent, you see the number of questions, the cost and the median time to an answer.

- If it fails: if the watch app does not print a digest within 90 seconds, press Ctrl+C and say "I will not keep you waiting. Here is the same flow, recorded." Go back to slide 9 for the API calls and slide 15 for the recorded question. Then continue with step 3.

**Step 3: KEDA on the live server (3:40 to 4:40).**

- Do: in the terminal, run:

  ```sh
  kubectl get scaledobject,hpa -n lumen
  kubectl get pods -n lumen -l app.kubernetes.io/name=worker
  ```

- What appears: the first command lists the scaled object of the worker (at least 1, at most 4) and the CPU autoscalers of identity, project and billing. The second command lists the worker pods that run now.
- What to say:

> Now scalability, live. Here is KEDA's scaled object for the worker: at least one pod, at most four. Here are the CPU autoscalers for identity, project and billing. And here are the worker pods that run now. When more than five jobs wait for each worker, KEDA adds a pod, as He Rong showed in the load test.

- If it fails: if kubectl does not answer, go back to slide 23 and say "This is the same autoscaler, recorded on this server."

**Step 4: delete a worker during a question, and the question still ends (4:40 to 6:00).**

- Do: in the terminal, type and run each command:

  ```sh
  SID=$(curl -s "$API/questions" -H "$AUTH" -H "$JSON" -d '{"question":"Count the Dyck paths of semilength 6."}' | jq -r .sessionId); echo $SID
  VICTIM=$(kubectl get pods -n lumen -o name | tr -d '\r' | grep '^pod/worker-' | head -1); echo $VICTIM
  kubectl delete $VICTIM -n lumen --force --grace-period=0
  for i in $(seq 12); do curl -s "$API/questions/$SID" -H "$AUTH" | jq -c '{status, cost}'; sleep 4; done
  kubectl get pods -n lumen -l app.kubernetes.io/name=worker
  ```

  Press Ctrl+C on the loop as soon as two lines say "ended".
- What appears: the question id; the name of one worker pod; "force deleted"; then lines with "status":"running" and a cost; then lines with "status":"ended" and a higher cost. The last command shows the worker pods, with a new one at a young age.
- What to say:

> Now availability. I ask one more question through the API. Here is its id.
>
> Now I take one worker pod, and I force-delete it, with no grace period. Here it is deleted.
>
> Here we read the question every four seconds. It is still running.
>
> And here it ends. A worker acknowledges a job only when the job is done. So RabbitMQ gave the open job to another worker, and the question still ended.
>
> And here is the new worker pod that Kubernetes started.

- If it fails: if the status is not "ended" after the twelve reads, say "Here is the same test, recorded on this server." Go back to slide 16.

**Step 5: open the last pipeline run on GitHub (6:00 to 6:40).**

- Do: switch to browser tab 2, the GitHub Actions page of "Platform deploy". Click the top run. The run page shows its jobs as a graph: verify, SCA and SAST, then deploy, then DAST and the smoke load, then summary.
- What to say:

> Last, maintainability. Here is our pipeline on GitHub, and its last run. Here you can see every job: the tests, the dependency audit, CodeQL, the deploy with the Trivy gate, the ZAP scan and the smoke load. Every push to our integration branch runs all of these, and only an image that passes the gate goes live.

- If it fails: if GitHub does not load, say "Here are the runs, recorded." Go back to slide 20, and then slide 19 for the flowchart.

**Close (6:40 to 7:00).**

- Do: in the terminal, press Ctrl+C if a command still runs. Switch back to the deck and go to slide 25.

> That was the platform, live. Thank you. We are happy to take questions.

**If the live demo fails.** Say one sentence: "The network does not reach the server, so I play our recorded demo." Play the narrated backup video `ASS-Architecting-Scalable-Systems/Team15-Demo-Backup.mp4 (coursework repository)` (about 6 minutes). In Zoom, share the screen with computer sound on. Then go to slide 25. If the video cannot play either, show slides 12, 15, 16, 20 and 23, in that order, with one or two sentences each.

**Point at.**
1. In step 1, the call tree when the reader rows appear.
2. In step 3, the worker pods.
3. In step 4, the line where "running" changes to "ended".

**If asked.**
- *What can a producer publish?* An agent is a short name, a name, a description and instructions of at most 4000 characters. A consumer chooses the agent for each question.
- *How does the watch app use the platform?* Only through the public API, with its own API key, like any other consumer. It is about 210 lines.

**Handover.** "Thank you. We are happy to take questions."

---

## Everyone: slide 25, questions

### Slide 25: Thank you

- Outline item: none (end slide)
- Speaker: everyone. The owner of a part answers about it.
- Time: the rest of the 40 minutes, about 8 minutes

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
- *Where is the detail of a number?* Every number on the slides comes from our evidence files and the pipeline runs. The report gives each one, with its source.
