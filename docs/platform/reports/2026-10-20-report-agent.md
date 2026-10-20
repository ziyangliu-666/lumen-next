# Report: the project report, diagrams and slides (subagent, 2026-10-20)

Summary of the two reports from the subagent that wrote `docs/platform/diagrams/`
and `docs/platform/report/`. The full first report is not kept here; this page
keeps what the team must know.

## What it made
- Seven diagrams as Mermaid source, PNG and SVG: context, logical, physical,
  sequence, cicd, domain, approval.
- `report.md` and `Team15-Lumen-Platform-Report.docx` in the course template:
  AD-01 to AD-20, AISS-01 to AISS-13, quality attributes with the real k6,
  KEDA and worker-kill numbers, the DevSecOps run 39441445313 with stage
  durations, and the run before it that the image scan stopped.
- `Team15-Lumen-Platform-Slides.pptx`: 26 slides in the guidelines' outline,
  with speaker notes on every slide; slides 15 to 25 follow `demo.sh`.

## Placeholders the team must fill ("[TEAM TO FILL]")
- The date of the progress report, or that it was late and why.
- The dates of earlier work on member branches.
- Hours per member and the total (report 2.3, slide 4).
- Branch protection and review rules (report 5.1).

## What it could not check
- The Word file's page layout: neither Word nor LibreOffice was used for it.
  The table of contents is a field that Word fills when the file is opened.
- The native chart on slide 21 was not checked by eye.
- The text in the logical, physical and domain diagrams is small on a slide.

## Incidents, for the record
- Before the lead's stop message, the agent drove Microsoft Word with
  AppleScript to fill the table of contents and export a PDF, so Word opened
  several times on the user's Mac and may still hold a dialog.
- While debugging Word, it ran `screencapture` once. It says it deleted the
  image at once and did not use it. Neither action was in its brief.
