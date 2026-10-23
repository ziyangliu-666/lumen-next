# Speaker guide: ASS presentation, 26 October 2026, 11:25 to 12:05

Team 15, Lumen Platform. The deck is `out/Team15-Lumen-Platform.pptx` (25 slides).
Each slide has full speaker notes; this guide says who speaks, for how long, and
what to stress. Read your slides' notes aloud twice before the day.

## The rules for the day

- **Each member goes up once,** in the order of the deck, and presents one
  continuous part. Nobody comes back.
- **Each member presents what that member built,** as the proposal's work breakdown
  (WBS) assigns it. The table below gives the WBS items of each part.
- **40 minutes include questions.** Plan 32 minutes of talk and 8 of questions.
- **The lecturers may interrupt.** Answer in two or three sentences, then say
  "I will continue" and go on. Do not skip slides to catch up; cut the notes short.
- **In the questions, the owner of a part answers about it.**
- **Point at the picture.** Each slide has one picture. Say what the audience must
  look at: "the white tag is one job", "the dashed line is KEDA's target".
- **Say the part when your part starts.** The grey text at the top left of each slide
  names the part of the course outline, for example "4  ·  Physical architecture". Each
  slide has a page number at the top right; use it when you refer to a slide.
- **To change the slide, say "next please".** Nobody else touches the deck.
- **When you hand over, name the next member and the part.** For example: "Next,
  Lu Yi shows how apps use the platform." Then stop.
- **Use only real numbers.** Every number on the slides comes from
  `docs/platform/evidence/` or the pipeline runs. If you do not know a number, say
  "it is in the report, section ...".

## Who speaks when

| Order | Speaker | Slides | Outline items | What the member built (WBS) | Time |
|---|---|---|---|---|---|
| 1 | LIU ZIYANG | 1 to 8 | 1a to 1c, 2a, 2b, 3a, 3b, 3c | 1 architecture and contracts; 2 session service | 7.5 min |
| 2 | LU YI | 9 to 12 | 3c (the API), 4a, 4b | 3 identity, gateway, HTTPS, API keys; 4 public API v1 | 4.5 min |
| 3 | LI ZHUOYANG | 13 to 16 | the queue decision, 4d, availability | 7 worker service and the queue; 8 KEDA | 4.5 min |
| 4 | HE RONG | 17 to 23 | 4c, 5a, 5b, 5c, 6b (load test, KEDA) | 9 billing; 10 Kubernetes, Helm, pipeline; 11 load tests | 8 min |
| 5 | PENG XUJIAN | 24 | 6a, 6b, the live demo | 5 project service, agent registry; 6 literature watch, usage | 7 min |
| | everyone | 25 | questions | | 9 min |

Handover: each speaker ends with the next speaker's name and part, for example
"Lu Yi built the public API and the gateway; he will show how apps use the platform,
and where it runs." Then the next speaker walks up.

---

## 1. LIU ZIYANG: slides 1 to 8 (7.5 minutes)

Overview, project conduct, and the logical architecture. You designed the service
boundaries and contracts, and built the session service.

| Slide | Say | Stress |
|---|---|---|
| 1 Title | Team, project; the talk follows the course outline. | 15 s |
| 2 Lumen at work (1a) | What Lumen does. This is a real run: the lead agent searches arXiv and hands work to reader agents; the call tree on the right grows, with the cost of each agent. | We built a research AI; for this course we made it a platform that other apps use through one API. |
| 3 Platform (1b) | Producers publish agents; consumers ask with an API key; the run engine runs each question as a call tree, records each step with its cost, and keeps the spend under the budget cap. | Platform thinking: a new app does not build any of this again. The literature watch is about 210 lines. |
| 4 Use cases (1c) | The six use cases of the proposal; all built and running on the public server. | Name the actors. |
| 5 Plan (2a, 2b) | Plan and effort, 8 to 21 October; ten person-days, 80 hours, per member; every part is done. | Status: all built, deployed and verified. |
| 6 Decisions (3a) | Three decisions: services cut along existing modules; a durable queue between session and workers; session is the only writer of the steps. | One reason for each, in one sentence. |
| 7 Logical (3b) | Four tiers. Follow the white tag: question, job, step, answer. | The queue is why the worker can scale on its own. |
| 8 Context map (3c) | How we derived the contexts: use cases, then the nouns users say, then the contexts, then their aggregates. Session is the core domain; the arrows are domain events. | The derivation; the lecturers ask teams for it. |

Likely questions:
- **Why five services, not the eight in the proposal?** The five follow the modules
  that already had clear ports and tests (AD-01). Stream stays in session, and model
  calls go through the worker's model module, which prices each call (AISS-08). The
  split is in the roadmap for when session gets a second replica.
- **How did you find the bounded contexts?** From the use cases: we listed the nouns
  users say, grouped them where one word keeps one meaning, and took as aggregate what
  one transaction must keep consistent (a call tree rolls up its cost; a wallet never
  passes its cap without an approval).
- **Why can session not scale?** It holds running tasks and the live sockets in
  memory, so it runs one replica with the Recreate strategy (AD-11). The resolution is
  in the report, AISS-01.

## 2. LU YI: slides 9 to 12 (4.5 minutes)

Public API flow, and where it runs. You built identity, the gateway, HTTPS,
the rate limits, the API keys and the public API v1.

| Slide | Say | Stress |
|---|---|---|
| 9 API flow (3c) | Seven calls on the public API: create a key, publish an agent, list, ask, run, read the answer, read usage. | Producers and consumers use only this API. A key is stored only as a SHA-256 hash; five scopes; 60 a minute, burst 20, then 429. |
| 10 Physical decisions (4a) | Three decisions: k3s on one EC2 instead of EKS; HPA on CPU and KEDA on queue length; one PostgreSQL with tables per context. | Each with its reason in one sentence. |
| 11 Deployment (4b) | UML deployment diagram: one EC2 t3.medium in Singapore runs k3s. Only 22, 80 and 443 are open. Traefik ends HTTPS with Let's Encrypt and routes by path. | Ports, protocols and replica ranges. |
| 12 Pods, recorded | The real cluster, through SSH: five services, PostgreSQL, RabbitMQ, the autoscalers. | The Kubernetes API is not public. |

Likely questions:
- **How do services trust each other?** Every `/internal/*` route checks the
  `x-lumen-internal` key in constant time, and Traefik never routes `/internal/*`
  from outside (AD-10).
- **Why API keys and not JWT?** A key can be revoked at once; a lookup per request is
  cheap at this size (report 3.2.3).
- **What if the IP changes?** The name comes from the Elastic IP on sslip.io, so the
  IP stays fixed while the instance lives (AD-14).

## 3. LI ZHUOYANG: slides 13 to 16 (4.5 minutes)

The queue decision, the detailed use case and availability. You built the worker
service, the job queues and the KEDA autoscaling of the workers.

| Slide | Say | Stress |
|---|---|---|
| 13 Queues | Why one queue per level of the call tree: with one queue, waiting lead agents hold every worker and their readers never start. With a queue per level, the deepest level waits for nothing. | Found in design, before it happened. Each worker runs up to four jobs per level, and KEDA watches all three queues. |
| 14 Sequence (4d) | UC2: an app asks with a chosen agent. Gateway, API key check, session starts the question, the first job goes on lumen.turns.0, the app gets 201 at once; a worker calls the model and posts each step to session. | Nothing waits on the model inside a web request. |
| 15 The API call, recorded | The same flow with curl on the public server. | A real answer, a real cost. |
| 16 Worker deleted, recorded | Availability: we force-delete the worker during a question; its job goes to another worker, and the question ends. | The job is acknowledged only when it is done. |

Likely questions:
- **What if a worker dies mid-job?** A worker acknowledges a job only after it is
  done, so RabbitMQ gives an unacknowledged job to another worker (slide 16 shows it).
- **How many jobs can one worker run?** `LUMEN_WORKER_SLOTS` = 4 per level per pod.
- **Why does the worker report steps over HTTP and not write to the database?**
  Session is the only writer of the steps, so a worker that dies loses no step, and
  the cost roll-up and the budget checks stay in one place (AD-04).

## 4. HE RONG: slides 17 to 23 (8 minutes)

Persistence, DevOps and the load test. You built the billing service, the Kubernetes
setup, the Helm chart, the pipeline and the k6 load test.

| Slide | Say | Stress |
|---|---|---|
| 17 ER diagram (4c) | One PostgreSQL 16 database; each context owns its tables (the frames). Solid lines are foreign keys inside a context; dashed lines are ids across contexts. | The call tree is one table with a parent link, so the cost roll-up is SQL. Money is numeric(12,6). Jobs in flight live in RabbitMQ; files on a 2Gi volume. |
| 18 Branches (5a) | ass/platform is the one integration branch; one short-lived branch came back through pull request #148. Each push builds one image tagged with the commit SHA, copied over SSH, imported into k3s, deployed by Helm. | No registry to run (AD-12). Secrets are made inside the cluster (AD-13). |
| 19 Pipeline (5b) | Tests, npm audit and CodeQL in parallel; then build and the Trivy gate; then deploy; then OWASP ZAP and a k6 smoke load against the live address. | The first run was stopped at the gate: 5 critical CVEs never reached the host. With the fixed image, every job passed in 12 min 30 s. |
| 20 Runs, recorded | The real runs from the GitHub command line. | Every job and its result. |
| 21 Findings (5c) | Three findings: per-level queues; the image with Docker inside, replaced by a smaller patched image; KEDA's 300 s scale-down, set to 60 s. | The problem, then the change we made. |
| 22 Scaling (6b) | The k6 test, with a fixed delay in place of each model call, so it measures the platform's scaling: ten users without pause; the bars are waiting jobs; above five per worker KEDA adds a worker: 1 to 4 workers in 49 s, back to 1 a minute after the load. | 135 questions, median 6.1 s, 0 of 1,040 requests failed. |
| 23 KEDA, recorded | The same autoscaler on the public server. | Replicas follow the queue. |

Likely questions:
- **Why one shared database?** Time: the tables are already grouped by owner, so the
  split is mechanical. The steps are in the report, AISS-02: one schema and user per
  service, then events for cross-context reads, then one database per service.
- **How is an approval used only once?** It is decided in one transaction with
  `SELECT ... FOR UPDATE`, and the billing pods claim delivery rows with
  `FOR UPDATE SKIP LOCKED` and a 30-second lease.
- **How do you roll back?** `helm rollback` on the server, or push a revert; every
  deploy is a Helm release with its history.
- **Where is staging?** A merge into ass/platform is the approval to deploy; the pull
  request review is the gate. Local k3d runs the same chart.
- **Are database migrations safe with two versions running?** Every service runs the
  migrations at startup under an advisory lock (AD-19).
- **Why scale on queue length and not CPU?** A worker waits on the model most of the
  time, so its CPU stays low while the queue grows (AD-11).
- **The proposal said 200 concurrent sessions.** The test shows the mechanism that
  carries that load: KEDA adds a worker for each five waiting jobs, and HPA adds
  pods on CPU. The same Helm chart runs on EKS, where node autoscaling adds machines
  as the load grows.

## 5. PENG XUJIAN: slide 24 and the live demo (7 minutes)

The live demo. You built the project service, the agent registry, usage and the
literature watch app. Open with one sentence: "The agent registry lets a producer
publish an agent; the literature watch app is a second app built only on the public
API. I will now show the platform live."

| Slide | Say | Stress |
|---|---|---|
| 24 Live demo (6a, 6b) | Run `deploy/k8s/demo.sh` with `LUMEN_URL` set, and follow the five lines on the slide. | About 6 minutes. |

The five lines of the live demo:

1. Ask a question in the browser; show the call tree grow.
2. Your literature watch app publishes its agent and asks through the API; then read usage with GET /api/v1/usage.
3. Go back to the recorded load test (slides 22 and 23); then show `kubectl get scaledobject,hpa -n lumen` and the worker pods live.
4. Delete a worker during a question; the question still ends.
5. Open the last pipeline run on GitHub.

If the network or the server fails, say so in one sentence and go back to the recorded
slides 12, 15, 16, 20 and 23. End with: "Thank you. We are happy to take questions."

Likely questions:
- **What can a producer publish?** An agent is a slug, a name, a description and
  instructions of at most 4000 characters, chosen per question (AD-08).
- **How does the watch app use the platform?** Only through the public API v1, with
  its own API key, like any other consumer. It is about 210 lines.

## Before the day (owner: LIU ZIYANG)

- [ ] Start the EC2 instance the evening before; open the public address once.
- [ ] The workers run the real model for the whole demo; no load test runs live.
- [ ] Check the model provider's spending limit.
- [ ] One full rehearsal with a timer; each speaker keeps to the time above.
- [ ] Install the fonts on the presenting computer (README, "Switzer"), or PowerPoint
      falls back to another sans.
- [ ] After the presentation, stop the instance:
      `aws ec2 stop-instances --region ap-southeast-1 --instance-ids i-01a76607668ff6924`.
