# The project report (ASS, Team 15)

`report.md` is the source of the project report. `build_docx.py` turns it into
the Word file in the course template, renders the PDF with LibreOffice, and
fills the page numbers of the table of contents from that render.

```sh
python3 docs/platform/diagrams/report/draw.py   # the diagrams, figures/d-*.png
python3 docs/platform/report/figures.py         # the screenshot figures, figures/s-*.png
python3 docs/platform/report/build_docx.py      # out/Team 15 - Lumen Platform Report.docx and .pdf
```

- `draw.py` needs Playwright at `/tmp/pw/node_modules/playwright` and
  `/tmp/rpt/tools/svg2png.js` (set `SVG2PNG` to use another copy). It writes one
  HTML file per diagram next to itself, in the style of the diagram-design
  skill with the white-paper skin, and renders each to PNG at 3x.
- `figures.py` crops the screenshots in `figures/src/` and groups them into
  panels. Its docstring names the source of every screenshot.
- `build_docx.py` needs python-docx, Pillow, the course template
  (`00_Report-Template.docx` in the coursework folder, or `REPORT_TEMPLATE`)
  and, for the PDF, LibreOffice (`soffice`) and poppler (`pdftotext`).
  A figure line that ends in `{wide}` goes on a landscape page.

`out/Team 15.zip` is the Canvas submission: the Word file, the PDF and a
`README.txt` with the repository URL and the place of the pipeline script,
the Helm chart and the test scripts.

The Mermaid sources in `../diagrams/*.mmd` are the earlier diagrams; the
report no longer uses them.
