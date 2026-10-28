# Speaker guide: ASS presentation, 26 October 2026, 11:25 to 12:05

Team 15, Lumen Platform. The deck is `out/Team15-Lumen-Platform.pptx` (25 slides).
The speaker notes of each slide are the words of `script.md`. This guide says who
speaks, for how long, and what to stress. Read your slides' words aloud twice before
the day.

## The rules for the day

- **Each member goes up once,** in the order of the deck, and presents one
  continuous part. Nobody comes back.
- **Each member presents what that member built.**
- **40 minutes include questions.** Plan 33 minutes of talk and 7 of questions.
- **The lecturers may interrupt.** Answer in two or three sentences, then say
  "I will continue" and go on. Do not skip slides to catch up; cut words short.
- **In the questions, the owner of a part answers about it.**
- **Point at the picture.** Each slide has one picture. Say what the audience must
  look at: "the white tag is one job", "the dashed line is KEDA's target".
- **Say each term in plain words the first time.** The words list at the top of
  `script.md` gives one meaning for each: question, agent, lead agent, reader, call
  tree, task, job, step, budget cap.
- **Say no internal code.** Say the decision, the use case or the person by name.
  Never say a decision number, a use case number, a pull request number or a branch
  name.
- **Each GIF plays once and holds its last frame.** The time cues in `script.md` say
  when to start each sentence. The words after the last cue describe the held frame.
- **To change the slide, say "next please".** Nobody else touches the deck.
- **When you hand over, name the next member and the part.** Then stop.
- **Use only real numbers.** Every number on the slides comes from our evidence
  files or the pipeline runs. If you do not know a number, say "it is in the report".

## Who speaks when

| Order | Speaker | Slides | Outline items | What the member built | Time |
|---|---|---|---|---|---|
| 1 | LIU ZIYANG | 1 to 8 | 1, 2, 3 | architecture and contracts; session service | 7.5 min |
| 2 | LU YI | 9 to 12 | 3 (the public API), 4 | identity, gateway, HTTPS, API keys; public API | 5 min |
| 3 | LI ZHUOYANG | 13 to 16 | 4 (the queue decision, detailed design, availability) | worker service and the job queues; worker autoscaling | 5 min |
| 4 | HE RONG | 17 to 23 | 4 (persistence), 5, 6 (load test, KEDA) | billing; Kubernetes, Helm, pipeline; load tests | 8.5 min |
| 5 | PENG XUJIAN | 24 | 6, the live demo | project service, agent registry; literature watch app, usage | 7 min |
| | everyone | 25 | questions | | 7 min |

Handover: each speaker ends with the next speaker's name and part, for example
"Next, Lu Yi. Lu Yi built identity, the gateway, the API keys and the public API,
and shows how apps use the platform and where it runs." Then the next speaker walks up.

---

## 1. LIU ZIYANG: slides 1 to 8 (7.5 minutes)

Overview, project conduct and the logical architecture.

| Slide | Say | Stress |
|---|---|---|
| 1 Title | Team, project; the talk follows the course outline. | 20 s |
| 2 What Lumen does | A real run: the lead agent searches arXiv and hands one paper each to three reader agents. The call tree on the right grows, with the cost of each task. | Define lead agent, reader and call tree here. Then: for this course, we made Lumen a platform that other apps use through one public API. |
| 3 Producers and consumers | Producers publish agents; consumers ask with an API key or in the web app; the run engine runs each question as a call tree, records each step with its cost, and checks each step against the budget cap. | Define agent, step and budget cap here. A new app builds none of this; the literature watch app is about 210 lines. |
| 4 Use cases | Six use cases, four actors; all run on the public server. | Name the actors. The operator is our team. |
| 5 Plan | The plan, 8 to 21 October: the interfaces first, then the services, then autoscaling, the public API and the pipeline. | Ten person-days, 80 hours, for each member: 400 hours. |
| 6 Logical decisions | Each module became a service; a durable job queue between session and the workers; session is the only writer of the steps. | One reason for each. |
| 7 Components | Four tiers; follow the white tag: question, job, step, answer. | Billing has no line from session: session checks the budget in billing's tables, in one database transaction. |
| 8 Context map | How we found the contexts: use cases, nouns, contexts, aggregates. Each arrow is a domain event. Session is the core domain. | The derivation; the lecturers ask teams for it. |

Likely questions:
- **Why five services, not the eight in the proposal?** The five follow the modules
  that already had clear interfaces and tests. The live stream runs inside session,
  and model calls go through the worker, which prices each call.
- **How did you find the bounded contexts?** From the use cases: we listed the nouns
  users say, grouped them where one word keeps one meaning, and took as aggregate what
  one transaction must keep consistent: a call tree rolls up its cost, and a budget
  never passes its cap without an approval.
- **Why can session not scale?** It holds the running call trees in memory, so it
  runs one copy, and a new version replaces the old one. The agent loop, the heavy
  work, runs in the workers, which scale from one to four.

## 2. LU YI: slides 9 to 12 (5 minutes)

The public API and where the platform runs.

| Slide | Say | Stress |
|---|---|---|
| 9 Public API | Six calls: create a key, publish an agent, list, ask, read the answer, read usage. Between ask and read, the platform runs the agent. | An app uses only these six calls. |
| 10 Physical decisions | Hosting: k3s on one EC2 t3.medium, the same Helm chart also installs on EKS. Scaling: HPA on CPU, KEDA on waiting jobs. Database: one PostgreSQL, tables by owner. | Define Helm chart, EKS, k3s, HPA, KEDA and pod here, in one sentence each. |
| 11 Deployment | One EC2 t3.medium in Singapore runs k3s. Only 22, 80 and 443 are open. Traefik ends HTTPS and routes by path. | Ports, protocols and pod counts. |
| 12 Pods, recorded | The real cluster, through SSH: five services, PostgreSQL, RabbitMQ, the autoscalers. | The Kubernetes API is not public. |

Likely questions:
- **How do services trust each other?** Every internal route checks a shared internal
  key, and Traefik never routes internal paths from outside.
- **Why API keys and not JWT?** A key can be revoked at once, and a lookup for each
  request is cheap at this size. The platform stores only a SHA-256 hash of each key.
- **What if the IP changes?** The name comes from a fixed Elastic IP through sslip.io.

## 3. LI ZHUOYANG: slides 13 to 16 (5 minutes)

The queue decision, one use case in detail, and availability.

| Slide | Say | Stress |
|---|---|---|
| 13 Queue decision | One shared queue can deadlock: leads hold every worker while their readers wait. One queue per level of the call tree breaks the cycle. | Found in design. |
| 14 Sequence | Ask a question: project checks the API key, session starts the question and puts the first job on the level 0 queue, the app gets 201 at once; a worker calls the model and sends each step to session. | No web request waits on the model. |
| 15 The API call, recorded | The same use case with curl on the public server. No agent is named, so the default lead agent answers. | A real answer, a real cost. |
| 16 Worker deleted, recorded | We force-delete the only worker during a question. Kubernetes starts a new worker, and RabbitMQ gives it the open job. The question ends. | A job is acknowledged only when it is done. |

Likely questions:
- **What if a worker dies in the middle of a job?** A worker acknowledges a job only
  after it is done, so RabbitMQ gives an unacknowledged job to another worker.
- **How many jobs can one worker run?** Four of each level at a time.
- **Why one queue per level?** With one shared queue, waiting leads hold every
  worker and their readers never start. With a queue per level, a reader never waits
  behind a lead (slide 13).

## 4. HE RONG: slides 17 to 23 (8.5 minutes)

Persistence, DevOps and the load test.

| Slide | Say | Stress |
|---|---|---|
| 17 ER diagram | One PostgreSQL 16 database; the frames group the tables by owner. Solid lines are foreign keys; dashed lines are ids with no foreign key. | Four foreign keys cross between owners: findings to sessions and to tasks, ledger entries to tasks, agents to accounts. The call tree is one table with a parent link. Money is numeric(12,6). |
| 18 Branches | One integration branch off main; a feature branch comes back through a reviewed pull request. Each push builds one image tagged with its commit, copied over SSH, imported into k3s, deployed by Helm. | No image registry to run. |
| 19 Pipeline | Tests, the dependency audit and CodeQL in parallel; then build and the Trivy gate; then deploy; then OWASP ZAP and a k6 smoke load against the live address. | The first two runs stopped at the gate: 5 critical CVEs never reached the host. The jobs of the passing run took 12 min 30 s; GitHub shows 20 min 45 s because the run first waited 8 minutes for the run before it. |
| 20 Runs, recorded | The real runs from the GitHub command line. | The two red runs are the gate at work. |
| 21 Findings | Three findings: per-level queues; the image with Docker inside, replaced by a smaller patched image; KEDA's 300 s scale-down, set to 60 s. | Spend the time on the third; the first two were shown before. |
| 22 Scaling | The k6 test, with a fixed delay in place of each model call: ten users without pause; above five jobs per worker, KEDA adds workers, up to four, and goes back to 1 a minute after the load. | 135 questions, median 6.1 s, 0 of 1,040 requests failed. |
| 23 KEDA, recorded | The same autoscaler on the public server, in a smaller run. | The replicas follow the queue. |

Likely questions:
- **Why one shared database?** One transaction writes the step, its cost and the
  ledger entry together. Each service owns its tables, and only four foreign keys
  cross between owners, so a later split replaces those four keys with ids.
- **How is an approval used only once?** It is decided in one transaction with
  `SELECT ... FOR UPDATE`.
- **How do you roll back?** `helm rollback` on the server, or push a revert; every
  deploy is a Helm release with its history.
- **Where is staging?** The local k3d cluster runs the same chart. A merge into the
  integration branch deploys to the public server.
- **Are database migrations safe with two versions running?** Every service runs the
  migrations at startup under a database lock, so pods migrate one after another.
- **The proposal said 200 concurrent sessions.** The test shows the mechanism that
  carries that load: KEDA adds a worker for each five waiting jobs, and HPA adds
  pods on CPU. The same Helm chart runs on EKS, where node autoscaling adds machines
  as the load grows.

## 5. PENG XUJIAN: slide 24 and the live demo (7 minutes)

The live demo. Open with one sentence: "The agent registry lets a producer publish an
agent; the literature watch app is a second app built only on the public API. I will
now show the platform live." The full run sheet is in `script.md`, slide 24.

The five lines of the live demo:

1. Ask a question in the browser and watch the call tree grow.
2. As the agent author, publish the agent; the watch app asks with it; read usage.
3. Show KEDA on the live server: `kubectl get scaledobject,hpa -n lumen` and the worker pods.
4. Delete a worker during a question; the question still ends.
5. Open the last pipeline run on GitHub.

If the live demo fails, say so in one sentence and play the narrated backup video
`ASS-Architecting-Scalable-Systems/Team15-Demo-Backup.mp4 (coursework repository)` (about 6 minutes). In Zoom, share the screen with
computer sound on. If the video cannot play either, show the recorded slides 12, 15,
16, 20 and 23. End with: "Thank you. We are happy to take questions."

Likely questions:
- **What can a producer publish?** An agent is a short name, a name, a description
  and instructions of at most 4000 characters. A consumer chooses the agent for each
  question.
- **How does the watch app use the platform?** Only through the public API, with its
  own API key, like any other consumer. It is about 210 lines.

## Before the day (owner: LIU ZIYANG)

- [ ] Start the EC2 instance the evening before; open the public address once.
- [ ] The workers run the real model for the whole demo; no load test runs live.
- [ ] Check the model provider's spending limit.
- [ ] Play the backup video `ASS-Architecting-Scalable-Systems/Team15-Demo-Backup.mp4 (coursework repository)` once on the presenting
      computer, and test Zoom's "Share sound" with it.
- [ ] One full rehearsal with a timer; each speaker keeps to the time above.
- [ ] Install the fonts on the presenting computer (README, "Switzer"), or PowerPoint
      falls back to another sans.
- [ ] After the presentation, stop the instance:
      `aws ec2 stop-instances --region ap-southeast-1 --instance-ids i-01a76607668ff6924`.
