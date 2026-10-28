# Report: the Helm chart (subagent, 2026-10-20)

Verbatim report from the subagent that wrote `deploy/k8s/lumen/` and `deploy/k8s/aws/`.

---

The chart is written and all three required commands pass. It is not tested on a cluster: I did not run k3d or k3s. Nothing is staged or committed. I applied the lead's change to three queues.

## Files
All files are under `deploy/k8s/`. The other agents wrote `load/ask.js` and `.github/workflows/platform-deploy.yml`. I did not touch them.
- `lumen/Chart.yaml`, `lumen/values.yaml`
- `lumen/templates/`:
  - `_helpers.tpl`
  - `secrets.yaml`, `configmap.yaml`
  - `apps.yaml` (the five services)
  - `autoscaling.yaml` (the HPAs, the TriggerAuthentication and the ScaledObject)
  - `worker-pvc.yaml`, `postgres.yaml`, `rabbitmq.yaml`
  - `ingress.yaml` (the IngressRoutes, the Middlewares and the Certificate)
  - `NOTES.txt`
- `aws/values-aws.yaml`, `aws/cluster-issuer.yaml`, `aws/README.md`
- `README.md`

## Rendered resources (AWS values, 28 objects)
- **Deployment and Service** (port 4000, named `http`): identity, project, session, worker, billing.
  - Each runs `node apps/server/dist/services/<name>.js` in `/app` as user 1000. The image entrypoint is not used.
  - Each has startup, readiness and liveness probes on `/api/health`.
- **HorizontalPodAutoscaler**: identity, project, billing. CPU 70%, 1 to 3 replicas.
- **session**: `replicas: 1` with the `Recreate` strategy, so two kernels never run at the same time during a rollout.
- **TriggerAuthentication** `worker-rabbitmq`, and **ScaledObject** `worker`:
  - 1 to 4 replicas.
  - Three `rabbitmq` triggers, on `lumen.turns.0`, `.1` and `.2`. Each uses `protocol: http` and `QueueLength` 5.
  - Scale-down waits 60 s in place of the HPA default of 300 s, so the demo shows the workers go back down.
- **PersistentVolumeClaim** `worker-projects`: local-path, ReadWriteOnce. A comment says why one node makes this work.
- **worker**: fsGroup 1000, `terminationGracePeriodSeconds` 120, `LUMEN_VOLUME_ROOT=/data/projects`.
- **StatefulSet and headless Service** `postgres`: postgres:16-alpine, 2Gi.
- **StatefulSet and headless Service** `rabbitmq`: rabbitmq:3.13-management, ports 5672 and 15672, 1Gi.
- **Secret** `lumen-core`:
  - Holds POSTGRES_PASSWORD, RABBITMQ_PASSWORD and LUMEN_INTERNAL_KEY (48 characters). It is generated with `randAlphaNum`, kept on upgrade with `lookup`, and kept on uninstall with `resource-policy: keep`.
  - It also holds `KEDA_RABBITMQ_URL`. That value is the management-API URL with the full name `rabbitmq.<ns>.svc.cluster.local`, because KEDA runs in another namespace.
- **Secret** `lumen-extra`: built from `extraSecrets`. Every app container loads it with `envFrom` and `optional: true`.
- **ConfigMap** `lumen-config`: holds every key you listed. `LUMEN_WORKER` is `steering` when `extraSecrets` holds `OPENAI_API_KEY` or `DEEPSEEK_API_KEY`, otherwise `demo`. `config.worker` overrides this.
- **Middleware** `auth-rate-limit`: average 10, burst 20.
- **IngressRoute** `lumen`: entryPoint `websecure` with `tls.secretName: lumen-tls`.
- **IngressRoute** `lumen-redirect` and **Middleware** `redirect-https`: on entryPoint `web`, with the rule `Host && !PathPrefix(/.well-known/acme-challenge/)`.
- **Certificate** `lumen-tls`: from ClusterIssuer `letsencrypt`.

The local render has no Certificate and no redirect. It has one IngressRoute on `web`.

`DATABASE_URL` and `RABBITMQ_URL` are built with `$(VAR)` expansion. Each app pod also has an init container that uses the same image and waits for postgres (and rabbitmq for session and worker), so a fresh install does not crash-loop.

## Route table
Every rule also matches `Host(ingress.host)`. All paths are under `apps/server/src/`.

| Priority | Rule | Service | Source |
|---|---|---|---|
| 100 | `PathRegexp ^/api/projects/[^/]+/(files\|upload)(/\|$)` | worker | `modules/steering/routes.ts:100,129,153` |
| 100 | `PathRegexp ^/api/projects/[^/]+/sessions/?$` | session | `modules/session/routes.ts:52,72` |
| 50 | `/api/projects`, `/api/projects/*` (includes `:id/stop`, `/visit`, `/findings`) | project | `modules/projects/routes.ts:12-42` |
| 50 | `/api/auth*`, with the rate limit | identity | `modules/identity/routes.ts`, `oauthRoutes.ts` |
| 50 | `/api/me`, `/api/me/*`, `/api/local/*` | identity | `modules/identity/routes.ts:142-338` |
| 50 | `/api/wallet*`, `/api/keys*`, `/api/billing/*`, `/api/admin/*` | billing | `modules/billing/routes.ts`, `keyRoutes.ts`, `topupRoutes.ts`, `approvalRoutes.ts`, `adminRoutes.ts`, `adminLedger.ts`, `adminWallet.ts` |
| 50 | `/api/sessions/*`, `/api/models`, `/ws` | session | `modules/session/routes.ts:80-89`, `core/http/wsBridge.ts:48` |
| 1 | ``PathPrefix(`/`) && !PathPrefix(`/internal`)`` | session (web app) | `core/http/server.ts:158` |

The source answers your question: `/api/projects/:id/stop` is in the projects slice, so it goes to project. `/api/projects/:id/sessions` is in the session slice, so it goes to session. No rule routes `/internal`.

## Commands and results
- `brew install helm kubeconform`: both installed.
- `helm lint deploy/k8s/lumen`: passes, also with the AWS values. The only message is "icon is recommended".
- `helm template lumen deploy/k8s/lumen -n lumen`: renders 25 objects.
- The AWS `helm template` command with `--set ingress.host=lumen.example.sslip.io`: renders 28 objects.
- `kubeconform -strict` with the CRD kinds skipped: valid for both renders.
- I also ran kubeconform with the datree CRDs-catalog schemas. All 28 AWS objects and `cluster-issuer.yaml` are valid, including the Traefik, KEDA and cert-manager kinds.
- I read the rendered output once and checked every fixed name. I also checked that `LUMEN_WORKER` becomes `steering` when a model key is set, and that `keda.enabled=false` gives no ScaledObject.

## Open questions
1. **`RABBITMQ_URL` has no reader yet.** No code in `apps/server/src/services/` reads it. The adapter owner must use this exact name, or tell me the name to use.
2. **The KEDA URL has no vhost path.** KEDA then uses the default vhost `/`. Check this on the first install with `kubectl get scaledobject worker`. If it shows not ready, add `/%2F` to the end of the URL.
3. **`/api/local/*` has no route in the source.** I sent it to identity because the contract assigns it there. Remove that rule if you want the routes to come only from the source.
4. **The rate limit may count every user as one client.** The k3s ServiceLB can replace the client IP, so all users could share the 10/20 limit. Check this on the host. A fix is `externalTrafficPolicy: Local` on the Traefik service, or a `sourceCriterion` on the middleware.
5. **Sign-in may hit the rate limit.** The limit covers every `/api/auth` path, including the OAuth redirects and `/api/auth/providers`. A page that loads several of them in a burst could reach the limit.
6. **Only the worker mounts the projects volume.** If session or project also reads project files, for example on project delete, they need the same mount.
7. **The services' memory limit of 256Mi is not tested.** Session also serves the web app, so watch it for OOM kills.
