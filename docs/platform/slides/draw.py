"""The drawing library for the deck's animations (README.md, "The look", has the rules).

Everything is crisp: boxes, connectors, queues, bars, marks and words are drawn as solid
shapes at twice the GIF's size and scaled down, so every edge is smooth. The one halftone
thing is an agent, drawn as lumen's landing page draws its sphere.

A scene is a list of steps. Each step sets a title, changes some state, may move a job
along a connector, and holds. A scene module defines functions that take a Scene.

    sc = Scene("services.gif")
    sc.step("1. The gateway sends a question to project", hold=2.5)
    sc.hop("lead", [(1.0, 2.0), (3.0, 2.0)], 0.7)
    sc.save()

The paint function draws the whole picture from `sc.st` (a dict the scene owns) every
frame; the moving jobs are in `sc.moving` and are drawn last.
"""
import os
import shutil
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFont

S = 144                                        # pixels per inch at the size on the slide
X2 = 2                                         # drawn at twice the size, then scaled down
W, H = 12.13, 5.0                              # the GIF's size on the slide, in inches
FPS = 25                                       # 40 ms a frame: a GIF stores whole centiseconds, so the
                                               # picture plays at exactly the clock that script.md cues
TOP = 0.95                                     # the title band; the diagram starts below it
HOLD_FPS = 25                                  # a hold moves as smoothly as a tween
NOW = 0.0                                      # the scene's clock in seconds, for motion that never stops

# lumen's dark palette (apps/web/src/styles/theme.css, .dark)
BLACK = (0, 0, 0)
INK = (255, 255, 255)
INK2 = (0x9A, 0x9D, 0xA3)
INK3 = (0x7C, 0x80, 0x86)
RULE = (0x45, 0x48, 0x4C)
RULE2 = (0x36, 0x39, 0x3D)
WELL = (0x1A, 0x1B, 0x1E)
RAISED = (0x2A, 0x2B, 0x2F)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
EVIDENCE = os.path.join(HERE, "..", "evidence")
FONTS = os.path.join(HERE, "..", "..", "..", "apps", "web", "public", "fonts")
_fonts = {}


def font(pt, weight="Regular", mono=False):
    key = (pt, weight, mono)
    if key not in _fonts:
        path = os.path.join(FONTS, "jetbrains-mono.woff2" if mono else "switzer.woff2")
        f = ImageFont.truetype(path, round(pt / 72 * S * X2))
        if not mono:
            f.set_variation_by_name(weight)
        _fonts[key] = f
    return _fonts[key]


def ease(u):
    """Cubic ease in and out."""
    u = max(0.0, min(1.0, u))
    return 4 * u * u * u if u < 0.5 else 1 - (-2 * u + 2) ** 3 / 2


def lerp(a, b, u):
    return a + (b - a) * u


def along(pts, u):
    """The point at fraction u along a polyline."""
    segs = list(zip(pts, pts[1:]))
    lens = [((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5 for a, b in segs]
    d = u * sum(lens)
    for (a, b), l in zip(segs, lens):
        if d <= l or (a, b) == segs[-1]:
            f = 0 if l == 0 else min(1, d / l)
            return lerp(a[0], b[0], f), lerp(a[1], b[1], f)
        d -= l
    return pts[-1]


def mix(a, b, u):
    u = max(0.0, min(1.0, u))
    return tuple(round(a[i] + (b[i] - a[i]) * u) for i in range(3))


class Canvas:
    """One frame, drawn in inches. All coordinates are inches from the GIF's top left."""

    def __init__(self):
        self.img = Image.new("RGB", (round(W * S * X2), round(H * S * X2)), BLACK)
        self.d = ImageDraw.Draw(self.img)

    def _p(self, v):
        return v * S * X2

    def _lw(self, pt):
        return max(1, round(pt / 72 * S * X2))

    # ---- boxes
    def box(self, x, y, w, h, label="", state="idle", size=15, sub=None):
        """A part. state: idle, active, done, waiting, failed, well, faint."""
        box = [self._p(x), self._p(y), self._p(x + w), self._p(y + h)]
        if state == "well":
            self.d.rectangle(box, fill=WELL)
        elif state == "active":
            self.d.rectangle(box, fill=RAISED, outline=INK, width=self._lw(2))
        elif state == "faint":
            self.d.rectangle(box, outline=RULE2, width=self._lw(1.5))
        else:
            self.d.rectangle(box, outline=RULE, width=self._lw(1.5))
        if label:
            color = INK if state in ("active", "well") else (INK3 if state == "faint" else INK2)
            if state == "done":
                color = INK
            dy = -0.12 if sub else 0
            self.text(x, y + dy, w, h, label, size, "Medium", color)
            if sub:
                self.text(x, y + h / 2 + 0.02, w, 0.32, sub, 13, "Regular", INK3 if state != "active" else INK2)
        if state == "failed":
            self.cross(x + 0.08, y + 0.08, w - 0.16, h - 0.16)

    def well(self, x, y, w, h, label="", size=13):
        self.box(x, y, w, h, state="well")
        if label:
            self.text(x + 0.14, y + 0.08, w - 0.28, 0.3, label, size, "Medium", INK2, "left")

    # ---- lines
    def line(self, pts, active=False, pt=1.5, color=None):
        col = color or (INK if active else RULE)
        self.d.line([(self._p(x), self._p(y)) for x, y in pts], fill=col,
                    width=self._lw(2 if active else pt), joint="curve")

    def flow(self, pts, speed=1.0, gap=0.05, every=0.32):
        """Marching gaps along a lit connector: something is moving along it now."""
        segs = list(zip(pts, pts[1:]))
        total = sum(((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5 for a, b in segs)
        if total < 0.3:
            return
        d = (NOW * speed) % every
        while d < total - 0.12:
            x, y = along(pts, d / total)
            r = gap / 2
            self.d.rectangle([self._p(x - r), self._p(y - r), self._p(x + r), self._p(y + r)], fill=BLACK)
            d += every

    def arrow(self, pts, active=False, color=None):
        """A connector with a 6 pt arrowhead at its last point. A lit one flows."""
        col = color or (INK if active else RULE)
        self.line(pts, active, color=col)
        if active and col == INK:
            self.flow(pts)
        (x1, y1), (x2, y2) = pts[-2], pts[-1]
        dx, dy = x2 - x1, y2 - y1
        n = max(1e-6, (dx * dx + dy * dy) ** 0.5)
        ux, uy = dx / n, dy / n
        L, Wd = 0.1, 0.055
        p2 = (self._p(x2), self._p(y2))
        self.d.polygon([p2,
                        (self._p(x2 - ux * L - uy * Wd), self._p(y2 - uy * L + ux * Wd)),
                        (self._p(x2 - ux * L + uy * Wd), self._p(y2 - uy * L - ux * Wd))], fill=col)

    # ---- work
    def job(self, x, y, kind="lead", hollow=False, color=INK, s=0.2):
        """A job centred on (x, y): a lead's is a square, a reader's a circle."""
        b = [self._p(x - s / 2), self._p(y - s / 2), self._p(x + s / 2), self._p(y + s / 2)]
        if kind == "step":
            # A recorded step: a short flat bar, so it is never taken for a job.
            self.d.rectangle([self._p(x - s * 0.6), self._p(y - s * 0.18), self._p(x + s * 0.6), self._p(y + s * 0.18)],
                             fill=color)
            return
        draw = self.d.ellipse if kind == "reader" else self.d.rectangle
        if hollow:
            draw(b, outline=color, width=self._lw(1.5))
        else:
            draw(b, fill=color)

    def queue(self, x, y, n, items=(), label="", active=False, cell=0.32):
        """A crisp queue of n cells; items fill from the left: 'lead', 'reader' or None."""
        col = INK if active else RULE
        self.d.rectangle([self._p(x), self._p(y), self._p(x + n * cell), self._p(y + cell)],
                         outline=col, width=self._lw(2 if active else 1.5))
        for j in range(1, n):
            xx = self._p(x + j * cell)
            self.d.line([(xx, self._p(y)), (xx, self._p(y + cell))], fill=RULE2, width=self._lw(1))
        for j, it in enumerate(list(items)[:n]):
            if it:
                self.job(x + (j + 0.5) * cell, y + cell / 2, it, s=cell * 0.56)
        if label:
            self.text(x, y - 0.38, n * cell + 1.5, 0.32, label, 14, "Medium", INK if active else INK2, "left")

    # ---- marks
    def check(self, x, y, s=0.26, color=INK):
        pts = [(x, y + s * 0.55), (x + s * 0.38, y + s * 0.9), (x + s, y + s * 0.1)]
        self.d.line([(self._p(a), self._p(b)) for a, b in pts], fill=color, width=self._lw(2.5), joint="curve")

    def cross(self, x, y, w, h, color=INK):
        for a, b in (((x, y), (x + w, y + h)), ((x, y + h), (x + w, y))):
            self.d.line([(self._p(a[0]), self._p(a[1])), (self._p(b[0]), self._p(b[1]))], fill=color,
                        width=self._lw(2.5))

    def invert(self, x, y, text, size=16, pad=0.16, h=0.5, align="left"):
        """A result that matters: black words on a white block. Returns its width."""
        f = font(size, "Semibold")
        tw = f.getlength(text) / (S * X2)
        w = tw + 2 * pad
        if align == "center":
            x -= w / 2
        self.d.rectangle([self._p(x), self._p(y), self._p(x + w), self._p(y + h)], fill=INK)
        self.text(x, y, w, h, text, size, "Semibold", BLACK)
        return w

    def number(self, x, y, w, value, label="", size=32, align="left"):
        if label:
            self.text(x, y, w, 0.3, label, 13, "Medium", INK2, align)
        self.text(x, y + 0.3, w, 0.6, value, size, "Semibold", INK, align)

    def bar(self, x, y, w, h, color=INK2):
        self.d.rectangle([self._p(x), self._p(y), self._p(x + w), self._p(y + h)], fill=color)

    # ---- words
    def text(self, x, y, w, h, s, size=15, weight="Regular", color=INK2, align="center", mono=False):
        f = font(size, weight, mono)
        asc, desc = f.getmetrics()
        lines = s.split("\n")
        lh = asc + desc
        top = self._p(y) + (self._p(h) - lh * len(lines)) / 2
        for i, line in enumerate(lines):
            tw = f.getlength(line)
            if align == "center":
                tx = self._p(x) + (self._p(w) - tw) / 2
            elif align == "right":
                tx = self._p(x + w) - tw
            else:
                tx = self._p(x)
            self.d.text((tx, top + i * lh), line, font=f, fill=color)

    # ---- the one halftone thing
    def sphere(self, x, y, r, bright=1.0, cell=0.07):
        """An agent: a ball lit from the upper left, printed as halftone dots. The light
        drifts round it, so an agent always looks at work."""
        import math
        a = NOW * 0.9 + x * 1.7 + y
        lx, ly = -0.45 + 0.25 * math.cos(a), -0.55 + 0.25 * math.sin(a)
        c = cell
        n = int(r / c) + 1
        for j in range(-n, n + 1):
            for i in range(-n, n + 1):
                px, py = i * c, j * c
                if px * px + py * py > r * r:
                    continue
                nx, ny = px / r, py / r
                nz = max(0.0, 1 - nx * nx - ny * ny) ** 0.5
                light = max(0.08, min(1.0, 0.25 + 0.75 * (lx * nx + ly * ny + 0.7 * nz))) * bright
                rr = c / 2 * light ** 0.5 * 0.95
                cx, cy = x + px, y + py
                self.d.ellipse([self._p(cx - rr), self._p(cy - rr), self._p(cx + rr), self._p(cy + rr)], fill=INK)

    def frame(self):
        return self.img.resize((round(W * S), round(H * S)), Image.LANCZOS)


class Scene:
    """Steps over one picture. paint(c, st) draws the picture from the state."""

    def __init__(self, name, paint, state):
        self.name = name
        self.paint = paint
        self.st = state
        self._title = ""
        self.marks = []                         # (seconds, title): when each step starts, for script.md
        self.moving = []                        # (x, y, kind) drawn on top of the picture
        self.frames, self.durs, self.holds = [], [], []
        self.t = 0.0                            # the scene's clock: every frame moves it on

    @property
    def title(self):
        return self._title

    @title.setter
    def title(self, text):
        # The step's words are not drawn: the slide has one title, in build.js, and the speaker
        # says each step (checklist review, 23 October). The step start is kept for the script.
        self._title = text
        self.marks.append((round(self.t, 1), text))

    def _draw(self):
        global NOW
        NOW = self.t
        c = Canvas()
        self.paint(c, self.st)
        for (x, y, kind) in self.moving:
            c.job(x, y, kind)
        return c.frame()

    def _add(self, img, ms):
        self.t += ms / 1000
        img = img.convert("L")                  # a grey frame is a third of the memory
        if self.frames and img.tobytes() == self.frames[-1].tobytes():
            self.durs[-1] += ms
        else:
            self.frames.append(img)
            self.durs.append(ms)

    def step(self, title, hold=2.6, **changes):
        """A new step: its title, the state changes, then a hold."""
        self.title = title
        self.st.update(changes)
        self.hold(hold)

    def hold(self, seconds):
        """The picture stays, and its icons keep moving."""
        n = max(1, round(seconds * HOLD_FPS))
        for _ in range(n):
            self._add(self._draw(), round(1000 / HOLD_FPS))
        self.holds.append((len(self.frames) - 1, seconds))

    def set(self, **changes):
        self.st.update(changes)

    def tween(self, seconds, fn):
        """Frames for u from 0 to 1 (eased); fn(u) changes the state."""
        n = max(1, round(seconds * FPS))
        for i in range(n + 1):
            fn(ease(i / n))
            self._add(self._draw(), round(1000 / FPS))

    def hop(self, kind, pts, seconds=0.7, also=()):
        """A job moves along a connector; `also` are more (kind, pts) that move with it."""
        paths = [(kind, pts)] + list(also)
        self.tween(seconds, lambda u: setattr(self, "moving", [(*along(p, u), k) for k, p in paths]))
        self.moving = []

    def save(self):
        # The top band (TOP) stays empty: build.js places the picture so that the band sits
        # under the slide title.
        frames = self.frames
        os.makedirs(OUT, exist_ok=True)
        frames[0].save(os.path.join(OUT, self.name), save_all=True, append_images=frames[1:],
                       duration=self.durs, loop=0, disposal=1, optimize=False)
        # Every icon moves in every frame, so the plain GIF is large (17 MB for one scene).
        # gifsicle keeps only what changed between frames, in 32 greys: about a tenth. The GIF
        # plays once and stays on its last frame, the complete diagram, while the speaker talks.
        if shutil.which("gifsicle"):
            subprocess.run(["gifsicle", "-b", "-O3", "--colors", "32", "--no-loopcount", os.path.join(OUT, self.name)],
                           check=True)
        self.frames[0].save(os.path.join(OUT, self.name.replace(".gif", ".png")))
        os.makedirs(os.path.join(OUT, "steps"), exist_ok=True)
        # One still per step, for checking: the frames held 1.5 s or longer.
        for k, i in enumerate(sorted({i for i, sec in self.holds if sec >= 1.5})):
            self.frames[i].save(os.path.join(OUT, "steps", "%s-%02d.png" % (self.name[:-4], k)))
        with open(os.path.join(OUT, "steps", self.name[:-4] + ".txt"), "w") as f:
            for sec, text in self.marks:
                f.write("%5.1f  %s\n" % (sec, text))
            f.write("%5.1f  (end, last frame held)\n" % (sum(self.durs) / 1000))
        print(self.name, len(frames), "frames", round(sum(self.durs) / 1000, 1), "s")
        for sec, text in self.marks:
            print("  %5.1f  %s" % (sec, text))
