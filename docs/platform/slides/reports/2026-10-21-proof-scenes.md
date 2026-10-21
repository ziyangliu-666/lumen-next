# Report: the scale, kill and pipeline animations (subagent, 2026-10-21)

Verbatim report from the subagent that wrote `scenes_proof.py`.

---

I wrote `scenes_proof.py`. It holds `SCENES = dict(scale=scale, kill=kill, pipeline=pipeline)` and does not change any other source file. I ran `python3 make.py scale kill pipeline`, then looked at every still in `out/steps/` and fixed what I found:
- In `kill`, the caption crossed the connector, so I moved the boxes.
- In `pipeline`, the run 1 result block covered a bus line, so I moved it.
- In `pipeline`, a connector stayed white after run 2, so I turned it off.
- In `scale`, the cursor sat on top of the current bar and some steps stopped exactly on a sample, so I put the cursor behind the bars and moved the stop points.

The last stills are clean: no overlap, no clipped word, labels 13 pt or more, 0.3 in margins, and nothing in the title band. Running `make.py` rewrote `out/scale.gif`, `kill.gif` and `pipeline.gif`, with their PNGs and step stills. Nothing is staged or committed.

## scale (25.3 s)
Step titles:
1. "1. Ten users ask questions without pause"
2. "2. One worker falls behind; the queue grows"
3. "3. Above 5 waiting jobs per worker, KEDA adds one: 1 to 4 in 49 s"
4. "4. At the limit of 4 workers, the queue stops growing"
5. "5. The load stops, the queue empties, and a minute later: 1 worker"
6. "6. Every question finished, and no request failed"

The last step shows an inverted block on three lines: "135 questions / median 6.1 s / 0 of 1,040 failed".

What the chart shows:
- **Shared time axis:** 0 to 220 s.
- **Jobs:** grey bars, with y ticks at 0, 10, 20 and 30.
- **Threshold:** a dashed step line at 5 × workers.
- **Workers:** stacked boxes under the bars, on the same time axis.
- **Cursor and counters:** a white cursor sweeps the axis. The counters "workers (max 4)" and "jobs waiting" change with it.

Data:
- **Source:** the evidence file is parsed at run time. Each sample is seconds after 14:19:13, workers, and jobs summed over the three queues.
- **Samples:** (0,1,0) (12,1,0) (24,1,5) (35,1,12) (47,2,24) (61,3,27) (73,4,22) (85,4,29) (97,4,26) (109,4,23) (121,4,16) (133,4,0) … (167,4,0) (180,2,0) (191,1,0) … (214,1,0).
- **Which number is a job:** I used the first number of each queue pair. The capture script lists `messages messages_unacknowledged`, so the first number is the total in the queue. KEDA's QueueLength rule counts that total too. The evidence header calls this column "ready", but the data says otherwise: the first number is never below the second.
- **"1 to 4 in 49 s":** from 14:19:37, the first sample with jobs, to 14:20:26, the first with 4 workers.
- **"A minute later":** the queue is empty at 133 s and back to 1 worker at 191 s, which is 58 s.

## kill (25.2 s)
Step titles:
1. "1. Worker A holds three jobs; they stay in the queue until A says done"
2. "2. We force-delete worker A"
3. "3. Nobody said done, so the three jobs return to the queue"
4. "4. Kubernetes starts worker B, and B takes them"
5. "5. B says done for each job, and each job leaves the queue"
6. "6. The question still ends, later and at a higher cost"

The last step shows an inverted block on three lines: "ended in 12.6 s (median 6.1 s) / cost 8¢ instead of 3¢: / the jobs ran twice".

How the rule shows:
- While a worker holds the jobs, the queue cells show them as hollow outlines. They are solid in the worker.
- A fixed caption under the queue reads "hollow: taken, not acknowledged / a job leaves only when its worker says done".

Data:
- The three jobs are one lead square and two reader circles. The hard-kill evidence lists one depth-0 message and two depth-1 messages.
- 12.6 s, median 6.1 s, USD 0.08 against 0.03. The 8 findings against 3 are not on the slide.

## pipeline (21.2 s)
Step titles:
1. "1. Every push runs six checks around one deploy"
2. "2. Run 1: Trivy finds 5 critical issues, so the deploy stops"
3. "3. The fix: a platform image without Docker, patched at build"
4. "4. Run 2: every check passes, and the deploy goes live"

The layout follows the real workflow, so I drew it in parallel columns instead of one straight line:
- **Column 1:** verify, SCA and SAST run at the same time. The tools under them are tests, npm audit and CodeQL.
- **Column 2:** image scan, with Trivy.
- **Column 3:** deploy, with Helm on k3s.
- **Column 4:** DAST and smoke load at the same time, with OWASP ZAP and k6.
- **The count:** that is 6 checks and 1 deploy, so the title "six checks around one deploy" is correct.

The four steps:
- **Run 1:** the push job splits into three, gets three checks, merges, and stops at the image scan with a cross. The block "5 critical: deploy stopped" is inverted. Deploy, DAST and smoke load go faint.
- **Fix:** a panel under the image scan reads "perl-base: patched at build / docker.io: removed".
- **Run 2:** every stage gets a check, and "live in 12.5 min" is inverted.

The run IDs 39439752963 and 39441445313 are not on the slide. They can go in the speaker notes.
