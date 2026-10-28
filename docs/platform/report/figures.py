"""Makes the screenshot figures of the report from the files in figures/src/.

    python3 docs/platform/report/figures.py

Each figure is one to four screenshots, cropped to the part that matters, with
a thin grey border and an (a), (b), (c) label under each panel. The diagrams
(figures/d-*.png) come from ../diagrams/report/draw.py, not from this script.

Sources of figures/src/ (all real screens, nothing redrawn):
- web-*.png: frames of the team's demonstration recordings
  (ASS-Team15-Demo-Backup.mp4: public host, 25 October 2026, gpt-4.1-mini;
  ASS-Team15-Demo-Backup-v1.mp4: the same web app on a local server,
  22 October 2026, gpt-4.1), taken with ffmpeg; the subtitle band is cut off.
- landing.png, run-*.png, runs-list.png, tree-services.png: public pages
  captured with Playwright on 27 October 2026, without signing in.
- term-load, term-scale, term-pods, term-deploy: the last frames of the
  terminal recordings on the AWS host, 20 and 21 October 2026.
- term-keda, term-worker-deleted, term-watch: the last frames of the terminal
  recordings on the Vultr host, 25 October 2026.
- gh-commits-week.jpg: the GitHub commits-per-week page, captured by the team on
  23 October 2026.
"""
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "figures", "src")
OUT = os.path.join(HERE, "figures")
WIDTH = 2400            # pixels across the printed text width
GAP = 36
BORDER = (191, 192, 192)
FONT = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 34)


def load(name, box=None, auto=False):
    im = Image.open(os.path.join(SRC, name)).convert("RGB")
    if box:
        im = im.crop(box)
    if auto:
        im = autocrop(im)
    return im


def autocrop(im, pad=24):
    """Cuts the empty dark border of a terminal frame."""
    grey = im.convert("L").point(lambda v: 255 if v > 60 else 0)
    box = grey.getbbox()
    if not box:
        return im
    l, t, r, b = box
    return im.crop((max(0, l - pad), max(0, t - pad), min(im.width, r + pad), min(im.height, b + pad)))


def framed(im):
    out = Image.new("RGB", (im.width + 4, im.height + 4), BORDER)
    out.paste(im, (2, 2))
    return out


def figure(name, rows, labels=True):
    """rows: a list of rows; each row is a list of images placed side by side at one height."""
    placed = []
    letter = ord("a")
    y = 0
    for row in rows:
        gaps = GAP * (len(row) - 1)
        ratio = sum(i.width / i.height for i in row)
        h = int((WIDTH - gaps) / ratio)
        x = 0
        for im in row:
            w = int(im.width * h / im.height)
            placed.append((framed(im.resize((w, h), Image.LANCZOS)), x, y, chr(letter)))
            letter += 1
            x += w + GAP
        y += h + 4 + (56 if labels else 0) + GAP
    canvas = Image.new("RGB", (WIDTH + 4, y - GAP), "white")
    d = ImageDraw.Draw(canvas)
    for im, x, y0, ch in placed:
        canvas.paste(im, (x, y0))
        if labels and len(placed) > 1:
            d.text((x + im.width / 2, y0 + im.height + 10), "(%s)" % ch, fill=(45, 49, 66), font=FONT, anchor="mt")
    canvas.save(os.path.join(OUT, name + ".png"))
    print(name, canvas.size)


# ---------------------------------------------------------------- terminal frames
# The terminal recordings use one monospace font: a cell is 13.18 px wide and a row
# 29.7 px high; text starts at x = 13. A frame is up to 141 columns wide, so at the
# printed text width its letters come out at about 6 pt. The helpers below rebuild a
# frame at 88 columns, so the text prints at about 8.4 pt: they cut columns that the
# caption does not need, and wrap a long command line the way a narrower terminal does.
CW, X0, TOP, RH = 13.18, 13, 15, 29.7
COLS = 88


def strip(im, r, c0, c1):
    """One terminal row, columns c0 to c1."""
    return im.crop((round(X0 + CW * c0), round(TOP + RH * r), round(X0 + CW * c1), round(TOP + RH * (r + 1))))


def hcat(parts):
    out = Image.new("RGB", (sum(p.width for p in parts), parts[0].height), "black")
    x = 0
    for p in parts:
        out.paste(p, (x, 0))
        x += p.width
    return out


def line(im, r, *ranges):
    """A row with only the given column ranges, joined; ranges default to the first COLS columns."""
    return hcat([strip(im, r, a, b) for a, b in (ranges or [(0, COLS)])])


def wrapped(im, rows):
    """A logical line that the terminal wrapped over several rows, wrapped again at COLS.
    rows: (row, number of columns in that row)."""
    whole = hcat([strip(im, r, 0, n) for r, n in rows])
    step = round(CW * COLS)
    return [whole.crop((x, 0, min(x + step, whole.width), whole.height)) for x in range(0, whole.width, step)]


def term(lines):
    """Stacks rows on a black terminal of COLS columns; None is an empty row."""
    w = round(2 * X0 + CW * COLS)
    pad = 12
    out = Image.new("RGB", (w, round(2 * pad + RH * len(lines))), "black")
    for i, ln in enumerate(lines):
        if ln is not None:
            out.paste(ln, (X0, round(pad + RH * i)))
    return out


def term_load():
    im = load("term-load.png")
    return term([line(im, r) for r in range(5)])


def term_scale():
    # the prompt, then the table without NAME and REFERENCE (TARGETS starts at column 38)
    im = load("term-scale.png")
    # the rows where the replica count changes; the repeated rows between them are left out
    keep = [1, 2, 4, 5, 6, 10, 12, 13]
    return term([line(im, 0, (0, 60))] + [line(im, r, (38, 116)) for r in keep])


def term_keda():
    im = load("term-keda.png")
    rows = [line(im, 0, (0, 60)),
            line(im, 1, (0, 86)),            # ScaledObject header, up to FALLBACK
            line(im, 3, (0, 86)),            # the worker row; rows 2 and 4 are its wrapped tails
            line(im, 5, (0, 60)), line(im, 6, (0, 60))]
    rows += wrapped(im, [(7, 99)])           # the watch loop command
    rows += [line(im, r, (18, 96)) for r in (8, 11, 14, 16)]   # HPA rows where the targets change, without NAME
    rows += [line(im, r, (0, 72)) for r in range(17, 22)]
    return term(rows)


def term_worker_deleted():
    im = load("term-worker-deleted.png")
    rows = wrapped(im, [(0, 110), (1, 76)])                   # ask with the agent
    rows += [line(im, 2, (0, 60)), line(im, 3, (0, 76)), line(im, 4, (0, 60))]
    rows += wrapped(im, [(5, 106)])                           # the force delete
    rows += wrapped(im, [(6, 110), (7, 57)])                  # kubectl's warning
    rows += [line(im, r, (0, 66)) for r in range(8, 12)]
    rows += wrapped(im, [(12, 110), (13, 57)])                # the poll loop
    rows += [line(im, r, (0, 66)) for r in range(14, 22)]
    return term(rows)


def term_pods():
    # pods as they are; HPAs without the REFERENCE column (TARGETS starts at column 40)
    im = load("term-pods.png")
    return term([line(im, r, (0, 62)) for r in range(10)] + [line(im, r, (0, 18), (40, 110)) for r in range(10, 15)])


def term_deploy():
    # helm history without CHART and APP VERSION; then the rollout history
    im = load("term-deploy.png")
    return term([line(im, 0, (0, 60))] + [line(im, r, (0, 64), (96, 114)) for r in range(1, 6)] +
                [line(im, r, (0, 60)) for r in range(6, 13)])


def term_watch():
    # the digest header and the producer's usage; the list of findings is left out
    im = load("term-watch.png")
    return term([line(im, r) for r in range(8)] + [line(im, r) for r in range(16, 25)])


APP = (230, 22, 1690, 846)        # the app window inside a 1920 x 1080 demo frame


def main():
    # 1.1 Lumen in use on the public host
    figure("s-lumen", [[load("landing.png", (672, 1128, 2208, 1440))], [load("web-answer.png", (230, 22, 1690, 690))]])
    # 3.1.4 producer and consumer on the public host
    figure("s-producer", [[load("web-agents-publish.png", (230, 22, 1690, 494))], [load("web-agents-usage.png", (265, 41, 1632, 343))],
                          [term_watch()]])
    # 3.2.4 over the budget cap, the approval and the ledger
    figure("s-approval", [[load("web-over-cap.png", (0, 41, 1920, 398))],
                          [load("web-wallet-approvals.png", (27, 20, 1111, 837)), load("web-ledger.png", (55, 20, 1378, 823))]])
    # 4.1 load and autoscaling
    figure("s-scaling", [[term_load()], [term_scale()], [term_keda()]])
    # 4.2 a worker deleted during a question
    figure("s-kill", [[term_worker_deleted()], [term_pods()]])
    # 5.1 source control
    figure("s-source", [[load("tree-services.png", (0, 330, 2880, 1480))],
                        [load("gh-commits-week.jpg", (420, 112, 1340, 673))]])
    # 5.2 and 5.3 pipeline runs
    figure("s-runs", [[load("run-ok.png", (0, 360, 2880, 1560))], [load("run-gate.png", (0, 390, 2880, 1840))]])
    figure("s-history", [[load("runs-list.png", (640, 190, 2880, 1850))], [term_deploy()]])


if __name__ == "__main__":
    main()
