# Speaker guide: ASS presentation, 26 October 2026, 11:25 to 12:05

Team 15, Lumen Platform. The deck is `out/Team15-Lumen-Platform.pptx` (24 slides).
Each slide has full speaker notes; this guide says who speaks, for how long, and
what to stress. Read your slides' notes aloud twice before the day.

## The rules for the day

- **Each member goes up once,** in the order of the deck, and presents one
  continuous part. Nobody comes back.
- **40 minutes include questions.** Plan 32 minutes of talk and 8 of questions.
- **The lecturers may interrupt.** Answer in two or three sentences, then say
  "I will continue" and go on. Do not skip slides to catch up; cut the notes short.
- **In the questions, the member who presented a slide answers about it.** If the
  question is about a part another member built, that member may add one sentence.
- **Point at the picture.** Each slide has one picture. Say what the audience must
  look at: "the white tag is one turn", "the dashed line is KEDA's target".
- **Say the outline item.** The grey text at the top left of each slide (1a, 3b, ...)
  is the item of the course outline that the slide answers. Read it out when your
  part starts: "Now 4, the physical architecture."
- **Use only real numbers.** Every number on the slides comes from
  `docs/platform/evidence/` or the pipeline runs. If you do not know a number, say
  "it is in the report, section ...".

## Who speaks when

| Order | Speaker | Slides | Outline items | Time |
|---|---|---|---|---|
| 1 | LIU ZIYANG | 1 to 7 | 1a, 1b, 1c, 2a, 2b, 3a, 3b | 6.5 min |
| 2 | LI ZHUOYANG | 8 to 10 | 3c, 3a (the queue decision) | 4.5 min |
| 3 | LU YI | 11 to 15 | 4a, 4b, 4c, 4d | 7 min |
| 4 | HE RONG | 16 to 19 | 5a, 5b, 5c | 5.5 min |
| 5 | PENG XUJIAN | 20 to 23 | 6a, 6b, the live demo | 9 min |
| | everyone | 24 | questions | 8 min |

Handover: each speaker ends with the next speaker's name and part, for example
"Li Zhuoyang will now show the domain design." Then the next speaker walks up.

---

## 1. LIU ZIYANG: slides 1 to 7 (6.5 minutes)

Overview, project conduct, and the logical architecture.

| Slide | Say | Stress |
|---|---|---|
| 1 Title | Team, project; the talk follows the course outline. | 15 s |
| 2 Lumen at work (1a) | Lumen is an AI that does research. This is a real run: the lead agent searches arXiv and hands work to reader agents; the call tree on the right grows, with the cost of each agent. | The business problem: every research team builds the same agent plumbing again. |
| 3 Platform (1b) | Producers publish agents; consumers ask with an API key; the platform is the seed: task tree, steps with cost, budget cap. | Platform thinking: a new app gets all of this for free. The literature watch is about 210 lines. |
| 4 Use cases (1c) | The six use cases of the proposal; all built and running on the public server. | Name the actors. |
| 5 Plan (2a, 2b) | We worked to the proposal's plan, 8 to 21 October; ten person-days, 80 hours, per member; every part is done. | Status: all built, deployed and verified. |
| 6 Decisions (3a) | Three decisions: services cut along existing slices; a durable queue between session and workers; session is the only writer of the trace. | One reason for each, in one sentence. |
| 7 Logical (3b) | Four tiers. Follow the white tag: question, turn, step, answer. | The queue is why the worker can scale on its own. |

Handover: "Li Zhuoyang will now show how we found the domains, and one decision in detail."

Likely questions:
- **Why five services, not the eight in the proposal?** The five follow the slices
  that already had clear ports and tests (AD-01). Stream stays in session, and model
  calls go through the worker's model module, which prices each call (AISS-08). The
  split is in the roadmap for when session gets a second replica.
- **Why can session not scale?** It holds running tasks and the live sockets in
  memory, so it runs one replica with the Recreate strategy (AD-11). The resolution is
  in the report, AISS-01.

## 2. LI ZHUOYANG: slides 8 to 10 (4.5 minutes)

Domain-driven design, the queue decision, and how apps use the platform.

| Slide | Say | Stress |
|---|---|---|
| 8 Context map (3c) | How we derived the contexts: use cases, then the nouns users say, then the contexts, then their aggregates. Session is the core domain; the arrows are domain events. | The derivation; the lecturers ask teams for it. |
| 9 Queues (3a) | Why one queue per level of the task tree: with one queue, waiting leads fill every worker slot and their readers never start. With a queue per level, the deepest level waits for nothing. | Found in design, before it happened. In the real system each worker has four slots per level. |
| 10 API flow (3c) | Seven calls on the public API: create a key, publish an agent, list, ask, run, read the answer, read usage. | Producers and consumers use only this API. |

Handover: "Lu Yi will now show where it runs, how the data is stored, and one use case in detail."

Likely questions:
- **How did you find the bounded contexts?** From the use cases: we listed the nouns
  users say, grouped them where one word keeps one meaning, and took as aggregate what
  one transaction must keep consistent (a task tree rolls up its cost; a wallet never
  passes its cap without an approval).
- **How is an API key protected?** It is stored only as a SHA-256 hash, has five
  scopes, and is limited to 60 requests a minute with a burst of 20; then 429.

## 3. LU YI: slides 11 to 15 (7 minutes)

The physical architecture: deployment, persistence, and the detailed use case.

| Slide | Say | Stress |
|---|---|---|
| 11 Deployment (4a, 4b) | UML deployment diagram: one EC2 t3.medium in Singapore runs k3s. Only 22, 80 and 443 are open. Traefik ends HTTPS with Let's Encrypt and routes by path. | Key physical decisions: k3s rather than EKS (the same Helm chart on a laptop and on AWS); HPA on CPU, KEDA on queue length. |
| 12 Pods, recorded | The real cluster, through SSH: five services, PostgreSQL, RabbitMQ, the autoscalers. | The Kubernetes API is not public. |
| 13 ER diagram (4c) | One PostgreSQL 16 database; each context owns its tables (the frames). Solid lines are foreign keys inside a context; dashed lines are ids across contexts. | The task tree is one table with a parent link, so the cost roll-up is SQL. Money is numeric(12,6). Turns in flight live in RabbitMQ; files on a 2Gi volume. |
| 14 Sequence (4d) | Use case A: an app asks with a chosen agent. Gateway, key guard, session opens, the root turn goes on lumen.turns.0, the app gets 201 at once; a worker calls the model and posts each step to session. | Nothing waits on the model inside a web request. On the public host: 4.9 s, one cent. |
| 15 The API call, recorded | The same flow with curl on the public server. | A real answer, a real cost. |

Handover: "He Rong will now show how the code gets from a branch to this server."

Likely questions:
- **How do services trust each other?** Every `/internal/*` route checks the
  `x-lumen-internal` key in constant time, and Traefik never routes `/internal/*`
  from outside (AD-10).
- **Why one shared database?** Time: the tables are already grouped by owner, so the
  split is mechanical. The steps are in the report, AISS-02: one schema and user per
  service, then events for cross-context reads, then one database per service.
- **How is an approval used only once?** It is decided in one transaction with
  `SELECT ... FOR UPDATE`, and the billing pods claim delivery rows with
  `FOR UPDATE SKIP LOCKED` and a 30-second lease.
- **What if a worker dies mid-turn?** A worker acknowledges a turn only after it is
  done, so RabbitMQ gives an unacknowledged turn to another worker (slide 22 shows it).

## 4. HE RONG: slides 16 to 19 (5.5 minutes)

DevOps and the development lifecycle.

| Slide | Say | Stress |
|---|---|---|
| 16 Branches (5a) | One repository; each member merges a branch into ass/platform through a pull request. Each push builds one image tagged with the commit SHA, copied over SSH, imported into k3s, deployed by Helm. | No registry to run (AD-12). Secrets are made inside the cluster (AD-13). |
| 17 Pipeline (5b) | Tests, npm audit and CodeQL in parallel; then build and the Trivy gate; then deploy; then OWASP ZAP and a k6 smoke load against the live address. | The first run was stopped at the gate: 5 critical CVEs never reached the host. With the fixed image: live in 12 min 30 s. |
| 18 Runs, recorded | The real runs from the GitHub command line. | Every job and its result. |
| 19 Findings (5c) | Three findings: per-level queues; the image with Docker inside, replaced by a smaller patched image; KEDA's 300 s scale-down, set to 60 s. | The problem, then the change we made. |

Handover: "Peng Xujian will now show the system under load, and live."

Likely questions:
- **How do you roll back?** `helm rollback` on the server, or push a revert; every
  deploy is a Helm release with its history.
- **Where is staging?** A merge into ass/platform is the approval to deploy; the pull
  request review is the gate. Local k3d runs the same chart.
- **Are database migrations safe with two versions running?** Every service runs the
  migrations at startup under an advisory lock (AD-19).

## 5. PENG XUJIAN: slides 20 to 23 (9 minutes)

The quality attributes and the live demo.

| Slide | Say | Stress |
|---|---|---|
| 20 Scaling (6b) | Ten users without pause; the bars are waiting jobs; above five per worker KEDA adds one: 1 to 4 workers in 49 s, back to 1 a minute after the load. | 135 questions, median 6.1 s, 0 of 1,040 requests failed. |
| 21 KEDA, recorded | The same autoscaler on the public server. | Replicas follow the queue. |
| 22 Worker deleted, recorded | Availability: we force-delete the worker during a question; its turn goes to another worker, and the question ends. | The turn is acknowledged only when it is done. |
| 23 Live demo (6a, 6b) | Run `deploy/k8s/demo.sh` with `LUMEN_URL` set, and follow the five lines on the slide. | About 6 minutes. |

The five lines of the live demo:

1. Ask a question in the browser; show the call tree grow.
2. The literature watch app asks through the API.
3. Start the k6 load; show `kubectl get scaledobject,hpa,pods` as KEDA adds workers.
4. Delete a worker during a question; the question still ends.
5. Open the last pipeline run on GitHub.

If the network or the server fails, say so in one sentence and go back to the recorded
slides 12, 15, 18, 21 and 22. End with: "Thank you. We are happy to take questions."

Likely questions:
- **Why scale on queue length and not CPU?** A worker waits on the model most of the
  time, so its CPU stays low while the queue grows (AD-11).
- **The proposal said 200 concurrent sessions. Did you test that?** Not on one
  t3.medium; the recorded test used 10 virtual users. The larger test needs EKS with
  node autoscaling (AISS-12). Say this plainly if asked; do not raise it yourself.

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
