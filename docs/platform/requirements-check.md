# ASS practice module: requirements against the build

This page checks the platform on `ass/platform` against what the course asks
for. It was written on 20 October 2026 and reconciled with the branch and deployment
evidence on 21 October 2026. Historical plans below are not unfinished features.

Sources:

- **Briefing**: `01 Briefing.pdf` (ATA/S-SWE5001/Briefing V2.6), Canvas course
  SWE5001_SE34FT_202609, folder "PM Project Brief".
- **Guidelines**: `04 Project Presentation Guidelines & Schedule-Revised.pdf`.
- **Template**: `02 Project Report Template for Practice Project.docx`.
- **Review**: the lecturer's proposal review in Canvas Inbox, 6 October 2026:
  "By default, you are expected to architect, design and implement a
  horizontally scalable cloud-native microservice-oriented system."
- **Proposal**: Team 15 proposal v2, 6 October 2026 (eight services, one
  database each, UC1 to UC6).

## What is graded

| Part | Weight (not company sponsored) |
|---|---|
| Final presentation | 20% |
| Project report (5% of it is peer assessment) | 30% |
| Written examination | 50% |

The group project and the examination must each be passed separately, with
at least 40%.

## Requirements and status

Status: **Built** (on the branch and deployed), **Partial**, **Unconfirmed**.

| # | Requirement | Source | Status | Notes |
|---|---|---|---|---|
| R1 | A platform that enhances a business ecosystem. Identify the seed, the producers and the consumers. | Briefing p5, p8, p10; Guidelines 1b, 3c; Template 3.1.4 | Built | The seed (a question runs as a tree of costed, recorded steps under a cap), the producers (publish an agent in the registry, read its usage) and the consumers (the web app, and the API with a chosen agent). See `evidence/2026-10-20-public-api-flow.md`. |
| R2 | Demonstrate the scalability of the platform. | Briefing p5; Guidelines 6b | Built | HPA on identity, project, billing; KEDA on the worker queues; k6 test. Public-host evidence: demo workers scaled 1 to 4 to 1 on 20 Oct; real-model workers scaled 1 to 2 to 1 on 21 Oct. These are short-profile results, not a full-profile capacity guarantee. |
| R3 | A horizontally scalable, cloud-native, microservice-oriented system. | Review, 6 Oct | Partial | Five services, four of them scale horizontally. `session` has one replica, because the kernel holds running tasks in memory. All services share one database, while the proposal promised one database per service. |
| R4 | Cloud native, with appropriate cloud services. | Briefing p3, p5 | Partial | Containers, Kubernetes, probes, ConfigMap and Secrets, autoscaling, rolling updates, on AWS EC2 with an Elastic IP. Observability (OpenTelemetry traces and Prometheus metrics in the proposal) is not built. |
| R5 | Automate development and deployment; DevSecOps pipeline scripts and test scripts. | Briefing p3, p5 | Built | CI (`npm run verify`), SCA (`npm audit`), SAST (CodeQL), an image scan (Trivy, which stopped one deploy on a critical CVE until the platform image was fixed), CD to the public host, DAST (OWASP ZAP baseline) and a k6 smoke load after demo-mode deploys. Run 39441445313 passed every stage. Run 39542685448 passed verify, SCA, SAST, image scan/deploy and DAST; smoke was intentionally skipped in steering mode to avoid paid calls. |
| R6 | Minimum security controls. | Briefing p5 | Built | HTTPS (Let's Encrypt), cookie sign-in, an internal key on `/internal/*` (never routed), a rate limit on `/api/auth`, pods as a non-root user, generated secrets that stay in the cluster. Network policies (proposal) are not built. |
| R7 | At least one application that shows the platform's capabilities. | Briefing p5 | Built | The Lumen web app, and the literature watch (`apps/watch/`), which uses only the public API and an API key. It ran end to end on the public host. |
| R8 | Robust API access to the platform (Platform Engineering). | Briefing p3; proposal UC2, UC3 | Built | `/api/v1` with API keys (hashed, with scopes), a per-key rate limit (429 seen after the burst on the public host) and an OpenAPI document at `/api/v1/openapi.json`. |
| R9 | Platform operations and data; analytics. | Briefing p3, p10; proposal UC5 | Built | `/api/v1/usage`: sessions, cost and median time to rest per agent for producers and per account for consumers; everything for staff. Staff administration also shows accounts and the ledger. |
| R10 | A fortnightly progress report in Canvas ("PM Progress Reports"). | Briefing p14 | Unconfirmed | No submission receipt is recorded here. The team must confirm the Canvas submission date; repository evidence alone cannot establish whether it was submitted. |
| R11 | A 40-minute presentation in the given outline, with an 8-minute demo. | Guidelines | Partial | `deploy/k8s/demo.sh` and `slides/out/Team15-Lumen-Platform.pptx` exist, including recorded public-host scenes. Timed rehearsal and final speaker allocation still need team confirmation. |
| R12 | A report in the template, due 16 November. | Template | Partial | `report/report.md` and the Word export exist, including AD-01 to AD-20 and architectural limitations. Actual hours, submission date and repository review rules remain team placeholders; regenerate the final Word export after completing them. |

## Remaining acceptance and delivery work before 26 October

1. **Hosted approval acceptance** (billing/session). Local Postgres and
   real-HTTP acceptance now passes grant, rejection, account isolation and
   delivery retry after a billing restart; see
   `evidence/2026-10-21-approval-http.md` for the test and reproduction command.
   Local success is not evidence of a hosted ingress/queue run; record that
   approval run separately when the team schedules it.
2. **Submission and effort records** (R10, R12). Confirm the Canvas receipt,
   actual member hours and repository review rules. Do not infer them from
   commit counts. Finish the report source, then refresh its Word export.
3. **Presentation rehearsal** (R11). Time the 40-minute presentation and
   8-minute demo with the existing deck and recordings; confirm who speaks.
4. **Capacity claims** (R2). Keep the recorded short-profile results distinct
   from the unrecorded full profile. Coordinate any further hosted load with
   the load-test owner and core owner; steering mode incurs provider charges.

The producer registry, scoped public API, literature-watch client and
DevSecOps pipeline from the original 20 October plan are implemented. Their
public-host evidence is linked above; they are not new feature assignments.

## What to explain in the report instead of building

Each of these goes into "Architectural Limitation" (Template 3.4) with a
resolution and a timeline.

| Limitation | Why it is acceptable now | Resolution |
|---|---|---|
| `session` has one replica. | The kernel keeps running tasks in memory. | Move the live stream to its own `stream` service and the task state to the database, then run several session replicas. |
| One shared database. | The slices still read across tables. The schemas are already separated by migration prefix. | One schema and one database user per service, then one database per service. |
| One EC2 node, not EKS. | Cost (about USD 1.3 a day) and time. The same chart runs on EKS. | EKS with node autoscaling, and EFS for the worker's shared volume. |
| A redelivered turn runs again from its start. | A worker that dies mid-turn is rare; the question still finishes. | Make turns idempotent, or resume from the recorded steps. |
| No network policies, no tracing. | Time. | Network policies that allow only the calls in the contract; OpenTelemetry with one trace id per question. |
