# Agent report: ASS project report, 27 October 2026

Brief: /tmp/rpt/briefs/b-ass-project.md. Nothing is committed.

## What I produced

| Output | Path (worktree `ass-platform`) |
|---|---|
| Report source, rewritten | `docs/platform/report/report.md` (about 14,900 words) |
| Word builder | `docs/platform/report/build_docx.py` |
| Screenshot figure builder | `docs/platform/report/figures.py`, sources in `figures/src/` |
| Diagram generator (diagram-design style, white-paper skin) | `docs/platform/diagrams/report/draw.py`, `kit.py`, one `.html` per diagram |
| Figures used by the report | `docs/platform/report/figures/d-*.png` (10 diagrams), `s-*.png` (8 screenshot figures) |
| Word, PDF, Canvas zip | `docs/platform/report/out/Team 15 - Lumen Platform Report.docx`, `.pdf` (49 pages), `out/Team 15.zip`, `out/README.txt` |
| Report folder README | `docs/platform/report/README.md` |
| Old Mermaid diagrams | `docs/platform/diagrams/*.mmd` updated (Vultr host, "module", activation bars) and re-rendered with `theme.json`; the report does not use them any more |
| Removed | `docs/platform/report/Team15-Lumen-Platform-Report.docx` (the stale 20 October export; deleted in the worktree, not staged) |

The coursework copy (`~/Downloads/NUS-SE34-Coursework/ASS-Architecting-Scalable-Systems/Team15-Lumen-Platform-Report.docx`) is not updated. The coordinator copies the new file.

## The lecturer's remark: one node

AD-09 in 3.2.1 now reads "The platform runs on one node, for budget", with a detail block after the table: cost (Figure 7 and a table), what one node gives up, what still scales (measured, three rows), and a four-step growth path to EKS. 3.4 (AISS-03) and 4.2 each point to 3.2.1 in one sentence. Prices (read on 27 October 2026):

- AWS Price List API, `ap-southeast-1`: t3.medium 0.0528 USD/h, gp3 0.096 USD/GB-month, public IPv4 0.005 USD/h, NLB 0.0252 USD/h.
- Amazon EKS pricing page: 0.10 USD per cluster-hour (standard support).
- Vultr plans API: vc2-2c-4gb 0.027 USD/h, 20 USD/month.
- Result: Vultr 0.65 USD/day, EC2 1.45 USD/day, minimal EKS (control plane + 3 t3.medium + 3 IPv4 + NLB + 3 × 20 GB gp3) 7.36 USD/day. For 20 Oct to 16 Nov: about 22 USD (5 days EC2 + 23 days Vultr) against 206 USD.

## Facts found and changed

- **Where it runs.** The public host was an AWS EC2 t3.medium from 20 to 24 October. On 25 October it moved to a Vultr vc2-2c-4gb VM in Singapore (commit `b9aec0c`). The first install on vc2-1c-2gb failed (run 40161155236), the VM was resized, and run 40162838596 deployed. The address is now `https://lumen.139-180-185-51.sslip.io`; it answered 200 on 27 October. The old AWS address does not answer. The 26 October live demo used the Vultr host (the demo scripts point at it since commit `29e2a76`).
- **Model.** gpt-4.1-nano was pinned on 21 October; OpenAI answered 404 for it on 24 October; the workflow now sets gpt-4.1-mini (commit `67570f3`).
- **Default budget cap.** USD 0.05 for a new account on the public host (commit `ade7f7a`, run 40284716751). Added as AD-21.
- **Pipeline history.** 21 runs of `platform-deploy.yml`, 17 passed. Failures: 39439752963 and 39440170020 (image scan gate), 40160854228 (Prettier check on two files), 40161155236 (first install on the 1 vCPU VM).
- **Tests.** Run 40284716751: 1,198 tests passed in 131 files (5 skipped); lines 97.5%, branches 92.34%, functions 99.51%.
- **Branch protection (read only, `gh api`).** Ruleset "main" on the default branch: pull request with 1 approving review and code-owner review, required checks `quality` and `build-web`, no deletion, no force push, Copilot review. `ass/platform` has no ruleset and no branch protection. The report says so and names the pipeline as the gate.
- **Member branches.** The old report named `ass/session`, `ass/worker` and others. They do not exist on the remote; I removed the claim.
- **Commit for the platform image fix.** The old report cited `2b5e460`, which is no longer on the branch; the commit on the branch is `44630f7`.
- **Milestones.** The platform commits on the integration branch all carry 20 October 2026 dates; the branch starts from main at `320aa39` (19 October). Module work from 8 to 19 October is on main. The milestone table says this; it does not invent per-service dates.

## Figures and their sources

| Fig. | File | Source |
|---|---|---|
| 1 | `s-lumen.png` | (a) Playwright capture of the public landing page, 27 Oct; (b) frame at 105 s of `ASS-Team15-Demo-Backup.mp4` (public host, 25 Oct, gpt-4.1-mini) |
| 2 | `d-gantt.png` | Redrawn from the proposal v2 work breakdown and Figure 9 |
| 3 | `d-logical.png` | Drawn from the chart and services |
| 4 | `d-contextmap.png` | Drawn; contexts as on deck slide 9 |
| 5 | `s-producer.png` | Frames at 35 s and 145 s of `ASS-Team15-Demo-Backup.mp4`; last frame of `extra-recordings-vultr/literature-watch.gif` |
| 6 | `d-deployment.png` | Drawn from `deploy/k8s/lumen` and `deploy/k8s/vultr` |
| 7 | `d-cost.png` | Price figures above |
| 8 | `d-er.png` | Drawn from the migrations |
| 9 | `d-seq_ask.png` | Drawn from the code (askRoutes, queueWorker, worker) |
| 10 | `d-seq_approval.png` | Drawn from budgetChain, approvals, kernel |
| 11 | `s-approval.png` | Frames at 310, 330, 350 s of `ASS-Team15-Demo-Backup-v1.mp4` (local server, 22 Oct, gpt-4.1) |
| 12 | `d-loadtest.png` | Data from `evidence/2026-10-20-load-and-scaling.md` |
| 13 | `s-scaling.png` | Last frames of `slides/out/rec-load.gif`, `rec-scale-cut.gif` (EC2, 21 Oct) and `extra-recordings-vultr/keda-1-to-3.gif` (Vultr, 25 Oct) |
| 14 | `s-kill.png` | Last frames of `extra-recordings-vultr/worker-deleted.gif` (25 Oct) and `slides/out/rec-pods-cut.gif` (21 Oct) |
| 15 | `s-source.png` | Playwright capture of `apps/server/src/services` on GitHub (27 Oct); `cicd-screens/29-commits-per-week.jpg` (23 Oct) |
| 16 | `d-pipeline.png` | Drawn from `platform-deploy.yml`; durations of run 39441445313 |
| 17 | `s-runs.png` | Playwright captures of runs 40284716751 and 39439752963 (27 Oct, no sign-in) |
| 18 | `s-history.png` | Playwright capture of the workflow run list (27 Oct); last frame of `slides/out/rec-deploy.gif` (EC2, 21 Oct) |

No Mermaid PNG and no matplotlib chart is in the report. All 10 diagrams use one kit (`kit.py`) built on the diagram-design primitives: white paper, the skill's light roles, Geist and Geist Mono, orthogonal connectors, masked labels, accent on at most two elements.

## Choices the coordinator should check

1. **The Vultr move.** `deploy/k8s/vultr/README.md` mentions a suspended AWS account. The report does not give a reason for the move beyond the price comparison. If the team wants the reason stated, add one sentence in 3.2.
2. **Project hosting cost** (about USD 22) is a list-price estimate, not an invoice. I could not read the AWS or Vultr bills. The report says "at list price".
3. **Live demo.** The report says the team presented with a live demonstration on the public host, from the five-step run sheet. I did not see whether every step ran live on 26 October.
4. **Effort hours** stay at 80 per member (the plan's person-days × 8), with a note that there were no time sheets. This matches the progress reports brief.
5. **Type size in diagrams.** At print width, node names are about 8 to 9 pt and sublabels about 6 to 7 pt; deployment and pipeline sit on landscape pages for this reason. The skill's own ramp is smaller. If the lecturer reads on paper, the next step is a larger type ramp in `kit.py` and a re-layout.
6. **Bold lead-ins** in some bullet lists ("**One failure domain.**") remain from the old text. The writing guide reserves bold for definitions; remove them if the team wants a strict reading.
7. **Screenshots not available:** no RabbitMQ management page screenshot exists; the queue state is shown by the KEDA and kubectl output instead. No screenshot of the approval flow on the public host exists; Figure 11 uses the local-server recording of the same web app, and its caption says so.
8. **Size.** `figures/` is 20 MB (3x PNGs) and `out/` 29 MB (docx 10 MB, PDF 5 MB, zip 15 MB). Decide whether `out/` goes into git or only to Canvas and the coursework repository.
9. **Table of contents.** The PDF shows page numbers from the LibreOffice render. The docx asks Word to update fields on open; Word may paginate slightly differently.

## Facts not found

- Two-factor authentication on the members' GitHub accounts: not readable without admin access. Left out.
- The exact date the Canvas progress reports were submitted: none submitted so far, per the brief. Not mentioned.
