# Agent report: ASS fortnightly progress reports (27 October 2026)

## What I produced

All files are in `docs/platform/progress/`. Nothing is committed.

- `2026-10-20.md`: the source of the report for 7 to 20 October 2026.
- `2026-10-27.md`: the source of the report for 21 to 27 October 2026.
- `figures.py`: makes every figure. It writes the diagrams and charts as SVG
  in the diagram-design grammar (white-paper skin) to `figures/src/*.html` and
  renders them with `/tmp/rpt/tools/svg2png.js` at 3x. It also crops the screenshots
  and groups them into lettered panels with a thin grey border.
- `build.py`: writes both Word files from the course template. Run `figures.py` first,
  then `build.py`.
- `Team 15_2026-10-20.docx` and `.pdf`: 6 pages, which are a cover and 5 pages of content,
  with 6 figures and 4 tables.
- `Team 15_2026-10-27.docx` and `.pdf`: 7 pages, which are a cover and 6 pages of content,
  with 7 figures and 4 tables.

Each report has the six sections from the briefing (slide 14). The template gives the
styles, the cover and the logo.

I made the PDFs with LibreOffice and looked at every page at 60 dpi. I also looked at the
pages with screenshots at 110 dpi. Before the coordinator's message arrived, I tried a Word
export three times. All three attempts failed. I removed the temporary folder.

### Second pass (after the team's review)

The first figures were rejected for two reasons: the reports had no screenshots, and the
charts and diagrams looked AI-made. I followed
`presenting/report-figures-standard.md` and made these changes:

- The matplotlib charts and the inverted deck picture are gone.
- The deployment diagrams and the two charts are now in the diagram-design grammar.
  Each has one accent:
  - Report 1: the worker (scaled by KEDA).
  - Report 2: the one node (the budget decision).
- Every other figure is a real screenshot.
- No "slice" appears in either report. I checked the sources and the PDF text.

## Figures and their sources

| Report | Figure | What | Source |
|---|---|---|---|
| 20 Oct | 1 | Deployment diagram, EC2 t3.medium (drawn) | `deploy/k8s/lumen/values.yaml`, `contract.md` |
| 20 Oct | 2 | (a) `kubectl get pods`/`get hpa`, (b) `helm history` | Deck recordings `slides/out/rec-pods-cut.gif`, `rec-deploy.gif`, 21 Oct |
| 20 Oct | 3 | Ask through the public API with curl | `slides/out/rec-ask.gif`, 21 Oct |
| 20 Oct | 4 | Jobs and worker pods, demo-mode k6 run (drawn) | `evidence/2026-10-20-load-and-scaling.md` |
| 20 Oct | 5 | `gh run list` and run 39441445313 jobs | `slides/out/rec-pipeline-cut.gif` |
| 20 Oct | 6 | Worker pod force-deleted, the question ends | `slides/out/rec-kill.gif`, 21 Oct |
| 27 Oct | 1 | Jobs per worker and worker pods, real model (drawn) | `evidence/2026-10-21-load-real-model.md` |
| 27 Oct | 2 | (a) k6 summary, (b) HPA watch | `slides/out/rec-load.gif`, `rec-scale-cut.gif` |
| 27 Oct | 3 | Deployment diagram, Vultr (drawn) | `deploy/k8s/vultr/README.md`, `values.yaml` |
| 27 Oct | 4 | (a) publish an agent, (b) the agent with 18 runs, USD 0.1451 | Frames 19 s and 139 s of `ASS-Team15-Demo-Backup.mp4` (25 Oct), with the subtitles cut off |
| 27 Oct | 5 | A question with three reader agents and the call tree | Frame 91 s of the same video |
| 27 Oct | 6 | KEDA from 1 to 3 workers on the Vultr host | `extra-recordings-vultr/keda-1-to-3.gif` (25 Oct) |
| 27 Oct | 7 | Six slides of the deck | `slides/out/preview/slide-02, 07, 11, 13, 19, 22.png` |

Terminal frames are cut at a right edge, so that the text stays readable at print width.
Each caption says so. Some screenshots in report 1 were recorded on 21 Oct, one day after its
period ended, and their captions give that date. They show the system as it was built in the
period.

## Numbers and their sources

- Run 39441445313 passed every stage; run 39439752963 stopped on 5 critical CVEs: report.md
  §6.1 and commit 44630f7.
- 135 questions, 0 of 1,040 requests failed, workers 1 to 4: 2026-10-20 load evidence.
- 21 requests, then 429; the literature watch digest in 5 s: 2026-10-20 public API evidence.
- USD 0.08 and 8 findings against USD 0.03 and 3: 2026-10-20 worker-kill evidence.
- 131 questions, median 4.1 s, p95 27.0 s, workers 1 to 2: 2026-10-21 real-model evidence.
- 4 approval tests, deploy run 39542685448: 2026-10-21 approval evidence.
- t3.xlarge at about USD 5 a day, then t3.medium at about USD 1.3 a day: commits a1be103
  and 06311a7.
- Image copied over SSH, no registry: commit cdf5cd7.
- gpt-4.1-nano rejected with 404, then gpt-4.1-mini: commit 67570f3 (24 Oct).
- Vultr vc2-1c-2gb failed, vc2-2c-4gb at USD 20 a month: commits b9aec0c and 61129c4, and
  `deploy/k8s/vultr/README.md`.
- Default budget cap of USD 0.05: commit ade7f7a (26 Oct).
- Backup video of 2 min 42 s and three extra recordings on Vultr: the coursework speaker guide
  and `2026-10-26-Presentation-Files/extra-recordings-vultr/`.
- Planning meeting and rehearsal on 23 Oct: `meeting-minutes/2026-10-23-1557-minutes.md`.

Map from git author to person: Ziyang Liu and Rufus = LIU ZIYANG; youayouly = LU YI;
kita80387694 = PENG XUJIAN; sestet = LI ZHUOYANG; Darrenus = HE RONG. The map comes from the
owned services in report.md §2.1 and the CODEOWNERS list in the SWE5006 `slides/facts.md`.

## Choices the coordinator should check

1. **Hours.** Each member has 80 hours in total, as report.md §2.3 states. I split them
   between the two periods by the work in git and by the slides each member presented:
   - LIU ZIYANG: 56 + 24.
   - HE RONG: 66 + 14.
   - LU YI, LI ZHUOYANG and PENG XUJIAN: 70 + 10 each.
   - Totals: 332 + 68 = 400.

   These hours are an allocation, not a timesheet. The team should confirm them.
2. **The k6 test owner.** The proposal gives load tests to HE RONG, but kita80387694
   (PENG XUJIAN) wrote the k6 commits. Table 1 of the first report names both of them.
3. **Dates in the first report.** Git shows all platform commits on 20 Oct, because the
   history was squashed. The report says "merged and deployed on 20 October". It does not
   copy the 8 to 16 Oct milestone dates from report.md §2.3.
4. **The plan dates in the second report** are mine: 2 Nov for the report sections, 10 Nov
   for the Word build. The owners of those tasks are also mine. The team should confirm both.
5. **The lecturer's remark** is in the second report, in Problems Encountered and in the plan.
   It gives the reason as budget, with the measured host costs, and states the one-node
   limit as a fact. It does not quote EKS prices, because no source in the repository has them.

## Screens I did not use

- The GitHub commits-per-member pages in `/tmp/web/` show the main branch, which is the
  SWE5006 work, and the repository is private. The ASS reports therefore have no
  commits-per-member figure. Table 1 of each report names the owner of each task instead.
- The `/tmp/sd` Lumen screens come from the SWE5006 staging site. The ASS web-app screens
  come from the ASS demo video, which was recorded on the platform's public host.

## Facts I could not find (left out)

- **Why the host moved from AWS to Vultr on 25 Oct.** The commits do not give the reason. The
  report states the move without a reason.
- **What happened at the presentation on 26 Oct.** I could not find whether the live
  demonstration ran or the backup video played, or any remark other than the one-node
  question. The report says only that each member presented the part that member built.
- **When these reports go to Canvas.** No submission date is in any source, so the reports
  name none.

## Mismatches found in other documents (not changed)

- The deck, the speaker guide and report.md still say "EC2 t3.medium". Since 25 Oct the
  public host is a Vultr VM. Its address is 139.180.185.51 in `deploy/k8s/vultr/README.md`.
- report.md §2.2 has a "[TEAM TO FILL]" item about the progress report submission.
- report.md §2.1 and the logical diagram use the word "slice". The writing guide asks for
  "module".
