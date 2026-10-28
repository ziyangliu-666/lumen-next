# Page review of the ASS project report, 28 October 2026

Report: `docs/platform/report/report.md`, built by `build_docx.py` into
`out/Team 15 - Lumen Platform Report.docx`, the PDF and `out/Team 15.zip`.
Before the review the PDF had 49 pages. After the fixes it has 44 pages.
Page numbers in the table are pages of the 49-page PDF.

## Review table

| Page | Fault type | Quote (short) | Fix |
|---|---|---|---|
| 3 | Caption separated from its figure | Figure 1 caption runs onto page 4 | Figure 1 restacked: (a) a strip of the landing page, (b) the answer at full width; the figure and caption now sit together on page 4 |
| 3 | Screenshot too small to read | Figure 1 (b), half width, dark | (b) now uses the full text width and is cropped to the app window |
| 3 | Table wraps badly | "reader / agent", "budget / cap" | Build script: a short label column gets its whole text as minimum width |
| 3 | Meta-talk | "The terms below have one meaning each in this report" | "The report uses these terms, each with one meaning:" |
| 3 | Synonym (turn / job) | "The figures from the presentation call a queued turn a job" | Now names the real source: the proposal's plan in section 2.1 |
| 3 | Term used before it is explained | "fan-out" (1.2, 3.2.4) | New glossary row for fan-out |
| 3 | Sentence over 25 words | "Each team that does this builds the same parts again: ..." (33) | Split into two sentences |
| 3 | Puffery ("every") and long sentence | "records every step ..., and holds every step ..." (34) | Split into three sentences, "each step" |
| 4 | Restating the briefing's question | "The briefing asks two questions: what are ..." | One plain lead sentence for the table |
| 4 | Puffery ("every") | "every consumer can choose the agent"; "for every account and agent" | "consumers choose it by name"; "per account and per agent" |
| 4 | Sentence over 25 words | "The team built the platform from 8 to 21 October, presented it ..." (32) | Split |
| 4 | Sentence over 25 words | "The scope is the platform side of Lumen: ..." (27) | Split |
| 4 | Puffery ("All") | "All of it is built and running." | "It is built and runs on the public address." |
| 5 | Terms used before they are explained | "HPA", "KEDA", "SCA, SAST, DAST", "smoke load", "k3s" | Each is spelled out at first use in 1.4 |
| 5 | Puffery ("every") | "the auth cookie on every service" | "the auth cookie, checked by each service" |
| 5 | Big empty gap | 1.4.2 table pushed to page 6 | Build script: only short tables (8 rows, 700 characters) are kept together |
| 6 | Page mostly empty | 1.4.2 table alone on the page | Same fix; the table now starts on the page before |
| 7 | Table wraps badly | "WB / S", "LI / ZHUOYA / NG" | Column widths now count capitals and bold headers |
| 7 | Internal code in prose (WBS) | column "WBS" | Column "No." |
| 8 | Big empty gap | status table pushed to page 9 | Long tables may break across pages |
| 8 | Puffery ("every") | "every task of the plan is done"; "every stage passed, and the smoke load was skipped" | "the eleven tasks of the plan are done"; "Its stages passed, except the smoke load" (the old text also contradicted itself) |
| 9 | Defensive writing | "None of them blocks the demonstration or the use cases." | Removed; "The open issues are in section 3.4." |
| 10 | Table wraps badly | "8 to 19 / Oct", member names | Column widths fixed |
| 10 | Defensive writing, order | "as the work breakdown of the proposal planned ... the team did not keep time sheets" | The fact comes first, plainly: no time sheets; the table gives the planned effort |
| 10 | Branch name in a table | "Merged pull requests on `main`" | "Merged pull requests in the base product" |
| 11 | Figure legend cut off | Figure 3 legend ends in "fo..." | Legend shortened in `draw.py`; it fits |
| 11 | Text in figures too small (all diagrams) | sublabels about 6 pt, arrow labels about 5.6 pt at print size | `kit.py` type sizes raised (name 14, sublabel 11.5, label 10.5, tag 9); boxes widened where text overflowed (Figures 3, 4, 6, 16) |
| 11 | Puffery ("every", "All") | "Every service runs from the same container image"; "All five services share" | "The five services run from one container image, each with its own command"; "The five services share" |
| 11 | Long caption | Figure 3 caption, one 40-word sentence | Three sentences |
| 12 | Heading at the bottom of a page | "3.1.2 Tiers and Layers" with one line | A paragraph that ends in a colon now stays with what follows |
| 12 | Puffery ("every", "always") | AD-03 "fill every slot ... the work always drains"; AD-05 "every pod sees every steer"; AD-06 "every service connects" | "take all slots ... the queues drain"; "each pod receives each steer"; "the five services connect" |
| 13 | "X, not Y" construction | "depends on the `Worker` interface, not on the worker" | "depends only on the `Worker` interface" |
| 14 | Table wraps badly | "Subsyste / m", "PostgreSQ / L" | Column widths fixed |
| 14 | Puffery ("every") | "every other call 10 seconds"; "Every `/internal/*` route"; "every app on the platform uses" | "the other calls"; "Each"; "the apps on the platform use" |
| 15 | Table wraps badly | "Consum / er" | Column widths fixed |
| 15 | Puffery ("every") | Role table "for every account and agent" | "per account and per agent" |
| 15 | Sentence over 25 words | "The team took the nouns that users say in the six use cases ..." (27) | Split |
| 16 | "never" slogan | "Every total is a SUM in SQL, never a sum of JavaScript numbers." | "The database computes each total with SUM in SQL, with no JavaScript arithmetic." |
| 16 | "not X" construction | "The contexts talk through ports, not through each other's code." | "The contexts talk only through ports." |
| 16 | Big empty gap | Figure 5 pushed to page 17 | The seven API steps now come before Figure 5 |
| 16 | No space after a list | "Domain events." directly under the bullets | Last list item gets 8 pt after |
| 17 | Screenshot too small to read | Figure 5 (a) and (b), half width each | Panels stacked at full width and cropped to the content |
| 18 | Meta-talk | "This is the answer to the briefing's third question for this platform." | Removed |
| 18 | Page almost empty | landscape Figure 6 forced a new page after two paragraphs | Figure 6 now follows the host table, so the page holds the table |
| 19 | Long caption | Figure 6 caption, 45 words | Three sentences |
| 20 | Meta-talk | AD-09: "The details ... follow this table." | Removed |
| 20 | "not Y" slogan | AD-10 title "..., not a gateway service" | "The gateway is a Traefik ingress." |
| 20 | Puffery ("every"), "make sure" | AD-10 "runs in every service, not once at the edge"; AD-11 "`Recreate` makes sure that ..." | "runs in each service instead of once at the edge"; "With `Recreate`, the old kernel stops before the new one starts" |
| 21 | Table wraps badly | "USD / a / day" | Column widths fixed |
| 21 | Sentence over 25 words | "Pods scale inside the node" bullet (43); "One node is also the floor" bullet (51) | Split into short sentences; run number moved next to the failure |
| 22 | Table wraps badly | "Date / and / host" | Column widths fixed |
| 22 | Puffery ("every"), long sentence | "pull it on every node"; "The team takes this path when ..." (30) | "each node pulls it"; two cases, two sentences |
| 22 | Slogans | "Reuse, not rewrite."; "Scales on the cause of the load, not on CPU" | "The stack of the base product, so the modules are reused as they are."; "Scales on the queue length, which rises before CPU does" |
| 23 | Puffery ("Every") | "Every total is a SUM in SQL." | "The database computes each total with SUM." |
| 26 | Puffery ("every", "all") | "every worker pod mounts. This works because all pods are on one node." | "the worker pods mount. This works only while the pods are on one node." |
| 26 | Defensive writing | "One node and one environment do not need one." | "For one node and one environment, Kubernetes Secrets hold the secrets." |
| 26 | Meta-talk | "This section shows two use cases." | Removed; the two use cases are named directly |
| 27 to 30 | List numbers collide with text | "10.When", "11.and 12." | Build script: wider hanging indent for numbered lists |
| 28 | Slogan | "The agent is an addition to the question, never a condition for it." | Removed; the fact stays ("the turn runs with the plain question") |
| 29 | Long caption | Figure 10 caption, 40 words | Two sentences |
| 30 | Screenshot mostly empty and dark | Figure 11 (a), a large black area | (a) cropped to the question, the message and the call tree |
| 30 | Slogan, "exactly" | "A guard that throws is not a yes."; "covers exactly one operation" | "When the guard throws an error, the kernel treats the check as failed ..."; "covers one operation" |
| 31 | Sentence over 25 words | integration test bullet (43) | Split; the evidence file comes first |
| 31 | Puffery | AD-15 "every service carries all the code"; AD-17 "The exit is simpler and safer." | "each service carries the code of all five"; "so the exit loses no work" |
| 31 | Puffery ("Every") | AD-19 title "Every service runs the migrations" | "Each service runs the migrations" |
| 31 | Meta-talk | "Section 4 gives the reasons for the decisions on quality attributes." | Removed |
| 31 | Big empty gap | AISS table pushed to page 32 | Long tables may break; AISS-01 now starts on the same page |
| 31 to 33 | Table rows split across pages; table wraps badly | AD-15 row split after one line; "LI ZHUOY / ANG" | Rows under 1,500 characters stay whole; AISS column widths set (10/21/23/23/13/10) |
| 32 | Sentence over 25 words | AISS-04 "Seen on the public host: ..." (30) | Two sentences |
| 34 | "cause of the load" slogan | "Scaling on the cause of the load." | "Scaling on queue length." |
| 34 | Sentence over 25 words | fan-out bullet (30) | Split |
| 35 | Puffery ("every") | "every slot was full ... every new pod took work" | "all slots were full ... each new pod took work" (measured, kept as fact) |
| 35 | Sentence over 25 words | "With the real model, the same profile on 21 October gave ..." (38) | Three sentences |
| 37 | Puffery ("Every"), "make sure" | "Every service has ... probes"; "waits until every Deployment"; "make sure that a granted approval resumes" | "The five services have"; "the Deployments"; "a granted approval resumes its task" |
| 39 | Puffery ("Every") | Security table: "Every `/internal/*` route"; "Every step over the budget cap" | "Each"; "A step over the budget cap" |
| 39 | "not X" construction | "pinned to a commit, not a tag" | "pinned to a commit instead of a tag" |
| 40 | Text-only page where a table helps | 4.4 "How the platform is extended" as six bullets | Now a table: extension, what to do, what changes |
| 40 | Branch name in prose; puffery | "The base product on `main`"; "every push"; "every environment"; "every call ... every API route" | "The base product"; "each push"; "both environments"; one sentence per contract file |
| 41 | Screenshot crop shows the GitHub tab bar | Figure 15 (b), top edge | Crop starts below the tab bar |
| 42 | Page half empty | landscape Figure 16 forced a page break after one paragraph | Figure 16 now follows the trigger list and the job table |
| 43 | Puffery ("every") | Figure 16 caption "summary reports every stage" | "summary reports the result of each stage" |
| 44 | Table wraps badly | "verif / y" | Column widths fixed |
| 44 | Branch name in prose; puffery | "`security.yml` for `main`"; "every push"; Figure 17 caption "every stage passed ... the smoke load was skipped" | "for the base product"; "a push"; "passed in 8 min 31 s; the smoke load did not run" |
| 45 | Table wraps badly | "Environme / nt" | Column widths fixed |
| 45 | Long sentence, "every" | "How a deployment is verified: `helm --wait` waits for every readiness probe; ..." | A lead sentence and a four-item list |
| 45 | "never" slogan | "a vulnerable image never reaches the host"; "a push never pays for model calls" | "the image does not reach the host"; "a push does not pay for model calls" |
| 46 | Page mostly empty | the run table alone on the page | The table now follows the text on the page before |
| 46 | Table wraps badly | "Dat / e" | Column widths fixed |
| 48 | Puffery ("every") | technical findings "can fill every slot" | "waiting parents can take all slots" |
| 48 | Sentence over 25 words | AI declaration (36); demo step 1 (29) | Split |

## Counts

| Fault type | Found | Fixed |
|---|---|---|
| Puffery and absolute words ("every" 50, plus "All", "always", "never", "exactly", "simpler and safer", "make sure") | 58 | 58; "every" is down from 50 to 3 |
| Sentences over 25 words in prose and captions | 22 | 22 (some semicolon lists inside table cells remain) |
| "X, not Y" slogans and "not X" constructions | 9 | 9 |
| Meta-talk and restating the briefing | 7 | 7 |
| Defensive writing | 4 | 4 |
| Terms used before they are explained | 6 | 6 |
| Internal codes and branch names in prose | 4 | 4 |
| Synonym (turn / job) | 1 | 1 |
| Tables that wrap badly | 14 | 14 |
| Big gaps, near-empty pages, split rows, heading at the bottom of a page | 12 | 12 |
| Caption separated from its figure | 1 | 1 |
| Legend cut off | 1 | 1 |
| Text in diagrams below 8 pt | 10 diagrams | 10 |
| Text in terminal screenshots below 8 pt | 4 figures | 4 |
| Screenshots too small, too dark or badly cropped | 5 figures | 5 |
| Text-only page where a table helps | 1 | 1 |
| List numbering and spacing | 2 | 2 |

## Fixes by file

- `report/report.md`: the wording fixes in the table. Figure 5 moved after its
  seven steps. Figure 6 moved after the host table. Figure 16 moved after the
  job table. New glossary row for fan-out. Section 4.4 extensions as a table.
  No fact or number changed.
- `report/build_docx.py`:
  - Column widths count capitals and bold headers.
  - A short label column does not wrap.
  - Only short tables are kept on one page.
  - Rows under 1,500 characters do not break across pages.
  - The AISS table has set widths.
  - A paragraph that ends in a colon, or a bold-only subheading, stays with the next block.
  - Numbered lists get a wider hanging indent.
  - Each list ends with 8 pt of space.
- `diagrams/report/kit.py`: type sizes raised (name 13 to 14, sublabel 10 to
  11.5, arrow label 9 to 10.5, tag 8 to 9).
- `diagrams/report/draw.py`: legends of Figures 3 and 4 shortened to fit; the
  Clients, GitHub Actions, RabbitMQ and OpenAI boxes widened; "lint, types,
  tests" in Figure 16. All ten diagrams re-rendered.
- `report/figures.py`: new crops for Figures 1, 5, 11 and 15 (b); Figures 1
  and 5 stacked at full width.
- `report/out/`: the docx, the PDF (47 pages) and `Team 15.zip` rebuilt. The
  zip holds the docx, the PDF and the unchanged `README.txt`.

## Second pass: readability faults left after the first pass

| Fault | Fix | Result at print size |
|---|---|---|
| Terminal screenshots at about 6 pt (Figures 5 (c), 13, 14, 18 (b)) | `figures.py` rebuilds each frame at 88 columns: it cuts the columns that the caption does not need (NAME, REFERENCE, CHART, APP VERSION), wraps long command lines, and leaves out repeated HPA rows. The captions of Figure 13 say that repeated rows are left out. | about 8.4 pt |
| Diagram text at about 7 pt (Figures 2 to 10, 12, 17) | `kit.use()` sets one minimum type size per diagram, chosen from the viewBox width so that it prints at 8 pt or more. The small type tags in the boxes are gone (the legend and the caption carry the type). Cost chart, ER, sequence and gantt diagrams relaid; the context map redrawn. Landscape figures may use 5.6 in of height. | 8.1 to 8.5 pt; nothing overlaps (checked in each PNG) |
| Pages with gaps | No forced page break before a chapter; a heading keeps with the next block. Figure 3 follows the text that introduces it; Figure 6 follows the 3.2 introduction; Figure 15 follows the source control table; the pipeline diagram moved to 5.3 and became Figure 17, the runs became Figure 16; Figure 18 comes before the run table. | 44 pages; no page under 70% full except the landscape figure pages and the last page |

## Left open

- The page before the landscape Figure 6 (page 17) and the landscape Figure 17 page (page 41) are about one third empty. A landscape figure starts a new section, so the text cannot flow round it.
- **"The key architectural decisions taken are as follows:"** appears three times. It is the template's lead-in text and was kept.
- The screenshots in Figures 16 and 18 show the GitHub handle of the repository owner. They are evidence screenshots and were not changed.
