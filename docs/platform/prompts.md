# Prompts for each member's AI assistant

Each member copies their own prompt, from the line under their name to the end
of the code block, into their AI coding assistant. Run it from the root of a
fresh clone of `lumen-next`. Each prompt is complete: it names the branch, the
files, the behaviour and the check that says it is done.

Order: LIU ZIYANG's shared adapters merge into `ass/platform` first, on
21 October. The worker and billing prompts import them. Until then, those two
members write against the interfaces in `docs/platform/contract.md` and merge
`ass/platform` again when the adapters land.

---

## LIU ZIYANG: session, shared adapters, integration, demo script

```text
You are working on lumen-next, a TypeScript monorepo (Node 22, Fastify,
PostgreSQL). Read docs/platform/contract.md first, completely. It is the
contract for this work and it wins over anything else you assume.

Branch:
  git fetch origin
  git switch -c ass/session origin/ass/platform
Open one pull request from ass/session into ass/platform. Merge
origin/ass/platform into your branch every day.

Rules:
- Add files only, under apps/server/src/services/, deploy/k8s/ and
  .github/workflows/platform-*.yml. Do not change main.ts, app.ts or anything
  under apps/server/src/modules/.
- npm run verify must stay green.
- English only in code, comments, commits and the pull request.

Part 1, first, open its own pull request today so the others can use it:
the shared adapters in apps/server/src/services/shared/.
- internalAuth.ts: a Fastify hook for /internal/* that checks the header
  x-lumen-internal against LUMEN_INTERNAL_KEY and answers 401 otherwise; and a
  fetch helper that adds the header, with a timeout parameter.
- rabbit.ts: connect to RABBITMQ_URL (use the amqplib package), declare the
  durable queue lumen.turns, publish a JSON message, consume with manual
  acknowledgement and prefetch 1.
- queueWorker.ts: QueueWorker implements Worker (core/domain/worker.ts).
  run(task, input, report) publishes { turnId, task, input } to lumen.turns,
  keeps report in a map under turnId, and resolves or rejects when
  POST /internal/turns/:turnId/done arrives.
- internalTurnRoutes.ts: the session-side routes from the contract section
  "The report": step, delegate, finding, spend, any other WorkerReport member,
  and done. Each finds the report under turnId and calls it.
- remoteReport.ts: RemoteReport implements WorkerReport over those routes, for
  the worker side. delegate has a 15-minute timeout, the others 10 seconds.
- Unit tests for each file, with no real RabbitMQ: put the connection behind a
  small interface and pass a fake.

Part 2: apps/server/src/services/session.ts, the session service.
- Read the environment as main.ts does. Open the database and run the
  migrations (openDatabase already migrates).
- Build the session slice with QueueWorker as its worker. Build the projects
  and billing slices in-process over the shared database for the ports
  session needs (requireProject, recordFinding, onTitle, recordSpend, budget),
  exactly as app.ts wires them. Build identity's cookie resolver for sign-in.
- Register the session routes, the /ws socket (buildServer), /api/health,
  and the internal routes. Also POST /internal/approvals/resume, which calls
  session.approvals.requestResume, and the two reads in the contract's
  section "Steering's reads".
- Listen on LUMEN_PORT (default 4000). Shut down cleanly on SIGTERM.

Part 3, on 24 and 25 October: deploy/k8s/demo.sh, the command-line
demonstration in the contract section "The demonstration". It reads the
address from LUMEN_URL and opens the SSH tunnel for kubectl when LUMEN_SSH_HOST
is set, so the same script runs against local k3d and against the public host.
It prints each command before it runs it and stops on the first error. Test it
on k3d first, then on the public host.

Done when: a question asked with curl on the public HTTPS address shows steps
that a worker pod wrote, and demo.sh runs from start to end against it.
```

---

## LI ZHUOYANG: worker

```text
You are working on lumen-next, a TypeScript monorepo (Node 22, Fastify,
PostgreSQL). Read docs/platform/contract.md first, completely. It is the
contract for this work and it wins over anything else you assume.

Branch:
  git fetch origin
  git switch -c ass/worker origin/ass/platform
Open one pull request from ass/worker into ass/platform. Merge
origin/ass/platform into your branch every day. LIU ZIYANG's shared adapters
(apps/server/src/services/shared/) arrive there on 21 October; use them, do
not write your own copies.

Rules:
- Add files only, under apps/server/src/services/, deploy/k8s/ and
  .github/workflows/platform-*.yml. Do not change main.ts, app.ts or anything
  under apps/server/src/modules/.
- npm run verify must stay green.
- English only in code, comments, commits and the pull request.

Build apps/server/src/services/worker.ts, the worker service.
- Consume lumen.turns with prefetch 1 (shared/rabbit.ts).
- For each message { turnId, task, input }: build a RemoteReport for turnId
  (shared/remoteReport.ts) and run the worker on it. Then call
  POST http://session:4000/internal/turns/:turnId/done with { ok: true }, or
  { ok: false, error } if run threw. Acknowledge the message only after that.
- Which worker runs: LUMEN_WORKER=steering runs steering's worker
  (createSteeringSlice(...).worker) with the model from modelFromEnv.
  LUMEN_WORKER=demo runs demoWorker from modules/session with paceMs from
  LUMEN_DEMO_PACE_MS. The load test uses demo, so it costs no money.
- Steering needs requireProject, taskSession and sessionContext. Build the
  projects slice in-process over the shared database for requireProject. Get
  taskSession and sessionContext from session over HTTP, as the contract's
  section "Steering's reads" says. LIU ZIYANG writes the session side.
- Serve steering's file routes (/api/projects/:id/files*,
  /api/projects/:id/upload/*) with the identity cookie resolver, and
  /api/health. The project volume is LUMEN_VOLUME_ROOT, a mounted volume.
- On SIGTERM: stop taking messages, finish the current turn, then exit. A turn
  that is not acknowledged goes back on the queue for another worker.
- Unit tests with a fake queue and a fake session: a turn runs and is
  acknowledged; a failed turn reports ok: false; a turn is not acknowledged
  when done could not be sent.

Done when: on k3d, two worker pods share the turns of one question, and
deleting one worker pod during a run does not lose the question.
```

---

## LU YI: identity and the Ingress

```text
You are working on lumen-next, a TypeScript monorepo (Node 22, Fastify,
PostgreSQL). Read docs/platform/contract.md first, completely. It is the
contract for this work and it wins over anything else you assume.

Branch:
  git fetch origin
  git switch -c ass/identity origin/ass/platform
Open one pull request from ass/identity into ass/platform. Merge
origin/ass/platform into your branch every day.

Rules:
- Add files only, under apps/server/src/services/, deploy/k8s/ and
  .github/workflows/platform-*.yml. Do not change main.ts, app.ts or anything
  under apps/server/src/modules/.
- npm run verify must stay green.
- English only in code, comments, commits and the pull request.

Part 1: apps/server/src/services/identity.ts, the identity service.
- Read the environment as main.ts does (OAuth providers, mail, origin,
  secure cookies). Open the shared database. Do not run migrations: session
  runs them. Wait until the database answers before you listen.
- Build the identity slice as app.ts does. Its ports onAccountDeleting and
  removeOwnOpenAiKey come from the billing module and only touch the database,
  so wire them in-process.
- Register the identity routes and /api/health. Listen on LUMEN_PORT.

Part 2: the Ingress, deploy/k8s/lumen/templates/ingress.yaml, inside HE RONG's
chart (coordinate the file with HE RONG; the chart lives on ass/deploy until
it merges).
- Traefik, which k3d ships. Route by path prefix to the five services exactly
  as the contract's service table says. More specific paths first.
- Never route /internal/*. Add a test in demo terms: curl /internal/... through
  the Ingress returns 404.
- HTTPS on the public host (contract section "Public deployment"): the host
  name comes from values.yaml (ingress.host); a cert-manager annotation asks
  the ClusterIssuer that HE RONG installs for a Let's Encrypt certificate; a
  Traefik middleware redirects HTTP to HTTPS. Local k3d keeps plain HTTP, set
  by a value.
- Sign-in on the public host: the identity origin is https://<ingress.host>.
  Add https://<ingress.host>/api/auth/github/callback and the Google one to the
  OAuth apps (or make second OAuth apps for the platform), and put their
  client ids and secrets in the GitHub Actions secrets that HE RONG lists.
- A Traefik rate-limit middleware on /api/auth/*. Show that the 11th sign-in
  attempt in one second gets 429.

Part 3, only if Parts 1 and 2 are done: API keys for the public API (UC3).
Create, list and revoke a key on /api/auth/keys; store only a hash; accept
Authorization: Bearer <key> in the resolver. Write the design decision into
the contract's "Sign-in" section.

Done when: on the public HTTPS address, sign-up, sign-in and GitHub sign-in
work, the browser shows a valid certificate, and the rate limit returns 429.
```

---

## PENG XUJIAN: project and the load test

```text
You are working on lumen-next, a TypeScript monorepo (Node 22, Fastify,
PostgreSQL). Read docs/platform/contract.md first, completely. It is the
contract for this work and it wins over anything else you assume.

Branch:
  git fetch origin
  git switch -c ass/project origin/ass/platform
Open one pull request from ass/project into ass/platform. Merge
origin/ass/platform into your branch every day.

Rules:
- Add files only, under apps/server/src/services/, deploy/k8s/ and
  .github/workflows/platform-*.yml. Do not change main.ts, app.ts or anything
  under apps/server/src/modules/.
- npm run verify must stay green.
- English only in code, comments, commits and the pull request.

Part 1: apps/server/src/services/project.ts, the project service.
- Open the shared database; do not run migrations (session does). Wait until
  the database answers.
- Build the projects slice. It needs session's SessionDirectory
  (session.projects): the list of a project's sessions reads the database, so
  check whether building it in-process over the shared database is enough. If
  some of it needs the running kernel, call session over HTTP instead, and add
  that call to the contract with LIU ZIYANG.
- Identity's cookie resolver for sign-in. Register the projects routes and
  /api/health. Listen on LUMEN_PORT.

Part 2: the load test, deploy/k8s/load/ask.js, for k6.
- Setup: sign up one account per virtual user (or reuse a fixed set), create a
  project, and read the session cookie.
- Each iteration: ask a question, then poll /api/sessions/:id until the root
  task is at rest. Measure the time to rest as a custom trend.
- Stages: ramp from 1 to 50 virtual users over 2 minutes, hold 3 minutes,
  ramp down over 1 minute. Read the target URL from LUMEN_URL, so it runs
  against local k3d and against the public HTTPS address.
- Thresholds: under 1 percent failed requests; report the 95th percentile of
  the time to rest.
- The workers run with LUMEN_WORKER=demo, so the test costs no money.
- A short deploy/k8s/load/README.md: how to run it, and what to watch at the
  same time (kubectl get scaledobject,hpa,pods -w).

Done when: k6 runs against the public address, the worker pods scale up
during the hold and down after it, and the k6 summary is saved for the report.
```

---

## HE RONG: billing, the Helm chart, KEDA

```text
You are working on lumen-next, a TypeScript monorepo (Node 22, Fastify,
PostgreSQL). Read docs/platform/contract.md first, completely. It is the
contract for this work and it wins over anything else you assume.

Branch:
  git fetch origin
  git switch -c ass/deploy origin/ass/platform
Open one pull request from ass/deploy into ass/platform. Merge
origin/ass/platform into your branch every day. Merge the chart skeleton
(Part 2) early, by 22 October, because everyone tests on it.

Rules:
- Add files only, under apps/server/src/services/, deploy/k8s/ and
  .github/workflows/platform-*.yml. Do not change main.ts, app.ts or anything
  under apps/server/src/modules/.
- npm run verify must stay green.
- English only in code, comments, commits and the pull request.

Part 1: apps/server/src/services/billing.ts, the billing service.
- Open the shared database; do not run migrations (session does). Wait until
  the database answers.
- Build the billing slice as app.ts does. canSpend and the admin account
  reader come from identity and only touch the database, so build them
  in-process. Stripe as in main.ts.
- approvalResume.requestResume must reach the running task in the session
  pod: implement it as POST http://session:4000/internal/approvals/resume with
  shared/internalAuth.ts (LIU ZIYANG's adapters).
- Identity's cookie resolver for sign-in. Register the billing routes and
  /api/health. Listen on LUMEN_PORT.

Part 2: the Helm chart, deploy/k8s/lumen/.
- One image (the repository's Dockerfile), five Deployments: identity,
  project, session, worker, billing. Each runs
  node apps/server/dist/services/<name>.js. One Service per Deployment,
  port 4000. Readiness and liveness on /api/health.
- session: 1 replica. The others start at 1.
- PostgreSQL and RabbitMQ as StatefulSets with a volume, or as chart
  dependencies if that is simpler. RabbitMQ with the management plugin.
- One Secret with DATABASE_URL, RABBITMQ_URL, LUMEN_INTERNAL_KEY and the
  model key; one ConfigMap for the rest. values.yaml holds every setting.
- A ReadWriteMany volume for the worker's LUMEN_VOLUME_ROOT (on k3d,
  local-path on one node is enough; say so in a comment).
- Leave deploy/k8s/lumen/templates/ingress.yaml to LU YI.
- deploy/k8s/README.md: create a k3d cluster, build and import the image,
  install KEDA, helm install, open the app.

Part 3: scaling.
- HPA on CPU for identity, project and billing: 1 to 4 replicas, 70 percent.
  Set CPU requests, or the HPA has nothing to measure.
- KEDA ScaledObject for worker on the RabbitMQ queue length of lumen.turns:
  1 to 8 replicas, a target of 5 messages per replica.
- Check with PENG XUJIAN's k6 test that workers scale up and down.

Part 4: the public host and the deploy workflow. Read the contract section
"Public deployment" and follow its table.
- deploy/k8s/aws/README.md: the exact steps a person runs once, with the AWS
  CLI: a key pair, a security group (80 and 443 open, 22 open, 6443 closed), a
  t3.xlarge Ubuntu 24.04 instance in ap-southeast-1 with 50 GB gp3, an Elastic
  IP. Then on the host: install k3s, install KEDA and cert-manager with Helm,
  and apply a Let's Encrypt ClusterIssuer (deploy/k8s/aws/cluster-issuer.yaml).
  Also how to stop and start the instance, and how to delete everything. Do
  not put credentials, IPs or keys in the repository.
- deploy/k8s/aws/values-aws.yaml: the values for the public host: the image
  from ghcr.io/ziyangliu-666/lumen-next, ingress.host, HTTPS on.
- .github/workflows/platform-deploy.yml, triggered on push to ass/platform
  and by hand (workflow_dispatch), never on main:
  1. Build the image from the Dockerfile and push it to GHCR, tagged with the
     commit SHA (use the built-in GITHUB_TOKEN with packages: write).
  2. Copy the chart to the host with ssh and run helm upgrade --install with
     values-aws.yaml and --set image.tag=<sha>, and --wait.
  3. curl https://<host>/api/health until it answers, or fail the job.
  Secrets: PLATFORM_SSH_KEY, PLATFORM_SSH_HOST, and the application secrets
  (database password, LUMEN_INTERNAL_KEY, model key, OAuth ids and secrets),
  passed to helm as --set values from GitHub secrets, never echoed.
- The model key on the host must have a low spending limit at the provider.

Done when: helm lint passes, helm install on a fresh k3d cluster brings every
pod to ready, a push to ass/platform deploys to the public HTTPS address
without anyone logging in to the host, and the worker ScaledObject scales on
the public host during the load test.
```
