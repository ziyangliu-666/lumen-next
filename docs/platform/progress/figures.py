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


def mask_label(x, y, s, fill, w=None, size=9):
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
        lw = int(len(label) * (9 * 0.62 + 1.08) + 14)
        if not label:
            return (
                f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="rgba(45,49,66,0.02)" '
                f'stroke="{stroke}" stroke-width="{1.2 if accent else 0.8}" stroke-dasharray="4,4"/>'
            )
        return (
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="rgba(45,49,66,0.02)" '
            f'stroke="{stroke}" stroke-width="{1.2 if accent else 0.8}" stroke-dasharray="4,4"/>'
            f'<rect x="{x + 12}" y="{y - 6}" width="{lw}" height="12" fill="{PAPER}"/>'
            + t(x + 18, y + 4, label, size=9, fill=col, family=MONO, spacing=0.12, weight=500)
        )

    def node(x, y, w, h, tag, title, chips, sub=None, kind="infra"):
        fill = {"infra": "#ffffff", "ext": PAPER2}[kind]
        stroke = INK if kind == "infra" else "rgba(45,49,66,0.35)"
        tw = int(len(tag) * 8 * 0.66 + 10)
        s = (
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{fill}" stroke="{stroke}" stroke-width="1"/>'
            f'<rect x="{x + 8}" y="{y + 8}" width="{tw}" height="13" rx="2" fill="none" stroke="rgba(45,49,66,0.40)" stroke-width="0.8"/>'
            + t(x + 8 + tw / 2, y + 18, tag, size=8, fill=INK, family=MONO, anchor="middle", spacing=0.08)
            + t(x + w / 2, y + 40, title, size=13, weight=600, anchor="middle")
        )
        cy = y + 50
        if sub:
            s += t(x + w / 2, y + 56, sub, size=9.5, fill=MUTED, family=MONO, anchor="middle")
        for label, tagtext, hot in chips:
            st = ACCENT if hot else MUTED
            fl = ACCENT_TINT if hot else "rgba(45,49,66,0.05)"
            s += (
                f'<rect x="{x + 8}" y="{cy}" width="{w - 16}" height="24" rx="4" fill="{fl}" stroke="{st}" stroke-width="{1 if hot else 0.8}"/>'
                + t(x + 16, cy + 16, label, size=12)
                + t(x + w - 16, cy + 16, tagtext, size=10, fill=ACCENT if hot else MUTED, family=MONO, anchor="end")
            )
            cy += 30
        return s

    # Zones first. The host label sits at the bottom edge, because the
    # network paths cross the top edge.
    parts.append(zone(16, 20, 640, 92, "OUTSIDE THE HOST"))
    parts.append(zone(16, 152, 640, 252, "", accent=host["accent_zone"]))
    hl = host["zone"]
    hw = int(len(hl) * (9 * 0.62 + 1.08) + 14)
    parts.append(f'<rect x="28" y="398" width="{hw}" height="12" fill="{PAPER}"/>')
    parts.append(t(34, 408, hl, size=9, fill=ACCENT if host["accent_zone"] else SOFT, family=MONO, spacing=0.12, weight=500))

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
    parts.append(node(184, 36, 120, 64, "CLIENT", "Literature watch", [], sub="watch.mjs"))
    parts.append(node(336, 36, 120, 64, "CI/CD", "GitHub Actions", [], sub="deploy workflow"))
    parts.append(node(520, 36, 120, 64, "MANAGED", "OpenAI API", [], sub=host["model"], kind="ext"))
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
    parts.append(mask_label(180, 222, "HTTP", MUTED, w=30))
    parts.append(mask_label(492, 231, "SQL", MUTED, w=26))
    parts.append(mask_label(492, 284, "AMQP", MUTED, w=30))

    # Legend strip.
    y = 432
    parts.append(f'<line x1="16" y1="{y - 8}" x2="656" y2="{y - 8}" stroke="{RULE}" stroke-width="0.8"/>')
    parts.append(t(16, y + 8, "LEGEND", size=8, fill=MUTED, family=MONO, spacing=0.18))
    parts.append(f'<line x1="80" y1="{y + 4}" x2="108" y2="{y + 4}" stroke="{LINK}" stroke-width="1.2" marker-end="url(#al)"/>')
    parts.append(t(116, y + 8, "crosses the host boundary", size=10, fill=MUTED))
    parts.append(f'<line x1="270" y1="{y + 4}" x2="298" y2="{y + 4}" stroke="{MUTED}" stroke-width="1.2" marker-end="url(#a)"/>')
    parts.append(t(306, y + 8, "inside the host", size=10, fill=MUTED))
    parts.append(
        f'<rect x="410" y="{y - 2}" width="14" height="11" rx="2" fill="{ACCENT_TINT}" stroke="{ACCENT}" stroke-width="1"/>'
    )
    parts.append(t(430, y + 8, host["accent_legend"], size=10, fill=MUTED))
    parts.append(t(16, y + 30, "1–3: the replicas an autoscaler may run.", size=10, fill=MUTED))

    svg = f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg">{defs}{"".join(parts)}</svg>'
    return render(name, svg, 1280)


# ---------------------------------------------------------------- charts


def chart(name: str, xs, left, right, *, xmax, lmax, lticks, rmax, xlabel, llabel, rlabel,
          left_label, right_label, target=None, area=True) -> Path:
    """One time chart: a muted series on the left axis, the focal worker count
    (a step line in accent) on the right axis. Direct labels, no legend box."""
    W, H = 640, 300
    x0, x1, y0, y1 = 64, 584, 248, 24

    def X(v):
        return x0 + (x1 - x0) * v / xmax

    def YL(v):
        return y0 - (y0 - y1) * v / lmax

    def YR(v):
        return y0 - (y0 - y1) * v / rmax

    p = [f'<rect width="{W}" height="{H}" fill="{PAPER}"/>']
    for v in lticks:
        p.append(f'<line x1="{x0}" y1="{YL(v)}" x2="{x1}" y2="{YL(v)}" stroke="rgba(45,49,66,0.08)" stroke-width="0.8"/>')
        p.append(t(x0 - 8, YL(v) + 4, str(v), size=10, fill=MUTED, family=MONO, anchor="end"))
    for v in range(0, rmax + 1):
        p.append(t(x1 + 8, YR(v) + 4, str(v), size=10, fill=ACCENT, family=MONO))
    p.append(f'<line x1="{x0}" y1="{y0}" x2="{x1}" y2="{y0}" stroke="rgba(45,49,66,0.35)" stroke-width="1"/>')
    step = 50 if xmax <= 250 else 60
    for v in range(0, int(xmax) + 1, step):
        p.append(t(X(v), y0 + 16, str(v), size=10, fill=MUTED, family=MONO, anchor="middle"))
    p.append(t((x0 + x1) / 2, y0 + 36, xlabel, size=10, fill=MUTED, family=MONO, anchor="middle", spacing=0.06))
    p.append(t(20, (y0 + y1) / 2, llabel, size=10, fill=MUTED, family=MONO, anchor="middle", spacing=0.06,
               extra=f'transform="rotate(-90 20 {(y0 + y1) / 2})"'))
    p.append(t(W - 14, (y0 + y1) / 2, rlabel, size=10, fill=ACCENT, family=MONO, anchor="middle", spacing=0.06,
               extra=f'transform="rotate(90 {W - 14} {(y0 + y1) / 2})"'))

    if target is not None:
        p.append(f'<line x1="{x0}" y1="{YL(target)}" x2="{x1}" y2="{YL(target)}" stroke="{MUTED}" stroke-width="1" stroke-dasharray="5,4"/>')
        lab = f"KEDA target: {target} jobs per worker"
        lw = int(len(lab) * 9 * 0.62 + 8)
        p.append(f'<rect x="{x1 - 28 - lw}" y="{YL(target) + 5}" width="{lw}" height="13" rx="2" fill="{PAPER}"/>')
        p.append(t(x1 - 32, YL(target) + 15, lab, size=9, fill=MUTED, family=MONO, anchor="end", spacing=0.06))

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
    p.append(t(X(lx), YL(ly), LEFT_TEXT[name], size=11, fill=MUTED, weight=500))
    rx, ry = right_label
    p.append(t(X(rx), YR(ry), "worker pods", size=11, fill=ACCENT, weight=600))

    svg = f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg">{"".join(p)}</svg>'
    return render(name, svg, 1280)


LEFT_TEXT = {
    "chart-load-2026-10-20": "jobs in the three turn queues",
    "chart-keda-2026-10-21": "jobs per worker",
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
        xlabel="SECONDS FROM THE START OF SAMPLING", llabel="JOBS WAITING OR RUNNING", rlabel="WORKER PODS",
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
        xlabel="SECONDS FROM THE START OF THE WATCH", llabel="JOBS PER WORKER", rlabel="WORKER PODS",
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


def row(name: str, images: list[Image.Image], width: int = 2400) -> Path:
    """Screenshots side by side at one common height, lettered (a), (b), ...
    Used when the screens have different shapes, so neither is shrunk to a strip."""
    gap, label_h = 36, 56
    framed = [bordered(im) for im in images]
    ratio = sum(im.width / im.height for im in framed)
    h = int((width - gap * (len(framed) - 1)) / ratio)
    sheet = Image.new("RGB", (width, h + label_h), "white")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype(LABEL_FONT, 40)
    x = 0
    for k, im in enumerate(framed):
        w = round(im.width * h / im.height)
        draw.text((x, 4), f"({chr(97 + k)})", fill=(45, 49, 66), font=font)
        sheet.paste(im.resize((w, h), Image.LANCZOS), (x, label_h))
        x += w + gap
    out = OUT / f"{name}.png"
    sheet.save(out)
    return out


def deck_rec(name: str, right: int | None = None) -> Image.Image:
    return cut(autocrop(last_frame(DECK / f"{name}.gif")), right)


def vultr_rec(name: str, right: int | None = None) -> Image.Image:
    return cut(autocrop(last_frame(VULTR / f"{name}.gif")), right)


def web(sec: float, bottom: int = 845) -> Image.Image:
    """A frame of the narrated demo video, cut to the web app: no subtitle band,
    no chapter bar."""
    return video_frame(sec).crop((230, 25, 1690, bottom))


def screens() -> list[Path]:
    made = []
    # Report of 20 October: the build.
    made.append(panels("shot-cluster", [deck_rec("rec-pods-cut"), deck_rec("rec-deploy").crop((0, 0, 1508, 193))], cols=1))
    made.append(panels("shot-ask", [deck_rec("rec-ask", 1100)], cols=1))
    made.append(panels("shot-kill", [deck_rec("rec-kill", 1100)], cols=1))
    made.append(panels("shot-pipeline", [deck_rec("rec-pipeline-cut")], cols=1, width=1500))
    # Report of 27 October: the real model, the Vultr host, the presentation.
    made.append(panels("shot-real-model", [deck_rec("rec-load"), deck_rec("rec-scale-cut")], cols=1))
    publish = video_frame(19).crop((1060, 25, 1690, 660))
    usage = video_frame(139).crop((230, 25, 1570, 610))
    made.append(row("shot-agents", [publish, usage]))
    made.append(panels("shot-session", [web(91)], cols=1, width=1800))
    made.append(panels("shot-vultr", [vultr_rec("keda-1-to-3", 1260)], cols=1))
    slides = [DECK / "preview" / f"slide-{n:02d}.png" for n in (2, 7, 11, 13, 19, 22)]
    made.append(panels("shot-deck", [Image.open(s).convert("RGB") for s in slides], cols=3))
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
