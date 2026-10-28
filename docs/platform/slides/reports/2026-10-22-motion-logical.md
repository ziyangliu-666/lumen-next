# Motion grammar: the overview and logical pictures (2026-10-22)

Module: `docs/platform/slides/scenes_motion_logical.py`, added at the end of `MODULES` in
`make.py`. Each scene keeps its GIF name and its scene key, so the deck picks it up. Every
GIF builds, ends on its complete diagram with nothing lit, and runs 25 to 29 s.

## platform.gif (key std_platform)

Motion: spotlight, then grow. Each relation grows from its source to its target, and the
target pulses once.

1. The platform boundary, the agent registry, the run engine, the producer and the consumers appear. No relations yet.
2. Producer side in the spotlight: the producer, the agent registry and "publish an agent". The publish line grows from the producer to the registry, and the registry pulses. The rest dims.
3. Consumer side in the spotlight: the literature watch app, the web app and people. "Ask with an API key" and "ask, signed in" grow into the run engine, and the engine pulses.
4. The seed in the spotlight: "the agent's instructions" grows from the registry into the run engine. Then the task tree, the steps and cost, and the budget cap light one after another.
5. "Answer + findings + cost" grows back to the watch app, and "the run, live" grows to the web app. Each target pulses.
6. Everything comes back to full ink. The picture ends on the full diagram.

Speaker notes: The platform sits between two groups of users. A producer, the agent author, publishes agents to the registry. A consumer asks: an app with its API key, or people who sign in to the web app. The seed is the run engine. It takes the agent's instructions, runs each question as a task tree, records each step with its cost, and keeps every step under the account's budget cap.

## usecases.gif (key usecases)

Motion: spotlight per actor; each association grows from the actor to the use case.

1. The four actors, the six use cases and the system boundary appear.
2. Producer: the links to UC1 Publish an agent and UC5 Read usage grow, one at a time. Each oval pulses.
3. Literature watch app: UC2 Ask a question and UC6 Watch the literature.
4. People in the web app: UC3 Manage API keys and UC4 Approve spend over cap.
5. Operator: UC5 Read usage. UC5 is shared with the producer.
6. The full diagram, nothing lit.

Speaker notes: This is the UML use case diagram of the platform. We take one actor at a time, so each actor's use cases are clear. The producer publishes and reads usage. The literature watch app asks and watches. People in the web app manage keys and approve spend over the cap. The operator also reads usage. All six use cases are built.

## decisions.gif (key decisions)

Motion: a before and after morph for each decision.

1. AD-01 before: one process, "main", holds five slices (modules/identity, projects, session, steering, billing).
2. AD-01 after: the box fades. Each slice moves up and becomes a component of its own: identity, project, session, worker, billing. The module path stays beside each name. The caption reads "Five services, cut along the slices".
3. AD-02 before: session calls a worker on a direct HTTP call.
4. AD-02 after: that line breaks and falls away. A RabbitMQ queue of turns appears between session and the worker, and turns fill it.
5. Behind the queue, the worker divides into three. Three turns go to the three workers at the same time. The caption reads "A durable queue, not a direct call".
6. AD-04 before: the worker writes each step to the trace (PostgreSQL).
7. AD-04 after: that line breaks. The step goes through session instead: "one call per step" from the worker to session, then "SQL: the only writer" from session to the trace.
8. Session is in the spotlight as the one writer; the worker dims. Then the three panels hold with their captions.

Speaker notes: The three key decisions are shown as before and after. AD-01 does not write new services: each slice of main gets a new entry point in the same image. AD-02 puts a durable queue between session and the workers, so a slow model call never holds a request, and any worker can take a turn. AD-04 makes session the only writer of the trace, so a worker that dies loses no step.

## contextmap.gif (key contextmap)

Motion: spotlight per context. Each domain event grows from its sender to its receiver, with its name.

1. The method strip builds: use cases UC1 to UC6, then the nouns users say, then 5 bounded contexts, then their aggregates.
2. The five contexts appear with their aggregates.
3. Projects: "question asked" grows to Session, and "finding recorded" grows back to Projects.
4. Identity: "account, API key" grows up to Projects. Identity is upstream.
5. Execution: "turn queued" grows from Session, and "step recorded" grows back.
6. Billing: "spend recorded" and "approval needed" grow from Session.
7. Session, the core domain, comes last: it lights with all six events and pulses.
8. The full map, nothing lit.

Speaker notes: We found the contexts from the use cases and the nouns that users say. Each context keeps its own aggregates. Each context talks to the others only through domain events, and each arrow shows who sends and who receives. Session comes last, because every event goes through it: it is the core domain.

## interaction.gif (key interaction)

Motion: messages grow in time order, and each reply grows back. Parentheses at the left group the calls into producer and consumer phases. The lifelines of the active phase are lit, and the other lifeline dims.

1. The three lifelines: Consumer app, Lumen platform (API v1), Producer.
2. Producer phase: 1 POST /api/v1/keys, then 2 POST /api/v1/agents. The consumer lifeline dims.
3. Consumer phase: 3 GET /api/v1/agents, 4 POST /api/v1/questions, 5 the platform runs it (a self call), 6 GET /api/v1/questions/:id. The producer lifeline dims.
4. Producer phase: 7 GET /api/v1/usage.
5. All seven calls, nothing lit.

Speaker notes: This sequence diagram shows real calls on the public API v1, in the order they happen. First the producer creates an API key and publishes an agent. Then a consumer lists the agents, asks with one of them, and reads the answer, the findings and the cost. Last, the producer reads usage. Publish, list, ask and read all use one API.

## logical.gif (key logical)

Motion: dependencies grow tier by tier as UML dependencies (dashed lines, open heads). At run time, one real question travels as a tag, and each component lights as the tag passes.

1. The four tiers: clients, edge, services, data.
2. The clients depend on the API gateway (Traefik).
3. The gateway routes to the five services: Identity, Project, Session, Worker, Billing.
4. Project and Worker call session's internal routes.
5. The services depend on the data: Identity, Project, Session and Billing on PostgreSQL (one database, tables per context); Session and Worker on RabbitMQ (AMQP); Worker on the LLM (an external API).
6. Run time: a question goes from the watch app through the gateway to Project. Project opens a session.
7. Session puts a turn on RabbitMQ, and a free worker takes it. The worker sends a prompt to the LLM and gets the reply.
8. Each step goes back to session, which saves it in PostgreSQL. The answer goes back through the gateway to the app.
9. The full component diagram, nothing lit.

Speaker notes: The logical architecture has four tiers, and each dependency points down. The clients see one gateway, and the gateway routes to five services. Only Project and Worker call session's internal routes. At run time a question becomes a session, then a turn on the queue. A free worker runs it, and session saves each step.

## queues.gif (key queues)

Motion: a wait-for cycle grows, lights and turns. The fix breaks the cycle, and the work drains.

1. One shared queue: two questions put two leads on it. Each worker has one slot and takes a lead.
2. Each lead delegates three readers and keeps its slot while it waits. Six readers wait on the shared queue.
3. The wait-for graph grows edge by edge: "lead waits for reader", "reader waits for a free slot", "slot held by lead".
4. The three edges close into a cycle. Dots run round it, and "deadlock" appears.
5. The fix: the picture changes to a queue per level (level 0 lumen.turns.0, level 1 lumen.turns.1, level 2 lumen.turns.2) and a slot per level in each worker. The readers move down to the level 1 queue.
6. A reader no longer waits for a lead's slot. The edge "reader waits for a free slot" falls away, and the cycle is broken.
7. The readers run in the reader slots: 2, 4, then 6 of 6 done. Level 2 stays empty, because readers do not delegate.
8. The leads write their answers. The picture ends with "all questions finish".

Speaker notes: AD-03 is about a deadlock that we found in design. With one shared queue, a lead keeps its slot while it waits for its readers, and the readers wait for a free slot. The waits close into a cycle, so no question can finish. A queue per level, with a slot per level, removes one edge of the cycle: the deepest level never waits, so the work always drains.

## Layout check fixes (reviews/2026-10-22-layout-check.md)

All eight GIFs were re-rendered one at a time inside the render lock. The last frames were measured: every GIF keeps at least 30 px from the bottom and side edges, and every last frame keeps its step title (C1, fixed in draw.py).

**platform**
1. The Web app to People line stopped 12 px short. It now ends at the tip of the actor's arm.
2. The pulse ring came within 9 px of the right edge. The ring is smaller (it grows 0.08 in, not 0.16 in), and the Consumers column moved 0.25 in left.
3. "budget cap" filled its box. It now breaks into two lines, "budget / cap", like "steps / and cost".
4. The platform frame ended 14 px from the bottom. The frame, the run engine and "the run, live" moved up; the frame now ends 31 px from the edge.

**usecases**
1. The right column was crowded. The ovals are 0.625 in tall with 0.25 in gaps, so the four right-hand ovals fill the column evenly.
2. The association lines stopped short of the actors. Each line now starts at the tip of the actor's arm.
3. The Operator to UC5 line had a 1 px step. UC5 now sits level with the Operator's arm, so the line is horizontal.
4. The system frame ended 17 px from the bottom. It is 0.15 in shorter and ends 35 px from the edge.

**milestones** (now owned here; scenes_lean.py)
1. The eased sweep crawled over the labels and the check marks. The sweep now moves at one constant speed (about 400 px a second), and it is drawn behind the bars, so a lit bar covers it: it never runs over a label. The chart moved up so that "October 2026" ends 43 px above the edge.

**decisions**
1. The new workers slid out with stacked labels. A new worker now fades in as it slides out, and its name shows only after it has left its parent.
2. The turn tokens stopped on the worker box edge. They now stop 0.18 in before it.
3. AD-04 had an empty corner. Session moved left, next to the worker and the trace; the whole AD-04 group is centred in its panel.
4. The captions and the panel lines came within 14 px of the bottom. The captions moved up 0.1 in, the panel lines end higher, and the third caption is shorter: "Session alone writes the trace".

**logical**
1. The arrows filled the 45 px gaps between the services. The service boxes are narrower (1.6 in) and spread over the width, so the gaps are 0.6 in (86 px).
2. The "step" chip crossed the gap. The gap is now wider. The chip text stays at 13 pt, because the deck allows no text under 13 pt.
3. The "answer" chip covered the gateway to Session arrow. It now travels 0.5 in to the right of the arrow.
4. The data lines left the boxes at mixed points. A box with one data line uses its centre (Billing now matches its gateway arrow); a box with two uses a quarter and three quarters.
5. "API gateway  (Traefik)" now has one space.
6. PostgreSQL ended 16 px from the bottom. The tiers are tighter, and the diagram now ends 37 px from the edge. RabbitMQ, the LLM and PostgreSQL lost the component mark: they are not our components, and the mark touched "AMQP".

**contextmap**
1. The method strip was too close to the map and too short. Its four boxes now spread across the map's full width, and the strip sits 0.35 in above the map.
2. The bottom of the Session box was empty. Its three aggregates moved down 0.28 in.
3. Identity and Billing ended 23 px from the bottom. Both are 0.1 in shorter (35 px from the edge), and the map keeps 30 px from both sides.

**interaction**
1. Message 7 and the activation bar ended 9 px from the bottom. The heads are shorter and start higher, and the lifelines end 0.24 in above the edge.
2. Each request and its reply were 14 px apart. They are now 0.13 in (19 px) apart, and the pitch is 0.452 in, so no label touches the reply above it. The diagram now ends 33 px above the edge.
3. The brackets touched each other and the last one was cramped. Each bracket now stops 11 px before the next, and the brackets sit 30 px from the left edge.

**queues**
1. The label "waits for a free" now reads "waits for a free slot".
2. The graph edges stopped short of the boxes. Each edge now runs from border to border.
3. The "reader" chips read as one white band. The cells are wider (0.88 in), and the chips have narrow padding, so each chip has 14 px of black on each side. The text stays at 13 pt (the deck's minimum).
4. The left half was empty below the shared queue. The shared queue now sits on the level 1 row. The fix turns it into level 1 in place: levels 0 and 2 grow in above and below, and the leads move up to the level 0 slots.
