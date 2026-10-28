# Layout check of the animated diagrams, 22 October 2026

Scope: the 16 GIFs in `docs/platform/slides/out/`. Every GIF is 1747 x 720 px. All coordinates below are GIF pixels, origin top-left.

Method:

- PIL walked every frame of each GIF. Every frame held for 300 ms or more, 10 evenly spaced frames, and the last frame were exported.
- Consecutive identical frames were dropped. The last frame and the held frames were read at full size. Dense areas were cropped and zoomed 2x.
- A script compared every held frame with the last frame. It listed the frames that contain elements the last frame does not have, such as chips, tokens, and "before" states. All of those frames were read.
- Held frames that differ from the last frame only by highlight or dimming have the same geometry as the last frame. The faults in the last frame apply to them.
- Moving elements were tracked frame by frame where they cross text.

No text is below the 13 px glyph-body threshold. The smallest text, for example the "UC1" tags and the ER column names, is about 16 px cap height.

## Faults that repeat across GIFs

- **C1. Empty top band in the last frame.** In 15 of the 16 GIFs the last frame drops the step title. This leaves 60 to 145 px empty at the top, while the diagram sits 7 to 30 px from the bottom edge. Milestones is the exception: its last frame keeps its title. Fix: keep the last step title in the last frame, as milestones does. Alternatively, move the diagram up by half of the empty band in every frame.
- **C2. Small bottom margin.** The diagram's bottom edge is less than 25 px from the picture edge in these GIFs: platform (14), usecases (17), logical (16), contextmap (23), interaction (9), sequence (9), er (7), pipeline (21), scaling (19). Fix: give a bottom margin of at least 30 px. Scale the diagram to about 95 % or move it up.
- **C3. Title position.** Sequence and er put the step title at y 15 to 60. All other GIFs put it at y 45 to 90. Fix: use the same title baseline in all GIFs, or accept the offset as the cost of the denser diagrams and make it the same in both.

## platform.gif

1. All frames, right side: the line from "Web app" to the "People" actor ends at x 1645. The actor's arm starts at x 1657, y 580, so the line stops 12 px short. Fix: extend the line to x 1657.
2. "The answer, its findings and cost go back..." (frame 227): the pulse ring around "Literature watch app" reaches x 1738, 9 px from the right edge. Fix: shrink the pulse ring by 8 px, or move the Consumers column 20 px left.
3. Last frame: the "budget cap" text fills its box. It has 12 px side padding, while "task tree" has 30 px. Fix: break the text into two lines, "budget / cap", as "steps / and cost" does.
4. Last frame: the outer "Lumen platform" frame ends at y 706, 14 px from the bottom edge (C1, C2).

## usecases.gif

1. All frames, right column: the gap between UC2 and UC6 is 14 px (y 309 to 323). The gap between UC3 and UC4 is also 14 px (y 551 to 565). The left column has 140 px between UC1 and UC5. The right column is crowded and the two columns are uneven. Fix: make the right-column ellipses 90 px tall instead of 106 px, and put 36 px gaps between them. Four ellipses then fill y 204 to 672.
2. All frames: every association line stops 17 to 18 px short of its actor. The right-side lines meet at x 1553, and the actor arms start at x 1570. The left-side lines start at x 190, and the arms end at x 172. Fix: end each line at the arm tip.
3. "The operator reads usage too (UC5)" and the last frame: the Operator to UC5 line has a 1 px step at x 280, where y goes from 551 to 552. Fix: give both ends the same y.
4. Last frame: "People in the web app" ends at y 675. The system frame ends at y 703, 17 px from the edge (C1, C2).

## milestones.gif

1. Step "2. Contracts first..." (frames 15 to 126): the sweep line eases in and out. It moves slowly over the left-aligned bar labels (x 345 to 560) for about 1.0 s (frames 16 to 50). It also moves slowly over the check marks (x 1600 to 1700) for about 1.0 s (frames 106 to 139). This is a moving element over text for more than 0.5 s. Fix: use linear easing at a constant speed of about 400 px/s. Alternatively, draw the sweep line behind the label text and give the text a 4 px black halo.

Otherwise clean.

## decisions.gif

1. AD-02 split, "behind the queue, the worker divides" (frames 112 to 170): the new worker boxes slide out from behind the old box. In frames 120 and 144, two boxes overlap and two "worker" labels stack. Each split lasts less than 0.5 s, so this is low severity. Fix: fade the new boxes in at their final positions instead of sliding them out.
2. Frame 168: the turn tokens stop on the worker box edge. The middle token touches the "w" of "worker". Fix: end the token path 12 px before the box edge.
3. AD-04 panel, last frame: the boxes form an L. This leaves an empty area at x 1203 to 1500, y 290 to 470, and the panel looks weighted to the right. Fix: move the "session" box 120 px left (to x 1400 to 1578) and shorten the two elbow lines to match.

## logical.gif

1. All frames, services row: the dependency arrows Project to Session and Worker to Session sit in 45 px gaps between the boxes. Each arrow head fills its gap and touches both box edges. Fix: make each service box 20 px narrower (250 to 230 px). The gaps then become 70 px.
2. "Each step goes back to session, which saves it" (frames 398 to 414): the "step" chip is about 80 px wide and moves through the 45 px gap. It covers both box borders and the "t" of "the agent loop" for about 0.27 s. Fix: widen the gap (fault 1) and make the chip text 16 px.
3. "The app reads the answer" (frames 460 to 470): the "answer" chip fills the 45 px gap between the gateway bottom (y 323) and the Session top (y 368). It touches both edges and covers the gateway-to-Session arrow. Fix: make the chip 32 px tall, or move it 20 px right of the arrow.
4. All frames: the data arrows leave the service boxes at inconsistent points. Identity and Project use the box centre. Session uses x 806, 20 px from its left edge. Billing uses x 1537, 36 px right of its incoming gateway arrow at x 1501. Fix: start the Billing to PostgreSQL line at x 1501.
5. All frames: the label reads "API gateway  (Traefik)" with two spaces. Fix: use one space.
6. Last frame: the PostgreSQL bar ends at y 704, 16 px from the edge (C1, C2).

## contextmap.gif

1. All frames: the derivation row (y 145 to 198) sits only 33 px above the context boxes (y 231), so it reads as part of the map. The row also ends at x 1561, while the map ends at x 1720. Fix: spread the four row boxes evenly across x 29 to 1720. Move the row up 17 px so that the gap to the map is 50 px.
2. All frames: the bottom third of the Session box (y 530 to 645) is empty. The box looks top-heavy next to its peers. Fix: move the three aggregate lines ("Session, the root" and the two lines under it) down 40 px.
3. Last frame: Identity and Billing end at y 697, 23 px from the edge (C1, C2).

## interaction.gif

1. Step 7 and the last frame: the activation bar ends at y 711. Message 7's return arrow is at y 700. The last "producer" bracket spans y 648 to 702. The bottom margin is 9 px. Fix: reduce the message pitch from 65 to 58 px. Message 7 then moves up about 40 px.
2. All steps: each request and its dashed reply are only 14 px apart (y 296 and 311, 361 and 376, 426 and 440). At slide distance each pair reads as one thick line. Fix: separate each pair by 20 px.
3. Last frame: the last "producer" bracket is 54 px tall, and its label fills it. The other brackets are 117 px and 246 px tall. This is low severity and is fixed together with fault 1.

## physdecisions.gif

1. AD-09, from frame 165: the "same chart" label sits in the gap between "Helm chart" (right edge x 222) and "EKS" (left edge x 375). The label ends 10 px from one box and 9 px from the other, and its baseline is level with the box tops (y 191). Fix: move the EKS box 30 px right (to x 405 to 562). Lift the label 6 px.
2. AD-09 k3s grid: the 9 cells have gaps of only 7 to 8 px. "rabbitmq" and "postgres" fill about 78 % of the cell width. Fix: make the cells 136 px wide with 12 px gaps (3 x 136 + 2 x 12 = 432 px, which fits in the 440 px inner width).
3. AD-11: peer "pod" boxes have two sizes. The HPA pods are 103 px wide. The KEDA worker pods are 78 px wide. Fix: make all pods 78 px wide. Four 103 px pods would run past the panel divider at x 1166.
4. AD-11: the vertical rhythm is uneven. There is 32 px from the billing row to "KEDA: 5 turns per worker", but 55 px from that heading to the turns row. Fix: move the KEDA heading down 10 px, and move the turns, worker and CPU rows up 12 px.
5. AD-06, last frame: the sub-caption "step, cost and ledger entry in one transaction" ends at x 1726, 21 px from the right edge. Fix: shorten it to "one transaction: step, cost, ledger entry".
6. "AD-09, after..." (frame 119, 420 ms): the Helm chart box shows with no arrow to the EC2 node, so it looks unfinished for 0.4 s. Fix: draw the arrow together with the box.

## deployment.gif

1. Last frame and frames 279 to 283: the worker-to-OpenAI "HTTPS" line rises from the point where the Traefik bus drops into "worker" (x 1362, y 348). The reader cannot separate the bus from the egress line. Fix: start the egress line on the worker box top at x 1420. Route it up at x 1420 to y 215, then right to x 1598.
2. "GitHub Actions deploys over SSH 22 into k3s" and the last frame: the SSH 22 arrow crosses the k3s left border (x 441). It then turns down and points at the k3s bottom border from inside (tip at x 468, y 625; border at y 632). The arrow points at a border line. Fix: end the arrow horizontally on the k3s left border (x 441, y 612).
3. Top right: the OpenAI API box spans y 30 to 113 and reaches x 1727. The HTTPS arrow head sits in the 14 px between the OpenAI box bottom (y 113) and the EC2 top face (y 127). Fix: reduce the EC2 node's 3D depth from 25 to 12 px. The gap then becomes about 27 px.
4. All frames: the data row does not align with the service row above it. The KEDA right edge is at x 1634, but billing ends at 1622. PostgreSQL ends at 1087, but project ends at 1082. RabbitMQ ends at 1447, but worker ends at 1442. Fix: set the right edges of KEDA to 1622, PostgreSQL to 1082 and RabbitMQ to 1442.

## queues.gif

1. Frames 180 to 355, the slot-to-reader edge: the label reads "waits for a free". The word "slot" is missing, so the label looks cut off. Fix: change the label to "waits for a free slot". It fits: it ends at about x 1665.
2. All frames with the wait graph: every edge stops 7 to 10 px short of its boxes at both ends. For example, the "held by" tip is at y 290 but the lead box ends at y 281. The "waits for" tip is at y 472 but the reader box starts at y 482. Fix: extend each edge so it touches the box border.
3. Frames 28 to 355 and 379: the "reader" chips fill the queue cells. Each chip is about 100 px wide in a 115 px cell, with 5 to 7 px to each divider, so six chips read as one white band. Fix: make the chips 84 px wide with 18 px text.
4. "AD-03: one shared queue" to "The waits close into a cycle" (frames 0 to 300, about 45 % of the run): the left side uses only y 156 to 360, and y 360 to 700 is empty. Fix: draw the shared queue at the level-1 row position (y 395 to 455). It then turns into level 1 in place.

## sequence.gif

1. All frames, labels crossed by lifelines: dashed lifelines run through the text of these message labels.
   - "POST /internal/directory/start" (x 589 to 939) crosses the session lifeline at x 914.
   - "publish lumen.turns.0" crosses the PostgreSQL lifeline at x 1109.
   - "POST /internal/turns/:id/step" crosses the PostgreSQL lifeline (x 1109) and the RabbitMQ lifeline (x 1297).
   - "200 {status, answer, findings, cost}" crosses the Traefik lifeline (x 425) and the project lifeline (x 569).
   - "201 {sessionId}" crosses the Traefik lifeline (x 425).
   - "chat completion" crosses the OpenAI lifeline (x 1642).

   Fix: put a black background with 4 px padding behind every message label, so that the lifelines break around the text.
2. Arrows that stop short and then overshoot: some arrow heads stop before the target lifeline, and a short stub continues past it.
   - publish to RabbitMQ: head at x 1285, stub to x 1305; the lifeline is at x 1297.
   - INSERT steps to PostgreSQL: head at x 1100, stub to x 1117; the lifeline is at x 1109.
   - The same pattern appears for "forward" to session (frame 201) and for the step POST to session.
   - "consume" starts at x 1305, 8 px right of the RabbitMQ lifeline.

   Fix: put each arrow tip on the lifeline, or on a 10 px activation bar centred on it. Remove the stubs. Start "consume" at x 1297.
3. par block, from frame 182: the "GET /api/v1/questions/:id" label sits 5 px under the dashed 201 line. Its right end touches the Traefik activation bar at x 425. The "200 {...}" label sits 6 px under the "forward" arrow. Fix: raise the message pitch in the par block from 37 to 45 px. Take the space from the gap above the par frame (y 337 to 352) and from the empty band between the par divider (y 527) and "consume" (y 567).
4. All frames: the small return box of the "key guard check" self-call (x 571 to 581, y 262 to 276) is 8 px from the start of the "POST /internal/directory/start" label (x 589). Fix: start the label at x 600.
5. All frames: the par frame's right edge is at x 1740, 7 px from the edge. Its bottom is at y 711, 9 px from the edge. The lifelines run off the bottom. Fix: scale the diagram to 96 %, or take 40 px from the 172 px gap between "Watch app" and "Traefik".
6. All frames, participant heads: the gaps between heads are only 24 px (Traefik to project) and 16 to 18 px (PostgreSQL, RabbitMQ, worker). Other gaps are 172 px (Watch app to Traefik) and 221 px (project to session). Fix: give every pair of heads a gap of at least 36 px. Take the space from the project-to-session gap.
7. The title sits at y 15 to 60, 13 px above the heads (C3).

## er.gif

1. All frames from the first relation: the findings-to-sessions connector runs horizontally at y 335. This is inside the 25 px gap between the project frame bottom (y 322) and the session frame top (y 347), so three parallel lines are 12 px apart. The findings crow's feet (x 655 and x 748) straddle the project frame border. Fix: reduce the table row pitch from 29 to 26 px. This saves about 25 px in tasks. Use the saving to widen the gap between the project and session frames to 50 px, and route the connector through the middle of the gap.
2. Last frame: the footer line "PostgreSQL 16 · money as numeric(12,6) · ..." sits at y 702, with glyphs down to about y 713. It is 7 px from the bottom edge and 18 px under the frames. The legend (y 612 to 661) is crowded above it. Fix: move the footer into the empty title band of the last frame (about y 40).
3. All frames: the diagram fills the whole canvas. The identity frame starts at x 12, and the worker frame ends at x 1737. Fix: scale the diagram to 96 % and centre it, which gives margins of about 35 px.
4. All frames: the accounts-to-platform_agents line runs at y 72. It is 12 px above the frame tops and about 14 px under the step title. Fix 3 also fixes this. Keep the line at least 20 px from the title.
5. The title sits at y 15 to 60 (C3).

## branches.gif

1. From "Commits land on ass/platform" (frame 107): the 36 commit dots on ass/platform sit at a 10 px pitch (x 427 to 806), so they merge into a beaded bar. The later dots use pitches of 40 px and 15 px, so peer elements are spaced unevenly. Fix: draw all commits at one pitch of 14 px with 5 px dots. Alternatively, draw 12 dots and let the "48 commits" label carry the count.
2. Last frame: the "helm upgrade --install --wait" label sits in the 56 px gap between "EC2 host" (bottom y 573) and "Lumen platform, live" (top y 629). It is 15 px from each box. Fix: move the image box and the EC2 host box up 20 px. The gap then becomes 76 px.
3. Frames 0 to about 234 (about 75 % of the run): the right half of the picture is empty. Fix: show the deploy column dimmed from frame 0, as other GIFs dim future parts.
4. From frame 138: the label "codex/platform-approval-acceptance" ends at x 789, 17 px from the fork line at x 806. Fix: right-align the label at x 775.

## pipeline.gif

1. From frame 108: the "25 s" label for the Trivy gate (x 572 to 620) is 9 px from the deploy frame's left border (x 563), and it sits outside the diamond. Fix: move the label 8 px right. The gaps to the frame and to the diamond tip are then about equal.
2. Frames 89 and 222 to 223: the result chips do not align with anything. "all jobs done in 12 min 30 s" spans x 1405 to 1654. "5 critical CVEs: deploy stopped" spans x 1405 to 1685. The summary box above spans x 1412 to 1627. The chips sit 17 px right of the fan-in line at x 1388. Fix: centre each chip under the summary box (centre x 1520).
3. "5 critical CVEs: the line breaks at the Trivy gate" (frames 74 to 90): the broken "pass" line draws as a "<"-shaped mark, which reads as a stray character next to "pass". Fix: draw a clear 12 px gap with a small "x" on the line.
4. Last frame: the deploy frame ends at y 699, 21 px from the edge (C1, C2).

## findings.gif

1. Last frame, "KEDA scale-down" column: the 300 s bar from frame 201 is removed. Only a small "60 s" chip and a 63 px tick remain, so the panel looks unfinished next to the other two box-and-arrow panels. Fix: keep the 300 s bar as a dim outline above the "60 s" chip, so the before-and-after comparison stays visible.
2. Last frame: the content spans x 26 to 1595. The left margin is 26 px and the right margin is 152 px. Fix: set the column starts to x 26, 626 and 1226, or move all columns 60 px right.
3. All frames: the stacked "level 0 / 1 / 2" boxes have 7 px gaps. Fix: make the boxes 30 px tall with 10 px gaps.

## scaling.gif

1. Last frame: the result chip ("135 questions / median 6.1 s / 0 of 1,040 failed") ends at x 1672. The worker boxes above it end at x 1706, so the chip is 34 px narrower. The chip is 16 px under "worker 4" and its bottom is at y 701, 19 px from the edge. Fix: make the chip x 1405 to 1706. Reduce its line pitch from 46 to 40 px, and place it at y 545 to 690.
2. All frames from frame 35: the dashed target line at 5 jobs lies exactly on the top of the first bar (y 576), so the line and the bar top merge. Fix: draw the target line on top of the bars with a 2 px black outline.
3. All frames: the bar gaps are uneven. The gap between the bars at about 45 s and 60 s is 33 px. Other gaps are 18 to 23 px. If the samples are evenly spaced, fix the bar positions. If the gap shows real sample times, leave it.

## Summary

| GIF | Faults | Worst fault |
|---|---|---|
| platform | 4 | The Web app to People line stops 12 px short of the actor |
| usecases | 4 | The right-column ellipses are 14 px apart; the left column has 140 px |
| milestones | 1 | The sweep line moves slowly over the bar labels for about 1 s |
| decisions | 3 | The worker boxes overlap during the AD-02 split |
| logical | 6 | The arrow heads fill the 45 px gaps between peer service boxes |
| contextmap | 3 | The derivation row is 33 px above the map and shorter than the map |
| interaction | 3 | Message 7 and the activation bar end 9 px from the bottom edge |
| physdecisions | 6 | The AD-11 pod boxes have two widths (103 px and 78 px) |
| deployment | 4 | The egress HTTPS line shares the bus drop into worker |
| queues | 4 | The "waits for a free" label is cut off and missing "slot" |
| sequence | 7 | Lifelines run through six message labels; arrow heads stop short and stubs overshoot |
| er | 5 | The connector runs between two frame borders 12 px apart |
| branches | 4 | 36 commit dots at a 10 px pitch merge into one bar |
| pipeline | 4 | The result chips do not align with the summary box |
| findings | 3 | The KEDA panel loses its 300 s bar and looks unfinished |
| scaling | 3 | The result chip is narrower than the worker boxes and 19 px from the bottom |
| All (C1 to C3) | 3 | The last frame drops the title; the diagram sits 7 to 30 px from the bottom |

No GIF is fully clean. Milestones has one fault. The densest problems are in sequence, er and logical.
