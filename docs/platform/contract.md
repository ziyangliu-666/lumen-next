# Lumen Platform: the minimal service contract

This is the contract for the ASS practice project (Architecting Scalable
Systems, Team 15). The goal is a minimal demonstration on 26 October 2026: the
slices that already work on `main` run as separate services on Kubernetes in
AWS, behind a public HTTPS address, one question runs end to end, and the team
shows it from the command line. The
report is due on 16 November 2026.

Reuse before rewrite. A service is the existing slice, built by a new entry
point. Write new code only where two processes must now talk.

## Branches

- `ass/platform` is the integration branch. It starts from `main`.
- Each member works on one branch from `ass/platform` and opens one pull
  request back into `ass/platform`.

| Member | Branch | Service |
|---|---|---|
| LIU ZIYANG | `ass/session` | `session`, the shared adapters, integration, the demo script |
| LI ZHUOYANG | `ass/worker` | `worker` |
| LU YI | `ass/identity` | `identity`, the gateway (Ingress), HTTPS |
| PENG XUJIAN | `ass/project` | `project`, the k6 load test |
| HE RONG | `ass/deploy` | `billing`, the Helm chart, KEDA, the AWS host, the deploy workflow |

## Rules

1. **Add files. Do not change slice internals.** New code goes under
   `apps/server/src/services/`, `deploy/k8s/` and
   `.github/workflows/platform-*.yml`. `main.ts`, `app.ts` and
   `apps/server/src/modules/` do not change on this branch.
2. **A slice change goes to `main` first**, as a normal pull request. Then
   merge `main` into `ass/platform`.
3. **`npm run verify` stays green.** SWE5006 grades the monolith on `main`.
4. **English only** in code, comments, commit messages and pull requests.

## The services

One image for every service: the existing `Dockerfile`. Each service starts the
same image with a different command:
`node apps/server/dist/services/<name>.js`.

| Service | Built from | Routes | Scales on |
|---|---|---|---|
| `identity` | `modules/identity` | `/api/auth/*`, `/api/me*`, `/api/local/*` | CPU (HPA) |
| `project` | `modules/projects` | `/api/projects*`, except the two rows below | CPU (HPA) |
| `session` | `modules/session`, the `Broker`, the `/ws` socket | `/api/sessions/*`, `/api/projects/:id/sessions`, `/api/models`, `/ws` | none, 1 replica |
| `worker` | `modules/steering` | `/api/projects/:id/files*`, `/api/projects/:id/upload/*` | queue depth (KEDA) |
| `billing` | `modules/billing` | `/api/wallet/*`, `/api/keys/*`, `/api/billing/*`, `/api/admin/*` | CPU (HPA) |

Plus PostgreSQL and RabbitMQ, each a StatefulSet.

There is no gateway service. The gateway is a Kubernetes Ingress on Traefik,
which k3s and k3d both ship. It routes by path prefix, as the table says, and it never
routes `/internal/*`.

`session` has one replica. The kernel holds running tasks in memory, so a
second replica would not see them. Say so in the report: it is the next thing
to split, and the reason the proposal named a `stream` service.

## Data: one shared database

Every service connects to the same PostgreSQL database with the same
`DATABASE_URL`. Only `session` runs the migrations, at startup, as the monolith
does today. The other services wait for `session` to be ready.

So a port that only reads or writes the database can stay in-process: build
the other slice inside your service. Example: `worker` needs
`requireProject`; it builds the projects slice in-process over the shared
database. The report states this as a simplification. The proposal's
"one database per service" is future work.

## The two calls that must cross a process

### 1. A turn: session to worker, through RabbitMQ

The kernel takes a `Worker` (`core/domain/worker.ts`). The `session` service
gives it a `QueueWorker` in place of the in-process worker. The kernel does not
change.

1. `QueueWorker.run(task, input, report)` publishes a message to the durable
   queue `lumen.turns`:
   `{ "turnId": "<uuid>", "task": <Task>, "input": "<string>" }`.
2. It keeps `report` in a map under `turnId`, and waits.
3. A `worker` pod takes the message and calls `steering.worker.run(task, input,
   remoteReport)`.
4. When `run` returns or throws, the worker calls
   `POST /internal/turns/:turnId/done` with `{ "ok": true }` or
   `{ "ok": false, "error": "<message>" }`, and then acknowledges the message.
5. `QueueWorker.run` resolves or throws, and the kernel carries on.

A worker that dies before the acknowledgement leaves the turn on the queue, and
another worker takes it. KEDA scales `worker` on the length of `lumen.turns`.

### 2. The report: worker to session, over HTTP

`remoteReport` implements `WorkerReport` (`core/domain/worker.ts`). Each call
is an HTTP request to the `session` service, which finds the real report under
`turnId` and calls it.

| `WorkerReport` member | Request to `session` | Response |
|---|---|---|
| `appendStep(taskId, kind, text, detail)` | `POST /internal/turns/:turnId/step` | `204` |
| `delegate(taskId, work)` | `POST /internal/turns/:turnId/delegate` | `200 { "children": Task[] }` |
| `recordFinding(taskId, text, title)` | `POST /internal/turns/:turnId/finding` | `200 <Finding>` |
| `addSpend(taskId, amount, reason)` | `POST /internal/turns/:turnId/spend` | `204` |
| any other member (the stop check) | `POST /internal/turns/:turnId/<member>` | its value as JSON |
| `log` | none: the worker logs on its own stdout with the same ids | |

The request body is the arguments as a JSON object with the parameter names.
`delegate` waits until the children are at rest, which can take minutes. Its
client timeout is 15 minutes. Every other call has a 10-second timeout.

The children of a `delegate` are new turns. They go on `lumen.turns`, so any
worker pod can take them. This is what makes the worker scale: one question
fans out to several turns.

### 3. The approval resume: billing to session, over HTTP

When the owner approves an over-cap step on the Wallet page, billing calls
`approvalResume.requestResume`. The running task is in the `session` pod, so
in the `billing` service that port is an HTTP call:
`POST /internal/approvals/resume` with `{ "accountId", "approvalId" }`.

### 4. Steering's reads: worker to session, over HTTP

Steering needs `taskSession` and `sessionContext` from session's
`SessionDirectory`. The worker gets them from session:

- `GET /internal/tasks/:taskId/session`
- `GET /internal/sessions/:sessionId/context`

LIU ZIYANG writes the session side. If either one only reads the database, the
worker may build it in-process instead, and this section says so.

## Internal calls

- Every `/internal/*` route checks the header `x-lumen-internal`. Its value is
  the secret `LUMEN_INTERNAL_KEY`. A request without it gets `401`.
- The Ingress never routes `/internal/*`. Services call each other by their
  Kubernetes Service name, for example `http://session:4000/internal/...`.
- The adapters live in `apps/server/src/services/shared/`: `queueWorker.ts`,
  `remoteReport.ts`, `internalAuth.ts`, `rabbit.ts`. LIU ZIYANG writes them first,
  on 21 October, so that the worker and billing can use them.

## Sign-in

Sign-in does not change. Every service builds the identity cookie resolver over
the shared database, so the auth cookie works on every path. The public API
(UC2, UC3) uses `Authorization: Bearer <api key>`. LU YI decides where the keys
are stored.

## Public deployment: k3s on AWS

The demonstration runs on a public HTTPS address that the lecturer can open
during the presentation and after it. Local k3d stays the place to develop and
test; the cluster in AWS runs the same chart.

| Part | Choice | Why |
|---|---|---|
| Host | One EC2 instance, `t3.xlarge` (4 vCPU, 16 GB), region `ap-southeast-1` (Singapore), Ubuntu 24.04, 50 GB gp3 | Enough for every service and 8 workers. Close to the audience. |
| Kubernetes | k3s, one node | The same Traefik, local-path storage and metrics-server as k3d, so the chart does not change. The worker's shared volume works on one node. |
| Address | An Elastic IP, and the host name `lumen.<ip-with-dashes>.sslip.io` | A stable public name without buying a domain. |
| HTTPS | cert-manager with a Let's Encrypt `ClusterIssuer`, HTTP-01 through Traefik | A real certificate, so the browser shows the lock. |
| Images | GitHub Container Registry, `ghcr.io/ziyangliu-666/lumen-next`, tagged with the commit SHA | Built by the workflow. The package is public, as the repository is, so the cluster pulls without a secret. |
| Deploy | `.github/workflows/platform-deploy.yml`: on every push to `ass/platform`, build and push the image, then `ssh` to the host and run `helm upgrade --install` with the new tag | A merge is a deployment. This is the DevOps part of the demonstration. |
| Access | Security group: 80 and 443 open; 22 only with the deploy key; 6443 closed. `kubectl` from a laptop goes through `ssh -L 6443:localhost:6443`. | The Kubernetes API is never public. |
| Cost | About USD 5 per day. Stop the instance at night with `aws ec2 stop-instances`. Delete everything after the grades are out. | Under USD 50 in total. |

Rules for the public host:

- The model key on the host is a key with a low spending limit at the
  provider. Every account also starts with the USD 1 cap that billing enforces.
- `LUMEN_INTERNAL_KEY`, the database password and the model key are GitHub
  Actions secrets. They never appear in the repository or in a log.
- The RabbitMQ management page is not public. Reach it through the SSH tunnel.

EKS is the next step after the demonstration: the same chart, plus node
autoscaling and EFS for the shared volume. The report says so.

## The demonstration, from the command line

`deploy/k8s/demo.sh` runs the whole demonstration against the public host.
LIU ZIYANG writes it on 24–25 October. It reads the address from `LUMEN_URL`,
so the same script also runs against local k3d. It prints each command before
it runs it:

1. Open `https://lumen.<ip>.sslip.io` in the browser: the lock, the landing
   page. Show the last run of the deploy workflow on GitHub.
2. `kubectl get pods` through the SSH tunnel: every service is ready.
3. `curl`: sign up, sign in, create a project, ask a question.
4. Watch the session: the steps arrive through the socket (`websocat`), or
   `curl /api/sessions/:id`.
5. `rabbitmqctl list_queues`: turns on the queue.
6. `k6 run deploy/k8s/load/ask.js` against workers started with
   `LUMEN_WORKER=demo`. The demo worker (`modules/session/demoWorker.ts`) fans
   out to three readers and waits `paceMs` per step, without a model. So the
   test costs no money, and the queue grows enough to make KEDA scale.
7. `kubectl get hpa,scaledobject -w` and `kubectl get pods -w`: workers go
   from 1 to N, then back.
8. `kubectl delete pod` on a worker during a run: the turn is taken by another
   worker.
9. `curl /api/wallet`: the cost of the question.

## Schedule

| Date | Work | Done when |
|---|---|---|
| 20 Oct | This contract and the prompts. | Every member has read them. |
| 21 Oct | LIU ZIYANG: the shared adapters on `ass/platform`. | Merged, so the others can import them. |
| 21 Oct | HE RONG: the EC2 host with k3s, the Elastic IP and the security group. | `kubectl get nodes` works through the tunnel. |
| 21–23 Oct | Every member: their service, on their branch. | The service starts on k3d and answers `/api/health`. |
| 23 Oct | HE RONG and LU YI: the deploy workflow and HTTPS. | A push to `ass/platform` reaches the public address with a valid certificate. |
| 24 Oct | Integration, on k3d first, then on the public host. | Step 3 of the demonstration works on the public address. |
| 25 Oct | Load test, demonstration script, slides, rehearsal. | `demo.sh` runs from start to end. A recording exists, in case the live run fails. |
| 26 Oct | Presentation at 11:25. | |

Not in the demonstration, stated as future work in the report: EKS with node
autoscaling, a separate
`stream` service, one database per service, the model gateway, the agent
registry beyond a list, UC6 (the literature watch), OpenTelemetry and network
policies.
