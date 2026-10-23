"""The overview and logical pictures of the deck, redrawn with the motion grammar.

Each motion has one meaning (SWE5006 slides/MOTION.md):
- spotlight: one element lights with every element it relates to; the rest dims to 28%;
- grow: a relationship line grows from its source to its target, and the target pulses once;
- morph: a before picture changes into its after picture (a refactoring, a decision);
- divide: a replica splits out of its box;
- cycle: a wait-for cycle lights and turns, and the fix breaks it;
- a tag that travels along a line is kept for a real message at run time only.

platform.gif     producers and consumers around the platform (key std_platform)
usecases.gif     the UML use case diagram, one actor at a time
decisions.gif    AD-01, AD-02 and AD-04 as three small before and after morphs
contextmap.gif   the DDD context map, one context at a time, Session last
interaction.gif  the seven public API calls, grouped into producer and consumer phases
logical.gif      the component diagram, tier by tier, then one question at run time
queues.gif       AD-03: the wait-for cycle of one shared queue, and how a queue per level breaks it

The facts come from scenes_std_overview.py, scenes_std.py, scenes_std_design.py and
docs/platform/report/report.md. Every picture ends on its complete diagram, nothing lit.
"""
import math

import draw
from draw import BLACK, INK, INK2, INK3, RAISED, RULE, RULE2, Scene, font, lerp, mix, S, X2
from scenes_std import tag

DIM = 0.28                                      # the alpha of an element out of the spotlight


# ---------------------------------------------------------------- drawing helpers
def ink(color, a):
    """A colour faded towards the black page: a = 1 is the colour, a = 0 is invisible."""
    return mix(BLACK, color, a)


def clamp(u):
    return max(0.0, min(1.0, u))


def width(text, size=13, weight="Regular", mono=False):
    return font(size, weight, mono).getlength(text) / (S * X2)


def grow(pts, u):
    """The first fraction u of a polyline: a line that grows from its source."""
    if u >= 1:
        return list(pts)
    segs = list(zip(pts, pts[1:]))
    lens = [math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in segs]
    left = u * sum(lens)
    out = [pts[0]]
    for (a, b), L in zip(segs, lens):
        if left >= L:
            out.append(b)
            left -= L
        else:
            f = left / L if L else 0
            out.append((lerp(a[0], b[0], f), lerp(a[1], b[1], f)))
            break
    return out


def polyline(c, pts, col, pt=1.5, dashed=False):
    if len(pts) < 2:
        return
    if not dashed:
        c.d.line([(c._p(x), c._p(y)) for x, y in pts], fill=col, width=c._lw(pt), joint="curve")
        return
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        L = math.hypot(x2 - x1, y2 - y1)
        k = 0.0
        while k < L:
            e = min(L, k + 0.08)
            c.d.line([(c._p(lerp(x1, x2, k / L)), c._p(lerp(y1, y2, k / L))),
                      (c._p(lerp(x1, x2, e / L)), c._p(lerp(y1, y2, e / L)))], fill=col, width=c._lw(pt))
            k += 0.14


def arrowhead(c, tip, frm, col, open_=False):
    (x2, y2), (x1, y1) = tip, frm
    dx, dy = x2 - x1, y2 - y1
    n = max(1e-6, math.hypot(dx, dy))
    ux, uy = dx / n, dy / n
    L, Wd = (0.13, 0.07) if open_ else (0.1, 0.055)
    a = (x2 - ux * L - uy * Wd, y2 - uy * L + ux * Wd)
    b = (x2 - ux * L + uy * Wd, y2 - uy * L - ux * Wd)
    if open_:
        c.d.line([(c._p(a[0]), c._p(a[1])), (c._p(x2), c._p(y2)), (c._p(b[0]), c._p(b[1]))], fill=col,
                 width=c._lw(1.5), joint="curve")
    else:
        c.d.polygon([(c._p(x2), c._p(y2)), (c._p(a[0]), c._p(a[1])), (c._p(b[0]), c._p(b[1]))], fill=col)


def arrow(c, pts, g=1.0, a=1.0, lit=False, dashed=False, open_=False, head=True):
    """A connector grown to fraction g. Its head rides on the growing tip."""
    if g <= 0 or a <= 0.01:
        return
    part = grow(pts, g)
    col = ink(INK if lit else INK2, a)
    polyline(c, part, col, 2 if lit else 1.5, dashed)
    if head and len(part) >= 2 and math.hypot(part[-1][0] - part[-2][0], part[-1][1] - part[-2][1]) > 0.02:
        arrowhead(c, part[-1], part[-2], col, open_)


def ring(c, x, y, w, h, p, a=1.0, oval=False):
    """The pulse of a target: a ring that leaves its edge and fades, once."""
    if p <= 0 or p >= 1:
        return
    r = 0.04 + 0.08 * p
    box = [c._p(x - r), c._p(y - r), c._p(x + w + r), c._p(y + h + r)]
    col = ink(INK, (1 - p) * a)
    if oval:
        c.d.ellipse(box, outline=col, width=c._lw(1.5))
    else:
        c.d.rectangle(box, outline=col, width=c._lw(1.5))


def cbox(c, x, y, w, h, name, note="", a=1.0, hot=False, mark=True, size=15, pulse=0.0, left=False):
    """A UML component that fades: a box, its component mark, its name and one note."""
    if a <= 0.01:
        return
    edge = ink(INK if hot else INK2, a)
    fill = ink(RAISED, a) if hot else BLACK
    c.d.rectangle([c._p(x), c._p(y), c._p(x + w), c._p(y + h)], fill=fill, outline=edge,
                  width=c._lw(2 if hot else 1.5))
    if mark:
        mx, my = x + w - 0.3, y + 0.1
        c.d.rectangle([c._p(mx), c._p(my), c._p(mx + 0.18), c._p(my + 0.22)], outline=edge, width=c._lw(1))
        for dy in (0.04, 0.12):
            c.d.rectangle([c._p(mx - 0.05), c._p(my + dy), c._p(mx + 0.05), c._p(my + dy + 0.06)], fill=fill,
                          outline=edge, width=c._lw(1))
    if note:
        c.text(x + 0.14, y + 0.08, w - 0.5, 0.32, name, size, "Semibold", ink(INK, a), "left")
        c.text(x + 0.14, y + 0.4, w - 0.2, h - 0.46, note, 13, "Regular", ink(INK2, a), "left")
    elif left:
        c.text(x + 0.14, y, w, h, name, size, "Semibold", ink(INK, a), "left")
    else:
        c.text(x, y, w, h, name, size, "Semibold", ink(INK, a))
    ring(c, x, y, w, h, pulse, a)


def actor(c, x, y, name, a=1.0, hot=False, pulse=0.0):
    """A UML actor: a stick figure, its name under it. (x, y) is the hip."""
    col = ink(INK, a)
    lw = c._lw(2 if hot else 1.5)
    r = 0.11
    c.d.ellipse([c._p(x - r), c._p(y - 0.55), c._p(x + r), c._p(y - 0.55 + 2 * r)], outline=col, width=lw)
    c.d.line([(c._p(x), c._p(y - 0.33)), (c._p(x), c._p(y))], fill=col, width=lw)
    c.d.line([(c._p(x - 0.2), c._p(y - 0.22)), (c._p(x + 0.2), c._p(y - 0.22))], fill=col, width=lw)
    c.d.line([(c._p(x - 0.17), c._p(y + 0.26)), (c._p(x), c._p(y)), (c._p(x + 0.17), c._p(y + 0.26))],
             fill=col, width=lw, joint="curve")
    lines = name.count("\n") + 1
    c.text(x - 1.1, y + 0.3, 2.2, 0.3 * lines, name, 15, "Semibold", col)
    ring(c, x - 0.25, y - 0.6, 0.5, 0.9, pulse, a)


class Look:
    """The spotlight, the growing lines and the pulses of one scene, kept in its state.

    st["a"][key] is an element's alpha, st["g"][key] how far a line has grown,
    st["p"][key] the phase of a target's pulse, st["hot"] the elements drawn lit."""

    def __init__(self, sc, keys):
        self.sc, self.st = sc, sc.st
        self.keys = list(keys)
        self.st.update(a={}, g={}, p={}, hot=set())

    def a(self, k):
        return self.st["a"].get(k, 1.0)

    def g(self, k):
        return self.st["g"].get(k, 0.0)

    def p(self, k):
        return self.st["p"].get(k, 0.0)

    def hot(self, k):
        return k in self.st["hot"]

    def spot(self, keys, seconds=0.5, hot=()):
        """Light keys (all of them when keys is None) and dim the rest."""
        start = {k: self.a(k) for k in self.keys}
        end = {k: 1.0 if keys is None or k in keys else DIM for k in self.keys}
        self.st["hot"] = set(hot)
        self.sc.tween(seconds, lambda u: self.st["a"].update({k: lerp(start[k], end[k], u) for k in self.keys}))

    def grow(self, key, seconds=0.7, pulse=(), also=()):
        """A line grows from its source to its target; then each target pulses once."""
        keys = [key] + list(also)
        self.sc.tween(seconds, lambda u: self.st["g"].update({k: u for k in keys}))
        if pulse:
            self.pulse(pulse)

    def pulse(self, keys, seconds=0.45):
        n = max(1, round(seconds * draw.FPS))
        for i in range(n + 1):
            self.st["p"].update({k: i / n for k in keys})
            self.sc._add(self.sc._draw(), round(1000 / draw.FPS))
        for k in keys:
            self.st["p"][k] = 0.0


def wtag(c, x, y, word, size=13):
    """A turn in a queue: its word, black on a narrow white tag centred on (x, y)."""
    w, h = width(word, size, "Semibold") + 0.12, 0.3
    c.d.rectangle([c._p(x - w / 2), c._p(y - h / 2), c._p(x + w / 2), c._p(y + h / 2)], fill=INK)
    c.text(x - w / 2, y - h / 2, w, h, word, size, "Semibold", BLACK)


def caption(c, x, y, w, line, sub, a=1.0):
    c.text(x, y, w, 0.32, line, 15, "Semibold", ink(INK, a), "left")
    c.text(x, y + 0.36, w, 0.28, sub, 13, "Regular", ink(INK2, a), "left")


# ---------------------------------------------------------------- platform: producers and consumers
def platform():
    PX, PW, PY = 3.05, 4.55, 1.0                # the platform's boundary
    IX, IW = PX + 0.25, PW - 0.5                # the parts inside it
    RX = 9.75                                   # the consumers' column
    LX = PX + PW + 0.12                         # labels right of the boundary start here
    REG = (IX, 1.42, IW, 0.75)
    ENG = (IX, 2.62, IW, 2.0)
    PARTS = [("tree", "call tree"), ("cost", "steps\nand cost"), ("cap", "budget\ncap")]
    bw = (IW - 0.5) / 3
    WATCH, WEB = (RX, 2.65, 2.0, 0.8), (RX, 3.9, 1.15, 0.75)
    AX = IX + IW - 0.95                         # the instructions' connector
    P = dict(pub=[(1.2, 1.75), (IX, 1.75)],
             instr=[(AX, 2.17), (AX, 2.62)],
             ask=[(RX, 2.85), (IX + IW, 2.85)],
             ans=[(IX + IW, 3.2), (RX, 3.2)],
             web=[(RX, 4.1), (IX + IW, 4.1)],
             live=[(IX + IW, 4.4), (RX, 4.4)])
    L = dict(pub=("publish an agent", 1.3, 1.35, 1.7, "left"),
             instr=("the agent's instructions", AX - 2.4, 2.26, 2.0, "right"),
             ask=("ask with an API key", LX, 2.45, 2.2, "left"),
             ans=("answer + findings + cost", LX, 3.32, 2.2, "left"),
             web=("ask, signed in", LX, 3.7, 2.2, "left"),
             live=("the run, live", LX, 4.47, 2.2, "left"))
    KEYS = ["plat", "prod", "reg", "eng", "tree", "cost", "cap", "cons", "watch", "web_app", "people"] + list(P)

    def paint(c, st):
        A, G, Pp, H = lk.a, lk.g, lk.p, lk.hot
        a = A("plat")
        c.d.rectangle([c._p(PX), c._p(PY), c._p(PX + PW), c._p(PY + 3.78)], outline=ink(RULE, a), width=c._lw(1.5))
        c.text(PX + 0.14, PY + 0.06, PW, 0.3, "Lumen platform", 14, "Semibold", ink(INK2, a), "left")
        cbox(c, *REG, "Agent registry", "the agents that producers publish", a=A("reg"), hot=H("reg"),
             pulse=Pp("reg"))
        a = A("eng")
        cbox(c, *ENG, "", a=a, hot=H("eng"), pulse=Pp("eng"))
        c.text(IX + 0.14, ENG[1] + 0.07, IW, 0.32, "Run engine", 15, "Semibold", ink(INK, a), "left")
        c.text(IX + 0.14, ENG[1] + 0.39, IW, 0.28, "the session, worker and billing services", 13, "Regular",
               ink(INK2, a), "left")
        c.text(IX + 0.15, ENG[1] + 0.7, IW, 0.28, "each question runs as", 13, "Regular", ink(INK2, a), "left")
        for i, (k, name) in enumerate(PARTS):
            cbox(c, IX + 0.15 + i * (bw + 0.1), ENG[1] + 1.02, bw, 0.84, name, a=min(a, A(k)), hot=H(k), mark=False,
                 size=14)
        actor(c, 0.75, 1.95, "Producer", a=A("prod"), hot=H("prod"))
        c.text(-0.25, 2.53, 2.0, 0.28, "agent author", 13, "Regular", ink(INK2, A("prod")))
        c.text(RX, 2.25, 2, 0.3, "Consumers", 14, "Semibold", ink(INK2, A("cons")), "left")
        cbox(c, *WATCH, "Literature\nwatch app", a=A("watch"), hot=H("watch"), mark=False, pulse=Pp("watch"))
        cbox(c, *WEB, "Web app", a=A("web_app"), hot=H("web_app"), mark=False, pulse=Pp("web_app"))
        actor(c, 11.5, 4.2, "People", a=A("people"))
        # the line meets the actor at the tip of its arm
        c.line([(RX + 1.15, 3.98), (11.3, 3.98)], color=ink(INK2, min(A("people"), A("web_app"))))
        for k, pts in P.items():
            g = G(k)
            if g <= 0:
                continue
            arrow(c, pts, g, A(k), lit=H(k))
            text, x, y, w, align = L[k]
            c.text(x, y, w, 0.28, text, 13, "Regular", ink(INK if H(k) else INK2, A(k) * clamp(g * 2 - 1)), align)

    sc = Scene("platform.gif", paint, {})
    lk = Look(sc, KEYS)
    sc.step("Producers and consumers around the Lumen platform", 2.4)
    sc.title = "Producers: an agent author publishes agents to the registry"
    lk.spot({"plat", "prod", "reg", "pub"}, hot={"prod", "reg", "pub"})
    lk.grow("pub", 0.8, pulse=["reg"])
    sc.hold(1.8)
    sc.title = "Consumers: an app asks with an API key; people ask in the web app"
    lk.spot({"plat", "cons", "watch", "web_app", "people", "ask", "web", "eng"}, hot={"watch", "web_app", "ask", "web"})
    lk.grow("ask", 0.7, pulse=["eng"])
    lk.grow("web", 0.7, pulse=["eng"])
    sc.hold(1.6)
    sc.title = "The run engine takes the agent's instructions"
    lk.spot({"plat", "eng", "tree", "cost", "cap", "reg", "instr"}, hot={"eng", "instr"})
    lk.grow("instr", 0.6, pulse=["eng"])
    sc.hold(1.0)
    for k, title in (("tree", "Each question runs as a call tree"),
                     ("cost", "Each step is recorded with its cost"),
                     ("cap", "Every step stays under the account's budget cap")):
        sc.title = title
        sc.set(hot={"eng", k})
        sc.hold(1.4)
    sc.title = "The answer, findings and cost go back; people watch the run live"
    lk.spot({"plat", "eng", "tree", "cost", "cap", "cons", "watch", "web_app", "people", "ans", "live"},
            hot={"eng", "ans", "live"})
    lk.grow("ans", 0.7, pulse=["watch"])
    lk.grow("live", 0.7, pulse=["web_app"])
    sc.hold(1.4)
    sc.title = "The Lumen platform between producers and consumers"
    lk.spot(None, 0.6)
    sc.hold(2.0)
    sc.save()


# ---------------------------------------------------------------- usecases: one actor at a time
def oval(c, cx, cy, w, h, ident, name, a=1.0, hot=False, pulse=0.0):
    """A UML use case: an oval with its id and its short name."""
    c.d.ellipse([c._p(cx - w / 2), c._p(cy - h / 2), c._p(cx + w / 2), c._p(cy + h / 2)],
                fill=ink(RAISED, a) if hot else BLACK, outline=ink(INK if hot else INK2, a),
                width=c._lw(2 if hot else 1.5))
    c.text(cx - w / 2, cy - 0.25, w, 0.24, ident, 13, "Regular", ink(INK2, a))
    c.text(cx - w / 2, cy - 0.05, w, 0.28, name, 15, "Semibold", ink(INK, a))
    ring(c, cx - w / 2, cy - h / 2, w, h, pulse, a, oval=True)


def on_oval(cx, cy, w, h, px, py):
    """The point on an oval's edge that faces (px, py)."""
    t = math.atan2((py - cy) / (h / 2), (px - cx) / (w / 2))
    return cx + w / 2 * math.cos(t), cy + h / 2 * math.sin(t)


def usecases():
    BX, BY, BW, BH = 2.25, 1.0, 7.6, 3.75       # the system boundary
    OW, OH = 3.3, 0.625                         # the right column: four ovals, 0.25 apart
    LCX, RCX = BX + 0.3 + OW / 2, BX + BW - 0.3 - OW / 2
    UC = {"UC1": (LCX, 2.15, "Publish an agent"), "UC2": (RCX, 1.73, "Ask a question"),
          "UC3": (RCX, 3.48, "Manage API keys"), "UC4": (RCX, 4.36, "Approve spend over cap"),
          "UC5": (LCX, 3.83, "Read usage"), "UC6": (RCX, 2.61, "Watch the literature")}
    ACT = {"Producer": (1.0, 2.1, "Producer\n(agent author)"), "Operator": (1.0, 4.05, "Operator"),
           "Watch": (11.1, 2.05, "Literature\nwatch app"), "People": (11.1, 3.85, "People in\nthe web app")}
    USES = {"Producer": ["UC1", "UC5"], "Watch": ["UC2", "UC6"], "People": ["UC3", "UC4"], "Operator": ["UC5"]}
    TITLE = {"Producer": "The producer publishes an agent (UC1) and reads usage (UC5)",
             "Watch": "The literature watch app asks (UC2) and watches the literature (UC6)",
             "People": "People in the web app manage API keys (UC3) and approve spend (UC4)",
             "Operator": "The operator reads usage too (UC5)"}
    LINKS = [(n, u) for n in USES for u in USES[n]]
    KEYS = ["box"] + list(UC) + list(ACT) + ["%s-%s" % l for l in LINKS]

    def path(name, u):
        ax, ay, _ = ACT[name]
        sx, sy = ax + (0.2 if ax < BX else -0.2), ay - 0.22    # the tip of the actor's arm
        ux, uy, _ = UC[u]
        return [(sx, sy), on_oval(ux, uy, OW, OH, sx, sy)]

    def paint(c, st):
        A = lk.a
        a = A("box")
        c.d.rectangle([c._p(BX), c._p(BY), c._p(BX + BW), c._p(BY + BH)], outline=ink(INK2, a), width=c._lw(1.5))
        c.text(BX + 0.14, BY + 0.08, BW, 0.3, "Lumen platform", 14, "Semibold", ink(INK2, a), "left")
        for n, u in LINKS:
            k = "%s-%s" % (n, u)
            arrow(c, path(n, u), lk.g(k), A(k), lit=lk.hot(k), head=False)
        for u, (ux, uy, name) in UC.items():
            oval(c, ux, uy, OW, OH, u, name, a=A(u), hot=lk.hot(u), pulse=lk.p(u))
        for n, (ax, ay, label) in ACT.items():
            actor(c, ax, ay, label, a=A(n), hot=lk.hot(n))

    sc = Scene("usecases.gif", paint, {})
    lk = Look(sc, KEYS)
    sc.step("Four actors and the system boundary of the Lumen platform", 2.4)
    for n in ("Producer", "Watch", "People", "Operator"):
        sc.title = TITLE[n]
        links = ["%s-%s" % (n, u) for u in USES[n]]
        lk.spot({"box", n} | set(USES[n]) | set(links), hot={n} | set(links))
        for u, k in zip(USES[n], links):
            lk.grow(k, 0.6, pulse=[u])
            sc.hold(0.5)
        sc.hold(1.3)
    sc.title = "Use case diagram: six use cases and four actors"
    lk.spot(None, 0.6)
    sc.hold(2.0)
    sc.save()


# ---------------------------------------------------------------- decisions: three before and after morphs
def decisions():
    PW = 3.75
    PX = [0.15, 4.2, 8.25]
    CY = 4.12                                   # the captions' line
    CAP = [("AD-01", "Five services, one per module", "one image, an entry point per service"),
           ("AD-02", "A durable queue, not a direct call", "a slow model call never holds a request"),
           ("AD-04", "Only session writes the steps", "a worker that dies loses no step")]
    # AD-01: the slices of main, and the service each one becomes
    SL = [("modules/identity", "identity"), ("modules/projects", "project"), ("modules/session", "session"),
          ("modules/steering", "worker"), ("modules/billing", "billing")]
    CONT = (0.35, 1.7, 3.4, 2.25)
    # AD-02: session, the queue, the workers
    b0 = PX[1]
    SES2 = (b0 + 0.1, 2.35, 0.95, 0.55)
    WKX, WKW, WKH = b0 + 2.85, 0.95, 0.55
    MIDY = 2.62
    QX, QC = b0 + 1.35, 0.3
    FX = b0 + 2.6
    WY = [2.35, 1.55, 3.15]                     # the first worker, then the two that divide out of it
    # AD-04: the worker, the trace, then session between them
    c0 = PX[2]
    WK4 = (c0 + 0.45, 1.45, 1.3, 0.48)
    DB4 = (c0 + 0.45, 3.25, 1.3, 0.65)
    SE4 = (c0 + 1.9, 2.4, 1.2, 0.48)            # close to the other two: no empty corner
    DX = c0 + 1.1                               # the direct line, worker to trace
    SX4 = SE4[0] + SE4[2] / 2
    R1 = [(c0 + 1.75, 1.69), (SX4, 1.69), (SX4, 2.4)]
    R2 = [(SX4, 2.88), (SX4, 3.57), (c0 + 1.75, 3.57)]
    KEYS = ["wk4", "db4", "se4", "r1", "r2"]

    def paint(c, st):
        for x in (4.05, 8.1):
            c.line([(x, 1.0), (x, 4.75)], color=RULE2)
        for k in range(3):
            if st["panel"] > k:
                c.text(PX[k] + 0.1, 1.0, 1, 0.28, CAP[k][0], 13, "Medium", INK2, "left")
            ca = st["cap"][k]
            if ca > 0:
                caption(c, PX[k] + 0.1, CY, PW, CAP[k][1], CAP[k][2], ca)
        # AD-01: the container fades; each slice moves up into a service of its own
        if st["panel"] > 0:
            m = st["m1"]
            a = 1 - clamp(m * 1.6)
            if a > 0.01:
                c.d.rectangle([c._p(CONT[0]), c._p(CONT[1]), c._p(CONT[0] + CONT[2]), c._p(CONT[1] + CONT[3])],
                              outline=ink(INK2, a), width=c._lw(1.5))
                c.text(CONT[0] + 0.14, CONT[1] + 0.05, 3, 0.3, "one process: Lumen", 14, "Semibold", ink(INK2, a),
                       "left")
            for i, (mod, svc) in enumerate(SL):
                u = draw.ease(clamp((m - i * 0.1) / 0.6))
                y = lerp(2.1 + i * 0.36, 1.4 + i * 0.53, u)
                h = lerp(0.3, 0.42, u)
                x = lerp(0.55, 0.35, u)
                w = lerp(3.0, 3.4, u)
                if u < 0.5:
                    c.d.rectangle([c._p(x), c._p(y), c._p(x + w), c._p(y + h)], outline=RULE, width=c._lw(1))
                    c.text(x + 0.14, y, w, h, mod, 13, "Regular", INK2, "left")
                else:
                    cbox(c, x, y, w, h, svc, size=14, hot=st["now1"] == i, left=True)
                    c.text(x, y, w - 0.45, h, mod, 13, "Regular", INK3, "right")
        # AD-02: the direct call breaks; a queue takes its place; the worker divides behind it
        if st["panel"] > 1:
            cbox(c, *SES2, "session", mark=False, size=14, hot=st["hot2"])
            brk = st["brk2"]
            if brk < 1:
                a = 1 - brk
                xa, xb = SES2[0] + SES2[2], WKX
                xm = (xa + xb) / 2
                gap = 0.05 * clamp(brk * 8) + 0.15 * brk
                drop = 0.35 * brk * brk
                polyline(c, [(xa, MIDY), (xm - gap, MIDY + drop)], ink(INK2, a))
                arrow(c, [(xm + gap, MIDY + drop), (xb, MIDY)], a=a)
                c.text(xa, MIDY - 0.34, xb - xa, 0.28, "direct HTTP call", 13, "Regular", ink(INK2, a))
            q = st["q2"]
            if q > 0:
                col = ink(INK2, q)
                c.d.rectangle([c._p(QX), c._p(MIDY - QC / 2), c._p(QX + 3 * QC), c._p(MIDY + QC / 2)], outline=col,
                              width=c._lw(1.5))
                for j in (1, 2):
                    xx = c._p(QX + j * QC)
                    c.d.line([(xx, c._p(MIDY - QC / 2)), (xx, c._p(MIDY + QC / 2))], fill=ink(RULE, q),
                             width=c._lw(1))
                for j in range(st["jobs2"]):
                    x = QX + (2 - j) * QC + 0.07
                    c.d.rectangle([c._p(x), c._p(MIDY - QC / 2 + 0.07), c._p(x + QC - 0.14),
                                   c._p(MIDY + QC / 2 - 0.07)], fill=INK)
                c.text(QX + 1.5 * QC - 1.0, MIDY + 0.25, 2.0, 0.5, "RabbitMQ\nqueue of jobs", 13, "Regular",
                       ink(INK2, q))
                arrow(c, [(SES2[0] + SES2[2], MIDY), (QX, MIDY)], st["g2"])
                if st["g2"] >= 1:
                    ys = [y for y, wa in zip(st["wy"], st["wa"]) if wa > 0.01]
                    cys = [y + WKH / 2 for y in ys]
                    polyline(c, [(QX + 3 * QC, MIDY), (FX, MIDY)], INK2)
                    polyline(c, [(FX, min(cys)), (FX, max(cys))], INK2)
                    for cy in cys:
                        arrow(c, [(FX, cy), (WKX, cy)])
            for i in reversed(range(3)):
                wa = st["wa"][i]
                if wa > 0.01:
                    y, s = st["wy"][i], st["stretch"][i]
                    # A new worker's name shows only once it has left its parent: no stacked labels.
                    la = 1.0 if i == 0 else clamp((wa - 0.6) / 0.4)
                    cbox(c, WKX, y - s / 2, WKW, WKH + s, "", a=wa, mark=False, hot=st["busy2"])
                    c.text(WKX, y - s / 2, WKW, WKH + s, "worker", 14, "Semibold", ink(INK, wa * la))
        # AD-04: the worker's line to the trace breaks and goes through session, the one writer
        if st["panel"] > 2:
            A = lk.a
            cbox(c, *WK4, "worker", a=A("wk4"), mark=False, size=14)
            a = A("db4")
            cbox(c, *DB4, "", a=a, mark=False, hot=lk.hot("db4"), pulse=lk.p("db4"))
            c.text(DB4[0], DB4[1] + 0.06, DB4[2], 0.3, "steps", 14, "Semibold", ink(INK, a))
            c.text(DB4[0], DB4[1] + 0.33, DB4[2], 0.26, "PostgreSQL", 13, "Regular", ink(INK2, a))
            brk = st["brk4"]
            if brk < 1:
                a = 1 - brk
                ya, yb = WK4[1] + WK4[3], DB4[1]
                ym = (ya + yb) / 2
                gap = 0.05 * clamp(brk * 8) + 0.15 * brk
                drift = 0.3 * brk * brk
                polyline(c, [(DX, ya), (DX - drift, ym - gap)], ink(INK2, a))
                arrow(c, [(DX - drift, ym + gap), (DX, yb)], a=a)
                c.text(DX + 0.12, ym - 0.14, 1.5, 0.28, "writes each step", 13, "Regular", ink(INK2, a), "left")
            sa = st["se4"] * A("se4")
            cbox(c, *SE4, "session", a=sa, mark=False, size=14, hot=lk.hot("se4"), pulse=lk.p("se4"))
            arrow(c, R1, lk.g("r1"), A("r1"), lit=lk.hot("r1"))
            arrow(c, R2, lk.g("r2"), A("r2"), lit=lk.hot("r2"))
            if lk.g("r1") > 0:
                c.text(c0 + 1.85, 1.36, 2, 0.28, "sends each step", 13, "Regular",
                       ink(INK2, A("r1") * clamp(lk.g("r1") * 2 - 1)), "left")
            if lk.g("r2") > 0:
                c.text(c0 + 1.85, 3.65, 2, 0.28, "the only writer", 13, "Regular",
                       ink(INK if lk.hot("r2") else INK2, A("r2") * clamp(lk.g("r2") * 2 - 1)), "left")
        for x, y in st["moving"]:
            c.d.rectangle([c._p(x - 0.08), c._p(y - 0.08), c._p(x + 0.08), c._p(y + 0.08)], fill=INK)

    st = dict(panel=0, cap=[0.0, 0.0, 0.0], m1=0.0, now1=None, brk2=0.0, q2=0.0, g2=0.0, jobs2=0, hot2=False,
              wy=list([WY[0]] * 3), wa=[1.0, 0.0, 0.0], stretch=[0.0, 0.0, 0.0], busy2=False, brk4=0.0, se4=0.0,
              moving=[])
    sc = Scene("decisions.gif", paint, st)
    lk = Look(sc, KEYS)

    def show_cap(k):
        sc.tween(0.4, lambda v: st["cap"].__setitem__(k, v))

    # AD-01
    sc.step("AD-01 before: five modules in one Lumen process", 1.8, panel=1)
    sc.title = "AD-01 after: each module becomes a service"
    sc.tween(2.0, lambda v: st.update(m1=v))
    sc.hold(0.6)
    show_cap(0)
    sc.hold(0.8)
    # AD-02
    sc.step("AD-02 before: session calls a worker directly", 1.6, panel=2)
    sc.title = "AD-02 after: a durable queue replaces the direct call"
    sc.tween(0.7, lambda v: st.update(brk2=v))
    sc.tween(0.5, lambda v: st.update(q2=v))
    sc.tween(0.5, lambda v: st.update(g2=v))
    sc.set(hot2=True)
    for j in (1, 2, 3):
        sc.set(jobs2=j)
        sc.hold(0.3)
    sc.set(hot2=False)
    sc.title = "AD-02: more workers can start, and any worker takes the next job"
    for i in (1, 2):
        sc.tween(0.3, lambda v, i=i: st["stretch"].__setitem__(0, 0.3 * v))
        y1 = WY[i]
        sc.tween(0.55, lambda v, i=i, y1=y1: (st["wy"].__setitem__(i, lerp(WY[0], y1, v)),
                                               st["wa"].__setitem__(i, v),
                                               st["stretch"].__setitem__(0, 0.3 * (1 - v))))
    paths = [[(QX + (2.5 - j) * QC, MIDY), (FX, MIDY), (FX, WY[j] + WKH / 2), (WKX - 0.18, WY[j] + WKH / 2)]
             for j in range(3)]
    sc.set(jobs2=0)
    sc.tween(0.8, lambda u: st.update(moving=[draw.along(p, u) for p in paths]))
    sc.set(moving=[], busy2=True)
    sc.hold(0.6)
    sc.set(busy2=False)
    show_cap(1)
    sc.hold(0.8)
    # AD-04
    sc.step("AD-04 before: the worker writes each step to the database", 1.6, panel=3)
    sc.title = "AD-04 after: each step goes through session"
    sc.tween(0.7, lambda v: st.update(brk4=v))
    sc.tween(0.4, lambda v: st.update(se4=v))
    lk.grow("r1", 0.6, pulse=["se4"])
    lk.grow("r2", 0.6, pulse=["db4"])
    sc.hold(0.6)
    sc.title = "AD-04: session is the only writer of the steps"
    lk.spot({"se4", "r2", "db4"}, hot={"se4", "r2"})
    sc.hold(1.4)
    lk.spot(None, 0.4)
    show_cap(2)
    sc.title = "Three key decisions of the logical design"
    sc.hold(1.6)
    sc.save()


# ---------------------------------------------------------------- contextmap: one context at a time
def contextmap():
    STEPS = ["use cases UC1 to UC6", "nouns users say: agent, question, step, budget cap", "5 bounded contexts",
             "their aggregates"]
    LX, LW = 0.24, 2.61
    MX, MW = 4.6, 2.8
    RX, RW = 9.25, 2.67
    CTX = {"Project": (LX, 1.6, LW, 1.7, ["Project, Finding", "Agent registry:", "Agent, QuestionIntent"]),
           "Identity": (LX, 3.95, LW, 0.8, ["Account, ApiKey"]),
           "Session": (MX, 2.1, MW, 2.4, ["Session, the root", "its tree of Tasks", "Step, a value"]),
           "Worker": (RX, 1.6, RW, 1.35, ["the agent loop;", "it keeps no state"]),
           "Billing": (RX, 3.3, RW, 1.45, ["Wallet, LedgerEntry", "Approval"])}
    # the method strip: spread across the map's width, 0.35 above it
    SY0, SH = 0.87, 0.38
    SX0, SX1 = LX, RX + RW
    # the domain events: (name, path from the sender to the receiver, label side, sender, receiver)
    EV = {"asked": ("question asked", [(LX + LW, 2.55), (MX, 2.55)], "above", "Project", "Session"),
          "queued": ("job queued", [(MX + MW, 2.35), (RX, 2.35)], "above", "Session", "Worker"),
          "step": ("step recorded", [(RX, 2.75), (MX + MW, 2.75)], "below", "Worker", "Session"),
          "spend": ("spend recorded", [(MX + MW, 3.6), (RX, 3.6)], "above", "Session", "Billing"),
          "approval": ("approval needed", [(MX + MW, 4.2), (RX, 4.2)], "above", "Session", "Billing"),
          "finding": ("finding recorded", [(MX, 3.1), (LX + LW, 3.1)], "below", "Session", "Project"),
          # Identity is upstream of Projects: it says who asks, with which key.
          "key": ("account, API key", [(LX + 1.0, 3.95), (LX + 1.0, 3.3)], "right", "Identity", "Project")}
    ORDER = [("Project", ["asked", "finding"], "Project sends question asked and receives finding recorded"),
             ("Identity", ["key"], "Identity is upstream: it says who asks, with which API key"),
             ("Worker", ["queued", "step"], "Worker receives job queued and sends step recorded"),
             ("Billing", ["spend", "approval"], "Billing receives spend recorded and approval needed")]
    KEYS = ["strip"] + list(CTX) + list(EV)
    sw = [width(s) + 0.3 for s in STEPS]
    sgap = (SX1 - SX0 - sum(sw)) / (len(STEPS) - 1)

    def paint(c, st):
        A = lk.a
        x, y = SX0, SY0
        sa = A("strip")
        for i, s in enumerate(STEPS):
            if i < st["strip"]:
                on = i == st["strip"] - 1 and st["building"]
                c.d.rectangle([c._p(x), c._p(y), c._p(x + sw[i]), c._p(y + SH)], fill=RAISED if on else BLACK,
                              outline=ink(INK if on else RULE, sa), width=c._lw(2 if on else 1.5))
                c.text(x, y, sw[i], SH, s, 13, "Regular", ink(INK if on else INK2, sa))
                if i:
                    arrow(c, [(x - sgap + 0.08, y + SH / 2), (x, y + SH / 2)], a=sa)
            x += sw[i] + sgap
        for name, (x, y, w, h, lines) in CTX.items():
            if not st["ctx"]:
                continue
            a = A(name)
            core = name == "Session"
            hot = lk.hot(name)
            c.d.rectangle([c._p(x), c._p(y), c._p(x + w), c._p(y + h)], fill=ink(RAISED, a) if hot else BLACK,
                          outline=ink(INK if hot else INK2, a), width=c._lw(2 if (hot or core) else 1.5))
            top = y + 0.1
            if core:
                c.text(x + 0.15, top, w, 0.26, "«core domain»", 13, "Regular", ink(INK2, a), "left")
                top += 0.26
            c.text(x + 0.15, top, w, 0.34, name, 16, "Semibold", ink(INK, a), "left")
            # Session's aggregates sit lower, so its tall box is not empty at the bottom.
            drop = 0.28 if core else 0.0
            for i, ln in enumerate(lines):
                c.text(x + 0.15, top + 0.42 + drop + i * 0.28, w - 0.2, 0.28, ln, 13, "Regular",
                       ink(INK if hot else INK2, a * st["agg"]), "left")
            ring(c, x, y, w, h, lk.p(name), a)
        for k, (name, pts, side, _, _) in EV.items():
            g = lk.g(k)
            if g <= 0:
                continue
            a, on = A(k), lk.hot(k)
            arrow(c, pts, g, a, lit=on)
            la = a * clamp(g * 2 - 1)
            col = ink(INK if on else INK2, la)
            (x1, y1), (x2, _) = pts
            if side == "right":
                c.text(x1 + 0.12, 3.48, 2.5, 0.28, name, 13, "Regular", col, "left")
            else:
                ty = y1 - 0.31 if side == "above" else y1 + 0.03
                c.text((x1 + x2) / 2 - 1.0, ty, 2.0, 0.28, name, 13, "Regular", col)

    st = dict(strip=0, building=True, ctx=False, agg=0.0)
    sc = Scene("contextmap.gif", paint, st)
    lk = Look(sc, KEYS)
    sc.title = "How we found the contexts"
    for i in range(4):
        sc.set(strip=i + 1)
        sc.hold(0.7)
    sc.set(building=False)
    sc.step("Five bounded contexts, each with its own aggregates", 0.3, ctx=True)
    sc.tween(0.5, lambda v: st.update(agg=v))
    sc.hold(1.6)
    for name, evs, title in ORDER:
        sc.title = title
        near = {name} | {EV[e][3] for e in evs} | {EV[e][4] for e in evs}
        lk.spot(near | set(evs), hot={name} | set(evs))
        for e in evs:
            lk.grow(e, 0.7, pulse=[EV[e][4]])
            sc.hold(0.4)
        sc.hold(1.0)
    sc.title = "Session, the core domain: every domain event goes through it"
    lk.spot((set(CTX) - {"Identity"}) | (set(EV) - {"key"}), hot={"Session"} | (set(EV) - {"key"}))
    lk.pulse(["Session"])
    sc.hold(1.8)
    sc.title = "Context map: five bounded contexts and six domain events"
    lk.spot(None, 0.6)
    sc.hold(1.6)
    sc.save()


# ---------------------------------------------------------------- interaction: the public API calls in order
def interaction():
    CON, PLA, PRO = 1.45, 6.05, 10.65
    LANES = [("con", "Consumer app", "literature watch", CON), ("pla", "Lumen platform", "API v1", PLA),
             ("pro", "Producer", "agent author", PRO)]
    HY, HH = 0.92, 0.58
    Y0, DY = 1.85, 0.452
    RET = 0.13                                  # a reply runs this far under its request
    END = 4.76                                  # the lifelines end 0.24 above the edge
    BAR = 0.08
    MSG = [(PRO, "1  POST /api/v1/keys", True), (PRO, "2  POST /api/v1/agents", True),
           (CON, "3  GET /api/v1/agents", True), (CON, "4  POST /api/v1/questions", True),
           (None, "5  runs the agent on the question", False),
           (CON, "6  GET /api/v1/questions/:id", True), (PRO, "7  GET /api/v1/usage", True)]
    TITLES = ["1. A producer creates an API key", "2. The producer publishes an agent",
              "3. A consumer lists the agents", "4. The consumer asks with a chosen agent",
              "5. The platform runs the question", "6. The consumer reads the answer, findings and cost",
              "7. The producer and the operator read usage"]
    PHASES = [("producer", [0, 1], "pro"), ("consumer", [2, 3, 4, 5], "con"), ("producer", [6], "pro")]
    KEYS = ["con", "pla", "pro", "ph0", "ph1", "ph2"] + ["m%d" % i for i in range(7)]

    def ends(i):
        src, _, _ = MSG[i]
        y = Y0 + i * DY
        if src is None:
            return [(PLA + BAR, y - 0.1), (PLA + 0.9, y - 0.1), (PLA + 0.9, y + 0.1), (PLA + BAR, y + 0.1)], None
        dst = PLA - BAR if src < PLA else PLA + BAR
        return [(src, y), (dst, y)], [(dst, y + RET), (src, y + RET)]

    def paint(c, st):
        A = lk.a
        for k, name, note, x in LANES:
            a, hot = A(k), lk.hot(k)
            cbox(c, x - 1.05, HY, 2.1, HH, "", a=a, hot=hot, mark=False)
            c.text(x - 1.05, HY + 0.04, 2.1, 0.3, name, 15, "Semibold", ink(INK, a))
            c.text(x - 1.05, HY + 0.29, 2.1, 0.26, note, 13, "Regular", ink(INK2, a))
            col = ink(INK2 if hot else RULE, a)
            if x == PLA:
                c.d.rectangle([c._p(PLA - BAR), c._p(HY + HH), c._p(PLA + BAR), c._p(END)], fill=BLACK,
                              outline=col, width=c._lw(1.5))
            else:
                polyline(c, [(x, HY + HH), (x, END)], col, dashed=True)
        for p, (name, rows, _) in enumerate(PHASES):
            pa = st["ph"][p] * A("ph%d" % p)
            if pa <= 0.01:
                continue
            top, bot = Y0 + rows[0] * DY - 0.23, Y0 + rows[-1] * DY + RET + 0.02
            col = ink(INK if lk.hot("ph%d" % p) else INK2, pa)
            polyline(c, [(0.37, top), (0.22, top), (0.22, bot), (0.37, bot)], col)
            c.text(0.32, (top + bot) / 2 - 0.14, 1.0, 0.28, name, 13, "Semibold", col, "left")
        for i, (src, label, reply) in enumerate(MSG):
            k = "m%d" % i
            g = lk.g(k)
            if g <= 0:
                continue
            a, on = A(k), lk.hot(k)
            col = ink(INK if on else INK3, a)
            go, ret = ends(i)
            part = grow(go, g)
            polyline(c, part, col, 2 if on else 1.5)
            if math.hypot(part[-1][0] - part[-2][0], part[-1][1] - part[-2][1]) > 0.02:
                arrowhead(c, part[-1], part[-2], col)
            y = go[0][1]
            la = clamp(g * 3)
            lcol = ink(INK if on else INK3, a * la)
            if src is None:
                c.text(PLA + 1.05, y - 0.14, 3.6, 0.28, label, 13, "Regular", lcol, "left")
            else:
                lo, hi = sorted((src, PLA))
                c.text(lo, y - 0.3, hi - lo, 0.28, label, 13, "Regular", lcol)
            r = lk.g("r%d" % i)
            if ret and r > 0:
                part = grow(ret, r)
                polyline(c, part, col, 1.5, dashed=True)
                if r >= 1:
                    arrowhead(c, ret[1], ret[0], col, open_=True)

    st = dict(ph=[0.0, 0.0, 0.0])
    sc = Scene("interaction.gif", paint, st)
    lk = Look(sc, KEYS)
    sc.step("Producers and consumers use one public API", 2.2)
    i = 0
    for p, (name, rows, who) in enumerate(PHASES):
        sc.title = "The %s phase" % name
        lk.spot({who, "pla", "ph%d" % p} | {"m%d" % j for j in rows}, hot={who, "pla", "ph%d" % p})
        sc.tween(0.4, lambda v, p=p: st["ph"].__setitem__(p, v))
        sc.hold(0.5)
        for i in rows:
            sc.title = TITLES[i]
            src = MSG[i][0]
            sc.set(hot=lk.st["hot"] | {"m%d" % i})
            lk.grow("m%d" % i, 1.2 if src is None else 0.6)
            if MSG[i][2]:
                sc.hold(0.25)
                lk.grow("r%d" % i, 0.5)
            sc.hold(1.0)
            sc.set(hot=lk.st["hot"] - {"m%d" % i})
    sc.title = "Sequence diagram: producer and consumer calls on the public API v1"
    lk.spot(None, 0.6)
    sc.hold(2.0)
    sc.save()


# ---------------------------------------------------------------- logical: tier by tier, then one question
def logical():
    TIERS = [("clients", 1.01), ("edge", 1.71), ("services", 2.5), ("data", 3.61)]
    BW, BH = 1.6, 0.75                          # gaps of 0.6 between services: room for an arrow
    SY = 2.5
    SX = [1.35 + i * 2.2 for i in range(5)]
    SVC = [("identity", "Identity", "sign-in, API keys"), ("project", "Project", "projects, registry"),
           ("session", "Session", "the call tree"), ("worker", "Worker", "the agent loop"),
           ("billing", "Billing", "the budget cap")]
    WEB, WATCH = (1.35, 1.0, 2.3, 0.42), (3.9, 1.0, 2.3, 0.42)
    GW = (1.35, 1.72, 10.4, 0.38)
    MQ = (6.5, 3.6, 2.1, 0.42)
    LLM = (8.75, 3.6, 2.05, 0.42)
    PG = (1.35, 4.32, 10.4, 0.42)

    def cx(i):
        return SX[i] + BW / 2

    SB = SY + BH                                # the services' bottom edge
    DEP = {   # the dependencies, from the client to the supplier, tier by tier
        "web_gw": [(WEB[0] + 1.15, WEB[1] + WEB[3]), (WEB[0] + 1.15, GW[1])],
        "watch_gw": [(WATCH[0] + 1.15, WATCH[1] + WATCH[3]), (WATCH[0] + 1.15, GW[1])],
        **{"gw_%s" % SVC[i][0]: [(cx(i), GW[1] + GW[3]), (cx(i), SY)] for i in range(5)},
        "project_session": [(SX[1] + BW, SY + 0.32), (SX[2], SY + 0.32)],
        "worker_session": [(SX[3], SY + 0.55), (SX[2] + BW, SY + 0.55)],
        # One data line leaves a box at its centre; two leave at a quarter and three quarters.
        "identity_pg": [(cx(0), SB), (cx(0), PG[1])],
        "project_pg": [(cx(1), SB), (cx(1), PG[1])],
        "session_pg": [(SX[2] + BW / 4, SB), (SX[2] + BW / 4, PG[1])],
        "billing_pg": [(cx(4), SB), (cx(4), PG[1])],
        "session_mq": [(SX[2] + BW * 3 / 4, SB), (SX[2] + BW * 3 / 4, MQ[1])],
        "worker_mq": [(SX[3] + BW / 4, SB), (SX[3] + BW / 4, MQ[1])],
        "worker_llm": [(SX[3] + BW * 3 / 4, SB), (SX[3] + BW * 3 / 4, LLM[1])],
    }
    TIER_DEPS = [("Clients depend on the API gateway", ["web_gw", "watch_gw"], ["web", "watch", "gw"]),
                 ("The gateway routes to the five services", ["gw_%s" % s[0] for s in SVC],
                  ["gw"] + [s[0] for s in SVC]),
                 ("Project and worker call session's internal routes", ["project_session", "worker_session"],
                  ["project", "session", "worker"]),
                 ("Services depend on PostgreSQL, RabbitMQ and the model",
                  ["identity_pg", "project_pg", "session_pg", "billing_pg", "session_mq", "worker_mq", "worker_llm"],
                  [s[0] for s in SVC] + ["pg", "mq", "llm"])]
    NODES = ["web", "watch", "gw"] + [s[0] for s in SVC] + ["mq", "llm", "pg"]
    KEYS = NODES + list(DEP)

    def paint(c, st):
        A, H, Pp = lk.a, lk.hot, lk.p
        for name, y in TIERS:
            c.text(0.25, y, 1.0, 0.4, name, 13, "Medium", INK3, "left")
        cbox(c, *WEB, "Web app", a=A("web"), hot=H("web"), mark=False, pulse=Pp("web"))
        cbox(c, *WATCH, "Literature watch app", a=A("watch"), hot=H("watch"), mark=False, pulse=Pp("watch"))
        cbox(c, *GW, "API gateway (Traefik)", a=A("gw"), hot=H("gw"), mark=False, left=True, pulse=Pp("gw"))
        for i, (k, name, note) in enumerate(SVC):
            cbox(c, SX[i], SY, BW, BH, name, note, a=A(k), hot=H(k), pulse=Pp(k))
        # The broker, the LLM and the database are not our components: no component mark.
        cbox(c, *MQ, "RabbitMQ", a=A("mq"), hot=H("mq"), mark=False, left=True, pulse=Pp("mq"))
        c.text(MQ[0] + 1.2, MQ[1], 1.0, MQ[3], "AMQP", 13, "Regular", ink(INK2, A("mq")), "left")
        cbox(c, *LLM, "Model", a=A("llm"), hot=H("llm"), mark=False, left=True, pulse=Pp("llm"))
        c.text(LLM[0] + 0.88, LLM[1], 1.1, LLM[3], "external API", 13, "Regular", ink(INK2, A("llm")), "left")
        cbox(c, *PG, "PostgreSQL", a=A("pg"), hot=H("pg"), mark=False, left=True, pulse=Pp("pg"))
        c.text(PG[0] + 1.75, PG[1], 4.0, PG[3], "one database, tables per context", 13, "Regular",
               ink(INK2, A("pg")), "left")
        for k, pts in DEP.items():
            arrow(c, pts, lk.g(k), A(k), lit=H(k), dashed=True, open_=True)
        for x, y, word in st["tags"]:
            tag(c, x, y, word)

    st = dict(tags=[])
    sc = Scene("logical.gif", paint, st)
    lk = Look(sc, KEYS)

    sc.step("Four tiers: clients, the API gateway, five services, the data", 1.6)
    for title, deps, nodes in TIER_DEPS:
        sc.title = title
        lk.spot(set(nodes) | set(deps), 0.4, hot=set(deps))
        sup = sorted({d.split("_")[1] for d in deps})   # a key is client_supplier
        lk.grow(deps[0], 0.7, also=deps[1:], pulse=sup)
        sc.hold(0.8)
    lk.spot(None, 0.4)
    sc.hold(0.8)

    def send(key, word, nodes, seconds=0.8, back=False, dx=0.0):
        """One real message at run time: its tag travels, its components light as it passes.
        dx moves the tag beside its line, so a wide tag does not cover the arrow."""
        pts = [(x + dx, y) for x, y in (DEP[key][::-1] if back else DEP[key])]
        lk.spot(set(nodes) | {key}, 0.3, hot=set(nodes) | {key})
        sc.tween(seconds, lambda u: st.update(tags=[(*draw.along(pts, u), word)]))
        st["tags"] = []

    sc.title = "Run time: the watch app asks a question"
    send("watch_gw", "question", ["watch", "gw"])
    send("gw_project", "question", ["gw", "project"])
    sc.title = "Project passes the question to session"
    send("project_session", "question", ["project", "session"], 0.6)
    sc.title = "Session puts a job on the queue; a free worker takes it"
    send("session_mq", "job", ["session", "mq"], 0.6)
    send("worker_mq", "job", ["mq", "worker"], 0.6, back=True)
    sc.title = "The worker calls the model"
    send("worker_llm", "prompt", ["worker", "llm"], 0.6)
    send("worker_llm", "reply", ["worker", "llm"], 0.6, back=True)
    sc.title = "Each step goes back to session, which saves it"
    send("worker_session", "step", ["worker", "session"], 0.6)
    send("session_pg", "step", ["session", "pg"], 0.6)
    sc.title = "The app reads the answer"
    send("gw_session", "answer", ["session", "gw"], 0.6, back=True, dx=0.5)
    send("watch_gw", "answer", ["gw", "watch"], 0.7, back=True)
    sc.hold(0.6)
    sc.title = "Component diagram: five services behind the Traefik API gateway"
    lk.spot(None, 0.6)
    sc.hold(1.8)
    sc.save()


# ---------------------------------------------------------------- queues: the wait-for cycle and its fix
def queues():
    CELL, QH, N = 0.88, 0.42, 6                 # a cell leaves room on each side of a "reader" tag
    QX = 1.45
    QR = QX + N * CELL
    LY = [2.05, 2.95, 3.85]                     # the rows of level 0, 1 and 2
    SHARED = 1                                  # the one shared queue sits on the row of level 1
    GX, COLW, COLGAP, SLOTW = 7.0, 1.0, 0.15, 0.86
    SEP = 9.4                                   # the line between the queues and the graph
    # the wait-for graph: three nodes and the three edges of the cycle
    NODE = {"lead": (10.65, 1.75), "reader": (11.35, 3.55), "worker": (9.95, 3.55)}
    NW, NH = 0.9, 0.42
    EDGE = {"e1": ("lead", "reader", "waits for"), "e2": ("reader", "worker", "waits for a free worker"),
            "e3": ("worker", "lead", "busy with")}

    def col(j):
        return GX + j * (COLW + COLGAP)

    def cell(i, y):
        """The middle of the i-th cell from the queue's head (its right end)."""
        return QR - (i + 0.5) * CELL, y

    def slot(j, y):
        return col(j) + COLW / 2, y

    def edge_pts(k):
        """An edge of the graph, from border to border of its two boxes."""
        a, b, _ = EDGE[k]
        (x1, y1), (x2, y2) = NODE[a], NODE[b]
        dx, dy = x2 - x1, y2 - y1
        n = math.hypot(dx, dy)
        ux, uy = dx / n, dy / n
        out = min(NW / 2 / max(1e-6, abs(ux)), NH / 2 / max(1e-6, abs(uy)))
        return [(x1 + ux * out, y1 + uy * out), (x2 - ux * out, y2 - uy * out)]

    LABEL = {"e1": (11.1, 2.45, "left"), "e2": (10.65, 3.86, "center"), "e3": (10.22, 2.45, "right")}

    def row_alpha(r, f):
        """Level 1 is there from the start (it is the shared queue); levels 0 and 2 come with the fix."""
        return 1.0 if r == SHARED else clamp(f * 2 - (0.4 if r == 2 else 0.0))

    def paint(c, st):
        f = st["fix"]
        # the left half: the queues and the workers
        hdr = "one shared queue" if f < 0.5 else "a queue per level; each worker runs one job per level"
        c.text(0.3, 1.0, 6, 0.32, hdr, 15, "Semibold", INK, "left")
        for r, y in enumerate(LY):
            a = row_alpha(r, f)
            if a <= 0.01:
                continue
            la = a if r != SHARED else clamp(f * 2)
            c.text(0.2, y - 0.25, QX - 0.3, 0.26, "level %d" % r, 13, "Semibold", ink(INK, la), "right")
            c.text(0.2, y + 0.0, QX - 0.3, 0.26, "lumen.turns.%d" % r, 13, "Regular", ink(INK2, la), "right")
            c.d.rectangle([c._p(QX), c._p(y - QH / 2), c._p(QR), c._p(y + QH / 2)], outline=ink(INK2, a),
                          width=c._lw(1.5))
            for k in range(1, N):
                xx = c._p(QX + k * CELL)
                c.d.line([(xx, c._p(y - QH / 2)), (xx, c._p(y + QH / 2))], fill=ink(RULE, a), width=c._lw(1))
            arrow(c, [(QR, y), (GX, y)], a=a)
            for i, word in enumerate(st["q"][r]):
                if word:
                    wtag(c, *cell(i, y), word)
        # the workers grow from one slot round the shared row to a slot for each level
        top = lerp(LY[SHARED] - 0.53, LY[0] - 0.53, f)
        bottom = lerp(LY[SHARED] + 0.45, LY[2] + 0.45, f)
        for j in range(2):
            x = col(j)
            c.d.rectangle([c._p(x), c._p(top), c._p(x + COLW), c._p(bottom)], outline=INK2, width=c._lw(1.5))
            c.text(x, top + 0.04, COLW, 0.26, "worker %d" % (j + 1), 13, "Semibold", INK)
            for r, y in enumerate(LY):
                a = row_alpha(r, f)
                if a <= 0.01:
                    continue
                sx = x + (COLW - SLOTW) / 2
                c.d.rectangle([c._p(sx), c._p(y - QH / 2), c._p(sx + SLOTW), c._p(y + QH / 2)],
                              outline=ink(RULE, a), width=c._lw(1))
                word = st["slots"][j][r]
                if word and r == 0 and st["done"]:
                    sx0, sy = slot(j, y)
                    wtag(c, sx0 - 0.15, sy, word)
                    c.check(sx0 + 0.2, sy - 0.11, 0.2)
                elif word:
                    wtag(c, *slot(j, y), word)
        if st["count"]:
            c.text(QX, LY[1] + QH / 2 + 0.06, QR - QX, 0.28, st["count"], 13, "Regular", INK, "right")
        if st["finish"]:
            c.invert(QX, 4.36, "all questions finish", 16, h=0.4)
        for x, y, word in st["moving"]:
            wtag(c, x, y, word)
        # the right half: the wait-for graph
        ga = st["graph"]
        if ga > 0:
            c.text(SEP + 0.2, 1.0, 2.4, 0.32, "waits for", 15, "Semibold", ink(INK, ga), "left")
            c.line([(SEP, 1.05), (SEP, 4.75)], color=ink(RULE2, ga))
        lit = st["cycle"]
        for k in EDGE:
            g = lk.g(k)
            if g <= 0:
                continue
            pts = edge_pts(k)
            fall = st["fall"] if k == "e2" else 0.0
            a = 1 - fall
            if a <= 0.01:
                continue
            if fall:
                pts = [(x - 0.1 * fall, y + 0.7 * fall * fall) for x, y in pts]
                pts[0] = (pts[0][0], pts[0][1] + 0.25 * fall)
            on = lit > 0 or lk.hot(k)
            arrow(c, pts, g, a, lit=on)
            lx, ly, align = LABEL[k]
            c.text(lx - (0 if align == "left" else (1.6 if align == "right" else 0.8)), ly + 0.7 * fall * fall, 1.6,
                   0.28, EDGE[k][2], 13, "Regular", ink(INK if on else INK2, a * clamp(g * 2 - 1)), align)
        if lit > 0:
            # the cycle turns: bright dots run round it, lead to reader to slot to lead
            loop = edge_pts("e1") + edge_pts("e2") + edge_pts("e3")
            segs = [(loop[i], loop[i + 1]) for i in range(0, 6, 2)]
            lens = [math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in segs]
            total = sum(lens)
            for n in range(6):
                d = (st["turn"] + n / 6) % 1 * total
                for (p, q), L in zip(segs, lens):
                    if d <= L:
                        x, y = lerp(p[0], q[0], d / L), lerp(p[1], q[1], d / L)
                        c.d.ellipse([c._p(x - 0.05), c._p(y - 0.05), c._p(x + 0.05), c._p(y + 0.05)], fill=INK)
                        break
                    d -= L
        for name, (x, y) in NODE.items():
            if ga <= 0:
                continue
            hot = lk.hot(name)
            cbox(c, x - NW / 2, y - NH / 2, NW, NH, name, a=ga, hot=hot or lit > 0, mark=False, size=14,
                 pulse=lk.p(name))
        if st["deadlock"]:
            c.invert(10.65, 4.3, "deadlock", 16, h=0.4, align="center")

    st = dict(q=[[], [], []], slots=[[None] * 3, [None] * 3], moving=[], fix=0.0, done=False, finish=False,
              count="", graph=0.0, cycle=0.0, turn=0.0, fall=0.0, deadlock=False)
    sc = Scene("queues.gif", paint, st)
    lk = Look(sc, ["lead", "reader", "worker", "e1", "e2", "e3"])

    def glide(moves, seconds=0.7):
        sc.tween(seconds, lambda u: st.update(moving=[(lerp(a[0], b[0], u), lerp(a[1], b[1], u), w)
                                                     for w, a, b in moves]))
        st["moving"] = []

    def arrive(r, words, seconds=0.9):
        q, y = st["q"][r], LY[r]
        start = len(q)
        glide([(w, (QX - 0.5, y), cell(start + k, y)) for k, w in enumerate(words)], seconds)
        q.extend(words)

    def take(r, j):
        """Worker j takes the head of row r's queue into its slot on that row; the queue moves up."""
        q, y = st["q"][r], LY[r]
        word = q.pop(0)
        rest = list(q)
        q[:] = []
        glide([(word, cell(0, y), slot(j, y))] + [(w, cell(i + 1, y), cell(i, y)) for i, w in enumerate(rest)], 0.6)
        st["slots"][j][r] = word
        q.extend(rest)

    S = SHARED
    sc.step("AD-03: one shared queue; two questions start two lead agents", 0.2)
    arrive(S, ["lead", "lead"])
    sc.hold(0.5)
    sc.title = "Each worker runs one job, and each takes a lead"
    take(S, 1)
    take(S, 0)
    sc.hold(0.5)
    sc.title = "Each lead starts three readers and holds its worker while it waits"
    arrive(S, ["reader"] * 6, 1.1)
    sc.hold(0.8)
    sc.title = "Who waits for whom"
    sc.tween(0.4, lambda v: st.update(graph=v))
    for k, title in (("e1", "A lead waits for its readers"), ("e2", "A reader waits for a free worker"),
                     ("e3", "Every worker is busy with a lead")):
        sc.title = title
        a, b, _ = EDGE[k]
        sc.set(hot={a, b, k})
        lk.grow(k, 0.7, pulse=[b])
        sc.hold(1.0)
    sc.set(hot=set())
    sc.title = "The waits close into a cycle, so no question can finish"
    sc.set(cycle=1.0)
    sc.tween(1.8, lambda u: st.update(turn=u * 2))
    sc.set(deadlock=True)
    sc.tween(1.0, lambda u: st.update(turn=u))
    sc.hold(0.4)
    # the fix: the shared queue becomes level 1 in place; levels 0 and 2 and their slots come in,
    # and the leads move up to the level 0 slots
    sc.step("The fix: a queue per level; each worker runs one job per level", 0.2, cycle=0.0, deadlock=False)
    sc.tween(1.2, lambda v: st.update(fix=v))
    leads = [st["slots"][j][S] for j in range(2)]
    for j in range(2):
        st["slots"][j][S] = None
    glide([(leads[j], slot(j, LY[S]), slot(j, LY[0])) for j in range(2)], 0.7)
    for j in range(2):
        st["slots"][j][0] = leads[j]
    sc.hold(0.5)
    sc.title = "A reader no longer waits behind a lead, so the cycle breaks"
    sc.set(hot={"e2"})
    sc.tween(0.9, lambda v: st.update(fall=v))
    sc.set(hot=set())
    sc.hold(0.6)
    for k in range(3):
        sc.title = "The readers run beside the leads"
        take(1, 1)
        take(1, 0)
        sc.set(count="%d of 6 readers done" % (2 * k + 2))
        sc.hold(0.4)
        st["slots"][0][1] = st["slots"][1][1] = None
    sc.hold(0.4)
    sc.step("Level 2 stays empty: readers do not delegate", 1.4)
    sc.title = "With a queue per level, all questions finish"
    sc.set(done=True, count="", finish=True)
    sc.hold(2.0)
    sc.save()


SCENES = dict(std_platform=platform, usecases=usecases, decisions=decisions, contextmap=contextmap,
              interaction=interaction, logical=logical, queues=queues)
