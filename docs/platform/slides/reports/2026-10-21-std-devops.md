# Standard-notation pictures: devops group

File: `docs/platform/slides/scenes_std_devops.py`. Scene keys: `branches`, `cicd`, `findings`, `scaling`. The module is added to `MODULES` in `make.py`.

The pipeline scene key is `cicd`, not `pipeline`. The key `pipeline` and the key `scale` already exist in `scenes_proof.py`. A second key with the same name would replace the old scene in `make.py`. The output file is `out/pipeline.gif`, as the brief asks, so `make.py cicd` overwrites the old `pipeline.gif` from `scenes_proof`. Running `make.py pipeline` writes the old picture again.

I checked every picture zoomed: quarter crops of the PNGs, and 10 to 12 frames from each GIF. I found no text that touches a line or an edge, and no cut-off text.

## 1. branches.png (slide 5a: source and artifacts), static

What it shows:
- At the left: the branch names. "main: Lumen" is grey, and "ass/platform" is white.
- `ass/platform` branches off `main`, and `main` merges into it once ("merge main").
- Five member branches leave `ass/platform` and come back through a pull request ("PR"). Each has the member's name and the branch name: Liu Ziyang `ass/session`, Lu Yi `ass/identity`, Peng Xujian `ass/project`, Li Zhuoyang `ass/worker`, He Rong `ass/deploy`. The branches nest, so no line crosses another line.
- At the right: the artifact path. "push" goes to the image `lumen-next:<commit sha>`, built from `deploy/k8s/Dockerfile`. "copy over SSH (scp)" goes to the UML node «AWS» EC2 host, with "k3s ctr images import". "helm upgrade --install --wait" goes to "Lumen platform, live".

Facts used:
- Branches, the merge rule and the image tag: report 5.1.
- The member-to-branch mapping: the WBS in report 2.1 (session for Liu Ziyang, identity for Lu Yi, project for Peng Xujian, worker for Li Zhuoyang, deploy for He Rong).
- The deploy steps: report 5.3, steps 1, 3 and 4.

Speaker notes: "We use one repository. main holds Lumen, and ass/platform is our integration branch. Each member works on one branch and merges it back through a pull request, and a change to Lumen goes to main first and is then merged in. Every push to ass/platform builds one image, tagged with the commit SHA, from deploy/k8s/Dockerfile. The pipeline copies that image to the EC2 host over SSH, imports it into k3s, and deploys it with helm upgrade, so there is no registry to run."

## 2. pipeline.gif (slide 5b: the CI/CD pipeline), animated, 26.6 s, 135 frames

The picture is a flowchart of `.github/workflows/platform-deploy.yml`:
- A "trigger" terminator: push to ass/platform, or a manual run.
- verify (lint, types, tests), SCA (npm audit) and SAST (CodeQL), in parallel.
- The "deploy" frame, with this chain: build image, then the Trivy gate (a decision diamond with "pass" down and "fail" to a "stop" terminator), then copy and import, then helm upgrade --wait, then health check.
- DAST (OWASP ZAP) and Smoke load (k6), in parallel.
- A "summary" terminator.

The steps of the animation:
1. "The pipeline: .github/workflows/platform-deploy.yml". The whole chart is calm.
2. "Run 39439752963 starts on a push to ass/platform". A "push" tag moves out of the trigger.
3. "Verify, SCA and SAST run in parallel, and all pass". The three boxes light up and get check marks.
4. "The deploy job builds the image and scans it". An "image" tag moves from build image to the Trivy gate.
5. "5 critical CVEs: the gate stops the deploy". The tag goes along "fail" to "stop". The later steps and DAST and the smoke load go faint, marked "skipped". The block "5 critical CVEs: deploy stopped" appears.
6. "The pipeline works: a vulnerable image never reaches the host".
7. "The fix: a smaller platform image, no Docker inside (2b5e460)".
8. "Run 39441445313: the fixed image". The real durations appear as the stages pass. The image tag goes through the gate, then copy and import, helm, and the health check.
9. "DAST and a smoke load run against the live address". Both get check marks.
10. "Every stage passed: live in 12 min 30 s". The final frame is calm.

Facts used, all from report 5.2 and 5.3 (the run table and the paragraph on the stopped image):
- Triggers and the job order.
- The durations: verify 5 min 05 s, SCA 33 s, SAST 2 min 54 s, deploy 5 min 30 s (build 2 min 50 s, gate 25 s, copy and import 1 min 04 s, Helm 22 s), DAST 1 min 40 s, smoke 1 min 15 s, summary 4 s. The total is 12 min 30 s.
- Run 39439752963: 5 critical CVEs, deploy failed before "Save image", DAST and smoke skipped.
- The fix commit 2b5e460.

Speaker notes: "Every push to ass/platform runs this pipeline. Tests, a dependency audit and CodeQL run in parallel. Only then does the deploy job build the image and scan it with Trivy. In our first run the gate found five critical CVEs and stopped the deploy, so the image never reached the host. That is the pipeline doing its job. We built a smaller platform image without Docker inside, and the next run passed every stage and was live in 12 minutes 30 seconds."

## 3. findings.png (slide 5c: technical findings), static

The picture has three columns. Each column has a problem, an arrow down, and a solution. Each problem and each solution has a small box diagram and two lines of words.
1. Per-depth queues ("found in design").
   - Problem: "one queue, all turns" feeds "worker slots, all held by parents". Parents wait for children that wait in the same queue: a deadlock.
   - Solution: three queues (depth 0, depth 1, depth 2) feed "worker slots, children always run". One queue per level of the task tree (AD-03).
2. Trivy gate ("run 39439752963").
   - Problem: "Lumen image, with Docker" goes to the gate, which ends in a cross. The words: 5 critical CVEs, most in the docker.io package, and the gate stopped the deploy.
   - Solution: "platform image, no Docker" goes to the gate, which ends in a check. The words: deploy/k8s/Dockerfile is smaller and patched at build (2b5e460), and the next run passed.
3. KEDA scale-down ("load test").
   - Problem: a bar to scale from "load ends" to "scale-down", 300 s. KEDA's HPA waits 300 s by default before it removes a worker.
   - Solution: the same bar at 60 s. The chart sets 60 s, so the workers go back to 1 a minute after the load.

Facts used:
- Report 6.1.
- `deploy/k8s/lumen/templates/autoscaling.yaml` (stabilizationWindowSeconds: 60).
- `deploy/k8s/Dockerfile` (header comment).

Speaker notes: "Three findings changed the design. First, one queue for all turns can deadlock, because parents hold every worker slot while their children wait behind them, so we gave each depth of the task tree its own queue. Second, the image scan stopped an image that carried Docker for Lumen's sandbox, and the platform does not need Docker, so we built a smaller platform image, patched at build. Third, KEDA's autoscaler waits five minutes before it scales down by default, and we set it to one minute, so the workers return to one soon after the load."

## 4. scaling.gif (slide 6b: scalability), animated, 27.0 s, 227 frames

What it shows:
- A time chart, 0 to 215 s. The grey bars are the jobs waiting in the three queues, one bar per 10-second sample. A dashed white step line is the target: 5 jobs per worker, times the workers that run.
- A white cursor sweeps the time axis.
- At the right, under "worker pods (KEDA)", there are four slots. A plain box "worker 1" to "worker 4" appears in a slot when KEDA adds that pod. A new box is lit for about 9 s of the run's time. The box goes away when the pod goes.

The steps:
1. "Ten users ask questions without pause".
2. "One worker falls behind; the queue grows".
3. "Above 5 jobs per worker, KEDA adds one: 1 to 4 in 49 s".
4. "With 4 workers, the queue stops growing".
5. "The load stops, the queue empties, and a minute later: 1 worker".
6. "Every question finished, and no request failed". The block "135 questions / median 6.1 s / 0 of 1,040 failed" appears.

Facts used:
- `docs/platform/evidence/2026-10-20-load-and-scaling.md`, parsed by `_scaling()` from `scenes_proof.py`. I import that function, so the parsing is the same.
- The k6 block in the same file: 135 questions, median 6.1 s, 1,040 requests, 0.00 % failed.
- The threshold of 5 comes from the chart's queueLength.

Speaker notes: "This is a real load test on the public host: ten users ask questions without pause. The bars are the jobs waiting in the queues, and the dashed line is KEDA's target of five jobs per worker. When the queue passes that line, KEDA adds a worker pod, and it went from one to four in 49 seconds. After the load stops, the queue empties, and a minute later KEDA scales back to one worker. All 135 questions finished with a median of 6.1 seconds, and none of the 1,040 requests failed."
