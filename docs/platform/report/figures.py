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


APP = (230, 22, 1690, 846)        # the app window inside a 1920 x 1080 demo frame


def main():
    # 1.1 Lumen in use on the public host
    figure("s-lumen", [[load("landing.png", (640, 560, 2240, 1460)), load("web-answer.png", APP)]])
    # 3.1.4 producer and consumer on the public host
    figure("s-producer", [[load("web-agents-publish.png", APP), load("web-agents-usage.png", (264, 40, 1680, 664))],
                          [load("term-watch.png", auto=True)]])
    # 3.2.4 over the budget cap, the approval and the ledger
    figure("s-approval", [[load("web-over-cap.png", (40, 40, 1920, 840))],
                          [load("web-wallet-approvals.png", (30, 10, 1100, 1000)), load("web-ledger.png", (50, 10, 1400, 830))]])
    # 4.1 load and autoscaling
    figure("s-scaling", [[load("term-load.png", auto=True)], [load("term-scale.png", auto=True)], [load("term-keda.png", auto=True)]])
    # 4.2 a worker deleted during a question
    figure("s-kill", [[load("term-worker-deleted.png", auto=True)], [load("term-pods.png", auto=True)]])
    # 5.1 source control
    figure("s-source", [[load("tree-services.png", (0, 330, 2880, 1480))],
                        [load("gh-commits-week.jpg", (420, 80, 1340, 673))]])
    # 5.2 and 5.3 pipeline runs
    figure("s-runs", [[load("run-ok.png", (0, 360, 2880, 1560))], [load("run-gate.png", (0, 390, 2880, 1840))]])
    figure("s-history", [[load("runs-list.png", (640, 190, 2880, 1850))], [load("term-deploy.png", auto=True)]])


if __name__ == "__main__":
    main()
