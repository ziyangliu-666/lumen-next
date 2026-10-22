# Standard-notation pictures: group "design"

Code: `docs/platform/slides/scenes_std_design.py` (SCENES: `queues`, `er`, `sequence`).
`make.py` has the module name `scenes_std_design` at the end of MODULES.
Each picture is 12.13 x 5.0 in, black page, white and grey ink, no hue. All text is 13 pt
or larger. I rendered each scene alone and checked it zoomed: GIFs at 10 to 12 frames
across the loop, the PNG in quarters.

## 1. out/queues.gif (slide "3a: key decision, one queue per level")

30.5 s, loops from the empty diagram to the full one. The upper half is "one shared
queue". The lower half is "a queue for each level". Turns are white tags with the words
"lead" and "reader". There are two workers in each half.

Steps (the step title is at the top):
1. "AD-03: why each level of the task tree has its own queue". Both halves are empty.
2. "One shared queue: two questions put two lead turns on it". Two "lead" tags enter the queue.
3. "Each worker has one slot, and each takes a lead". The two leads move into the slots of worker 1 and worker 2.
4. "Each lead delegates three readers, and keeps its slot while it waits". Six "reader" tags enter the queue. "waiting for its readers" appears under each worker.
5. "The readers wait for a slot that never frees". "no free worker" appears under the queue, then a white "deadlock" block appears beside the half's name. The upper half stays like this until the end.
6. "A queue for each level: each worker has a slot per level". The lower half has `lumen.turns.0`, `lumen.turns.1` and `lumen.turns.2`. Each worker has one slot per level. Two leads go through `lumen.turns.0` into the level-0 slots.
7. "The leads wait in their slots; the readers go on lumen.turns.1". Six readers enter `lumen.turns.1`.
8. "The readers run in the reader slots: 0, 2, 4, 6 of 6 done". The readers go two at a time into the level-1 slots and finish there.
9. "The leads write their answers, and every question finishes". The leads leave their slots, and a white "all questions finish" block appears.
10. "lumen.turns.2 stays empty: readers do not delegate".

Facts and sources:
- AD-03 (report 3.1.1): the three queue names. Also the reason: a parent turn keeps its slot while `delegate` waits, so with one queue the waiting parents fill every slot.
- Three readers per lead: report 3.2.4, use case A, step 9 ("`delegate` opens three child tasks (depth 1)").
- "lumen.turns.2 stayed empty, because readers (depth 1) do not delegate": report 4.1.
- One slot per worker in the upper half and one slot per level in the lower half are a simplification. The real default is `LUMEN_WORKER_SLOTS` = 4 per level per pod (AD-03). The slide title or the speaker says this.

Speaker notes:
"A lead turn keeps its worker slot while its readers run. With one shared queue, two
questions are enough to fill both slots with waiting leads. Their readers then sit in the
queue, and no worker is free to take them: that is a deadlock. So we gave each level of
the task tree its own queue and its own slots on every worker. The leads wait in the
level-0 slots, the readers run in the level-1 slots, and every question finishes. The
cost is three queues to watch and three KEDA triggers instead of one."

## 2. out/er.png (slide "4c: persistence")

A static ER diagram in crow's-foot notation. There is one thin frame per owning context,
with the context name in its top-left corner:
- identity: `accounts`, `platform_api_keys`
- project: `projects`, `findings`, `platform_agents`, `platform_question_intents`
- session: `sessions`, `tasks`, `steps`
- billing: `billing_wallets`, `ledger_entries`, `billing_approvals`

Each table shows its primary key (PK), its foreign keys (FK) and the key columns of
report 3.2.3. A solid line is a foreign key in the schema. A dashed line is an id from
another context that has no foreign key. A small key at the bottom left says this. Under
the diagram is the one line: "PostgreSQL 16 · money as numeric(12,6) · RabbitMQ keeps
turns in flight · files on a 2Gi volume".

Relationships drawn (one to many, bar on the one side, crow's foot on the many side):
- solid (foreign keys): accounts to platform_api_keys, accounts to platform_agents (owner_account_id), platform_agents to platform_question_intents (agent_id), projects to findings (project_id), sessions to findings, tasks to findings, sessions to tasks, tasks to tasks (parent_id, a self loop), tasks to steps, tasks to ledger_entries (task_id).
- dashed (an id, no foreign key): accounts to projects (account_id), projects to sessions (project_id).
- I did not draw the other text `account_id` columns (sessions, intents, billing tables) or `billing_approvals.task_id` and `platform_question_intents.session_id`. With them, lines from `accounts` would cross the whole picture. Each of those columns is still shown in its table.

Facts checked against the migrations (apps/server/src/core/db/migrations):
- `001_core_base.sql`: the base tables. `steps` has the primary key (task_id, index). `tasks.parent_id` references `tasks(id)`. `ledger_entries.task_id` references `tasks(id)`.
- `005_projects_read_model.sql` drops the foreign key `projects.account_id` (it becomes text) and adds `findings.project_id` with a foreign key to `projects`. For this reason `projects.account_id` is dashed and `findings` shows `project_id` as FK. Report 3.2.3 does not list `project_id`; the schema has it.
- `007`: `billing_wallets` (PK account_id, cap). `012`: `billing_approvals`. `011` and `008` add `tasks.pending` and `steps.detail`.
- `090_platform_api_keys.sql` and `091_platform_registry.sql`: the platform tables and their foreign keys. `apps/server/src/services/platform/apiKeys.ts` and `registry.ts` use the same column names.
- The table keeps only the key columns. Left out: `tasks.title`, `tasks.seq`, `findings.text`, `ledger_entries.reason` and the timestamps.

Speaker notes:
"All persistent data is in one PostgreSQL 16 database, and each context owns its own
tables: the frames show the owner. Inside a context we use real foreign keys. Across
contexts, a service keeps only the other context's id, so it does not depend on another
team's schema. The task tree is one table with a parent link, so the cost roll-up and the
usage queries are plain SQL. Money is numeric(12,6). Turns in flight are in RabbitMQ, not
in the database, and the agents' files are on a 2Gi volume."

## 3. out/sequence.gif (slide "4d: detailed design")

22 s. A UML sequence diagram of use case A in report 3.2.4 (ask a question with a chosen
agent). The lifelines are plain boxes: Watch app, Traefik, project service, session
service, PostgreSQL, RabbitMQ, worker service, OpenAI API. PostgreSQL stands next to
session service, not at the end. Session service is the only one here that writes to it,
so no message crosses an activation bar. Activation bars grow down as time runs. The
current message is white, and earlier messages are grey. Calls are solid arrows, and
returns are dashed with an open head.

Steps and messages (13 arrows; 201 and consume share a row because they happen at the same time):
1. "Use case A: ask a question with a chosen agent". Lifelines only.
2. "1. The watch app sends the question with its API key": `POST /api/v1/questions` (Watch app to Traefik), `forward` (Traefik to project service).
3. "2. Project checks the key, then opens a session": `key guard check` (a self call), `POST /internal/directory/start` (project to session).
4. "3. Session puts the root turn on lumen.turns.0": `publish lumen.turns.0` (session to RabbitMQ).
5. "4. The app gets 201, and a worker takes the turn": `201 {sessionId}` (return to the Watch app) and `consume` (RabbitMQ to worker).
6. "5. For each step, the worker calls the model and reports the step": a `loop [each step]` frame with `chat completion` (worker to OpenAI API), `POST /internal/turns/:id/step` (worker to session) and `INSERT steps` (session to PostgreSQL).
7. "6. The app reads the answer": `GET /api/v1/questions/:id` (Watch app to Traefik), `forward` (Traefik to session), `200 {status, answer, findings, cost}` (return).
8. "On the public host: the answer in 4.9 s, for USD 0.01". The full diagram stays.

Facts and sources:
- The message path: report 3.2.4, use case A, steps 1 to 11.
- `/internal/directory/start`: `apps/server/src/services/shared/directory.ts`.
- `/internal/turns/:turnId/step` is the member `step` that calls `appendStep`: `apps/server/src/services/shared/turnRoutes.ts`.
- `POST /api/v1/questions`: `platform/askRoutes.ts`. `GET /api/v1/questions/:sessionId`: `platform/answerRoutes.ts`, in the session service. The picture writes `:id` to fit.
- The 201 body `{sessionId, projectId, agent}` and the answer fields (status, answer, findings, cost) come from report 3.2.4, steps 3 and 11. The picture shortens the 201 body to `{sessionId}`.
- 4.9 s and USD 0.01: report 3.2.4, from `docs/platform/evidence/2026-10-20-public-api-flow.md`.

Speaker notes:
"This is use case A: a consumer asks a question with an agent that a producer published.
The request comes through Traefik to the project service. The key guard checks the key,
its rate and its scope, and then project asks session to open the session. Session puts
the root turn on lumen.turns.0 and the client gets 201 at once. Any worker takes the turn.
For each step it calls the model and posts the step to session, which writes it to
PostgreSQL. The client then reads the answer with a GET. On the public host this took 4.9
seconds and cost one cent."

## Animated: er.gif and deployment.gif

Both scenes now render as GIFs. Each scene also writes its first frame as a PNG, so
`out/er.png` and `out/deployment.png` now show only the opening frame (the first build
step, not the full diagram). Each loop has three phases: build, flow, then a calm hold of
3.6 s with nothing lit. I rendered each scene alone and checked 12 frames spread over each
loop, zoomed.

### out/er.gif (slide 4c), 26.0 s

- **Code:** `er()` in `scenes_std_design.py`.
- **Title band:** the diagram needs almost the full height. `HighScene` therefore draws the
  23 pt step title at y = 0.02 in, not at 0.18 in.
- **Space:** to fit under the title, the rows are 0.20 in, the table name rows 0.28 in, and
  the gaps are smaller. The layout, the tables, the columns and the lines are the same as
  in er.png.

Build:
1. "identity: accounts and their API keys". The frame appears, then `accounts`, then `platform_api_keys`.
2. "project: projects, findings, the agent registry". The frame appears, then the four tables one by one.
3. "session: the trace of each question". The frame appears, then `sessions`, `tasks`, `steps`.
4. "billing: wallet, ledger, approvals". The frame appears, then the three tables.
5. "Relationships: foreign keys, and ids from other contexts". All crow's-foot lines and the key appear. Then the line "PostgreSQL 16 · money as numeric(12,6) · RabbitMQ keeps turns in flight · files on a 2Gi volume" appears.

Flow: an "INSERT" tag runs along each relationship line. The line is white while the tag
runs on it. The table that receives the row then lights (white border, raised fill).
1. "One question: the intent row comes first". The tag runs from `platform_agents` to `platform_question_intents` (askRoutes writes the intent before the project).
2. "Then the project row, for the caller's account". The tag runs from `accounts` to `projects`.
3. "The session opens, with its root task at depth 0". The tag runs from `projects` to `sessions`, then from `sessions` to `tasks`.
4. "Each step of the lead is a row in steps". The tag runs from `tasks` to `steps`.
5. "delegate: a child task points to its parent_id". The tag runs round the `tasks.parent_id` self loop.
6. "A reader records a finding". The tag runs from `tasks` to `findings`.
7. "Each model call adds its cost to the ledger". The tag runs from `tasks` to `ledger_entries`.

Hold: "Four contexts, each owns its tables, in one PostgreSQL 16". The full diagram stays with nothing lit.

The write order follows report 3.2.4, use case A:
- step 3: the intent row, then the project;
- steps 5 to 8: the session, the root task, and the steps through the report calls;
- step 9: `delegate` opens the child tasks;
- the report calls `recordFinding` and `addSpend` write the findings and the ledger entries.

### out/deployment.gif (slide 11), 24.7 s

- **Code:** `deployment()` in `scenes_std.py`. The helpers `comp`, `node`, `tag`,
  `label_on` and `typing` did not change.
- **Layout:** the positions are the same as in the static diagram.

Build:
1. "Outside the server: browser, watch app, CI/CD, the model API". The four outside nodes appear.
2. "One AWS node: an EC2 t3.medium in Singapore". The AWS node appears with "security group: 22, 80, 443 open".
3. "k3s runs on it, with the namespace lumen". The cluster node appears.
4. "Traefik, then the five service pods". Traefik appears, then identity, project, session, worker and billing, one by one.
5. "PostgreSQL and RabbitMQ as StatefulSets, and KEDA".
6. "The connectors, each with its protocol and port". The wires appear with HTTPS 443, SSH 22 and HTTPS.

Flow:
1. "A request: HTTPS on 443 to Traefik, then the project pod". The Browser lights. A "request" tag runs along the HTTPS 443 wire to Traefik, which lights. Then it runs along the pod bus to the project pod, which lights.
2. "The worker pod calls the OpenAI API over HTTPS". The worker lights. A "chat completion" tag runs up the HTTPS wire and stops under the OpenAI API node, which lights.
3. "A deploy: GitHub Actions over SSH 22 into k3s". GitHub Actions lights. A "deploy" tag runs along the SSH 22 wire, and then the k3s cluster lights.
4. "KEDA scales the worker pods with the queue". KEDA and the worker light. The worker's label counts "1 pod", "2 pods", "3 pods", "4 pods".

Hold: "One EC2 node runs the whole platform in k3s". The full diagram stays with nothing lit.

Facts: the node, region, security group, replica ranges (worker 1 to 4 with KEDA) and
the protocols are the ones in the static diagram and in report 3.2. Section 4.1 of the
report shows four worker pods under load.

## Fixes after the clarity and slop review (2026-10-22)

All three GIFs now play once and stop on their last frame (draw.py at 30 fps). In every
last frame, nothing is lit or moving. I rendered one scene at a time and checked 11 frames
of each, zoomed.

### sequence.gif (21.6 s)
- The last title is now "The app gets 201 at once and reads the answer later". The title
  "On the public host: the answer in 4.9 s, for USD 0.01" is gone.
- The speaker notes in my first section still end with the 4.9 s and one-cent sentence.
  Remove that sentence too.

### queues.gif (30.9 s)
- The last frame now shows the solved lower half:
  - each worker's level-0 slot keeps its "lead" tag with a check mark;
  - the "all questions finish" block stays visible;
  - the deadlock stays in the upper half.
- The order at the end:
  1. "The readers run in the reader slots: 6 of 6 done".
  2. "lumen.turns.2 stays empty: readers do not delegate".
  3. "The leads write their answers, and every question finishes". The check marks and the block appear, and this frame stays.
- The words are lead, reader, level and slot everywhere. No frame uses parent, child or depth.

### er.gif (26.6 s)
- The last title is "Four of five contexts own tables; the worker owns none". A fifth thin
  frame, "worker", with "no tables" inside it, stands at the top right. It is built last,
  with the step title "worker: runs the agents, owns no tables". To make room, the gaps in
  the top row are 0.08 in smaller.
- I checked each line against the migrations. The lines were already correct, so none
  changed. Solid means a `references` clause in the schema. Dashed means a plain id.
  - **Inside a context, solid:**
    - accounts to platform_api_keys (090);
    - platform_agents to platform_question_intents (091, `agent_id`);
    - projects to findings (005, `findings.project_id`);
    - sessions to tasks, tasks to tasks (`parent_id`), and tasks to steps (001).
  - **Across contexts, solid (real foreign keys):**
    - platform_agents.owner_account_id to accounts (091);
    - findings.session_id to sessions, and findings.task_id to tasks (001);
    - ledger_entries.task_id to tasks (001).
  - **Across contexts, dashed (plain ids):**
    - projects.account_id to accounts (005 drops that foreign key and makes the column text);
    - sessions.project_id to projects (text, no foreign key).
  - **Plain ids that the picture does not draw:**
    - `account_id` in sessions, the question intents and the three billing tables;
    - `platform_question_intents.session_id`;
    - `billing_approvals.task_id`.
- **The proposed notes do not match the schema.** They say that only findings and ledger
  entries cross with foreign keys. Two more foreign keys cross: platform_agents to
  accounts, and findings to sessions. Notes that match the picture:
  "One shared database (AD-06). Inside a context, tables use foreign keys. Across contexts,
  most references are plain ids. A few foreign keys cross: findings point to sessions and
  tasks, ledger entries point to tasks, and an agent points to its owner's account."
