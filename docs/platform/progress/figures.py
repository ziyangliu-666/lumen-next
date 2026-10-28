"""Make every figure of the two ASS progress reports.

Two kinds of figure, one style each (docs: presenting/report-figures-standard.md):

- Diagrams and charts are SVG in the diagram-design skill's grammar, on the
  white-paper skin, written here as HTML files in figures/src/ and rendered to
  PNG with the shared Playwright tool (svg2png.js, first <svg> only, 3x).
- Screenshots are real frames: the terminal recordings of the deck (made on the
  public host), the extra recordings on the Vultr host, and frames of the
  narrated demo video. Each is cropped to its content, given a thin grey border,
  and grouped into lettered panels where several show one flow.

The data of the charts comes from the evidence files, so a chart cannot drift
from the numbers the reports quote.

Run:  python3 -I docs/platform/progress/figures.py
"""

from __future__ import annotations

import re
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
PLATFORM = HERE.parent
EVIDENCE = PLATFORM / "evidence"
DECK = PLATFORM / "slides/out"
OUT = HERE / "figures"
SRC = OUT / "src"
COURSE = Path.home() / "Downloads/NUS-SE34-Coursework"
VIDEO = COURSE / "2026-10-26-Presentation-Files/ASS-Team15-Demo-Backup.mp4"
VULTR = COURSE / "2026-10-26-Presentation-Files/extra-recordings-vultr"
SVG2PNG = Path("/tmp/rpt/tools/svg2png.js")

# White-paper skin: the skill's light roles with paper set to white.
PAPER = "#ffffff"
PAPER2 = "#f4f5f7"
INK = "#2d3142"
MUTED = "#4f5d75"
SOFT = "#5a6580"
ACCENT = "#bf4520"
ACCENT_TINT = "rgba(191,69,32,0.08)"
LINK = "#2e5aa8"
RULE = "rgba(45,49,66,0.12)"
MONO = "'Geist Mono', ui-monospace, monospace"
SANS = "'Geist', system-ui, sans-serif"

PAGE = """<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>*{{margin:0;padding:0}} body{{background:{paper}}} svg{{display:block;width:{w}px}}</style>
</head><body>
{svg}
</body></html>
"""


def render(name: str, svg: str, width_px: int) -> Path:
    """Write the HTML wrapper and render its first <svg> to PNG at 3x."""
    SRC.mkdir(parents=True, exist_ok=True)
    html = SRC / f"{name}.html"
    html.write_text(PAGE.format(paper=PAPER, w=width_px, svg=svg))
    png = OUT / f"{name}.png"
    subprocess.run(["node", str(SVG2PNG), str(html), str(png), "3"], check=True)
    return png


def t(x, y, s, size=11, fill=INK, family=SANS, anchor="start", weight=400, spacing=0.0, extra=""):
    s = s.replace("&", "&amp;").replace("<", "&lt;")
    return (
        f'<text x="{x}" y="{y}" fill="{fill}" font-size="{size}" font-family="{family}" '
        f'font-weight="{weight}" text-anchor="{anchor}" letter-spacing="{spacing}em" {extra}>{s}</text>'
    )


def mask_label(x, y, s, fill, w=None, size=12):
    """An arrow label on an opaque paper mask, centred at x."""
    w = w or int(len(s) * size * 0.62 + 8)
    return (
        f'<rect x="{x - w / 2}" y="{y - size}" width="{w}" height="{size + 4}" rx="2" fill="{PAPER}"/>'
        + t(x, y, s, size=size, fill=fill, family=MONO, anchor="middle", spacing=0.06)
    )


# ---------------------------------------------------------------- deployment


def deployment(name: str, host: dict) -> Path:
    """UML-style deployment diagram in the skill's deployment grammar.

    Two zones: outside the host (clients, CI, model provider) and the one k3s
    node. One node per role; replica ranges sit on the artifact chips.
    """
    W, H = 672, 470
    parts: list[str] = []
    defs = f"""<defs>
<marker id="a" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="{MUTED}"/></marker>
<marker id="al" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="{LINK}"/></marker>
</defs>"""
    parts.append(f'<rect width="{W}" height="{H}" fill="{PAPER}"/>')

    def zone(x, y, w, h, label, accent=False):
        stroke = ACCENT if accent else "rgba(45,49,66,0.28)"
        col = ACCENT if accent else SOFT
        lw = int(len(label) * (12 * 0.62 + 1.44) + 14)
        if not label:
            return (
                f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="rgba(45,49,66,0.02)" '
                f'stroke="{stroke}" stroke-width="{1.2 if accent else 0.8}" stroke-dasharray="4,4"/>'
            )
        return (
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="rgba(45,49,66,0.02)" '
            f'stroke="{stroke}" stroke-width="{1.2 if accent else 0.8}" stroke-dasharray="4,4"/>'
            f'<rect x="{x + 12}" y="{y - 8}" width="{lw}" height="16" fill="{PAPER}"/>'
            + t(x + 18, y + 5, label, size=12, fill=col, family=MONO, spacing=0.12, weight=500)
        )

    def node(x, y, w, h, tag, title, chips, sub=None, kind="infra"):
        fill = {"infra": "#ffffff", "ext": PAPER2}[kind]
        stroke = INK if kind == "infra" else "rgba(45,49,66,0.35)"
        tw = int(len(tag) * 12 * 0.64 + 10)
        s = (
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{fill}" stroke="{stroke}" stroke-width="1"/>'
            f'<rect x="{x + 6}" y="{y + 5}" width="{tw}" height="17" rx="2" fill="none" stroke="rgba(45,49,66,0.40)" stroke-width="0.8"/>'
            + t(x + 6 + tw / 2, y + 18, tag, size=12, fill=INK, family=MONO, anchor="middle", spacing=0.08)
            + t(x + w / 2, y + 39, title, size=13, weight=600, anchor="middle")
        )
        cy = y + 50
        if sub:
            s += t(x + w / 2, y + 56, sub, size=12, fill=MUTED, family=MONO, anchor="middle")
        for label, tagtext, hot in chips:
            st = ACCENT if hot else MUTED
            fl = ACCENT_TINT if hot else "rgba(45,49,66,0.05)"
            s += (
                f'<rect x="{x + 8}" y="{cy}" width="{w - 16}" height="24" rx="4" fill="{fl}" stroke="{st}" stroke-width="{1 if hot else 0.8}"/>'
                + t(x + 16, cy + 16, label, size=12)
                + t(x + w - 16, cy + 16, tagtext, size=12, fill=ACCENT if hot else MUTED, family=MONO, anchor="end")
            )
            cy += 30
        return s

    # Zones first. The host label sits at the bottom edge, because the
    # network paths cross the top edge.
    parts.append(zone(16, 20, 640, 92, "OUTSIDE THE HOST"))
    parts.append(zone(16, 152, 640, 252, "", accent=host["accent_zone"]))
    hl = host["zone"]
    hw = int(len(hl) * (12 * 0.62 + 1.44) + 14)
    parts.append(f'<rect x="28" y="395" width="{hw}" height="16" fill="{PAPER}"/>')
    parts.append(t(34, 408, hl, size=12, fill=ACCENT if host["accent_zone"] else SOFT, family=MONO, spacing=0.12, weight=500))

    # Paths behind the nodes.
    lnk = f'fill="none" stroke="{LINK}" stroke-width="1.2" marker-end="url(#al)"'
    mut = f'fill="none" stroke="{MUTED}" stroke-width="1.2" marker-end="url(#a)"'
    parts.append(f'<path d="M 96,100 V 174" {lnk}/>')
    parts.append(f'<path d="M 244,100 V 128 Q 244,136 236,136 H 144 Q 136,136 136,144 V 174" {lnk}/>')
    parts.append(f'<path d="M 396,100 V 174" {lnk}/>')
    model_dash = ' stroke-dasharray="5,4"' if host["model_dashed"] else ""
    parts.append(
        f'<path d="M 452,176 V 148 Q 452,140 460,140 H 572 Q 580,140 580,132 V 102" '
        f'fill="none" stroke="{LINK}" stroke-width="1.2"{model_dash} marker-end="url(#al)"/>'
    )
    parts.append(f'<path d="M 160,230 H 198" {mut}/>')
    parts.append(f'<path d="M 472,238 H 510" {mut}/>')
    parts.append(f'<path d="M 472,268 H 510" {mut}/>')

    # Nodes.
    parts.append(node(32, 36, 128, 64, "DEVICE", "Browser", [], sub="web app"))
    parts.append(node(178, 36, 132, 64, "CLIENT", "Literature watch", [], sub="watch.mjs"))
    parts.append(node(330, 36, 132, 64, "CI/CD", "GitHub Actions", [], sub="deploy workflow"))
    parts.append(node(508, 36, 140, 64, "MANAGED", "OpenAI API", [], sub=host["model"], kind="ext"))
    parts.append(node(32, 176, 128, 110, "POD", "Traefik", [("ingress", "TLS", False), ("limit", "/api/auth", False)]))
    worker_hot = host["accent_worker"]
    parts.append(
        node(
            200,
            176,
            272,
            206,
            "NAMESPACE",
            "lumen: five services",
            [
                ("identity", "1–3 · HPA", False),
                ("project", "1–3 · HPA", False),
                ("billing", "1–3 · HPA", False),
                ("session", "1", False),
                ("worker", "1–4 · KEDA", worker_hot),
            ],
        )
    )
    parts.append(node(512, 176, 128, 110, "STATEFULSET", "Data", [("PostgreSQL", "16", False), ("RabbitMQ", "3.13", False)]))

    # Path labels on masks.
    parts.append(mask_label(96, 126, "HTTPS:443", LINK))
    parts.append(mask_label(244, 120, "HTTPS:443", LINK))
    parts.append(mask_label(396, 126, "SSH:22", LINK))
    parts.append(mask_label(520, 144, host["model_label"], LINK))
    parts.append(mask_label(180, 222, "HTTP", MUTED))
    parts.append(mask_label(492, 231, "SQL", MUTED))
    parts.append(mask_label(492, 284, "AMQP", MUTED))

    # Legend strip.
    y = 432
    parts.append(f'<line x1="16" y1="{y - 8}" x2="656" y2="{y - 8}" stroke="{RULE}" stroke-width="0.8"/>')
    parts.append(t(16, y + 8, "LEGEND", size=12, fill=MUTED, family=MONO, spacing=0.08))
    parts.append(f'<line x1="86" y1="{y + 4}" x2="114" y2="{y + 4}" stroke="{LINK}" stroke-width="1.2" marker-end="url(#al)"/>')
    parts.append(t(122, y + 8, "crosses the host boundary", size=12, fill=MUTED))
    parts.append(f'<line x1="296" y1="{y + 4}" x2="324" y2="{y + 4}" stroke="{MUTED}" stroke-width="1.2" marker-end="url(#a)"/>')
    parts.append(t(332, y + 8, "inside the host", size=12, fill=MUTED))
    parts.append(
        f'<rect x="440" y="{y - 2}" width="14" height="11" rx="2" fill="{ACCENT_TINT}" stroke="{ACCENT}" stroke-width="1"/>'
    )
    parts.append(t(460, y + 8, host["accent_legend"], size=12, fill=MUTED))
    parts.append(t(16, y + 30, "1–3: the replicas an autoscaler may run.", size=12, fill=MUTED))

    svg = f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg">{defs}{"".join(parts)}</svg>'
    return render(name, svg, 1280)


# ---------------------------------------------------------------- charts


def chart(name: str, xs, left, right, *, xmax, lmax, lticks, rmax, xlabel, llabel, rlabel,
          left_label, right_label, target=None, area=True) -> Path:
    """One time chart: a muted series on the left axis, the focal worker count
    (a step line in accent) on the right axis. Direct labels, no legend box."""
    W, H = 640, 300
    x0, x1, y0, y1 = 72, 576, 240, 24

    def X(v):
        return x0 + (x1 - x0) * v / xmax

    def YL(v):
        return y0 - (y0 - y1) * v / lmax

    def YR(v):
        return y0 - (y0 - y1) * v / rmax

    p = [f'<rect width="{W}" height="{H}" fill="{PAPER}"/>']
    for v in lticks:
        p.append(f'<line x1="{x0}" y1="{YL(v)}" x2="{x1}" y2="{YL(v)}" stroke="rgba(45,49,66,0.08)" stroke-width="0.8"/>')
        p.append(t(x0 - 8, YL(v) + 5, str(v), size=13, fill=MUTED, family=MONO, anchor="end"))
    for v in range(0, rmax + 1):
        p.append(t(x1 + 8, YR(v) + 5, str(v), size=13, fill=ACCENT, family=MONO))
    p.append(f'<line x1="{x0}" y1="{y0}" x2="{x1}" y2="{y0}" stroke="rgba(45,49,66,0.35)" stroke-width="1"/>')
    step = 50 if xmax <= 250 else 60
    for v in range(0, int(xmax) + 1, step):
        p.append(t(X(v), y0 + 19, str(v), size=13, fill=MUTED, family=MONO, anchor="middle"))
    p.append(t((x0 + x1) / 2, y0 + 44, xlabel, size=12, fill=MUTED, family=MONO, anchor="middle", spacing=0.06))
    p.append(t(20, (y0 + y1) / 2, llabel, size=12, fill=MUTED, family=MONO, anchor="middle", spacing=0.06,
               extra=f'transform="rotate(-90 20 {(y0 + y1) / 2})"'))
    p.append(t(W - 14, (y0 + y1) / 2, rlabel, size=12, fill=ACCENT, family=MONO, anchor="middle", spacing=0.06,
               extra=f'transform="rotate(90 {W - 14} {(y0 + y1) / 2})"'))

    if target is not None:
        p.append(f'<line x1="{x0}" y1="{YL(target)}" x2="{x1}" y2="{YL(target)}" stroke="{MUTED}" stroke-width="1" stroke-dasharray="5,4"/>')
        lab = f"KEDA target: {target}"
        lw = int(len(lab) * 12 * 0.62 + 8)
        p.append(f'<rect x="{x1 - 28 - lw}" y="{YL(target) + 5}" width="{lw}" height="17" rx="2" fill="{PAPER}"/>')
        p.append(t(x1 - 32, YL(target) + 18, lab, size=12, fill=MUTED, family=MONO, anchor="end", spacing=0.06))

    pts = " ".join(f"{X(a):.1f},{YL(b):.1f}" for a, b in zip(xs, left))
    if area:
        poly = f"{X(xs[0]):.1f},{y0} {pts} {X(xs[-1]):.1f},{y0}"
        p.append(f'<polygon points="{poly}" fill="rgba(79,93,117,0.14)"/>')
    p.append(f'<polyline points="{pts}" fill="none" stroke="{MUTED}" stroke-width="1.2" stroke-linejoin="round"/>')

    # The focal series: worker pods as a step line.
    d = f"M {X(xs[0]):.1f},{YR(right[0]):.1f}"
    for i in range(1, len(xs)):
        d += f" H {X(xs[i]):.1f} V {YR(right[i]):.1f}"
    p.append(f'<path d="{d}" fill="none" stroke="{ACCENT}" stroke-width="2" stroke-linejoin="round"/>')

    lx, ly = left_label
    p.append(t(X(lx), YL(ly), LEFT_TEXT[name], size=14, fill=MUTED, weight=500))
    rx, ry = right_label
    p.append(t(X(rx), YR(ry), "worker pods", size=14, fill=ACCENT, weight=600))

    svg = f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg">{"".join(p)}</svg>'
    return render(name, svg, 1280)


LEFT_TEXT = {
    "chart-load-2026-10-20": "turns in the three turn queues",
    "chart-keda-2026-10-21": "turns per worker",
}


def chart_20() -> Path:
    text = (EVIDENCE / "2026-10-20-load-and-scaling.md").read_text()
    rows = re.findall(r"^(\d\d):(\d\d):(\d\d) workers=(\d+)/\d+ queues=(.*)$", text, re.M)
    if not rows:
        sys.exit("no samples in 2026-10-20-load-and-scaling.md")
    t0 = None
    xs, workers, jobs = [], [], []
    for h, m, s, w, queues in rows:
        sec = int(h) * 3600 + int(m) * 60 + int(s)
        t0 = sec if t0 is None else t0
        xs.append(sec - t0)
        workers.append(int(w))
        jobs.append(sum(int(q.split(":")[1]) for q in queues.split()))
    return chart(
        "chart-load-2026-10-20", xs, jobs, workers, xmax=300, lmax=32, lticks=[0, 10, 20, 30], rmax=4,
        xlabel="SECONDS FROM THE START OF SAMPLING", llabel="TURNS WAITING OR RUNNING", rlabel="WORKER PODS",
        left_label=(142, 5), right_label=(98, 4.2),
    )


def chart_21() -> Path:
    text = (EVIDENCE / "2026-10-21-load-real-model.md").read_text()
    rows = re.findall(r"^\| (\d+) \| ([\d.]+)/5 \| (\d+) \|$", text, re.M)
    if not rows:
        sys.exit("no samples in 2026-10-21-load-real-model.md")
    xs = [int(r[0]) for r in rows]
    per = [float(r[1]) for r in rows]
    workers = [int(r[2]) for r in rows]
    return chart(
        "chart-keda-2026-10-21", xs, per, workers, xmax=220, lmax=12, lticks=[0, 4, 8, 12], rmax=4,
        xlabel="SECONDS FROM THE START OF THE WATCH", llabel="TURNS PER WORKER", rlabel="WORKER PODS",
        left_label=(72, 10.2), right_label=(120, 2.15), target=5, area=False,
    )


# ---------------------------------------------------------------- screenshots

BORDER = (176, 176, 176)
LABEL_FONT = "/System/Library/Fonts/Helvetica.ttc"


def last_frame(gif: Path) -> Image.Image:
    im = Image.open(gif)
    im.seek(im.n_frames - 1)
    return im.convert("RGB")


def video_frame(sec: float) -> Image.Image:
    # The raw frame is a throwaway: only the cropped panel goes into figures/.
    tmp = Path(tempfile.gettempdir()) / f"lumen-progress-video-{sec:05.1f}.png"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-ss", str(sec), "-i", str(VIDEO), "-frames:v", "1", str(tmp)], check=True
    )
    return Image.open(tmp).convert("RGB")


def autocrop(im: Image.Image, pad: int = 18, threshold: int = 40) -> Image.Image:
    """Crop a dark terminal frame to its text, with a margin of pad pixels."""
    grey = im.convert("L").point(lambda v: 255 if v > threshold else 0)
    box = grey.getbbox()
    if not box:
        return im
    l, t_, r, b = box
    return im.crop((max(0, l - pad), max(0, t_ - pad), min(im.width, r + pad), min(im.height, b + pad)))


def bordered(im: Image.Image) -> Image.Image:
    out = Image.new("RGB", (im.width + 4, im.height + 4), BORDER)
    out.paste(im, (2, 2))
    return out


def panels(name: str, images: list[Image.Image], cols: int, width: int = 2400) -> Path:
    """Lay out screenshots in a grid at one width, each with a thin border and a
    letter label (a), (b), ... above it. Single images get no label."""
    gap, label_h = 36, (56 if len(images) > 1 else 0)
    cell_w = (width - gap * (cols - 1)) // cols
    scaled = []
    for im in images:
        im = bordered(im)
        h = round(im.height * cell_w / im.width)
        scaled.append(im.resize((cell_w, h), Image.LANCZOS))
    rows = [scaled[i:i + cols] for i in range(0, len(scaled), cols)]
    height = sum(max(r.height for r in row) + label_h for row in rows) + gap * (len(rows) - 1)
    sheet = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype(LABEL_FONT, 40)
    y = 0
    k = 0
    for row in rows:
        for j, im in enumerate(row):
            x = j * (cell_w + gap)
            if label_h:
                draw.text((x, y + 4), f"({chr(97 + k)})", fill=(45, 49, 66), font=font)
            sheet.paste(im, (x, y + label_h))
            k += 1
        y += max(r.height for r in row) + label_h + gap
    out = OUT / f"{name}.png"
    sheet.save(out)
    return out


def cut(im: Image.Image, right: int | None) -> Image.Image:
    """Cut a terminal frame at a right edge, so its text stays readable at print
    width. Long command lines lose their end; the output lines stay whole."""
    return im if right is None else im.crop((0, 0, min(right, im.width), im.height))


def text_bands(im: Image.Image, threshold: int = 60) -> list[tuple[int, int]]:
    """The text lines of a terminal frame, top to bottom, as (top, bottom) pixel rows."""
    grey = im.convert("L")
    w, h = grey.size
    px = grey.load()
    lit = [any(px[x, y] > threshold for x in range(0, w, 2)) for y in range(h)]
    out, start = [], None
    for y, on in enumerate(lit + [False]):
        if on and start is None:
            start = y
        elif not on and start is not None:
            out.append((start, y))
            start = None
    return out


def text_groups(im: Image.Image, band: tuple[int, int], min_gap: int = 24, threshold: int = 60):
    """The columns of one terminal line: runs of text split where two or more spaces
    separate them. Single spaces stay inside a column ("Tue Oct 20 14:14:45")."""
    grey = im.convert("L").crop((0, band[0], im.width, band[1]))
    px = grey.load()
    lit = [any(px[x, y] > threshold for y in range(grey.height)) for x in range(grey.width)]
    groups, start, last = [], None, None
    for x, on in enumerate(lit):
        if on:
            if start is None:
                start = x
            elif x - last > min_gap:
                groups.append((start, last + 1))
                start = x
            last = x
    if start is not None:
        groups.append((start, last + 1))
    return groups


LEFT = 14  # the left text edge of the deck's terminal recordings


def columns(im: Image.Image, spec: list, pitch: int = 30, gap: int = 40, pad: int = 18) -> Image.Image:
    """Rebuild a terminal frame with only the columns a caption talks about.

    spec is a list of (first_line, last_line, keep): keep is a list of column
    indexes, or ("left", px) to keep a command line whole up to px. The kept
    columns are set again at one width each, so a narrow table stays narrow.
    The pixels are the recording's own; no text is drawn.
    """
    bands = text_bands(im)
    pieces = []  # (y0, y1, [crop boxes] or None, raw_right)
    for first, last, keep in spec:
        block = bands[first:last + 1]
        if isinstance(keep, tuple):
            for b in block:
                pieces.append((b, None, keep[1]))
            continue
        rows = []
        for b in block:
            g = text_groups(im, b)
            rows.append((b, [g[i] for i in keep if i < len(g)]))
        widths = [max(r[1][k][1] - r[1][k][0] for r in rows if k < len(r[1])) for k in range(len(keep))]
        for b, cells in rows:
            pieces.append((b, (cells, widths), None))
    # Lines sit on the recording's grid (29.75 px a line), so a line with no
    # descender keeps the same baseline as its neighbours.
    tops = [int(12 + round((b[0] - 14) / 29.75) * 29.75) for b, _, _ in pieces]
    out_w = 0
    for b, cells, right in pieces:
        if cells is None:
            out_w = max(out_w, right - LEFT)
        else:
            out_w = max(out_w, sum(cells[1]) + gap * (len(cells[1]) - 1))
    out = Image.new("RGB", (out_w + 2 * pad, pitch * len(pieces) + 2 * pad), "black")
    for i, ((b, cells, right), top) in enumerate(zip(pieces, tops)):
        bottom = top + pitch
        y = pad + i * pitch
        if cells is None:
            out.paste(im.crop((LEFT, top, right, bottom)), (pad, y))
            continue
        x = pad
        for (x0, x1), w in zip(cells[0], cells[1]):
            out.paste(im.crop((x0, top, x1, bottom)), (x, y))
            x += w + gap
    return out


def deck_rec(name: str, right: int | None = None) -> Image.Image:
    return cut(autocrop(last_frame(DECK / f"{name}.gif")), right)


def web(sec: float, bottom: int = 845) -> Image.Image:
    """A frame of the narrated demo video, cut to the web app: no subtitle band,
    no chapter bar."""
    return video_frame(sec).crop((230, 25, 1690, bottom))


def screens() -> list[Path]:
    made = []
    # Report of 20 October: the build.
    # Wide tables keep only the columns the caption names, so the text prints at
    # 8 pt or more. One character is 13.2 px; 8 pt needs at most 78 px per cm.
    pods = columns(last_frame(DECK / "rec-pods-cut.gif"),
                   [(0, 8, [0, 1, 2, 3, 4]), (9, 9, ("left", 460)), (10, 14, [0, 3, 4, 5, 6])])
    helm = columns(last_frame(DECK / "rec-deploy.gif"), [(0, 0, ("left", 490)), (1, 5, [0, 1, 2, 5])])
    made.append(panels("shot-cluster", [pods, helm], cols=1))
    made.append(panels("shot-ask", [deck_rec("rec-ask", 1000)], cols=1))
    made.append(panels("shot-kill", [deck_rec("rec-kill", 1000)], cols=1))
    made.append(panels("shot-pipeline", [deck_rec("rec-pipeline-cut")], cols=1, width=1500))
    # Report of 27 October: the real model, the Vultr host, the presentation.
    load = columns(last_frame(DECK / "rec-load.gif"), [(0, 4, ("left", 1095))])
    watch = columns(last_frame(DECK / "rec-scale-cut.gif"), [(0, 0, ("left", 760)), (1, 13, [0, 2, 3, 4, 5])])
    made.append(panels("shot-real-model", [load, watch], cols=1))
    # The two panels are stacked. Side by side, the publish form shrank to text
    # of about 3 pt at print width. Each panel is cut to the part the caption names.
    publish = video_frame(19).crop((1080, 135, 1670, 552))
    usage = video_frame(139).crop((300, 140, 920, 330))
    made.append(panels("shot-agents", [publish, usage], cols=1, width=1800))
    # The whole web app at text width put its text at about 3.5 pt. Two crops
    # instead: the delegated tasks, and the call tree with the cost of each task.
    frame = video_frame(91)
    delegated = frame.crop((270, 395, 1045, 695))
    tree = frame.crop((1090, 400, 1660, 560))
    made.append(panels("shot-session", [delegated, tree], cols=1, width=2400))
    burst = columns(last_frame(VULTR / "keda-1-to-3.gif"), [
        (5, 6, ("left", 800)), (7, 7, ("left", 1125)), (8, 16, [0, 2, 3, 4, 5]),
        (17, 17, ("left", 900)), (18, 21, [0, 1, 2, 3, 4]),
    ])
    made.append(panels("shot-vultr", [burst], cols=1))
    return made


def main() -> None:
    OUT.mkdir(exist_ok=True)
    for path in [
        deployment(
            "diagram-deploy-2026-10-20",
            {
                "zone": "AWS AP-SOUTHEAST-1 · EC2 t3.medium · 2 vCPU, 4 GB · K3S, ONE NODE",
                "accent_zone": False,
                "accent_worker": True,
                "accent_legend": "scaled by KEDA",
                "model": "no key on 20 Oct",
                "model_label": "HTTPS",
                "model_dashed": True,
            },
        ),
        deployment(
            "diagram-deploy-2026-10-27",
            {
                "zone": "VULTR SINGAPORE · vc2-2c-4gb · 2 vCPU, 4 GB · K3S, ONE NODE",
                "accent_zone": True,
                "accent_worker": False,
                "accent_legend": "one node: the budget",
                "model": "gpt-4.1-mini",
                "model_label": "HTTPS",
                "model_dashed": False,
            },
        ),
        chart_20(),
        chart_21(),
        *screens(),
    ]:
        print(path)


if __name__ == "__main__":
    main()
