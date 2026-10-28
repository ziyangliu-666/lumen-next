# Page review of the two ASS progress reports (28 October 2026)

Scope: `docs/platform/progress/2026-10-20.md` and `2026-10-27.md`, built with `build.py`
and `figures.py`. The review used the brief `/tmp/rpt/briefs/review.md`, the report writing
guide, the figures standard and the slop checklist. Each page was rendered with LibreOffice and
`pdftoppm` before and after the fixes. No fact or number changed.

Page numbers are the pages before the fixes. The 20 October report had 6 pages before and
has 8 pages now. The 27 October report had 7 pages before and has 7 pages now.

## Progress report of 20 October 2026

| Page | Fault type | Quote | Fix |
|---|---|---|---|
| 2 | Term not explained | "from the same code" | "from the Lumen code" |
| 2 | Puffery; unclear subject | "All services, the pipeline and the public host were merged into the integration branch" | "The five services, the deploy pipeline and the public host were merged and deployed" |
| 2 | Meta-talk | "Figure 1 shows the deployment as it stood at the end of the period." | Removed. The text before Figure 1 introduces it. |
| 2 | Terms used before they are explained | HPA, KEDA, SCA, SAST, DAST, Helm in Table 1; definitions came after the table | Definitions moved above Table 1. SCA, SAST, DAST and Helm added. |
| 2 | Synonym swap | "A turn is one job for a worker"; "jobs wait in the queues" | "turn" used everywhere, in the text and in the chart labels |
| 2 | Internal code in prose | "Pipeline run 39441445313 passed every stage" (table cell) | Run number moved to the Table 1 caption. Cell now points to Figure 5. |
| 3 | Semicolon pause; vague cross-reference | "All of the platform runs on one virtual machine; the reason is budget (see Problems Encountered)." | "The whole platform runs on one virtual machine because of the budget (Table 3)." |
| 3 | Text too small | Figure 1 at 12.5 cm: node tags, path labels and legend about 4 to 6 pt | Fonts enlarged in `figures.py`. Figure at 14.5 cm. Smallest text is now about 6.7 pt. |
| 3 | Sentence over 25 words | "Figure 2 is the cluster as the team saw it through SSH: one pod for each service, ..." (33 words) | Split into three sentences |
| 3 | Text too small | Figure 2 terminal at 13 cm | Figure at 14 cm. Still about 5 pt (see "Left open"). |
| 3 | Sentence over 25 words | Figure 1 caption (28 words) | Split into two sentences |
| 4 | Defensive caption | "Lines longer than the frame are cut at the right edge." (Figures 3 and 6) | Removed |
| 4 | Sentence over 25 words | Figure 3 caption (33 words) | Split into three sentences |
| 4 | Text too small | Figure 3 terminal at 10 cm, about 4 to 5 pt | Cut at 100 columns, placed at 13 cm: about 6 pt |
| 4 | Text too small | Figure 4 chart at 12 cm: ticks and axis titles about 5 pt | Chart fonts enlarged, figure at full text width: about 8.5 to 9 pt |
| 5 | Sentence over 25 words | "Each member's 80 hours are split ... from the git history and the owned service." (29 words) | Split; "How the hours were counted:" removed |
| 5 | Defensive writing | "Recorded as a known limit." | Removed. The cell states the fix and where it is described. |
| 5 | Term not explained | "idempotency key" | Explained in the same cell |
| 5 | Internal code in prose | Run numbers 39439752963 and 39441445313 in Table 3 cells | Moved to the Table 3 caption |
| 5 | Dramatic colon; absolute word; repeats Table 3 and the caption | "The two red runs are the image scan at work: the image with 5 critical CVEs never reached the host." | "Figure 5 shows the deploy runs before and after the fix of the image." |
| 5 | Text too small | Figure 5 terminal at 9 cm | Figure at 11 cm: about 6 pt |
| 5 | Sentence over 25 words; repeats the caption | "Figure 6 shows the worker test as the presentation repeated it ... and the question ends." (34 words) | "Figure 6 is the worker test again with the real model, recorded for the presentation." |
| 6 | Defensive writing | "The team solved these problems itself. No help from the lecturers is needed." | "The team needs no help from the lecturers." |
| new | Layout (found after the rebuild) | A sentence that starts with "Table" was set as a small caption | Sentences reworded so that they do not start with "Table" |
| new | Layout (found after the rebuild) | Figure 5 alone at the top of a page, with a third of the page before it empty | Figure 5 and its sentence moved above Table 3 |

## Progress report of 27 October 2026

| Page | Fault type | Quote | Fix |
|---|---|---|---|
| 2 | Sentence over 25 words; list after a colon | "This report covers 21 to 27 October 2026: the run with the real model, ..." (32 words) | Split into three sentences |
| 2 | Meta-talk | "Figures 1 to 7 show the results." | Removed |
| 2 | Terms not explained | "turn", "producer" | Defined before Table 1 |
| 2 | Internal code in prose | "deploy run 39542685448 passed" (table cell) | Run number moved to the Table 1 caption |
| 2 | Ambiguous word | "the KEDA explanation fixed" | "agreed" |
| 3 | "X, not Y" slogan; sentence over 25 words; synonym swap | "so fewer jobs waited than in the run of 20 October, and KEDA added one worker, not three" | Three sentences. "turn" used in place of "job". |
| 3 | Text too small; label over the data line | Figure 1 chart at 13 cm, about 5 pt; "KEDA target: 5 jobs per worker" crossed the line | Fonts enlarged, full width. Label shortened to "KEDA target: 5". The caption gives the unit. |
| 3 | Big empty gap | 40 % of page 3 empty before Figure 3 | Figure order changed: the Vultr KEDA test now follows the Vultr deployment |
| 4 | Defensive; repeats Table 3 | "The one node (accent) is the decision the lecturer asked about; the reason is budget." | "The one node (accent) is a budget decision (Table 3)." |
| 4 | Text too small | Figure 3 diagram, about 4 to 6 pt | Same font fix as Figure 1 of 20 October |
| 4 | Repeats the captions | "Figures 4 and 5 are frames of it: a producer publishes an agent, ... the call tree shows the cost of each task." | Reduced to one line per figure. The captions carry the detail. |
| 4 | Text too small | Figure 4 (now 5): publish form about 3 pt beside the usage panel | Panels stacked, each cut to the part the caption names |
| 5 | Text too small | Figure 5 (now 6): the whole web app at 14 cm, about 3.5 pt | Two crops: (a) the delegated tasks, (b) the call tree with costs. The caption no longer names the findings panel. |
| 5 | Defensive caption | "Lines longer than the frame are cut at the right edge." | Removed |
| 5 | Dramatic colon | "The worker deletion test also passed there: the question ended with 3 findings." | "... passed on the new host too, and the question ended with 3 findings." |
| 5 | Repeats Table 1 | "The presentation on 26 October used a deck of 25 slides. Each member presented the part that member built." | "Figure 7 shows six of the 25 slides of the presentation on 26 October." |
| 6 | Text too small | Figure 7: six slides in three columns, about 5 cm each | Two columns |
| 6 | Sentence over 25 words | "Each member's 80 hours are split ... and the slides that member presented." (34 words) | Split; "How the hours were counted:" removed |
| 6 | Big empty gap | 40 % of page 6 empty before Problems Encountered | Gone after the figure changes |
| 7 | Defensive writing; term not explained | "Recorded as measured. The demonstration-mode run of 20 October stays the evidence ..." | "The run of 20 October, with a fixed delay in place of each model call, remains the evidence ..." |
| 7 | Sentence over 25 words | Table 3: "The team pays for the host: one node ..." (29 words); "The first Vultr VM ... ran out of memory during the first install: ..." (32 words) | Each split at the colon |
| 7 | Defensive writing | "The team solved these problems itself. No help from the lecturers is needed." | "The team needs no help from the lecturers." |
| 7 | Internal phrase | "look at every page" | "check each page" |
| new | Layout (found after the rebuild) | A sentence that starts with "Table" was set as a small caption | Sentence reordered |

## Counts

| Fault type | Found | Fixed |
|---|---|---|
| Text too small in a figure | 12 | 10; 2 web app screenshots improved to about 6 pt |
| Sentence over 25 words | 11 | 11 |
| Defensive writing | 7 | 7 |
| Repeats a table or a caption; meta-talk | 7 | 7 |
| Term used before it is explained | 6 | 6 |
| Internal code (run numbers) in table cells | 4 | 4 |
| Dramatic colon, semicolon pause, "X, not Y" | 4 | 4 |
| Synonym swap (job / turn) | 2 | 2 |
| Puffery or absolute word | 2 | 2 |
| Layout: gap, orphaned figure, text set as a caption | 5 | 5 (one new gap from the second pass) |
| Ambiguous word | 2 | 2 |

The word "every" stays in three places. Each is a measured fact or the agreed Lumen
introduction: "you see every step and its cost" and "passed every stage" (Figure 5 shows each
job green).

## Changes to the build

- `figures.py`: deployment diagram fonts (tags, path labels, zone labels, legend) from 8 to 9.5
  units up to 11 units (12 in the second pass). Chart fonts from 10 to 11 units up to 12 to 14 units. "jobs" changed to
  "turns" in the chart labels. Terminal frames for the ask and kill figures cut at 1000 px.
  Agents and session figures re-cropped and stacked. Deck figure dropped in the second pass. The unused
  `row()` helper removed.
- `build.py`: no change.

## Second pass: the readability faults left open after the first pass

The coordinator asked for 8 pt or more in every figure. A terminal character is 13.2 px wide
in the recordings. At 8 pt, a line can have at most about 78 px for each centimetre of print
width. No landscape page was necessary.

| Figure | Before | Fix | Print size now |
|---|---|---|---|
| 20 Oct, Figure 2 (pods, HPAs, Helm history) | About 110 to 150 columns, about 6 pt | New `columns()` helper in `figures.py`. It keeps only the named columns: pods (NAME, READY, STATUS, RESTARTS, AGE); HPAs (NAME, MINPODS, MAXPODS, REPLICAS, AGE); Helm (REVISION, UPDATED, STATUS, DESCRIPTION). It uses the pixels from the recording and draws no text. | About 8.5 pt at 12.5 cm |
| 27 Oct, Figure 2(b) (HPA watch) | About 115 columns | NAME, TARGETS, MINPODS, MAXPODS, REPLICAS | About 8.4 pt at 15.9 cm |
| 27 Oct, Figure 4 (burst on the Vultr host) | About 110 columns, with wrapped `scaledobject` lines | `scaledobject` lines removed. The HPA lines keep name, targets, minimum, maximum and current replicas. The loop command is cut after `--no-headers;`. Pods are shown whole. | About 8.6 pt at 15.9 cm |
| Figures 3, 5 and 6 of 20 Oct (ask, pipeline, kill) | Already 75 or fewer columns | Widths set to 13.5, 11.5 and 13.5 cm | About 8.2 to 8.4 pt |
| Both deployment diagrams | Node tags, path labels and legend at 11 units (about 6.7 pt at 14.5 cm) | All text 12 units or more. The Literature watch, CI/CD and OpenAI nodes are wider. Each diagram is at full text width (15.9 cm). | 8.0 pt or more |
| 27 Oct, Figure 7 (six slides) | Thumbnails, body text unreadable | Figure dropped. One sentence gives the deck file. | n/a |

The captions of the cropped figures now say "Other columns are cut out".

## Left open

- 20 October report, page 3: about a third of the page is empty under Figure 1. At 8 pt,
  Figure 2 is about 11 cm tall and does not fit there. The report now has 8 pages, and page 8
  holds only the plan.
- 27 October report: page 7 holds only the plan.
- The web app screenshots (Figures 5 and 6 of 27 October) were not measured against 8 pt. Their
  smallest UI text is about 6 pt (it was about 3 pt before the first pass).
