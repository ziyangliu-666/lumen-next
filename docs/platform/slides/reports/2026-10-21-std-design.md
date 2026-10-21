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
