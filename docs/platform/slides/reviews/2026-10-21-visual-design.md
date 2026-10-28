# Review: visual design of the dark halftone deck (subagent, 2026-10-21)

Verbatim report from a subagent asked to review the deck as a visual and motion
designer, after the owner said every edge drawn in dots made the deck ugly and
hard to read.

---

I reviewed the 19 slides, about 40 step frames across all 10 animations, the site screenshots, the earlier deck's frames, theme.css and the Intro comments. I edited no files.

## 1. Verdict

The deck uses halftone for everything: box outlines, connectors, queues, chart bars and moving work. On the site, halftone is only for the sphere, the agent spheres, the field and one document. On a projector and through Zoom compression, the dotted outlines read as grey fuzz, and the faint background field makes every edge noisy. The animations barely move, so the listener reads titles over a still picture. In `problem`, frames 0, 2, 3 and 5 are the same apart from the title.

## 2. Design system

The GIF is 12.1 × 5.0 in, which is 871 × 360 pt. The frames are 1747 × 720 px, so 1 pt is 2 px.

**Crisp, always:**
- **Boxes:** a 1.5 pt solid border in `#45484c` (rule-major), radius 0. The box that acts now gets a 2 pt `#ffffff` border.
- **Connectors:** solid 1.5 pt lines in `#45484c`, with a small arrowhead about 6 pt long.
- **Queue:** a crisp rectangle with 5 or 6 cells, each 18 × 18 pt, and a 1 pt `#36393d` divider between cells. Do not use a pill.
- **Chart bars:** solid `#9a9da3` fills. The current bar is `#ffffff`.
- **Text:** all text is crisp. This rule is already correct.

**Halftone, rarely:**
- Agents are halftone spheres, as on the landing page. Use them only in `tree` and on the title and end slides.
- Each slide gets at most one halftone object.
- Remove the background dot field from all GIFs. Keep the field only on the title, section and end slides, and fade it out behind the text.

**Colour on black:**
- Ink is `#ffffff`. Secondary text is `#9a9da3`, hints are `#7c8086`, and rules are `#45484c` and `#36393d`.
- `#1a1b1e` (well) is the fill for a container region, and `#2a2b2f` (raised) is the fill for the active box.
- Use no hue at all. Red `#ff3b30` means "waits on you", and nothing in the deck waits on the listener.
- The accent is inversion: a white block with black text. Use it once per step, for the number or the result that matters.

**Type:**
- The GIF step title is Switzer Medium at 22 to 24 pt, in white, top-left.
- Remove the grey subtitle line from all GIFs. The speaker says it.
- Box labels are 15 to 16 pt Medium. Small captions are 13 pt or more, in `#9a9da3`.
- Numbers are 28 to 36 pt Semibold, or set inside the white inverted block.
- Nothing is under 13 pt in a GIF. Labels in `depth` ("lead slot") and `kill` ("the question") are about 10 pt now, which is too small.

**Moving work:**
- A piece of work is a solid white square, 12 to 14 pt, crisp, with no dots.
- It travels along the drawn connector with cubic ease-in-out, 0.6 to 0.8 s per hop, about 400 to 500 pt/s. Use no trail, or at most a 2-frame ghost at 30 %.
- Run at 20 to 25 fps. Hold 2.5 to 3 s after each step's motion. One loop is 15 to 25 s.

**States:**
- **Acting now:** a white 2 pt border, the `#2a2b2f` fill and a white label. Optionally add a 1 pt outer ring at 4 pt offset that pulses once.
- **Idle:** a grey border and a `#9a9da3` label.
- **Waiting:** a hollow white square of the same size (outline only), or a box label with the word "waiting" in grey.
- **Done:** a crisp check mark and the word "done". The box goes back to idle.
- **Failed or killed:** a crisp 2 pt cross and a struck label. Do not draw the cross in dots.

**Layout:**
- Use a 28 pt side margin.
- The title band is the top 56 pt. The diagram is about 815 × 260 pt.
- Allow at most 6 boxes and one counter on screen.
- Every part has one fixed place for the whole loop, and the flow goes left to right.
- Fill the width. The `problem` GIF leaves its right half empty now.

## 3. The 10 animations

1. **`problem`**
   - Problem: it is static. The chat is a well inside a dotted list, the "cost ?" box hangs alone, and the right half is empty.
   - Redraw: show one crisp chat column. New message rows push up from the bottom, and the top rows slide out past a crisp "window" line and fade.
   - On the right, show a cost counter that stays "?" until a "bill" block drops in at the end.

2. **`tree`**
   - Problem: all spheres are equally bright, the connectors are dotted, and the "step" blocks are dot clumps that just appear.
   - Redraw: keep the halftone spheres, at 3 sizes only, and use crisp grey connectors.
   - A square travels from the question to the lead, then the lead sends 3 squares to the readers. Each reader brightens while it works and dims when it is done.
   - Each step ticks the cost counter, for example $0.00 → $0.03. The answer block inverts at the end.

3. **`platform`**
   - Problem: there are no connections. The registry boxes are three nested borders (dotted inside dotted inside well), and nothing flows.
   - Redraw: show three columns joined by two arrows. An "agent" square moves from the author into the registry.
   - A "question" square moves from the second app through the key into the platform. Cut "runs it: steps, cost, cap" and the six dot blocks.

4. **`services`**
   - Problem: the square appears in the queue in step 3 and vanishes in step 4. The worker never visibly takes it, and the database is not connected to anything.
   - Redraw: the request travels browser → gateway → session → queue cell → worker, and each box lights up when the square reaches it.
   - Connect the database with one line, or cut it.

5. **`depth`**
   - Problem: step 2 empties the worker boxes, so the deadlock is invisible. The listener cannot see that the leads hold the workers.
   - Redraw: show two rows at once. The top row is "one queue": the leads sit in both workers with the label "waiting", the reader squares pile up, and a "stuck" block inverts.
   - The bottom row is "a queue per level": the readers flow through the reader slot and the "questions done" counter rises.

6. **`hosting`**
   - Problem: the nested boxes are static, HTTPS is a dotted box jammed against the border, and GitHub floats unconnected.
   - Redraw: show one well for the AWS server with crisp pod boxes. A request square goes browser → HTTPS → gateway.
   - Then a push square goes GitHub → server, and the pods are replaced one by one (rolling update).

7. **`keys`**
   - Problem: the status codes appear as dotted boxes with no request moving. The row of 20 dot blocks for the rate limit cannot be read.
   - Redraw: a square leaves the key and goes to each action. The result appears beside it as "201 ✓", "200 ✓" or "403 refused".
   - For the rate limit, show a crisp bar that fills to 20 with a counter, then show "429 slow down" inverted.

8. **`scale`**
   - Problem: the dot bars blur, the chart has no y value and no time marker, and the frame titled "go back to 1" still shows "4 of 4".
   - Redraw: use solid grey bars with a white cursor line that sweeps over time.
   - The worker boxes, the "1 of 4" counter and the time readout change in sync with the cursor. Label the peak queue length once, and only with the measured value.

9. **`kill`**
   - Problem: the cross is drawn in dots over a well, and the jobs never visibly go back to the queue.
   - Redraw: a crisp cross on worker A. Its 3 squares move back into the queue cells.
   - Worker B fades in and the squares move into it. The question's status changes from "running" to "done ✓".

10. **`pipeline`**
    - Problem: there are 8 dotted boxes with no arrows and no pass or fail marks. The "fix" frame is the same as the first frame.
    - Redraw: a square travels left to right and each stage gets a ✓ when the square passes it. Run 1 stops at "image scan" with a cross and "5 critical: deploy stopped" inverted.
    - Run 2 passes every stage. Show the size of the smaller image as one number, if the evidence has it.

## 4. Slide-level fixes

- **Title slide and end slide:** these are good, and they are the correct place for halftone. Remove the dot field behind the text column.
- **Section slides:** the right two-thirds are empty field. Put a small halftone mark at the right, or keep the slide black and plain. The segment bar is good.
- **Label + title:** each slide stacks three headings: the slide title, the GIF heading and the GIF subtitle.
  - The last frame repeats the slide title. Slide 9 has "One queue per level of the tree" over "One queue for each level of the tree".
  - Keep the slide label and title. Make the loop frame's title a short step title, not a second slide title.
- **The GIF frame edge:** the dot-field rectangle shows a visible edge on the slide. Remove the field so that the GIF merges with the black slide.
- **Live demo slide:** this is good, and the crisp URL box matches the site's input. Add the fallback plan (a recorded video) in the speaker notes.
- **Limits slide:**
  - Add the column heads "limit" and "next", or an arrow between the columns.
  - The left boxes use a well fill and the right boxes use an outline. Make one of them deliberate: the limit is grey text, the next step is white.
  - Reword row 2. "One database for every service" and "One database for each service" read as the same words.

## 5. The five changes that would improve the deck most, ranked

1. Draw all boxes, connectors, queues and bars as crisp lines and fills. Keep halftone for the agent spheres and the title and end slides only.
2. Make work move: one solid white square that travels along drawn connectors, with easing and 0.6 to 0.8 s per hop, in every GIF.
3. Show state with border, fill, check mark and word (acting, waiting, done, failed), not with dot brightness.
4. Remove the GIF subtitle line and the GIF background field. Set the step title at 22 to 24 pt and no label under 13 pt.
5. Redraw `depth` and `kill` so that the cause can be seen. In `depth`, the leads hold the workers. In `kill`, the jobs go back to the queue.
