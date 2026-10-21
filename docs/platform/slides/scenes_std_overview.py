"""The overview pictures of the redesigned deck, in standard notation.

platform.png    who uses the platform and how (slide 1b)
usecases.png    a UML use case diagram of UC1 to UC6 (slide 1c)
decisions.png   AD-01, AD-02 and AD-04 as three small diagrams (slide 3a)
contextmap.png  a DDD context map with the domain events (slide 3c)
interaction.gif the seven calls of report 3.1.4, as a sequence diagram (slide 3c)

Every fact comes from docs/platform/report/report.md (sections 1.4.1, 3.1.1 and 3.1.4)
or docs/platform/evidence/2026-10-20-public-api-flow.md.
"""
import math
import os

import draw
from draw import BLACK, INK, INK2, INK3, RAISED, RULE, RULE2, Canvas, Scene, font, S, X2
from scenes_std import comp, tag


# ---------------------------------------------------------------- shared drawing
def width(text, size=13, weight="Regular"):
    """The width of one line of text, in inches."""
    return font(size, weight).getlength(text) / (S * X2)


def dashed(c, pts, color=RULE, pt=1.5, dash=0.08, gap=0.06):
    """A dashed polyline: a reply in a sequence diagram, or a lifeline."""
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        n = max(1e-6, math.hypot(x2 - x1, y2 - y1))
        d = 0.0
        while d < n:
            e = min(n, d + dash)
            c.line([(x1 + (x2 - x1) * d / n, y1 + (y2 - y1) * d / n),
                    (x1 + (x2 - x1) * e / n, y1 + (y2 - y1) * e / n)], color=color, pt=pt)
            d = e + gap


def head(c, x1, y1, x2, y2, color=INK):
    """An arrowhead at (x2, y2), pointing from (x1, y1)."""
    dx, dy = x2 - x1, y2 - y1
    n = max(1e-6, math.hypot(dx, dy))
    ux, uy = dx / n, dy / n
    L, Wd = 0.1, 0.055
    c.d.polygon([(c._p(x2), c._p(y2)),
                 (c._p(x2 - ux * L - uy * Wd), c._p(y2 - uy * L + ux * Wd)),
                 (c._p(x2 - ux * L + uy * Wd), c._p(y2 - uy * L - ux * Wd))], fill=color)


def actor(c, x, y, name, color=INK):
    """A UML actor: a stick figure, its name under it. (x, y) is the hip."""
    lw = c._lw(1.5)
    r = 0.11
    c.d.ellipse([c._p(x - r), c._p(y - 0.55), c._p(x + r), c._p(y - 0.55 + 2 * r)], outline=color, width=lw)
    c.d.line([(c._p(x), c._p(y - 0.33)), (c._p(x), c._p(y))], fill=color, width=lw)
    c.d.line([(c._p(x - 0.2), c._p(y - 0.22)), (c._p(x + 0.2), c._p(y - 0.22))], fill=color, width=lw)
    c.d.line([(c._p(x - 0.17), c._p(y + 0.26)), (c._p(x), c._p(y)), (c._p(x + 0.17), c._p(y + 0.26))],
             fill=color, width=lw, joint="curve")
    c.text(x - 1.0, y + 0.3, 2.0, 0.3, name, 15, "Semibold", color)


def oval(c, cx, cy, w, h, ident, name):
    """A UML use case: an oval with its id and its short name."""
    c.d.ellipse([c._p(cx - w / 2), c._p(cy - h / 2), c._p(cx + w / 2), c._p(cy + h / 2)], fill=BLACK,
                outline=INK2, width=c._lw(1.5))
    c.text(cx - w / 2, cy - 0.27, w, 0.26, ident, 13, "Regular", INK2)
    c.text(cx - w / 2, cy - 0.03, w, 0.3, name, 15, "Semibold", INK)


def on_oval(cx, cy, w, h, px, py):
    """The point on an oval's edge that faces (px, py)."""
    a = math.atan2((py - cy) / (h / 2), (px - cx) / (w / 2))
    return cx + w / 2 * math.cos(a), cy + h / 2 * math.sin(a)


def frame(c, x, y, w, h, name="", color=RULE):
    """A thin boundary with its name small in the top left corner."""
    c.d.rectangle([c._p(x), c._p(y), c._p(x + w), c._p(y + h)], outline=color, width=c._lw(1.5))
    if name:
        c.text(x + 0.14, y + 0.08, w, 0.3, name, 14, "Semibold", INK2, "left")


def save(c, name):
    c.frame().save(os.path.join(draw.OUT, name))
    print(name)


# ---------------------------------------------------------------- slide 1b: platform thinking
def platform():
    c = Canvas()
    PX, PW = 3.05, 4.55                         # the platform's boundary
    IX, IW = PX + 0.25, PW - 0.5                # the parts inside it
    RX = 10.0                                   # the consumers' column

    # the platform: the registry, and the seed under it
    frame(c, PX, 0.2, PW, 4.6, "Lumen platform")
    comp(c, IX, 0.7, IW, 0.85, "Agent registry", "the agents that producers publish")
    comp(c, IX, 2.05, IW, 2.5, "", lit=True)
    c.text(IX + 0.14, 2.15, IW, 0.32, "Run engine: the seed", 15, "Semibold", INK, "left")
    c.text(IX + 0.14, 2.47, IW, 0.28, "the session, worker and billing services", 13, "Regular", INK2, "left")
    parts = ["task tree", "steps\nand cost", "budget cap"]
    bw = (IW - 0.5) / 3
    for i, p in enumerate(parts):
        comp(c, IX + 0.15 + i * (bw + 0.1), 3.3, bw, 0.95, p, mark=False, size=14)
    c.text(IX + 0.15, 2.92, IW, 0.28, "each question runs as", 13, "Regular", INK2, "left")
    c.arrow([(IX + IW / 2, 1.55), (IX + IW / 2, 2.05)], color=INK2)
    c.text(IX + IW / 2 + 0.1, 1.66, 3, 0.28, "the agent's instructions", 13, "Regular", INK2, "left")

    # the producer, on the left
    actor(c, 0.75, 1.3, "Producer")
    c.text(0.75 - 1.0, 1.88, 2.0, 0.28, "agent author", 13, "Regular", INK2)
    c.arrow([(1.2, 1.12), (IX, 1.12)], color=INK)
    c.text(1.3, 0.8, PX - 1.4, 0.28, "publish an agent", 13, "Regular", INK, "left")

    # the consumers, on the right: an app with a key, and people through the web app
    c.text(RX, 1.45, 2, 0.3, "Consumers", 14, "Semibold", INK2, "left")
    comp(c, RX, 1.95, 2.0, 0.85, "Literature\nwatch app", mark=False)
    comp(c, RX, 3.4, 1.15, 0.85, "Web app", mark=False)
    actor(c, 11.7, 3.75, "People", color=INK)
    c.line([(RX + 1.15, 3.53), (11.42, 3.53)], color=INK2)
    LX = PX + PW + 0.12                         # the labels start right of the boundary
    c.arrow([(RX, 2.2), (IX + IW, 2.2)], color=INK)
    c.text(LX, 1.88, RX - LX, 0.28, "ask with an API key", 13, "Regular", INK, "left")
    c.arrow([(IX + IW, 2.55), (RX, 2.55)], color=INK)
    c.text(LX, 2.6, RX - LX, 0.28, "answer + findings + cost", 13, "Regular", INK, "left")
    c.arrow([(RX, 3.65), (IX + IW, 3.65)], color=INK2)
    c.text(LX, 3.33, RX - LX, 0.28, "ask, signed in", 13, "Regular", INK2, "left")
    c.arrow([(IX + IW, 4.0), (RX, 4.0)], color=INK2)
    c.text(LX, 4.05, RX - LX, 0.28, "the run, live", 13, "Regular", INK2, "left")
    save(c, "platform.png")


# ---------------------------------------------------------------- slide 1c: scope
def usecases():
    c = Canvas()
    BX, BW = 2.25, 7.6                           # the system boundary
    frame(c, BX, 0.15, BW, 4.7, "Lumen platform", color=INK2)
    OW, OH = 3.3, 0.85
    LCX, RCX = BX + 0.3 + OW / 2, BX + BW - 0.3 - OW / 2
    UC = {  # id: (centre x, centre y, short name)
        "UC1": (LCX, 1.45, "Publish an agent"),
        "UC5": (LCX, 3.45, "Read usage"),
        "UC2": (RCX, 1.0, "Ask a question"),
        "UC6": (RCX, 2.07, "Watch the literature"),
        "UC3": (RCX, 3.14, "Manage API keys"),
        "UC4": (RCX, 4.21, "Approve spend over cap"),
    }
    ACT = {  # name: (hip x, hip y, the use cases it takes part in)
        "Producer": (1.0, 1.75, ["UC1", "UC5"]),
        "Operator": (1.0, 3.75, ["UC5"]),
        "Consumer app": (11.1, 1.8, ["UC2", "UC6"]),
        "Account owner": (11.1, 3.95, ["UC3", "UC4"]),
    }
    for name, (ax, ay, ucs) in ACT.items():
        sx = ax + (0.32 if ax < BX else -0.32)
        sy = ay - 0.22
        for u in ucs:
            ux, uy, _ = UC[u]
            ex, ey = on_oval(ux, uy, OW, OH, sx, sy)
            c.line([(sx, sy), (ex, ey)], color=INK2)
    for u, (ux, uy, n) in UC.items():
        oval(c, ux, uy, OW, OH, u, n)
    for name, (ax, ay, _) in ACT.items():
        actor(c, ax, ay, name)
    save(c, "usecases.png")


# ---------------------------------------------------------------- slide 3a: key decisions
def decisions():
    c = Canvas()
    PW = 3.75
    PX = [0.15, 4.2, 8.25]
    for x in (4.05, 8.1):
        c.line([(x, 0.15), (x, 4.85)], color=RULE2)

    def caption(x0, ident, line, note):
        c.text(x0 + 0.1, 0.1, 1, 0.28, ident, 13, "Medium", INK2, "left")
        c.text(x0 + 0.1, 3.75, PW, 0.32, line, 15, "Semibold", INK, "left")
        c.text(x0 + 0.1, 4.12, PW, 0.28, note, 13, "Regular", INK2, "left")

    # (a) AD-01: the five services are the five slices that already existed
    x0 = PX[0]
    caption(x0, "AD-01", "Five services, cut along the slices", "same image, a new entry point each")
    c.text(x0 + 0.1, 0.45, 1.4, 0.28, "slices (main)", 13, "Regular", INK2)
    c.text(x0 + 2.15, 0.45, 1.4, 0.28, "services", 13, "Regular", INK2)
    pairs = [("identity", "identity"), ("projects", "project"), ("session", "session"), ("steering", "worker"),
             ("billing", "billing")]
    for i, (a, b) in enumerate(pairs):
        y = 0.85 + i * 0.55
        c.box(x0 + 0.1, y, 1.4, 0.42, state="idle")
        c.text(x0 + 0.1, y, 1.4, 0.42, a, 14, "Medium", INK2)
        comp(c, x0 + 2.15, y, 1.4, 0.42, b, mark=False, size=14)
        c.arrow([(x0 + 1.5, y + 0.21), (x0 + 2.15, y + 0.21)], color=INK2)

    # (b) AD-02: a durable queue between session and the workers
    x0 = PX[1]
    caption(x0, "AD-02", "A durable queue, not a direct call", "a slow model call never holds a request")
    comp(c, x0 + 0.1, 1.15, 1.0, 0.6, "session", mark=False, size=14)
    qx, qy = x0 + 1.35, 1.3
    c.queue(qx, qy, 3, cell=0.3)
    c.text(qx - 0.6, qy + 0.42, 2.1, 0.5, "RabbitMQ\nqueue of turns", 13, "Regular", INK2)
    c.arrow([(x0 + 1.1, qy + 0.15), (qx, qy + 0.15)], color=INK)
    wy = [0.75, 1.24, 1.73]
    for y in wy:
        comp(c, x0 + 2.8, y, 0.95, 0.4, "worker", mark=False, size=14)
    c.line([(qx + 0.9, qy + 0.15), (x0 + 2.55, qy + 0.15)], color=INK)
    c.line([(x0 + 2.55, wy[0] + 0.2), (x0 + 2.55, wy[-1] + 0.2)], color=INK)
    for y in wy:
        c.arrow([(x0 + 2.55, y + 0.2), (x0 + 2.8, y + 0.2)], color=INK)
    # the alternative that was not taken, faint and crossed out
    comp(c, x0 + 0.1, 2.75, 1.1, 0.42, "session", mark=False, size=14, faint=True)
    comp(c, x0 + 2.8, 2.75, 0.95, 0.42, "worker", mark=False, size=14, faint=True)
    c.arrow([(x0 + 1.2, 2.96), (x0 + 2.8, 2.96)], color=RULE)
    c.text(x0 + 1.2, 2.46, 1.65, 0.28, "direct HTTP call", 13, "Regular", INK3)
    c.cross(x0 + 1.93, 2.86, 0.2, 0.2, color=INK2)

    # (c) AD-04: the worker reports each step; session alone writes the trace
    x0 = PX[2]
    caption(x0, "AD-04", "Session is the only writer of the trace", "a worker that dies loses no step")
    bx, bw = x0 + 0.1, 1.5
    comp(c, bx, 0.55, bw, 0.5, "worker", mark=False, size=14)
    comp(c, bx, 1.75, bw, 0.5, "session", mark=False, size=14, lit=True)
    comp(c, bx, 2.95, bw, 0.5, "trace", mark=False, size=14)
    c.arrow([(bx + bw / 2, 1.05), (bx + bw / 2, 1.75)], color=INK)
    c.text(bx + bw / 2 + 0.12, 1.12, 3, 0.28, "POST /internal/turns/:id/step", 13, "Regular", INK, "left")
    c.text(bx + bw / 2 + 0.12, 1.38, 3, 0.28, "one call per step", 13, "Regular", INK2, "left")
    c.arrow([(bx + bw / 2, 2.25), (bx + bw / 2, 2.95)], color=INK)
    c.text(bx + bw / 2 + 0.12, 2.46, 3, 0.28, "SQL, the only writer", 13, "Regular", INK, "left")
    c.text(bx + bw + 0.12, 3.06, 2, 0.28, "PostgreSQL", 13, "Regular", INK2, "left")
    save(c, "decisions.png")


# ---------------------------------------------------------------- slide 3c: the context map
def contextmap():
    c = Canvas()
    # how the contexts were found, in one line of small steps
    steps = ["use cases UC1 to UC6", "nouns users say: agent, question, step, cap", "5 bounded contexts",
             "their aggregates"]
    x, y = 0.15, 0.15
    for i, s in enumerate(steps):
        w = width(s) + 0.3
        c.box(x, y, w, 0.38, state="idle")
        c.text(x, y, w, 0.38, s, 13, "Regular", INK2)
        x += w
        if i < len(steps) - 1:
            c.arrow([(x + 0.06, y + 0.19), (x + 0.36, y + 0.19)], color=INK2)
            x += 0.42

    def ctx(x, y, w, h, name, lines, core=False):
        c.d.rectangle([c._p(x), c._p(y), c._p(x + w), c._p(y + h)], fill=RAISED if core else BLACK,
                      outline=INK if core else INK2, width=c._lw(2 if core else 1.5))
        top = y + 0.1
        if core:
            c.text(x + 0.15, top, w, 0.26, "«core domain»", 13, "Regular", INK2, "left")
            top += 0.26
        c.text(x + 0.15, top, w, 0.34, name, 16, "Semibold", INK, "left")
        for i, ln in enumerate(lines):
            c.text(x + 0.15, top + 0.42 + i * 0.28, w - 0.2, 0.28, ln, 13, "Regular", INK2, "left")

    LX, LW = 0.2, 2.65                          # left column: Projects, Identity
    MX, MW = 4.6, 2.8                           # the core: Session
    RX, RW = 9.25, 2.7                          # right column: Execution, Billing
    ctx(LX, 0.95, LW, 2.2, "Projects", ["Project, Finding", "Agent registry:", "Agent, QuestionIntent"])
    ctx(LX, 3.75, LW, 1.1, "Identity", ["Account, ApiKey"])
    ctx(MX, 1.85, MW, 2.35, "Session", ["Session, the root", "its Task tree", "Step, a value"], core=True)
    ctx(RX, 0.95, RW, 1.65, "Execution", ["the worker loop;", "it keeps no state"])
    ctx(RX, 3.0, RW, 1.6, "Billing", ["Wallet, LedgerEntry", "Approval"])

    def event(pts, name, side="above"):
        c.arrow(pts, color=INK)
        (x1, y1), (x2, y2) = pts[-2], pts[-1]
        mx = (x1 + x2) / 2
        ty = y1 - 0.31 if side == "above" else y1 + 0.03
        c.text(mx - 1.0, ty, 2.0, 0.28, name, 13, "Regular", INK)

    event([(LX + LW, 2.25), (MX, 2.25)], "question asked")
    event([(MX, 2.85), (LX + LW, 2.85)], "finding recorded", "below")
    event([(MX + MW, 2.15), (RX, 2.15)], "turn queued")
    event([(RX, 2.45), (MX + MW, 2.45)], "step recorded", "below")
    event([(MX + MW, 3.35), (RX, 3.35)], "spend recorded")
    event([(MX + MW, 3.95), (RX, 3.95)], "approval needed")
    # Identity is upstream of every context: it says who asks, with which key.
    c.arrow([(LX + 1.0, 3.75), (LX + 1.0, 3.15)], color=INK2)
    c.text(LX + 1.12, 3.31, 2.5, 0.28, "account, API key", 13, "Regular", INK2, "left")
    save(c, "contextmap.png")


# ---------------------------------------------------------------- slide 3c: producers and consumers
def interaction():
    LANES = [("Consumer app", "literature watch", 1.45), ("Lumen platform", "API v1", 6.05),
             ("Producer", "agent author", 10.65)]
    CON, PLA, PRO = 1.45, 6.05, 10.65
    HY, HH = 1.0, 0.6                           # the lifeline heads
    Y0, DY = 1.97, 0.46                         # the first message, and the space between messages
    BAR = 0.08                                  # half the width of the platform's activation bar
    # each step: who calls, its label, the word that goes, the word that comes back
    MSG = [
        (PRO, "1  POST /api/v1/keys", None, "API key"),
        (PRO, "2  POST /api/v1/agents", "agent", "201"),
        (CON, "3  GET /api/v1/agents", None, "agent"),
        (CON, "4  POST /api/v1/questions", "question", "201"),
        (None, "5  runs it, the agent's instructions first", "question", None),
        (CON, "6  GET /api/v1/questions/:id", None, "answer"),
        (PRO, "7  GET /api/v1/usage", None, "usage"),
    ]
    TITLES = [
        "1. A producer creates an API key",
        "2. The producer publishes an agent",
        "3. A consumer lists the agents",
        "4. The consumer asks with a chosen agent",
        "5. The platform runs the question",
        "6. The consumer reads the answer, findings and cost",
        "7. The producer and the operator read usage",
    ]

    def ends(i):
        """The request's path and the reply's path of step i."""
        src, _, _, _ = MSG[i]
        y = Y0 + i * DY
        if src is None:                         # a call to itself, on the platform's right
            loop = [(PLA + BAR, y - 0.08), (PLA + 0.9, y - 0.08), (PLA + 0.9, y + 0.14), (PLA + BAR, y + 0.14)]
            return loop, None
        dst = PLA - BAR if src < PLA else PLA + BAR
        return [(src, y), (dst, y)], [(dst, y + 0.12), (src, y + 0.12)]

    def paint(c, st):
        for name, note, x in LANES:
            comp(c, x - 1.05, HY, 2.1, HH, "", mark=False, lit=(x == PLA and st["now"] is not None))
            c.text(x - 1.05, HY + 0.06, 2.1, 0.3, name, 15, "Semibold", INK)
            c.text(x - 1.05, HY + 0.33, 2.1, 0.26, note, 13, "Regular", INK2)
            if x != PLA:
                dashed(c, [(x, HY + HH), (x, 4.95)], color=RULE)
        c.d.rectangle([c._p(PLA - BAR), c._p(HY + HH), c._p(PLA + BAR), c._p(4.95)], fill=BLACK,
                      outline=INK2 if st["now"] is None else INK, width=c._lw(1.5))
        for i, (src, label, _, back) in enumerate(MSG):
            if i not in st["seen"] and i != st["now"]:
                continue
            lit = i == st["now"]
            col = INK if lit else INK3
            go, ret = ends(i)
            c.arrow(go, color=col)
            y = go[0][1]
            if src is None:
                c.text(PLA + 1.45, y - 0.11, 3.1, 0.28, label, 13, "Regular", col, "left")
                continue
            lo, hi = sorted((src, PLA))
            c.text(lo, y - 0.31, hi - lo, 0.28, label, 13, "Regular", col)
            if ret and (i in st["seen"] or st["back"]):
                dashed(c, ret, color=col)
                head(c, *ret[0], *ret[1], color=col)
        for x, y, word in st["tags"]:
            tag(c, x, y, word)

    st = dict(seen=set(), now=None, back=False, tags=[])
    sc = Scene("interaction.gif", paint, st)

    def travel(pts, word, seconds=0.9):
        sc.tween(seconds, lambda u: st.update(tags=[(*draw.along(pts, u), word)]))
        st["tags"] = []

    sc.step("A producer publishes; a consumer asks; one API", 2.6)
    for i, (src, label, word, back) in enumerate(MSG):
        go, ret = ends(i)
        sc.step(TITLES[i], 0.5, now=i, back=False)
        if word:
            travel(go, word, 1.4 if src is None else 0.9)
        else:
            sc.hold(0.5)
        if ret:
            sc.set(back=True)
            travel(ret, back, 0.9)
        sc.hold(1.4)
        st["seen"] = st["seen"] | {i}
    sc.step("Publish, list, ask, read: all on the public API v1", 3.0, now=None)
    sc.set(seen=set())
    sc.save()


SCENES = dict(std_platform=platform, usecases=usecases, decisions=decisions, contextmap=contextmap,
              interaction=interaction)
