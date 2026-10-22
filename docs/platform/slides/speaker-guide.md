# Speaker guide: ASS presentation, 26 October 2026, 11:25 to 12:05

Team 15, Lumen Platform. The deck is `out/Team15-Lumen-Platform.pptx` (24 slides).
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
  look at: "the white tag is one turn", "the dashed line is KEDA's target".
- **Say the outline item.** The grey text at the top left of each slide (1a, 3b, ...)
  is the item of the course outline that the slide answers. Read it out when your
  part starts: "Now 4, the physical architecture."
- **Use only real numbers.** Every number on the slides comes from
  `docs/platform/evidence/` or the pipeline runs. If you do not know a number, say
  "it is in the report, section ...".

## Who speaks when

| Order | Speaker | Slides | Outline items | What the member built (WBS) | Time |
|---|---|---|---|---|---|
| 1 | LIU ZIYANG | 1 to 8 | 1a to 1c, 2a, 2b, 3a, 3b, 3c | 1 architecture and contracts; 2 session service | 7.5 min |
| 2 | LU YI | 9 to 12 | 3c (the API), 4a, 4b | 3 identity, gateway, HTTPS, API keys; 4 public API v1 | 4.5 min |
| 3 | LI ZHUOYANG | 13 to 15 | the queue decision, 4d | 7 worker service and the queue; 8 KEDA | 4.5 min |
| 4 | HE RONG | 16 to 20 | 4c, 5a, 5b, 5c | 9 billing; 10 Kubernetes, Helm, pipeline; 11 load tests | 7 min |
| 5 | PENG XUJIAN | 21 to 24 | 6a, 6b, the live demo | 5 project service, registry; 6 literature watch, usage, k6 test | 8.5 min |
| | everyone | 25 | questions | | 8 min |

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
| 2 Lumen at work (1a) | Lumen is an AI that does research. This is a real run: the lead agent searches arXiv and hands work to reader agents; the call tree on the right grows, with the cost of each agent. | The business problem: every research team builds the same agent plumbing again. |
| 3 Platform (1b) | Producers publish agents; consumers ask with an API key; the platform is the seed: task tree, steps with cost, budget cap. | Platform thinking: a new app gets all of this for free. The literature watch is about 210 lines. |
| 4 Use cases (1c) | The six use cases of the proposal; all built and running on the public server. | Name the actors. |
| 5 Plan (2a, 2b) | We worked to the proposal's plan, 8 to 21 October; ten person-days, 80 hours, per member; every part is done. | Status: all built, deployed and verified. |
| 6 Decisions (3a) | Three decisions: services cut along existing slices; a durable queue between session and workers; session is the only writer of the trace. | One reason for each, in one sentence. |
| 7 Logical (3b) | Four tiers. Follow the white tag: question, turn, step, answer. | The queue is why the worker can scale on its own. |
| 8 Context map (3c) | How we derived the contexts: use cases, then the nouns users say, then the contexts, then their aggregates. Session is the core domain; the arrows are domain events. | The derivation; the lecturers ask teams for it. |

Likely questions:
- **Why five services, not the eight in the proposal?** The five follow the slices
  that already had clear ports and tests (AD-01). Stream stays in session, and model
  calls go through the worker's model module, which prices each call (AISS-08). The
  split is in the roadmap for when session gets a second replica.
- **How did you find the bounded contexts?** From the use cases: we listed the nouns
  users say, grouped them where one word keeps one meaning, and took as aggregate what
  one transaction must keep consistent (a task tree rolls up its cost; a wallet never
  passes its cap without an approval).
- **Why can session not scale?** It holds running tasks and the live sockets in
  memory, so it runs one replica with the Recreate strategy (AD-11). The resolution is
  in the report, AISS-01.

## 2. LU YI: slides 9 to 12 (4.5 minutes)

How apps use the platform, and where it runs. You built identity, the gateway, HTTPS,
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

## 3. LI ZHUOYANG: slides 13 to 15 (4.5 minutes)

The queue decision and the detailed use case. You built the worker service and the
turn queues.

| Slide | Say | Stress |
|---|---|---|
| 13 Queues | Why one queue per level of the task tree: with one queue, waiting leads fill every worker slot and their readers never start. With a queue per level, the deepest level waits for nothing. | Found in design, before it happened. Each worker has four slots per level, and KEDA watches all three queues. |
| 14 Sequence (4d) | Use case A: an app asks with a chosen agent. Gateway, key guard, session opens, the root turn goes on lumen.turns.0, the app gets 201 at once; a worker calls the model and posts each step to session. | Nothing waits on the model inside a web request. |
| 15 The API call, recorded | The same flow with curl on the public server. | A real answer, a real cost. |

Likely questions:
- **What if a worker dies mid-turn?** A worker acknowledges a turn only after it is
  done, so RabbitMQ gives an unacknowledged turn to another worker (slide 23 shows it).
- **How many turns can one worker run?** `LUMEN_WORKER_SLOTS` = 4 per level per pod.
- **Why does the worker report steps over HTTP and not write to the database?**
  Session is the only writer of the trace, so a worker that dies loses no step, and
  the cost roll-up and the budget checks stay in one place (AD-04).

## 4. HE RONG: slides 16 to 20 (7 minutes)

Persistence, and DevOps. You built the billing service, the Kubernetes setup, the Helm
chart and the pipeline.

| Slide | Say | Stress |
|---|---|---|
| 16 ER diagram (4c) | One PostgreSQL 16 database; each context owns its tables (the frames). Solid lines are foreign keys inside a context; dashed lines are ids across contexts. | The task tree is one table with a parent link, so the cost roll-up is SQL. Money is numeric(12,6). Turns in flight live in RabbitMQ; files on a 2Gi volume. |
| 17 Branches (5a) | One repository; each member merges a branch into ass/platform through a pull request. Each push builds one image tagged with the commit SHA, copied over SSH, imported into k3s, deployed by Helm. | No registry to run (AD-12). Secrets are made inside the cluster (AD-13). |
| 18 Pipeline (5b) | Tests, npm audit and CodeQL in parallel; then build and the Trivy gate; then deploy; then OWASP ZAP and a k6 smoke load against the live address. | The first run was stopped at the gate: 5 critical CVEs never reached the host. With the fixed image, every job passed in 12 min 30 s. |
| 19 Runs, recorded | The real runs from the GitHub command line. | Every job and its result. |
| 20 Findings (5c) | Three findings: per-level queues; the image with Docker inside, replaced by a smaller patched image; KEDA's 300 s scale-down, set to 60 s. | The problem, then the change we made. |

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

## 5. PENG XUJIAN: slides 21 to 24 (8.5 minutes)

The quality attributes and the live demo. You built the project service, the agent
registry, the literature watch app and the k6 load test.

| Slide | Say | Stress |
|---|---|---|
| 21 Scaling (6b) | Your k6 test, with the paced worker that makes no model calls, so it measures the platform's scaling: ten users without pause; the bars are waiting jobs; above five per worker KEDA adds one: 1 to 4 workers in 49 s, back to 1 a minute after the load. | 135 questions, median 6.1 s, 0 of 1,040 requests failed. |
| 22 KEDA, recorded | The same autoscaler on the public server. | Replicas follow the queue. |
| 23 Worker deleted, recorded | Availability: we force-delete the worker during a question; its turn goes to another worker, and the question ends. | The turn is acknowledged only when it is done. |
| 24 Live demo (6a, 6b) | Run `deploy/k8s/demo.sh` with `LUMEN_URL` set, and follow the five lines on the slide. | About 6 minutes. |

The five lines of the live demo:

1. Ask a question in the browser; show the call tree grow.
2. Your literature watch app publishes its agent and asks through the API.
3. Start the k6 load; show `kubectl get scaledobject,hpa,pods` as KEDA adds workers.
4. Delete a worker during a question; the question still ends.
5. Open the last pipeline run on GitHub.

If the network or the server fails, say so in one sentence and go back to the recorded
slides 12, 15, 19, 22 and 23. End with: "Thank you. We are happy to take questions."

Likely questions:
- **Why scale on queue length and not CPU?** A worker waits on the model most of the
  time, so its CPU stays low while the queue grows (AD-11).
- **The proposal said 200 concurrent sessions. Did you test that?** Not on one
  t3.medium; the recorded test used 10 virtual users. The larger test needs EKS with
  node autoscaling (AISS-12). Say this plainly if asked; do not raise it yourself.
- **What can a producer publish?** An agent is a slug, a name, a description and
  instructions of at most 4000 characters, chosen per question (AD-08).

## Before the day (owner: LIU ZIYANG)

- [ ] Start the EC2 instance the evening before; open the public address once.
- [ ] Before the live load test, switch the workers to the paced worker, so the load
      makes no model calls: `gh workflow run platform-deploy.yml --repo
      ziyangliu-666/lumen-next --ref ass/platform -f worker=demo`. Switch back after.
- [ ] Check the model provider's spending limit.
- [ ] One full rehearsal with a timer; each speaker keeps to the time above.
- [ ] Install the fonts on the presenting computer (README, "Switzer"), or PowerPoint
      falls back to another sans.
- [ ] After the presentation, stop the instance:
      `aws ec2 stop-instances --region ap-southeast-1 --instance-ids i-01a76607668ff6924`.
