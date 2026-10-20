# Report: DevSecOps stages in the platform pipeline (subagent, 2026-10-20)

Verbatim report from the subagent that changed `.github/workflows/platform-deploy.yml`
and added the smoke profile to `deploy/k8s/load/ask.js`.

---

I added the DevSecOps stages to the platform deploy pipeline. All three checks pass. Nothing is committed, pushed or run, and no new job has run on GitHub yet.

I changed two files:
- `.github/workflows/platform-deploy.yml`
- `deploy/k8s/load/ask.js` (the smoke profile only)

I did not create `deploy/k8s/zap-rules.tsv`. I did not need it.

## The new jobs and where they are

- **`sca`** runs in parallel with `verify`. It runs `npm ci`, then `npm audit --omit=dev --audit-level=high`, the same as `security.yml`. The audit ignores dev dependencies because only production dependencies go into the image.
- **`sast`** runs in parallel with `verify`. It is a copy of the CodeQL job in `security.yml` (javascript-typescript, `upload: never`, `security-events: write`, `actions: read`). The SARIF goes to the artifact `codeql-sarif`.
- **`deploy`** now needs `verify`, `sca` and `sast`. The Trivy scan comes directly after "Build image" and before "Save image", so a vulnerable image never reaches the host. The scan has two passes:
  - The report pass lists HIGH and CRITICAL in a table. It writes the table to the job summary and to the artifact `trivy-image-report`. It never fails.
  - The gate pass fails the job on a CRITICAL with a fix (`ignore-unfixed: true`). It reuses the Trivy install from the first pass.

  Both passes use `scanners: vuln` only. This keeps a false positive from Trivy's secret scanner from blocking a deploy.
- The `deploy` job now exposes three outputs:
  - `host`: the sslip.io name, from the existing step.
  - `worker`: the worker mode the chart will really use.
  - `image_scan`: the result of the gate pass.

  I removed the old summary step from `deploy`. The new `summary` job replaces it.
- **`dast`** needs `deploy`. It runs the ZAP baseline scan against `https://<host>` with:
  - `allow_issue_writing: false`
  - `cmd_options: '-I'`, so warnings do not fail the job. This is the same setting as `deploy.yml`.
  - `fail_action: true`, so a FAIL-level rule fails the job.
  - the report in the artifact `zap-baseline-report`.

  `fail_action: true` is necessary. Without it the action never fails, not even on a FAIL. In `deploy.yml` this input is not set, so that job does not fail on a FAIL either.
- **`smoke-load`** needs `deploy`. It runs `ask.js` with `PROFILE=smoke` and `POOL=4` against `https://<host>`. The k6 thresholds still apply. The summary JSON goes to the artifact `k6-smoke-summary`.
- **`summary`** needs all the stages and always runs. It writes the public URL, the image tag and a table with one row per stage: SCA, SAST, image scan, deploy, DAST, smoke load.

**`smoke-load` runs only when the effective worker mode is `demo`.** The skip is stricter than the brief, which skipped only when the input was `steering`. The chart picks steering on `auto` when `OPENAI_API_KEY` is set, and a push always runs as `auto`. A test on input `steering` only would have called the paid model on every push, if that secret exists. With this rule:
- A push with the key set skips the smoke load.
- To run the smoke load, start the workflow by hand with `worker: demo`.

In `ask.js`, the new `smoke` profile holds 2 VUs for 30 s (`startVUs: 2`). I also updated the header comment and the error message. `deploy/k8s/load/README.md` does not list `smoke` yet, because I could only change `ask.js` in that folder.

## Pinned versions

| Action | Pin |
|---|---|
| `aquasecurity/trivy-action` | commit `ed142fd0673e97e23eac54620cfb913e5ce36c25` (tag v0.36.0) |
| `zaproxy/action-baseline` | `v0.15.0` (the latest; `deploy.yml` uses v0.14.0) |
| `grafana/setup-k6-action` | `v1.2.2` |
| Other actions | as before: checkout, setup-node, upload-artifact v4; codeql-action v3 |

I pinned Trivy to the commit, not to the tag, because trivy-action tags were force-pushed with malicious code earlier in 2026. A commit pin cannot be moved.

## Checks
- `actionlint .github/workflows/platform-deploy.yml`: no findings.
- `npx prettier --check .github/workflows/platform-deploy.yml deploy/k8s/load`: all files pass.
- `k6 inspect -e PROFILE=smoke -e LUMEN_URL=https://x.example deploy/k8s/load/ask.js`: valid, `startVUs: 2`, one stage of 30 s at 2 VUs. The default `full` profile still passes `k6 inspect`.

## Open points
- **ZAP warnings:** I expect the 3 known warnings. On the public host, the Ingress and TLS can add other warnings, for example about HSTS or headers. `-I` reports them without failing the job. If one appears, mark it IGNORE in a rules file and add `rules_file_name` (this needs a checkout step in `dast`).
- **Trivy findings:** the image has not been scanned yet. If it has a CRITICAL with a fix, the first run will stop before the copy to the host.
- **Trivy database download:** it sometimes fails when ghcr.io rate-limits. The action caches the database, so a re-run usually passes.
- **Smoke load against the shared host:** each run signs up 4 new accounts on the public host and spends about USD 0.03 per demo question. This is in the demo wallet only, not real money.
