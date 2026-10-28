# Icons and business motion: the "proof" group

Scenes: services and depth (scenes_core.py), pipeline, kill and scale (scenes_proof.py).
stills() is not changed. No icon is added to icons.py.

## Shared parts (scenes_core.py)

- `Live` is a Scene subclass. While `st["busy"]` is not empty, every frame of a hold is
  drawn, so a busy gear keeps turning. `st["turn"]` grows by 0.06 teeth each frame.
- A moving thing whose kind is an icon kind (question, image, paper) is drawn as that icon.
  The kind "done" is a paper with a check. lead, reader and step stay the plain jobs.
- `gear()` draws a worker. It turns only while busy.
- `clock()` draws a small clock beside a gear that waits.
- `Live.save()` also writes `out/steps/<name>-turnNN.png` for holds where a gear turns.
  The base Scene skips those holds, because their frames are 40 ms each.

## services (29 s)

1. A question bubble goes from the browser through Traefik to project (folder icon).
2. The bubble goes on to session (stream icon).
3. A lead square goes from session into the RabbitMQ queue cells.
4. The square goes along the bus to the first worker gear, which starts to turn.
5. Three step bars go from the worker to PostgreSQL. Each adds one short line under the
   database. Each step then goes back along a path above the main line to the browser. One
   more line shows in the browser window.
6. The queue fills with six squares. Gears 2, 3 and 4 appear one by one. All four turn
   while the queue empties, then they stop.

identity (key) and billing (wallet) stay faint under project and session.

## depth (29 s)

- Row 1, "one queue": two leads go into worker 1 and worker 2, and both gears turn. Each
  lead then waits: its gear stops, its square becomes hollow, and a clock shows. Six reader
  circles fill the queue. Step 3 adds "deadlock: no worker is free".
- Row 2, "a queue for each level": each worker is a thin frame with two gears, lead and
  reader. Three times, a lead goes into worker 1's lead gear and waits with a clock. Its
  three readers go to the reader gears of worker 1, worker 2 and worker 1, and those gears
  turn. "questions done" counts 1, 2, 3, then "all 3 finish".

## pipeline (22 s)

Stages are icons, each with its tool name and a small grey check type under it:

- push: branch icon
- tests: flask
- npm audit (SCA): shield
- CodeQL (SAST): shield
- Trivy (image scan): image box
- Helm (k3s): wheel
- OWASP ZAP (DAST): shield
- k6 (smoke): gauge

The moving thing is a small image box.

1. Three image boxes go from push to tests, SCA and SAST. Each check gets a check mark.
2. Run 1: the boxes merge and stop at the Trivy gate. A line sweeps down over the Trivy
   icon. The parked image gets a cross, and Trivy gets a cross mark. Deploy, DAST and k6
   go faint. Then "5 critical: deploy stopped".
3. The fix: a lit image icon with "docker.io: removed" and "perl-base: patched at build".
4. Run 2: the same path. Trivy sweeps and passes. The image goes to Helm, then to DAST and
   k6, and all get checks. Then "live in 12.5 min".

## kill (25 s)

Parts: a question icon (status "running", then "ended"), the RabbitMQ queue of four cells,
worker A and worker B as gears, and the Kubernetes wheel to the right of worker A.

1. One lead and two reader jobs go into the queue. Worker A takes them: the cells go
   hollow, A holds the three jobs beside its gear, and the gear turns.
2. Worker A is force-deleted. Its gear stops, goes faint and gets a cross.
3. The three jobs travel back along the bus into the queue, solid again.
4. The Kubernetes wheel lights up and worker B appears. B takes the jobs and turns.
5. For each job, the job leaves B and its queue cell. A paper with a check goes along an
   arrow to a tray on the right. The question shows "ended".
6. "the question ended in 12.6 s".

## scale (25 s)

The chart and every real number stay as they were. Data comes from
`evidence/2026-10-20-load-and-scaling.md`:

- the bars of waiting jobs
- the dashed line at 5 waiting jobs per worker
- the worker strip
- 1 to 4 in 49 s
- 135 questions, median 6.1 s, 0 of 1,040 failed

The right panel shows one gear for each worker that runs at the cursor. The gears appear
one by one as KEDA adds workers, then go back to one. They turn while the load runs (up to
125 s on the time axis) and stop after it. "jobs waiting" stays as a number.

Changed words:
- Step 4 is now "With 4 workers, the queue stops growing". The old title said "At the
  limit of 4 workers".
- The panel label "workers (max 4)" is now "workers".

## What I could not do

- A lit gear (2 pt stroke) shows small notches at its tooth corners. The cause is the
  polygon outline in `icons._gear`, which I did not change because the brief forbids
  changes to an existing icon. A quiet gear (1.6 pt) looks clean.
- The labels "hollow: taken, not acknowledged" (kill) and the check types SCA, SAST,
  DAST, image scan, k3s, smoke (pipeline) stay as 13 pt words. The icons alone cannot
  tell these apart.
