# Wording review: ASS deck, 23 October 2026

Scope: everything the audience sees or hears in the ASS deck
(`out/Team15-Lumen-Platform.pptx`): the slide text and the speaker notes in `build.js`,
the text drawn in each GIF that `build.js` uses (the winning scene function in `make.py`),
`script.md` and `speaker-guide.md`.

Winning scene functions: `milestones` (scenes_lean); `std_platform` (platform.gif),
`usecases`, `decisions`, `contextmap`, `interaction`, `logical`, `queues`
(scenes_motion_logical); `physdecisions`, `deployment`, `scaling`, `er`, `sequence`,
`branches`, `cicd` (pipeline.gif), `findings` (scenes_motion_physical). The `rec-*.gif`
files and `lumen-at-work.gif` are real recordings: their text is not ours to change.

## 1. Glossary

One term per concept. "Keep" is the word the audience sees and hears. "Drop" are the
words that we remove from slides, GIFs, notes and the script. Code identifiers (queue
names, paths, table names, environment variables) stay as they are.

| Concept | Keep | Drop | Explained where |
|---|---|---|---|
| A part of the old Lumen program that becomes a service | **module** | slice, "main" (as the name of the program) | Slide 6, AD-01 |
| A deployed part of the platform | **service** (identity, project, session, worker, billing) | | Slide 7 |
| The work of one agent | **task** | | Slide 2 |
| The tree of tasks of one question | **call tree** (the word the web app shows) | task tree | Slide 2, on the screen |
| One recorded action of an agent, with its cost | **step** | trace | Slide 3 |
| The agent that plans and hands out work | **lead agent** (short: lead, in the queue picture only) | | Slide 2 |
| An agent that reads one paper | **reader agent** (short: reader) | | Slide 2 |
| One unit of work that waits on the queue | **job** | turn, root turn | Slide 6, AD-02 |
| What a reader records | **finding** | | Slide 2 |
| The spend limit of an account | **budget cap** | cap (alone), seed | Slide 3 |
| A person's yes to spend over the cap | **approval** | | Slide 4 |
| A process that takes jobs from the queue and runs agents | **worker** (a worker pod in Kubernetes) | paced worker, slot | Slide 6 |
| The capacity of a worker for one level | "a worker runs one job of each level" | slot, reader slot, worker slot | Slide 13 |
| The depth of a task in the call tree | **level** (level 0 is the lead agent) | task level | Slide 13 |
| The language model | **the model** (logical picture: "Model"; physical picture: "OpenAI API") | LLM, language model | Slide 7 |
| The worker context in DDD | **Worker** | Execution | Slide 8 |
| The project context in DDD | **Project** | Projects | Slide 8 |
| Making more pods | "HPA / KEDA adds a pod" | divide, merge back | Slide 10 |
| The load test's stand-in for the model | "a fixed delay in place of each model call" | paced worker | Slide 22 |
| Git: a branch starts from another | "branches off", "merges back" | grows out, grows back, left main | Slide 18 |

Terms kept with no change: producer, consumer, agent author, agent registry, API key,
use case, run engine, bounded context, domain event, core domain, gateway, pod, HPA, KEDA,
Trivy gate, pipeline.

## 2. Findings

Each finding: the current text, the problem, the replacement.

### 2.1 build.js (slide text and speaker notes)

1. Slide 3 notes. Current: "The seed is the run engine. It takes the agent's instructions, runs each question as a task tree, records each step with its cost, and keeps every step under the account's budget cap." Problem: internal jargon ("seed"); two words for one thing (task tree, call tree). Replacement: "In the middle is the run engine. It takes the agent's instructions, runs each question as a call tree, records each step with its cost, and keeps the spend under the account's budget cap."
2. Slide 6 notes. Current: "AD-01 does not write new services: each module of main gets a new entry point in the same image. AD-02 puts a durable queue between session and the workers, so a slow model call never holds a request, and any worker can take a turn. AD-04 makes session the only writer of the trace, so a worker that dies loses no step." Problem: "main" is also a branch name; "turn", "trace" are internal. Replacement: "AD-01: each module of Lumen becomes a service, with its own entry point in the same image. AD-02 puts a durable queue between session and the workers, so a slow model call never holds a request, and any worker can take the next job. AD-04 makes session the only writer of the steps, so a worker that dies loses no step."
3. Slide 7 notes. Current: "At run time a question becomes a session, then a turn on the queue. A free worker runs it, and session saves each step." Problem: "turn"; "a session" and "session" (the service) in one sentence. Replacement: "At run time, project passes the question to session, and session puts a job on the queue. A free worker runs it, and session saves each step."
4. Slide 7 notes. Current: "each with one job and its own tables". Problem: "job" now means a queue job. Replacement: "each with one purpose and its own tables".
5. Slide 8 notes. Current: "Session comes last, because every event goes through it: it is the core domain." Problem: drama colon. Replacement: "Session comes last, because every event goes through it. Session is the core domain."
6. Slide 10 notes. Current: "One PostgreSQL with a frame per context lets one transaction write the step, its cost and the ledger entry together." Problem: "frame" is a picture word, not an architecture word. Replacement: "One PostgreSQL, with its own tables for each context, lets one transaction write the step, its cost and the ledger entry together."
7. Slide 13 title. Current: "Decision: one queue per task level". Problem: "task level" is not a known term. Replacement: "Decision: one queue per tree level".
8. Slide 13 notes. Current: "With one shared queue, a lead keeps its slot while it waits for its readers, and the readers wait for a free slot. ... A queue per level, with a slot per level, removes one edge of the cycle: the deepest level never waits, so the work always drains." Problem: "slot" is internal; drama colon. Replacement: "With one shared queue, a lead agent holds its worker while it waits for its readers, and the readers wait for a free worker. The waits close into a cycle, so no question can finish. With a queue per level, each worker runs one job of each level. A reader no longer waits behind a lead, so the cycle breaks and every question finishes."
9. Slide 14 notes. Current: "session opens and publishes the root turn ... while a worker takes the turn". Problem: "root turn", "turn". Replacement: "session starts the question and puts the first job on the queue ... while a worker takes the job".
10. Slide 16 notes. Current: "Its turn was not acknowledged, so RabbitMQ gives it to another worker". Problem: "turn". Replacement: "Its job was not acknowledged, so RabbitMQ gives it to another worker".
11. Slide 21 notes. Current: "One queue for all turns let leads hold every worker slot while their readers waited, so the queue became one queue per level of the task tree." Problem: "turns", "slot", "task tree". Replacement: "With one queue for all jobs, the lead agents held every worker while their readers waited, so we made one queue per level of the call tree."
12. Slide 22 notes. Current: "with the paced worker, so it measures the platform's scaling and not the model. ... you see the worker divide as the cursor passes that moment. ... the extra pods merge back". Problem: "paced worker" is internal; "divide" and "merge back" are odd for pods. Replacement: "with a fixed delay in place of each model call, so it measures the platform's scaling and not the model. ... a new worker pod appears on the right as the cursor passes that moment. ... KEDA removes the extra pods".
13. Slide 24 line 3. Current: "the recorded load test; KEDA's state, live". Problem: "KEDA's state" is vague. Replacement: "the recorded load test, then KEDA live".

### 2.2 platform.gif (std_platform, scenes_motion_logical.py)

14. Box. Current: "Run engine: the seed". Problem: internal jargon. Replacement: "Run engine".
15. Box. Current: "task tree". Problem: two words for one thing. Replacement: "call tree".
16. Step title. Current: "Consumers: an app asks with its API key; people ask, signed in". Problem: clipped phrase "people ask, signed in". Replacement: "Consumers: an app asks with an API key; people ask in the web app".
17. Step title. Current: "The seed: the run engine takes the agent's instructions". Problem: jargon. Replacement: "The run engine takes the agent's instructions".
18. Step title. Current: "Each question runs as a task tree". Replacement: "Each question runs as a call tree".
19. Step title. Current: "The answer, its findings and cost go back; people see the run live". Problem: "its findings and cost" reads as one list with a missing article. Replacement: "The answer, findings and cost go back; people watch the run live".
20. Last title. Current: "Overview: the Lumen platform between producers and consumers". Problem: "Overview:" adds nothing. Replacement: "The Lumen platform between producers and consumers".

### 2.3 usecases.gif

21. Oval. Current: "Approve spend over cap". Problem: missing article. Replacement: none in the end (see section 4): with "the", the text touches the oval outline.
22. Step title. Current: "People in the web app manage API keys (UC3), approve spend (UC4)". Problem: comma list with no "and". Replacement: "People in the web app manage API keys (UC3) and approve spend (UC4)".

### 2.4 decisions.gif

23. Caption AD-01. Current: "Five services, cut along the modules / same image, a new entry point each". Problem: clipped, odd. Replacement: "Five services, one per module / one image, an entry point per service".
24. Box. Current: "one process: main". Problem: "main" is also the git branch. Replacement: "one process: Lumen".
25. Step title. Current: "AD-01 before: five modules in one process on main". Replacement: "AD-01 before: five modules in one Lumen process".
26. Step title. Current: "AD-01 after: each module moves up into a service of its own". Problem: too long. Replacement: "AD-01 after: each module becomes a service".
27. Label. Current: "RabbitMQ\nqueue of turns". Problem: "turns". Replacement: "RabbitMQ\nqueue of jobs".
28. Step title. Current: "AD-02 after: the direct call breaks; a durable queue takes its place". Problem: too long. Replacement: "AD-02 after: a durable queue replaces the direct call".
29. Step title. Current: "AD-02: behind the queue, the worker divides; any worker takes a turn". Problem: "divides", "turn". Replacement: "AD-02: more workers can start, and any worker takes the next job".
30. Caption AD-04. Current: "Session alone writes the trace". Problem: "trace" is a second word for the steps. Replacement: "Only session writes the steps".
31. Box. Current: "trace" (over "PostgreSQL"). Replacement: "steps".
32. Step title. Current: "AD-04 before: the worker writes each step to the trace". Replacement: "AD-04 before: the worker writes each step to the database".
33. Step title. Current: "AD-04 after: that line breaks; the step goes through session". Replacement: "AD-04 after: each step goes through session".
34. Label. Current: "one call per step". Problem: vague. Replacement: "sends each step".
35. Label. Current: "SQL: the only writer". Problem: drama colon. Replacement: "the only writer".
36. Step title. Current: "AD-04: session is the one writer of the trace". Replacement: "AD-04: session is the only writer of the steps".

### 2.5 contextmap.gif

37. Strip. Current: "nouns users say: agent, question, step, cap". Replacement: "nouns users say: agent, question, step, budget cap".
38. Context name. Current: "Projects". Problem: the service and the ER frame say "project". Replacement: "Project".
39. Context name and lines. Current: "Execution" with "the worker loop;", "it keeps no state". Problem: two names for the worker. Replacement: "Worker" with "the agent loop;", "it keeps no state".
40. Event. Current: "turn queued". Replacement: "job queued".
41. Step title. Current: "Projects sends question asked, receives finding recorded". Problem: clipped. Replacement: "Project sends question asked and receives finding recorded".
42. Step title. Current: "Execution receives turn queued, sends step recorded". Replacement: "Worker receives job queued and sends step recorded".

### 2.6 interaction.gif

43. Step title. Current: "A producer publishes; a consumer asks; one public API". Problem: three-part slogan with semicolons. Replacement: "Producers and consumers use one public API".
44. Message 5. Current: "5  runs it, the agent's instructions first". Problem: odd phrase. Replacement: "5  runs the agent on the question".

### 2.7 logical.gif

45. Step title. Current: "Services depend on the data: one database, one broker, the LLM". Problem: three-item list; "broker" and "LLM" are two more names. Replacement: "Services depend on PostgreSQL, RabbitMQ and the model".
46. Box. Current: "LLM". Problem: "LLM", "model" and "language model" for one thing. Replacement: "Model".
47. Step title. Current: "Project opens a session". Problem: "a session" next to the session service. Replacement: "Project passes the question to session".
48. Step title. Current: "Session puts a turn on the queue; a free worker takes it". Replacement: "Session puts a job on the queue; a free worker takes it".
49. Tag. Current: "turn". Replacement: "job".
50. Step title. Current: "The worker runs the agent with the LLM". Replacement: "The worker calls the model".

### 2.8 queues.gif

51. Header. Current: "a queue per level, a slot per level". Problem: "slot". Replacement: "a queue per level; each worker runs one job per level".
52. Graph node. Current: "slot". Replacement: "worker".
53. Graph edge. Current: "waits for a free slot". Replacement: "waits for a free worker".
54. Graph edge. Current: "held by". Problem: reads backwards for "worker held by lead". Replacement: "busy with".
55. Step title. Current: "AD-03: one shared queue; two questions put two leads on it". Replacement: "AD-03: one shared queue; two questions start two lead agents".
56. Step title. Current: "Each worker has one slot, and each takes a lead". Replacement: "Each worker runs one job, and each takes a lead".
57. Step title. Current: "Each lead delegates three readers, and keeps its slot while it waits". Problem: "delegates three readers" is odd; "slot". Replacement: "Each lead starts three readers and holds its worker while it waits".
58. Step title. Current: "A reader waits for a free slot". Replacement: "A reader waits for a free worker".
59. Step title. Current: "Every slot is held by a lead". Replacement: "Every worker is busy with a lead".
60. Step title. Current: "The waits close into a cycle: no question can finish". Problem: drama colon. Replacement: "The waits close into a cycle, so no question can finish".
61. Step title. Current: "The fix: a queue per level, and a slot per level". Replacement: "The fix: a queue per level; each worker runs one job per level".
62. Step title. Current: "A reader no longer waits for a lead's slot: the cycle breaks". Replacement: "A reader no longer waits behind a lead, so the cycle breaks".
63. Step title. Current: "The readers run in the reader slots". Replacement: "The readers run beside the leads".
64. Last title. Current: "Per-level queues and worker slots after all questions finish". Replacement: "With a queue per level, all questions finish".

### 2.9 physdecisions.gif

65. Caption AD-09. Current: "the laptop chart, unchanged; USD 1.3 a day". Problem: "laptop chart" is odd. Replacement: "the same Helm chart; about USD 1.3 a day".
66. Label. Current: "KEDA: 5 turns per worker". Replacement: "KEDA: 5 jobs per worker".
67. Row label. Current: "turns". Replacement: "jobs".
68. Step title. Current: "AD-11: CPU passes 70%; identity, project and billing divide". Problem: "divide" for pods. Replacement: "AD-11: CPU passes 70%, so HPA adds identity, project and billing pods".
69. Step title. Current: "AD-11: turns wait; the worker divides while its CPU stays low". Replacement: "AD-11: jobs wait, so KEDA adds workers; their CPU stays low".

### 2.10 scaling.gif

70. Top line. Current: "load test, 20 October: the paced worker, no model calls". Problem: "paced worker" is internal. Replacement: "load test, 20 October, with a fixed delay in place of each model call".
71. Step title. Current: "Above 5 jobs per worker, KEDA adds a pod: the worker divides". Replacement: "Above 5 jobs per worker, KEDA adds a worker pod".
72. Step title. Current: "A minute after the load, KEDA removes the extra pods: they merge back". Replacement: "A minute after the load, KEDA removes the extra pods".

### 2.11 er.gif

73. Step title. Current: "An account owns the agents it registers". Problem: "registers" is a second verb for "publishes". Replacement: "An account owns the agents it publishes".
74. Step title. Current: "A question intent names one agent". Problem: "question intent" is internal. Replacement: "A question can name one agent".
75. Last title. Current: "ER diagram: PostgreSQL 16 tables, money as numeric(12,6)". Problem: reads as "16 tables". Replacement: "ER diagram: PostgreSQL 16; money is numeric(12,6)".

### 2.12 sequence.gif

76. Message. Current: "key guard check". Problem: internal name. Replacement: "check the API key".
77. Step title. Current: "Project opens a session; session publishes the root turn". Replacement: "Session starts the question and puts the first job on the queue".
78. Step title. Current: "The app gets 201 at once, while a worker takes the turn". Replacement: "The app gets 201 at once, while a worker takes the job".

### 2.13 branches.gif

79. Label. Current: "left main on 19 October". Replacement: "branched off main on 19 October".
80. Step title. Current: "ass/platform grows out of main on 19 October". Problem: "grows out" is odd for git. Replacement: "ass/platform branches off main on 19 October".
81. Step title. Current: "A short-lived branch grows out for one change". Replacement: "A short-lived branch holds one change".
82. Step title. Current: "Pull request #148 grows back into ass/platform". Replacement: "Pull request #148 merges it back into ass/platform".

### 2.14 pipeline.gif (cicd)

83. Step title. Current: "The first run: verify, SCA and SAST grow at the same time, and pass". Replacement: "The first run: verify, SCA and SAST run at the same time and pass".
84. Step title. Current: "5 critical CVEs: the line breaks at the Trivy gate". Problem: describes the drawing, not the event. Replacement: "5 critical CVEs: the Trivy gate stops the deploy".

### 2.15 findings.gif

85. Step title. Current: "1. One queue for all turns: leads hold every worker slot". Replacement: "1. One queue for all jobs: the leads hold every worker".
86. Problem text. Current: "One queue per level of the task tree\n(AD-03)." Replacement: "One queue per level of the call tree\n(AD-03)."
87. Box. Current: "worker slots" with "all held by leads" / "readers always run". Replacement: "workers" with "all busy with leads" / "readers always run".
88. Step title. Current: "3. The chart sets 60 s: the bar shrinks to a fifth". Problem: describes the drawing. Replacement: "3. The chart sets 60 s, a fifth of the default".
89. Last title. Current: "Three technical findings and how the team fixed them". Replacement: "Three technical findings and their fixes".

### 2.16 script.md

90. Slide 3, screen and steps: "Run engine: the seed", "task tree", the step titles of findings 16 to 20. Replacement: the new GIF text.
91. Slide 3, say at 10.1 s. Current: "In the middle is the seed: the run engine. It takes the agent's instructions, and it runs each question as a task tree." Replacement: "In the middle is the run engine. It takes the agent's instructions, and it runs each question as a call tree."
92. Slide 3, if asked. Current: "*What is the "seed"?* ..." Problem: the word is no longer said. Replacement: remove the question.
93. Slide 3, say. Current: "So a new app gets all of this for free." Problem: vague claim. Replacement: "So a new app does not build any of this again."
94. Slide 4, steps: the UC3/UC4 title. Replacement: the new GIF text.
95. Slide 6, screen, steps and say: "one process: main", "queue of turns", "trace", "divides", "any turn". Replacement: the new GIF text. Say at 9.5 s: "More workers can start behind the queue. Any worker can take the next job." Say at 13.7 s: "AD-04. Before, the worker writes each step to the database itself." Say at 15.3 s: "Now each step goes through session." Say at 18.9 s: "Session is the only writer of the steps. So a worker that dies loses no step."
96. Slide 7, screen, steps and say: "LLM", "turn", "Project opens a session", "one broker". Say at 8.5 s: "The services depend on PostgreSQL, RabbitMQ and the model." Say at 14 s: "Project passes the question to session. Session puts a job on the queue, and a free worker takes it." Say at 16.6 s: "The worker calls the model." Last paragraph: "each with one purpose and its own tables".
97. Slide 8, screen, steps and say: "Projects", "Execution", "turn queued". Say at 12.6 s: "The worker receives "job queued" and sends "step recorded". It keeps no state."
98. Slide 9, screen and steps: message 5 and the first title. Say at 14.1 s: "The platform runs the agent on the question."
99. Slide 10, screen, steps and say: the AD-09 caption, "5 turns per worker", "divide". Say at 8.5 s: "When CPU passes 70 percent, HPA adds identity, project and billing pods." Say at 11.7 s: "The worker is different. Here the jobs wait, and KEDA adds workers, but their CPU stays low. A worker waits on the model, so we scale it on the queue length."
100. Slide 12, say. Current: "It compares the waiting turns with a target of five per worker". Replacement: "It compares the waiting jobs with a target of five per worker".
101. Slide 12 and handover, LU YI and LI ZHUOYANG intros. Current: "the turn queues". Replacement: "the job queues".
102. Slide 13, screen, steps and say: every "slot", "delegates", "held by". Replacement: the new GIF text. Say at 0 s: "Here is one shared queue for all jobs. Two questions start two lead agents." Say at 1.5 s: "Each worker runs one job, and each worker takes a lead." Say at 3.1 s: "Each lead starts three reader agents. And it holds its worker while it waits for them." Say at 7.5 s: "A reader waits for a free worker." Say at 9.6 s: "But every worker is busy with a lead." Say at 14.6 s: "Our fix is a queue for each level of the call tree. Each worker runs one job of each level." Say at 17.1 s: "Now a reader no longer waits behind a lead. The cycle breaks." Say at 18.5 s: "The readers run beside the leads." Say at 24.9 s: "... In the real system, each worker runs up to four jobs of each level, and KEDA watches all three queues."
103. Slide 13, if asked. Current: "*How many turns can one worker run?* Each worker pod has four slots for each level. It is set by LUMEN_WORKER_SLOTS, and RabbitMQ gives each channel that many turns at a time." Replacement: "*How many jobs can one worker run?* Four of each level at a time. LUMEN_WORKER_SLOTS sets it, and RabbitMQ gives each channel that many jobs at a time."
104. Slide 14, screen and steps. Current: "Use case A: ask a question with a chosen agent". Problem: stale; the GIF says UC2. Replacement: "UC2: ask a question with a chosen agent", and the new titles and "check the API key". Say at 3.5 s: "Session starts the question. It puts the first job on the first queue, level zero." Say at 6.7 s: "a worker takes the job".
105. Slide 14, if asked. Current: "The question first writes a question intent row. The worker claims it on the root turn". Replacement: "The question first writes a row that names the agent. The worker reads it with the first job".
106. Slide 16, say and if asked: "turn", "unacknowledged turn". Replacement: "job".
107. Slide 17, screen and steps: the ER titles of findings 73 to 75. Say at 23.1 s: "The jobs in flight live in RabbitMQ".
108. Slide 18, screen, steps and say: "left main", "grows out", "grows back". Say at 1.7 s: "It branches off main on 19 October." Say at 5.2 s: "One change came on a short-lived branch." Say at 6.7 s: "It merged back through pull request 148."
109. Slide 19, steps: the two new titles. Say at 6 s: "Here the gate stops the deploy." in place of "Here the line breaks."
110. Slide 21, screen, steps and say: "worker slots", "task tree", "the bar shrinks to a fifth". Say at 0 s: "First, one queue for all jobs. The leads held every worker, while their readers waited in the same queue." Say at 3.1 s: "So the one queue became a queue for each level of the call tree." Say at 15.4 s: "Our chart sets 60 seconds, a fifth of the default."
111. Slide 22, screen, steps and say: "paced worker", "divides", "merge back". Say before 0 s: "We put a fixed delay in place of each model call. So the test measures the platform's scaling, not the model." Say at 5.6 s: "Here on the right, a new worker pod appears as the cursor passes that moment." Say at 13.2 s: "A minute after the load ends, KEDA removes the extra pods."
112. Slide 22, if asked. Current: "*Why the paced worker and not the real model?* The paced worker makes ... the turns go through". Replacement: "*Why a fixed delay and not the real model?* The delay makes ... the jobs go through".
113. Slide 22 and 24, if asked and step 3: "five waiting turns". Replacement: "five waiting jobs".
114. Slide 23, if asked. Current: "KEDA watches all three turn queues". Replacement: "KEDA watches all three job queues".
115. Slide 24, screen. Current: "Scalability: the recorded load test; KEDA's state, live". Replacement: "Scalability: the recorded load test, then KEDA live".
116. Slide 24, step 2 say. Current: "a task tree, steps with their cost, the budget cap". Replacement: "a call tree, steps with their cost, and the budget cap".

### 2.17 speaker-guide.md

117. Rules. Current: ""the white tag is one turn"". Replacement: ""the white tag is one job"".
118. Slide 3 row. Current: "the platform is the seed: task tree, steps with cost, budget cap ... a new app gets all of this for free". Replacement: "the run engine runs each question as a call tree, records each step with its cost, and keeps the spend under the budget cap ... a new app does not build any of this again".
119. Slide 6 row. Current: "session is the only writer of the trace". Replacement: "session is the only writer of the steps".
120. Slide 7 row. Current: "question, turn, step, answer". Replacement: "question, job, step, answer".
121. LI ZHUOYANG intro. Current: "the turn queues". Replacement: "the job queues".
122. Slide 13 row. Current: "Why one queue per level of the task tree: with one queue, waiting leads fill every worker slot and their readers never start. ... Each worker has four slots per level". Replacement: "Why one queue per level of the call tree: with one queue, waiting lead agents hold every worker and their readers never start. ... Each worker runs up to four jobs per level".
123. Slide 14 row. Current: "Gateway, key guard, session opens, the root turn goes on lumen.turns.0". Replacement: "Gateway, API key check, session starts the question, the first job goes on lumen.turns.0".
124. Slide 16 row. Current: "its turn goes to another worker ... The turn is acknowledged only when it is done." Replacement: "its job goes to another worker ... The job is acknowledged only when it is done."
125. Questions, LI ZHUOYANG. Current: "What if a worker dies mid-turn? ... unacknowledged turn ... How many turns can one worker run? ... Session is the only writer of the trace". Replacement: "job" for "turn"; "the steps" for "the trace".
126. Slide 17 row. Current: "The task tree is one table with a parent link ... Turns in flight live in RabbitMQ". Replacement: "The call tree is one table with a parent link ... Jobs in flight live in RabbitMQ".
127. Slide 18 row. Current: "each member merges a branch into ass/platform through a pull request". Problem: does not match the slide (one short-lived branch, PR #148). Replacement: "ass/platform is the one integration branch; one short-lived branch came back through pull request #148".
128. Slide 22 row. Current: "with the paced worker that makes no model calls ... KEDA adds one". Replacement: "with a fixed delay in place of each model call ... KEDA adds a worker".
129. Questions, HE RONG. Current: "KEDA adds a worker for each five waiting turns". Replacement: "five waiting jobs".

### 2.18 Found while applying

130. logical.gif, Session box note. Current: "the task tree". Replacement: "the call tree".
131. logical.gif, Billing box note. Current: "cap, approvals". Problem: "cap" alone. Replacement: "the budget cap" ("budget cap, approvals" is 1.8 in wide and does not fit the 1.4 in note).
132. contextmap.gif, Session aggregates. Current: "its Task tree". Replacement: "its tree of Tasks" (Task stays as the aggregate name).
133. findings.gif, step title. Current: "1. The one queue divides into a queue per level". Problem: "divides" is the pod word we dropped. Replacement: "1. The one queue splits into a queue per level".
134. script.md, slide 7 screen and slide 8 screen: the two box notes and the aggregate line of findings 130 to 132.
135. script.md, slide 8 if asked. Current: "A task tree rolls up its cost ... its cap ... it owns the task tree". Replacement: "A call tree rolls up its cost ... its budget cap ... it owns the call tree".
136. script.md, slide 9 if asked. Current: "The key guard answers 429". Replacement: "The API key check answers 429".
137. script.md, slides 13, 21 and 22. Current: "The one queue divides into three", "divides into a queue per level", "when they divide". Replacement: "splits into three", "splits into a queue per level", "when they appear".
138. speaker-guide.md, LIU ZIYANG questions. Current: "a task tree rolls up its cost". Replacement: "a call tree rolls up its cost".

## 3. Count of findings per file

| File | Findings |
|---|---|
| build.js (slide text and notes) | 13 |
| scenes_motion_logical.py (platform, usecases, decisions, contextmap, interaction, logical, queues) | 54 (53 applied; UC4 kept) |
| scenes_motion_physical.py (physdecisions, scaling, er, sequence, branches, cicd, findings) | 26 |
| scenes_lean.py (milestones) | 0 |
| script.md | 31 |
| speaker-guide.md | 14 |
| Total | 138 |

No change: milestones.gif and deployment.gif read well; the recordings are real output.

## 4. Not changed, and why

- The outline item "1a · Context and business problem" stays. It is the name of the item in
  the course outline; the slide content under it says only "we built an AI for research".
- Code identifiers stay: `modules/steering`, `lumen.turns.0`, `/internal/turns/:id/step`,
  `LUMEN_WORKER_SLOTS`, `platform_question_intents`, the aggregate names `QuestionIntent`,
  `Task`, `Step`, and the service names on the lifelines.
- The short tags "lead" and "reader" in the queue picture stay. The title defines them as
  lead agents and reader agents, and the cells are too narrow for longer words.
- "job" also means a GitHub Actions job on slides 19 and 20. That is the standard GitHub
  word, and the slides are about the pipeline, so the two meanings do not meet.
- "Approve spend over cap" (UC4) stays. A UML use case name is a short verb phrase, and "over the cap" touches the oval outline. The speaker says "over the budget cap".
- The text in the recordings (`lumen-at-work.gif`, `rec-*.gif`) is real program output.

## 5. Layout fix

- logical.gif: "Model" ran into its note "external API". The Model box is now 2.05 in wide (was 1.85), and the note starts 0.88 in from its left edge.
