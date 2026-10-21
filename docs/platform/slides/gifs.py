"""The animations for the ASS presentation (docs/platform/slides/README.md has the rules).

Drawn the way the interview deck's GIFs are drawn (Canvas, palette and font adapted from
~/Projects/interview-deck/gif/make_gifs.py): a title and a sub line that change at each
step, parts in fixed places, plain squares for work that moves, red for what acts now.

Every number on a picture comes from docs/platform/evidence/.

    python3 docs/platform/slides/gifs.py              # all of them
    python3 docs/platform/slides/gifs.py scale kill   # some of them
"""
import os
import re
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

S = 144                                       # pixels per inch at the size on the slide
W, H = 12.13, 5.0                             # inches: the GIF's size on the slide
INK, RED, GRAY = (0x1A, 0x1D, 0x23), (0xC8, 0x10, 0x2E), (0x5F, 0x66, 0x70)
RULE, EDGE, LIGHT = (0xD5, 0xD8, 0xDD), (0x9A, 0xA0, 0xA8), (0xF2, 0xF3, 0xF5)
SHADE, WHITE, SOFT = (0xE6, 0xE8, 0xEB), (0xFF, 0xFF, 0xFF), (0xA3, 0xA9, 0xB1)
BLUE, GREEN = (0x1F, 0x6F, 0xB5), (0x1E, 0x8A, 0x4C)
FONT = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_B = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
EVIDENCE = os.path.join(HERE, "..", "evidence")
FR = 60                                       # ms per frame while something moves
_fonts = {}


def font(pt, bold=False):
    if (pt, bold) not in _fonts:
        _fonts[(pt, bold)] = ImageFont.truetype(FONT_B if bold else FONT, round(pt / 72 * S))
    return _fonts[(pt, bold)]


def mix(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def ease(u):
    u = max(0.0, min(1.0, u))
    return u * u * (3 - 2 * u)


def lerp(a, b, u):
    return a + (b - a) * u


class Canvas:
    def __init__(self, w=W, h=H):
        self.W, self.H = round(w * S), round(h * S)
        self.frames, self.durs = [], []

    def begin(self):
        self.img = Image.new("RGB", (self.W, self.H), WHITE)
        self.d = ImageDraw.Draw(self.img)

    def end(self, ms):
        # A frame that repeats the one before only lengthens it, so a hold costs no size.
        if self.frames and self.img.tobytes() == self.frames[-1].tobytes():
            self.durs[-1] += ms
        else:
            self.frames.append(self.img)
            self.durs.append(ms)

    def rect(self, x, y, w, h, fill=None, line=None, lw=1.25, r=0):
        box = [x * S, y * S, (x + w) * S, (y + h) * S]
        width = max(1, round(lw / 72 * S)) if line else 0
        if r:
            self.d.rounded_rectangle(box, radius=r * S, fill=fill, outline=line, width=width)
        else:
            self.d.rectangle(box, fill=fill, outline=line, width=width)

    def text(self, x, y, w, h, s, pt=13, bold=False, color=INK, align="center"):
        f = font(pt, bold)
        asc, desc = f.getmetrics()
        lines = s.split("\n")
        lh = asc + desc
        top = y * S + (h * S - lh * len(lines)) / 2
        for i, line in enumerate(lines):
            tw = f.getlength(line)
            tx = x * S + (w * S - tw) / 2 if align == "center" else ((x + w) * S - tw if align == "right" else x * S)
            self.d.text((tx, top + i * lh), line, font=f, fill=color)

    def box(self, x, y, w, h, s="", fill=WHITE, line=EDGE, color=INK, pt=14, bold=True, lw=1.25, r=0.06):
        self.rect(x, y, w, h, fill, line, lw, r)
        if s:
            self.text(x, y, w, h, s, pt, bold, color)

    def line(self, pts, color=RULE, lw=2.0):
        self.d.line([(x * S, y * S) for x, y in pts], fill=color, width=max(1, round(lw / 72 * S)), joint="curve")

    def arrow(self, x1, y1, x2, y2, color=GRAY, lw=2.0):
        p1, p2 = (x1 * S, y1 * S), (x2 * S, y2 * S)
        self.d.line([p1, p2], fill=color, width=max(1, round(lw / 72 * S)))
        dx, dy = p2[0] - p1[0], p2[1] - p1[1]
        n = max(1e-6, (dx * dx + dy * dy) ** 0.5)
        ux, uy = dx / n, dy / n
        L, Wd = 0.12 * S, 0.07 * S
        self.d.polygon([p2, (p2[0] - ux * L - uy * Wd, p2[1] - uy * L + ux * Wd),
                        (p2[0] - ux * L + uy * Wd, p2[1] - uy * L - ux * Wd)], fill=color)

    def square(self, x, y, col=BLUE, s=0.26):
        """A piece of work: a plain square, centred on (x, y)."""
        self.rect(x - s / 2, y - s / 2, s, s, fill=col, line=col)

    def badge(self, x, y, w, s, pt=14):
        self.box(x, y, w, 0.46, s, fill=RED, line=RED, color=WHITE, pt=pt, bold=True, r=0.08)

    def save(self, name):
        # Map pixels to the palette ourselves, so pure white stays pure white on the slide.
        exact = [WHITE, INK, RED, GRAY, RULE, EDGE, LIGHT, SHADE, SOFT, BLUE, GREEN]
        code = lambda a: (a[..., 0].astype(np.int64) << 16) | (a[..., 1].astype(np.int64) << 8) | a[..., 2]
        arrs = [np.asarray(f, dtype=np.uint8) for f in self.frames]
        step = max(1, len(arrs) // 8)
        vals, cnts = np.unique(np.concatenate([code(x).ravel() for x in arrs[::step]]), return_counts=True)
        exact_codes = [(r << 16) | (g << 8) | b for r, g, b in exact]
        order = [int(v) for v in vals[np.argsort(-cnts)] if int(v) not in exact_codes]
        pal_codes = exact_codes + order[: 256 - len(exact_codes)]
        P = np.array([[(v >> 16) & 255, (v >> 8) & 255, v & 255] for v in pal_codes], dtype=np.int64)
        flat = P.astype(np.uint8).ravel().tolist() + [0] * (768 - 3 * len(pal_codes))
        out = []
        for x in arrs:
            u, inv = np.unique(code(x).ravel(), return_inverse=True)
            U = np.stack([(u >> 16) & 255, (u >> 8) & 255, u & 255], axis=1)
            near = ((U[:, None, :] - P[None, :, :]) ** 2).sum(-1).argmin(1).astype(np.uint8)
            im = Image.fromarray(near[inv].reshape(x.shape[:2]), mode="P")
            im.putpalette(flat)
            out.append(im)
        os.makedirs(OUT, exist_ok=True)
        out[0].save(os.path.join(OUT, name), save_all=True, append_images=out[1:], duration=self.durs,
                    loop=0, disposal=1, optimize=False)
        # The first frame as a still, for the speaker notes and for checking.
        self.frames[0].save(os.path.join(OUT, name.replace(".gif", ".png")))
        # One still per step, for checking by eye.
        os.makedirs(os.path.join(OUT, "steps"), exist_ok=True)
        holds = [i for i, d in enumerate(self.durs) if d >= 700]
        for k, i in enumerate(holds):
            self.frames[i].save(os.path.join(OUT, "steps", "%s-%02d.png" % (name[:-4], k)))
        print(name, len(out), "frames", round(sum(self.durs) / 1000, 1), "s")


class Scene:
    """A canvas plus a title and a sub line; snap() draws one frame, move() draws a tween."""

    def __init__(self, paint):
        self.c = Canvas()
        self.paint = paint
        self.title, self.sub = "", ""

    def say(self, title, sub=""):
        self.title, self.sub = title, sub

    def snap(self, ms):
        c = self.c
        c.begin()
        c.text(0.1, 0.05, W - 0.2, 0.5, self.title, 20, True, INK, "left")
        if self.sub:
            c.text(0.1, 0.55, W - 0.2, 0.38, self.sub, 14, False, GRAY, "left")
        self.paint(c)
        c.end(ms)

    def move(self, ms, step):
        n = max(1, round(ms / FR))
        for i in range(n + 1):
            step(ease(i / n))
            self.snap(FR)


def along(pts, u):
    """The point at fraction u of a polyline."""
    segs = list(zip(pts, pts[1:]))
    lens = [abs(b[0] - a[0]) + abs(b[1] - a[1]) for a, b in segs]
    d = u * sum(lens)
    for (a, b), l in zip(segs, lens):
        if d <= l or (a, b) == segs[-1]:
            f = 0 if l == 0 else min(1, d / l)
            return lerp(a[0], b[0], f), lerp(a[1], b[1], f)
        d -= l


# ============================================================ 1. the problem
def problem():
    """One chat thread: one question at a time, early messages fall out, the bill comes later."""
    st = dict(msgs=[], gone=0, cost=False, team=0.0)
    X, Y0, MW, MH = 0.6, 1.25, 4.6, 0.36

    def paint(c):
        c.box(X - 0.2, 1.05, MW + 0.4, 3.7, fill=LIGHT, line=LIGHT)
        if not st["gone"]:
            c.text(X - 0.1, 1.1, 3, 0.3, "one chat window", 12, True, GRAY, "left")
        shown = st["msgs"][-8:]
        top = 0.45 if st["gone"] else 0.2
        for i, (who, s) in enumerate(shown[-7:] if st["gone"] else shown):
            y = Y0 + top + i * 0.4
            you = who == "you"
            c.box(X + (1.2 if you else 0), y, MW - 1.2, MH, s, fill=INK if you else WHITE, line=INK if you else EDGE,
                  color=WHITE if you else INK, pt=12, bold=False)
        if st["gone"]:
            c.badge(X + 0.4, 1.0, 3.8, "the first messages are gone", 13)
        if st["cost"]:
            c.box(6.2, 1.6, 2.4, 1.4, "cost\n?", fill=WHITE, line=EDGE, pt=22)
        k = st["team"]
        if k > 0:
            col = mix(WHITE, RED, k)
            c.box(9.2, 1.6, 2.6, 0.7, "lead agent", fill=col, line=col, color=WHITE, pt=15)
            for j in range(3):
                c.box(9.2 + j * 0.9, 2.75, 0.8, 0.6, "reader", fill=mix(WHITE, INK, k), line=mix(WHITE, INK, k),
                      color=WHITE, pt=11)
                c.line([(10.5, 2.3), (9.6 + j * 0.9, 2.75)], mix(WHITE, GRAY, k), 2)
            c.text(9.2, 3.5, 2.6, 0.35, "work in parallel", 13, True, mix(WHITE, GRAY, k))

    sc = Scene(paint)
    sc.say("How a researcher uses an AI model today", "One chat window, one model, one thing at a time.")
    st.update(msgs=[("you", "part 5 of my question"), ("ai", "answer 5")] + [("you", "and what about ...?"), ("ai", "...")] * 3,
              gone=1, cost=True, team=0.0)
    sc.snap(2200)
    st.update(msgs=[], gone=0, cost=False)
    sc.say("1. One question at a time", "Five parts of a question need five rounds.")
    for q in range(1, 6):
        st["msgs"].append(("you", "part %d of my question" % q))
        sc.snap(330)
        st["msgs"].append(("ai", "answer %d" % q))
        sc.snap(330)
    sc.snap(900)
    sc.say("2. A long talk: the first messages fall out", "The window is full, and nobody tells you what was lost.")
    for q in range(6, 9):
        st["msgs"].append(("you", "and what about ...?"))
        st["msgs"].append(("ai", "..."))
        sc.snap(380)
    st["gone"] = 1
    sc.snap(1800)
    sc.say("3. And the cost is unknown until the bill arrives", "")
    st["cost"] = True
    sc.snap(1800)
    sc.say("Lumen: give the question to a team of agents", "A lead agent splits it, and readers work on the parts at the same time.")
    sc.move(700, lambda u: st.update(team=u))
    sc.snap(2600)
    sc.say("How a researcher uses an AI model today", "One chat window, one model, one thing at a time.")
    st.update(msgs=[("you", "part 5 of my question"), ("ai", "answer 5")] + [("you", "and what about ...?"), ("ai", "...")] * 3,
              gone=1, cost=True, team=0.0)
    sc.snap(1200)
    sc.c.save("problem.gif")


# ============================================================ 2. a question becomes a tree
def tree():
    """The question, the lead, three readers; every step recorded with its cost."""
    st = dict(lead=False, readers=0, steps=[0, 0, 0, 0], sq=[], cost=0.0, found=0, lit=set(), answer=False)
    Q = (0.4, 2.2, 2.2, 0.9)
    LEAD = (3.6, 2.2, 2.2, 0.9)
    R = [(7.0, 1.15), (7.0, 2.35), (7.0, 3.55)]

    def paint(c):
        hot = st["lit"]
        c.box(*Q, "your question", fill=RED if "q" in hot else WHITE, line=RED if "q" in hot else EDGE,
              color=WHITE if "q" in hot else INK, pt=15)
        if st["lead"]:
            c.box(*LEAD, "lead agent", fill=RED if "lead" in hot else WHITE, line=RED if "lead" in hot else INK,
                  color=WHITE if "lead" in hot else INK, pt=15, lw=2)
            c.line([(2.6, 2.65), (3.6, 2.65)], RULE, 2.5)
        for i in range(st["readers"]):
            x, y = R[i]
            on = ("r%d" % i) in hot
            c.line([(5.8, 2.65), (6.4, 2.65), (6.4, y + 0.35), (7.0, y + 0.35)], RULE, 2.5)
            c.box(x, y, 1.6, 0.7, "reader %d" % (i + 1), fill=RED if on else WHITE, line=RED if on else INK,
                  color=WHITE if on else INK, pt=13, lw=2)
            for j in range(st["steps"][i + 1]):
                c.rect(8.75 + j * 0.3, y + 0.2, 0.22, 0.3, fill=INK, line=INK)
        for j in range(st["steps"][0]):
            c.rect(3.65 + j * 0.3, 3.25, 0.22, 0.3, fill=INK, line=INK)
        if st["steps"][0]:
            c.text(3.6, 3.6, 2.2, 0.3, "steps", 12, True, GRAY, "left")
        if st["readers"]:
            c.text(8.75, 0.85, 2.0, 0.3, "steps", 12, True, GRAY, "left")
        # the meter: cost against the account's cap
        c.text(10.55, 1.15, 1.5, 0.3, "cost", 12, True, GRAY)
        c.box(10.55, 1.5, 1.5, 0.7, "$%.2f" % st["cost"], fill=WHITE, line=EDGE, pt=18)
        c.text(10.55, 2.25, 1.5, 0.3, "cap $1.00", 12, False, GRAY)
        if st["found"]:
            c.text(10.55, 2.9, 1.5, 0.3, "findings", 12, True, GRAY)
            for j in range(st["found"]):
                c.rect(10.7 + j * 0.42, 3.25, 0.32, 0.32, fill=RED, line=RED)
        if st["answer"]:
            c.badge(0.4, 3.45, 2.2, "answer", 14)
        for (x, y, col) in st["sq"]:
            c.square(x, y, col)

    sc = Scene(paint)
    sc.say("A real question on our server", "Every box is an agent. Every small square is a step it took.")
    st.update(lead=True, readers=3, steps=[2, 3, 3, 2], cost=0.03, found=3, answer=True)
    sc.snap(2000)
    st.update(lead=False, readers=0, steps=[0, 0, 0, 0], cost=0.0, found=0, answer=False)
    sc.say("1. You ask a question", "")
    st["lit"] = {"q"}
    sc.snap(800)
    sc.move(700, lambda u: st.update(sq=[(lerp(2.6, 3.6, u), 2.65, BLUE)]))
    st.update(sq=[], lead=True, lit={"lead"})
    sc.say("2. A lead agent plans, and splits the work", "")
    for k in (1, 2):
        st["steps"][0] = k
        st["cost"] += 0.005
        sc.snap(450)
    sc.say("3. Three readers work at the same time", "Each one reads, runs commands and writes notes.")
    st["readers"] = 3
    sc.move(800, lambda u: st.update(sq=[(*along([(5.8, 2.65), (6.4, 2.65), (6.4, y + 0.35), (7.0, y + 0.35)], u), BLUE)
                                           for (_, y) in R]))
    st.update(sq=[], lit={"r0", "r1", "r2"})
    for k in range(1, 4):
        for i in range(3):
            st["steps"][i + 1] = k if i != 2 or k < 3 else 2
        st["cost"] += 0.004
        sc.snap(420)
    sc.say("4. Every step is recorded, with what it cost", "The cost adds up against the account's cap.")
    sc.snap(1600)
    sc.say("5. The findings and the answer come back", "")
    st["lit"] = {"lead"}
    for i in range(3):
        st["found"] = i + 1
        sc.snap(350)
    st["cost"] = 0.03
    st.update(answer=True, lit={"q"})
    sc.snap(2400)
    st["lit"] = set()
    sc.say("A real question on our server", "Every box is an agent. Every small square is a step it took.")
    sc.snap(1400)
    sc.c.save("tree.gif")


# ============================================================ 3. a platform: producers and consumers
def platform():
    """Producers publish agents; consumers pick one with an API key; the platform runs and bills it."""
    st = dict(agents=0, keyed=False, lit=set(), sq=[], run=0, watch=False)
    PLAT = (4.3, 1.1, 3.6, 3.7)

    def paint(c):
        hot = st["lit"]
        # producers
        c.text(0.3, 1.05, 3.2, 0.35, "producers", 14, True, GRAY, "left")
        c.box(0.3, 1.5, 3.0, 0.8, "agent author", fill=RED if "author" in hot else WHITE,
              line=RED if "author" in hot else EDGE, color=WHITE if "author" in hot else INK, pt=14)
        # the platform
        c.box(*PLAT, fill=LIGHT, line=LIGHT)
        c.text(4.45, 1.15, 3.3, 0.35, "Lumen platform", 15, True, INK, "left")
        c.box(4.5, 1.6, 3.2, 1.25, fill=WHITE, line=RED if "registry" in hot else EDGE, lw=2.5 if "registry" in hot else 1.25)
        c.text(4.6, 1.63, 3.0, 0.3, "agent registry", 12, True, GRAY, "left")
        for j in range(st["agents"]):
            c.box(4.65 + j * 1.0, 2.05, 0.9, 0.6, ["scout", "review", "math"][j], fill=INK, line=INK, color=WHITE, pt=11)
        c.box(4.5, 3.05, 3.2, 1.5, fill=WHITE, line=RED if "run" in hot else EDGE, lw=2.5 if "run" in hot else 1.25)
        c.text(4.6, 3.08, 3.0, 0.3, "runs it: steps, cost, cap", 12, True, GRAY, "left")
        for j in range(st["run"]):
            c.rect(4.7 + j * 0.3, 3.65, 0.22, 0.3, fill=INK, line=INK)
        # consumers
        c.text(8.8, 1.05, 3.2, 0.35, "consumers", 14, True, GRAY, "left")
        c.box(8.8, 1.5, 3.0, 0.8, "web app", fill=RED if "web" in hot else WHITE, line=RED if "web" in hot else EDGE,
              color=WHITE if "web" in hot else INK, pt=14)
        if st["watch"]:
            c.box(8.8, 2.6, 3.0, 0.8, "literature watch app", fill=RED if "watch" in hot else WHITE,
                  line=RED if "watch" in hot else EDGE, color=WHITE if "watch" in hot else INK, pt=14)
        if st["keyed"]:
            c.box(8.8, 3.7, 3.0, 0.6, "API key", fill=WHITE, line=INK, pt=13, lw=2)
            c.text(8.8, 4.35, 3.0, 0.3, "what this app may do", 11, False, GRAY)
        for (x, y, col) in st["sq"]:
            c.square(x, y, col)

    sc = Scene(paint)
    sc.say("Three roles around one platform", "Producers bring agents. Consumers use them. The platform runs them.")
    st.update(agents=3, keyed=True, watch=True, run=6)
    sc.snap(2200)
    st.update(agents=0, keyed=False, watch=False, run=0)
    sc.say("1. A producer publishes an agent", "An agent is a set of instructions for the lead: how to work on a kind of question.")
    st["lit"] = {"author"}
    sc.move(900, lambda u: st.update(sq=[(lerp(3.3, 4.9, u), 1.9 + 0.45 * u, RED)]))
    st.update(sq=[], agents=1, lit={"registry"})
    sc.snap(900)
    st["agents"] = 3
    st["lit"] = set()
    sc.snap(700)
    sc.say("2. A consumer asks a question and picks an agent", "An app gets an API key. The key says what the app may do.")
    st.update(keyed=True, watch=True, lit={"watch"})
    sc.snap(900)
    sc.move(900, lambda u: st.update(sq=[(lerp(8.8, 7.7, u), lerp(3.0, 2.35, u), BLUE)]))
    st.update(sq=[], lit={"registry"})
    sc.snap(500)
    sc.say("3. The platform runs it, records every step and bills it", "")
    st["lit"] = {"run"}
    for k in range(1, 7):
        st["run"] = k
        sc.snap(300)
    sc.move(800, lambda u: st.update(sq=[(lerp(7.7, 8.8, u), lerp(3.8, 3.0, u), INK)]))
    st.update(sq=[], lit={"watch"})
    sc.say("4. The second app needs no database, no model and no billing", "It is about 210 lines: the platform does the rest.")
    sc.snap(2600)
    st["lit"] = set()
    sc.say("Three roles around one platform", "Producers bring agents. Consumers use them. The platform runs them.")
    sc.snap(1400)
    sc.c.save("platform.gif")


# ============================================================ 4. the services and one question through them
def services():
    """Five services behind one gateway; the work goes through a queue to the workers."""
    SVC = {"identity": (3.3, 1.2), "project": (3.3, 2.15), "session": (3.3, 3.1), "billing": (3.3, 4.05)}
    st = dict(lit=set(), sq=[], workers=1, queue=0, labels=False)
    QX, QY = 6.15, 3.15
    WK = [(9.0, 1.6), (9.0, 2.55), (9.0, 3.5), (9.0, 4.45)]

    def paint(c):
        hot = st["lit"]
        c.box(0.3, 2.45, 1.3, 0.9, "browser\nor app", fill=WHITE, line=EDGE, pt=13)
        c.box(1.85, 1.2, 1.15, 3.55, "gateway", fill=RED if "gw" in hot else INK, line=RED if "gw" in hot else INK,
              color=WHITE, pt=13)
        c.line([(1.6, 2.9), (1.85, 2.9)], RULE, 2.5)
        for name, (x, y) in SVC.items():
            on = name in hot
            c.line([(3.0, y + 0.35), (x, y + 0.35)], RULE, 2)
            c.box(x, y, 2.0, 0.7, name, fill=RED if on else WHITE, line=RED if on else EDGE,
                  color=WHITE if on else INK, pt=14)
        # the queue: a waiting line of work
        c.text(QX, QY - 0.45, 2.3, 0.3, "queue", 13, True, RED if "q" in hot else GRAY, "left")
        c.box(QX, QY, 2.3, 0.6, fill=WHITE, line=RED if "q" in hot else EDGE, r=0.3, lw=2 if "q" in hot else 1.25)
        for j in range(5):
            on = j < st["queue"]
            c.rect(QX + 0.15 + j * 0.42, QY + 0.14, 0.32, 0.32, fill=BLUE if on else WHITE, line=EDGE)
        c.line([(5.3, 3.45), (QX, 3.45)], RULE, 2)
        # the workers
        c.text(9.0, 1.15, 2.6, 0.35, "workers", 13, True, GRAY, "left")
        for i in range(st["workers"]):
            x, y = WK[i]
            on = ("w%d" % i) in hot
            c.box(x, y, 2.0, 0.65, "worker", fill=RED if on else WHITE, line=RED if on else INK,
                  color=WHITE if on else INK, pt=13, lw=2)
        c.line([(QX + 2.3, 3.45), (9.0, 1.9)], RULE, 2)
        # the database every service shares
        c.box(5.75, 4.3, 2.0, 0.55, "database", fill=SHADE, line=SHADE, pt=12)
        for (x, y, col) in st["sq"]:
            c.square(x, y, col)

    sc = Scene(paint)
    sc.say("Behind one gateway", "Each service is its own program, and each can run as many copies as it needs.")
    sc.snap(2400)
    sc.say("1. A question arrives at the gateway", "The gateway sends each address to the service that owns it.")
    st["lit"] = {"gw"}
    sc.move(600, lambda u: st.update(sq=[(lerp(1.6, 2.45, u), 2.9, BLUE)]))
    sc.say("2. The project service opens a session", "")
    st["lit"] = {"project"}
    sc.move(700, lambda u: st.update(sq=[(*along([(2.45, 2.9), (2.45, 2.5), (3.3, 2.5)], u), BLUE)]))
    st["sq"] = []
    sc.snap(500)
    st["lit"] = {"session"}
    sc.move(500, lambda u: st.update(sq=[(4.3, lerp(2.85, 3.1, u), BLUE)]))
    st["sq"] = []
    sc.say("3. Session puts the work in a queue", "The queue is a waiting line. Session does not do the work itself.")
    st["lit"] = {"session", "q"}
    sc.move(600, lambda u: st.update(sq=[(lerp(5.3, QX, u), 3.45, BLUE)]))
    st.update(sq=[], queue=1)
    sc.snap(700)
    sc.say("4. A worker takes it from the queue and does it", "")
    st["lit"] = {"q", "w0"}
    st["queue"] = 0
    sc.move(700, lambda u: st.update(sq=[(lerp(QX + 2.3, 9.0, u), lerp(3.45, 1.9, u), BLUE)]))
    st["sq"] = []
    sc.snap(900)
    sc.say("5. Every step goes back to session, and on to the screen", "The person watches the work happen.")
    st["lit"] = {"w0", "session"}
    for _ in range(3):
        sc.move(450, lambda u: st.update(sq=[(*along([(9.0, 1.95), (7.0, 2.6), (5.3, 3.3)], u), INK)]))
        sc.move(400, lambda u: st.update(sq=[(*along([(3.3, 3.45), (2.45, 3.45), (2.45, 2.9), (1.6, 2.9)], u), INK)]))
    st["sq"] = []
    sc.say("6. More work waiting? More workers", "The queue's length decides how many workers run.")
    st["lit"] = {"q"}
    for k in range(1, 6):
        st["queue"] = k
        sc.snap(220)
    for n in (2, 3, 4):
        st["workers"] = n
        st["lit"] = {"q", "w%d" % (n - 1)}
        sc.snap(450)
    for k in range(4, -1, -1):
        st["queue"] = k
        sc.snap(200)
    st.update(lit=set(), workers=1)
    sc.say("Behind one gateway", "Each service is its own program, and each can run as many copies as it needs.")
    sc.snap(1400)
    sc.c.save("services.gif")


# ============================================================ 5. why one queue per depth
def depth():
    """With one queue, waiting leads hold every worker; with one queue per level, work drains."""
    st = dict(mode="one", slots=[None, None], q0=[], q1=[], stuck=False, done=0, sq=[])

    def slot(c, x, y, s, label):
        c.box(x, y, 1.7, 0.8, "", fill=WHITE, line=INK, lw=2)
        c.text(x, y + 0.03, 1.7, 0.25, label, 11, True, GRAY)
        if s:
            col = {"lead": RED, "lead waits": SOFT, "reader": BLUE}[s]
            c.box(x + 0.15, y + 0.3, 1.4, 0.42, s, fill=col, line=col, color=WHITE, pt=12)

    def queue(c, x, y, items, label, wide=3.6):
        c.text(x, y - 0.38, wide, 0.3, label, 13, True, GRAY, "left")
        c.box(x, y, wide, 0.6, fill=WHITE, line=EDGE, r=0.3)
        for j, it in enumerate(items[:7]):
            c.rect(x + 0.18 + j * 0.47, y + 0.14, 0.34, 0.32, fill=BLUE if it == "r" else INK, line=EDGE)

    def paint(c):
        if st["mode"] == "one":
            queue(c, 0.6, 2.2, st["q0"], "one queue")
            c.text(5.2, 1.4, 5, 0.3, "two workers", 13, True, GRAY, "left")
            slot(c, 5.2, 1.8, st["slots"][0], "worker 1")
            slot(c, 7.2, 1.8, st["slots"][1], "worker 2")
            if st["stuck"]:
                c.badge(5.2, 3.0, 3.7, "stuck: the readers never start", 14)
        else:
            queue(c, 0.6, 1.7, st["q0"], "queue for leads")
            queue(c, 0.6, 3.3, st["q1"], "queue for readers")
            slot(c, 5.2, 1.6, st["slots"][0], "lead slot")
            slot(c, 5.2, 3.2, st["slots"][1], "reader slot")
            c.text(9.3, 2.2, 2.6, 0.3, "questions done", 13, True, GRAY)
            c.box(9.8, 2.6, 1.6, 0.8, str(st["done"]), fill=WHITE, line=EDGE, pt=24)
        for (x, y, col) in st["sq"]:
            c.square(x, y, col)

    sc = Scene(paint)
    sc.say("One queue for each level of the tree", "Why: a lead waits for its readers, and a waiting lead keeps its worker busy.")
    st.update(mode="split", done=3)
    sc.snap(2200)
    st.update(mode="one", done=0)
    sc.say("1. With one queue: two leads take both workers", "")
    st["q0"] = ["l", "l"]
    sc.snap(700)
    st["q0"] = ["l"]
    st["slots"][0] = "lead"
    sc.snap(500)
    st["q0"] = []
    st["slots"][1] = "lead"
    sc.snap(700)
    sc.say("2. Both leads ask for readers, and wait", "Their readers go into the same queue, and no worker is free to take them.")
    st["slots"] = ["lead waits", "lead waits"]
    for k in range(1, 7):
        st["q0"] = ["r"] * k
        sc.snap(220)
    st["stuck"] = True
    sc.snap(2600)
    sc.say("3. Our fix: one queue for each level of the tree", "Leads take lead slots. Readers have slots of their own.")
    st.update(mode="split", slots=[None, None], q0=["l", "l", "l"], q1=[], stuck=False)
    sc.snap(1500)
    sc.say("4. A lead waits; its readers still run", "The deepest level never waits for anything, so the work always drains.")
    for n in range(3):
        st["q0"] = st["q0"][1:]
        st["slots"][0] = "lead waits"
        st["q1"] = ["r", "r", "r"]
        sc.snap(400)
        for _ in range(3):
            st["q1"] = st["q1"][1:]
            st["slots"][1] = "reader"
            sc.snap(260)
        st["slots"] = [None, None]
        st["done"] += 1
        sc.snap(400)
    sc.snap(1600)
    st.update(mode="split", slots=[None, None], q0=[], q1=[], done=3)
    sc.say("One queue for each level of the tree", "Why: a lead waits for its readers, and a waiting lead keeps its worker busy.")
    sc.snap(1200)
    sc.c.save("depth.gif")


# ============================================================ 6. where it runs
def hosting():
    """One server in Singapore, Kubernetes on it, HTTPS in front, deploys from GitHub."""
    st = dict(k8s=0.0, pods=0, tls=False, gh=False, sq=[], lit=set())
    PODS = ["identity", "project", "session", "billing", "worker", "worker", "PostgreSQL", "RabbitMQ"]

    def paint(c):
        hot = st["lit"]
        c.box(3.1, 1.05, 8.8, 3.85, fill=LIGHT, line=LIGHT)
        c.text(3.25, 1.1, 8, 0.35, "AWS, Singapore  ·  one server (t3.medium: 2 CPUs, 4 GB)", 13, True, GRAY, "left")
        k = st["k8s"]
        if k > 0:
            c.box(3.4, 1.55, 8.2, 3.1, fill=WHITE, line=mix(LIGHT, INK, k), lw=2)
            c.text(3.55, 1.6, 6, 0.32, "Kubernetes (k3s)", 13, True, mix(WHITE, INK, k), "left")
        for j in range(st["pods"]):
            x, y = 3.65 + (j % 4) * 2.0, 2.1 + (j // 4) * 1.15
            store = PODS[j] in ("PostgreSQL", "RabbitMQ")
            c.box(x, y, 1.8, 0.85, PODS[j], fill=SHADE if store else WHITE, line=SHADE if store else EDGE, pt=13)
        # the internet side
        c.box(0.3, 2.35, 2.1, 0.9, "you, in a\nbrowser", fill=WHITE, line=EDGE, pt=13)
        if st["tls"]:
            c.box(2.45, 2.45, 0.9, 0.7, "HTTPS", fill=RED if "tls" in hot else INK, line=RED if "tls" in hot else INK,
                  color=WHITE, pt=12)
        if st["gh"]:
            c.box(0.3, 3.85, 2.1, 0.9, "GitHub", fill=RED if "gh" in hot else WHITE, line=RED if "gh" in hot else EDGE,
                  color=WHITE if "gh" in hot else INK, pt=14)
        for (x, y, col) in st["sq"]:
            c.square(x, y, col)

    sc = Scene(paint)
    sc.say("Where it runs", "One public address that anyone can open.")
    st.update(k8s=1.0, pods=8, tls=True, gh=True)
    sc.snap(2200)
    st.update(k8s=0.0, pods=0, tls=False, gh=False)
    sc.say("1. One small server in AWS, in Singapore", "About 1.3 US dollars a day, and off at night.")
    sc.snap(1600)
    sc.say("2. Kubernetes runs every service on it", "It restarts what fails and adds copies when load grows.")
    sc.move(500, lambda u: st.update(k8s=u))
    for j in range(1, 9):
        st["pods"] = j
        sc.snap(230)
    sc.snap(800)
    sc.say("3. HTTPS in front, with a free certificate", "The certificate comes from Let's Encrypt and renews itself.")
    st.update(tls=True, lit={"tls"})
    sc.move(700, lambda u: st.update(sq=[(lerp(2.4, 3.65, u), 2.8, BLUE)]))
    st["sq"] = []
    sc.snap(1000)
    sc.say("4. A push to GitHub deploys a new version", "Tested and scanned first; then copied to the server and rolled out.")
    st.update(gh=True, lit={"gh"})
    sc.move(1000, lambda u: st.update(sq=[(*along([(2.4, 4.3), (3.0, 4.3), (3.0, 4.8), (11.0, 4.8)], u), INK)]))
    st["sq"] = []
    sc.snap(1600)
    st["lit"] = set()
    sc.say("Where it runs", "One public address that anyone can open.")
    sc.snap(1400)
    sc.c.save("hosting.gif")


# ============================================================ 7. the load test, from the recorded run
def _scaling_samples():
    """(seconds, workers, waiting jobs) every 10 s, from the run on 20 October."""
    path = os.path.join(EVIDENCE, "2026-10-20-load-and-scaling.md")
    out, t0 = [], None
    for line in open(path):
        m = re.match(r"(\d\d):(\d\d):(\d\d) workers=(\d+)/(\d+) queues=(.*)", line.strip())
        if not m:
            continue
        hh, mm, ss, ready, want, qs = m.groups()
        t = int(hh) * 3600 + int(mm) * 60 + int(ss)
        t0 = t if t0 is None else t0
        jobs = sum(int(x.split(":")[1]) for x in qs.split() if x.count(":") == 2)
        out.append((t - t0, int(want), jobs))
    return out


def _k6():
    text = open(os.path.join(EVIDENCE, "2026-10-20-load-and-scaling.md")).read()
    q = re.search(r"questions (\d+), at rest (\d+)", text).groups()
    med, p95 = re.search(r"median ([\d.]+) s, p95 ([\d.]+) s", text).groups()
    req, failed = re.search(r"http requests (\d+), failed ([\d.]+) %", text).groups()
    return dict(questions=int(q[0]), rest=int(q[1]), median=med, p95=p95, requests=int(req), failed=failed)


def scale():
    data = _scaling_samples()
    k6 = _k6()
    # The times of the story, read from the recording itself.
    t_up = next(t for t, w, _ in data if w > 1)
    t_four = next(t for t, w, _ in data if w == 4)
    t_end = max(t for t, _, j in data if j > 0)
    t_back = next(t for t, w, _ in data if t > t_end and w == 1)
    data = [d for d in data if d[0] <= t_back + 20]
    T = data[-1][0]
    st = dict(t=0.0, badge=None)
    X0, X1, YB, YT = 0.4, 8.3, 4.6, 1.95
    JMAX = max(j for _, _, j in data) + 4

    def at(t):
        """Workers and jobs at time t, stepping between samples as the recording did."""
        cur = data[0]
        for s in data:
            if s[0] <= t:
                cur = s
        return cur

    def paint(c):
        t = st["t"]
        c.line([(X0, YB), (X1, YB)], EDGE, 1.5)
        c.text(X0, YB + 0.05, 2, 0.3, "0 s", 11, False, GRAY, "left")
        c.text(X1 - 2, YB + 0.05, 2, 0.3, "%d s" % T, 11, False, GRAY, "right")
        c.text(X0, YT - 0.32, 4, 0.3, "jobs waiting in the queue", 13, True, BLUE, "left")
        # jobs waiting: one bar per sample so far
        bw = (X1 - X0) / len(data)
        for i, (ts, wk, jobs) in enumerate(data):
            if ts > t:
                break
            h = (YB - YT) * jobs / JMAX
            c.rect(X0 + i * bw + 0.06, YB - h, bw - 0.12, h, fill=BLUE, line=BLUE)
        # the workers now: one box per running copy
        _, wk, jobs = at(t)
        c.text(8.9, 1.45, 3.0, 0.3, "workers running", 13, True, RED, "left")
        for i in range(4):
            on = i < wk
            c.box(8.9 + i * 0.75, 1.85, 0.62, 0.62, "", fill=RED if on else WHITE, line=RED if on else RULE)
        c.text(8.9, 2.65, 2.9, 0.6, "%d of 4" % wk, 24, True, INK, "left")
        if st["badge"]:
            c.badge(*st["badge"])

    sc = Scene(paint)
    result = (X0, 1.0, 6.8, "%d questions · median %s s · %s %% failed" % (k6["questions"], k6["median"], k6["failed"].rstrip("0").rstrip(".") or "0"), 15)
    sc.say("A real load test on the public server", "Recorded on 20 October: 10 users ask questions as fast as they can.")
    st.update(t=T, badge=result)
    sc.snap(2400)
    st.update(t=0.0, badge=None)
    marks = [(0, "1. The load starts", "Each user asks, waits for the answer, and asks again."),
             (t_up - 20, "2. Jobs pile up in the queue", "One worker cannot keep up."),
             (t_up, "3. KEDA adds workers: 1, 2, 3, 4", "KEDA watches the queue and starts more copies of the worker."),
             (t_four + 10, "4. Four workers keep up", ""),
             (t_end, "5. The load ends, and the workers go back to 1", "")]
    t = 0.0
    while t <= T:
        cur = [m for m in marks if m[0] <= t][-1]
        sc.say(cur[1], cur[2])
        st["t"] = t
        sc.snap(FR)
        t += 1.0
    st["badge"] = (X0, 1.0, 6.8, "%d questions · median %s s · %s %% failed" % (k6["questions"], k6["median"], k6["failed"].rstrip("0").rstrip(".") or "0"), 15)
    sc.say("Result", "Every question was answered. 1,040 requests, none failed.")
    sc.snap(3200)
    sc.say("A real load test on the public server", "Recorded on 20 October: 10 users ask questions as fast as they can.")
    sc.snap(1200)
    sc.c.save("scale.gif")


# ============================================================ 8. a worker dies during a question
def kill():
    """The hard-kill test: the jobs go back to the queue and a new worker finishes the question."""
    st = dict(a="alive", b=False, held=3, queue=0, bheld=0, sq=[], done=False)
    QX, QY = 0.8, 2.3

    def paint(c):
        c.text(QX, QY - 0.42, 3, 0.3, "queue", 13, True, GRAY, "left")
        c.box(QX, QY, 3.2, 0.62, fill=WHITE, line=EDGE, r=0.3)
        for j in range(st["queue"]):
            c.rect(QX + 0.2 + j * 0.48, QY + 0.15, 0.32, 0.32, fill=BLUE, line=BLUE)
        # worker A
        dead = st["a"] == "dead"
        c.box(5.0, 1.4, 2.6, 1.0, "", fill=LIGHT if dead else WHITE, line=SOFT if dead else INK, lw=2)
        c.text(5.0, 1.45, 2.6, 0.32, "worker A", 14, True, SOFT if dead else INK)
        for j in range(st["held"]):
            c.rect(5.35 + j * 0.65, 1.88, 0.32, 0.32, fill=BLUE, line=BLUE)
        if dead:
            c.line([(5.0, 1.4), (7.6, 2.4)], RED, 4)
            c.line([(5.0, 2.4), (7.6, 1.4)], RED, 4)
        # worker B
        if st["b"]:
            c.box(5.0, 3.1, 2.6, 1.0, "", fill=WHITE, line=INK, lw=2)
            c.text(5.0, 3.15, 2.6, 0.32, "worker B (new)", 14, True, INK)
            for j in range(st["bheld"]):
                c.rect(5.35 + j * 0.65, 3.58, 0.32, 0.32, fill=INK, line=INK)
        c.text(8.6, 1.4, 3.2, 0.3, "the question", 13, True, GRAY)
        c.box(8.6, 1.8, 3.2, 0.8, "ended" if st["done"] else "running", fill=RED if st["done"] else WHITE,
              line=RED if st["done"] else EDGE, color=WHITE if st["done"] else INK, pt=18)
        if st["done"]:
            c.text(8.6, 2.75, 3.2, 0.35, "12.6 s after it was asked", 13, True, INK)
        for (x, y, col) in st["sq"]:
            c.square(x, y, col, 0.32)

    sc = Scene(paint)
    sc.say("What if a worker dies in the middle of a question?", "We tested it on the public server.")
    sc.snap(2000)
    sc.say("1. Worker A is working on three jobs", "A job leaves the queue for good only when its worker says it is done.")
    sc.snap(1600)
    sc.say("2. We kill worker A", "kubectl delete pod --force: no time to finish anything.")
    st["a"] = "dead"
    sc.snap(1400)
    sc.say("3. Its three jobs go back to the queue", "")
    st["held"] = 0
    sc.move(800, lambda u: st.update(sq=[(lerp(5.5 + j * 0.65, QX + 0.36 + j * 0.48, u), lerp(2.04, QY + 0.31, u), BLUE) for j in range(3)]))
    st.update(sq=[], queue=3)
    sc.snap(800)
    sc.say("4. Kubernetes starts worker B, and it takes them", "")
    st["b"] = True
    sc.snap(600)
    for j in range(3):
        st["queue"] -= 1
        sc.move(350, lambda u, j=j: st.update(sq=[(lerp(QX + 0.36 + st["queue"] * 0.48, 5.5 + j * 0.65, u), lerp(QY + 0.31, 3.74, u), BLUE)]))
        st.update(sq=[], bheld=j + 1)
    sc.snap(700)
    sc.say("5. The question still ends", "The cost of a kill: the three jobs ran twice. We will fix that next.")
    st["done"] = True
    sc.snap(3000)
    st.update(a="alive", b=False, held=3, queue=0, bheld=0, done=False)
    sc.say("What if a worker dies in the middle of a question?", "We tested it on the public server.")
    sc.snap(1200)
    sc.c.save("kill.gif")


# ============================================================ 9. the pipeline
def pipeline():
    """Every push: test, check dependencies, scan code, scan the image, deploy, attack, load."""
    STAGES = ["tests", "libraries", "code scan", "image scan", "deploy", "attack test", "small load"]
    st = dict(state=["idle"] * 7, sq=None, run="", badge=None)

    def paint(c):
        c.box(0.3, 2.2, 1.3, 0.9, "a push", fill=WHITE, line=EDGE, pt=14)
        for i, name in enumerate(STAGES):
            x = 1.95 + i * 1.42
            s = st["state"][i]
            fill = {"idle": WHITE, "run": WHITE, "ok": INK, "fail": RED, "skip": LIGHT}[s]
            line = {"idle": EDGE, "run": RED, "ok": INK, "fail": RED, "skip": LIGHT}[s]
            color = {"idle": INK, "run": INK, "ok": WHITE, "fail": WHITE, "skip": SOFT}[s]
            c.box(x, 2.2, 1.3, 0.9, name, fill=fill, line=line, color=color, pt=13, lw=2.5 if s == "run" else 1.25)
            if i == 4:
                c.text(x, 3.15, 1.3, 0.3, "to the server", 11, False, GRAY)
        if st["run"]:
            c.text(0.3, 1.35, 6, 0.4, st["run"], 15, True, GRAY, "left")
        if st["sq"]:
            c.square(*st["sq"], 0.3)
        if st["badge"]:
            c.badge(*st["badge"])

    sc = Scene(paint)
    sc.say("From a push to the server", "Nothing reaches the server unless the checks before it pass.")
    sc.snap(2200)

    def run(fail_at=None):
        st["state"] = ["idle"] * 7
        for i in range(7):
            x = 1.95 + i * 1.42
            sc.move(260, lambda u: st.update(sq=(lerp(x - 0.35, x + 0.65, u), 2.65, BLUE)))
            st["sq"] = None
            st["state"][i] = "run"
            sc.snap(380)
            if i == fail_at:
                st["state"][i] = "fail"
                for k in range(i + 1, 7):
                    st["state"][k] = "skip"
                return
            st["state"][i] = "ok"
            sc.snap(160)

    sc.say("Run 1: the image scan finds critical security issues", "Five, in programs the image did not need.")
    st["run"] = "run 1"
    run(fail_at=3)
    st["badge"] = (5.5, 3.45, 3.9, "5 critical issues: deploy stopped", 14)
    sc.snap(2600)
    sc.say("The fix: a smaller image, updated when it is built", "We removed Docker from it. The workers did not need it.")
    st.update(state=["idle"] * 7, badge=None, run="")
    sc.snap(2000)
    sc.say("Run 2: every check passes, and the new version is live", "12.5 minutes from push to a tested public server.")
    st["run"] = "run 2"
    run()
    sc.snap(2600)
    st.update(state=["idle"] * 7, run="")
    sc.say("From a push to the server", "Nothing reaches the server unless the checks before it pass.")
    sc.snap(1200)
    sc.c.save("pipeline.gif")


# ============================================================ 10. what an API key may do
def keys():
    """A key works only on the public API, only for its scopes, and only so fast."""
    st = dict(results=[], sq=None, count=0, limited=False)
    ROWS = [("ask a question", "201", INK), ("read the answer", "200", INK), ("open the web app's pages", "403  refused", RED)]

    def paint(c):
        c.box(0.4, 1.6, 2.6, 1.6, "", fill=WHITE, line=INK, lw=2)
        c.text(0.4, 1.68, 2.6, 0.35, "API key", 15, True, INK)
        for j, s in enumerate(("questions: read, write", "agents: read")):
            c.text(0.55, 2.15 + j * 0.38, 2.4, 0.3, s, 12, False, GRAY, "left")
        for i, (what, code, col) in enumerate(ROWS):
            y = 1.35 + i * 0.85
            c.box(4.0, y, 3.4, 0.62, what, fill=WHITE, line=EDGE, pt=13)
            if i < len(st["results"]):
                c.box(7.7, y, 1.9, 0.62, code, fill=col, line=col, color=WHITE, pt=13)
        if st["count"]:
            y = 4.1
            c.text(4.0, y - 0.38, 6, 0.3, "many requests at once", 13, True, GRAY, "left")
            for j in range(min(st["count"], 24)):
                over = j >= 21
                c.rect(4.0 + j * 0.3, y, 0.22, 0.34, fill=RED if over else INK, line=RED if over else INK)
            if st["limited"]:
                c.box(4.0 + 21 * 0.3 - 0.05, y + 0.45, 1.7, 0.42, "429  slow down", fill=RED, line=RED, color=WHITE, pt=12)
        if st["sq"]:
            c.square(*st["sq"], 0.28)

    sc = Scene(paint)
    sc.say("An app gets a key, not a password", "The key says what the app may do. It is shown once, and stored only as a hash.")
    sc.snap(2200)
    sc.say("1. Within its scopes, the key works", "")
    for i in range(3):
        y = 1.35 + i * 0.85 + 0.31
        if i == 2:
            sc.say("2. Outside the public API, it is refused", "A key can never act as a signed-in person on the web app.")
        sc.move(450, lambda u, y=y: st.update(sq=(lerp(3.0, 4.0, u), y, BLUE)))
        st["sq"] = None
        st["results"].append(i)
        sc.snap(900 if i < 2 else 1800)
    sc.say("3. Too fast, and it is told to slow down", "Each key may send 60 requests a minute, 20 at once.")
    for k in range(1, 25):
        st["count"] = k
        st["limited"] = k > 21
        sc.snap(110)
    sc.snap(2600)
    st.update(results=[], count=0, limited=False)
    sc.say("An app gets a key, not a password", "The key says what the app may do. It is shown once, and stored only as a hash.")
    sc.snap(1200)
    sc.c.save("keys.gif")


ALL = dict(problem=problem, tree=tree, platform=platform, services=services, depth=depth, hosting=hosting,
           scale=scale, kill=kill, pipeline=pipeline, keys=keys)

if __name__ == "__main__":
    for name in (sys.argv[1:] or ALL):
        ALL[name]()
