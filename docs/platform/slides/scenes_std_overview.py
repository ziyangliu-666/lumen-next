"""The overview pictures of the redesigned deck, in standard notation.

platform.gif    who uses the platform and how (slide 1b)
usecases.gif    a UML use case diagram of UC1 to UC6 (slide 1c)
decisions.gif   AD-01, AD-02 and AD-04 as three small diagrams (slide 3a)
contextmap.gif  a DDD context map with the domain events (slide 3c)
physdecisions.gif AD-09, AD-11 and AD-06: the decisions that shape the physical side (slide 4a)
interaction.gif the seven calls of report 3.1.4, as a sequence diagram (slide 3c)

Every fact comes from docs/platform/report/report.md (sections 1.4.1, 3.1.1 and 3.1.4)
or docs/platform/evidence/2026-10-20-public-api-flow.md.

Each animation builds its diagram part by part, runs one real flow over it with a word on a
white tag, and then holds the whole diagram, calm, so a lecturer can read it.
"""
import math

import draw
from draw import BLACK, INK, INK2, INK3, RAISED, RULE, RULE2, Scene, font, S, X2
from scenes_std import comp, node, tag


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
    lines = name.count("\n") + 1
    c.text(x - 1.1, y + 0.3, 2.2, 0.3 * lines, name, 15, "Semibold", color)


def oval(c, cx, cy, w, h, ident, name, lit=False):
    """A UML use case: an oval with its id and its short name."""
    c.d.ellipse([c._p(cx - w / 2), c._p(cy - h / 2), c._p(cx + w / 2), c._p(cy + h / 2)],
                fill=RAISED if lit else BLACK, outline=INK if lit else INK2, width=c._lw(2 if lit else 1.5))
    c.text(cx - w / 2, cy - 0.29, w, 0.26, ident, 13, "Regular", INK2)
    c.text(cx - w / 2, cy - 0.06, w, 0.3, name, 15, "Semibold", INK)


def on_oval(cx, cy, w, h, px, py):
    """The point on an oval's edge that faces (px, py)."""
    a = math.atan2((py - cy) / (h / 2), (px - cx) / (w / 2))
    return cx + w / 2 * math.cos(a), cy + h / 2 * math.sin(a)


def frame(c, x, y, w, h, name="", color=RULE):
    """A thin boundary with its name small in the top left corner."""
    c.d.rectangle([c._p(x), c._p(y), c._p(x + w), c._p(y + h)], outline=color, width=c._lw(1.5))
    if name:
        c.text(x + 0.14, y + 0.08, w, 0.3, name, 14, "Semibold", INK2, "left")


def trim(pts, a, b):
    """The part of a polyline that starts a inches in and ends b inches before its end."""
    segs = list(zip(pts, pts[1:]))
    total = sum(math.hypot(q[0] - p[0], q[1] - p[1]) for p, q in segs)
    if total <= a + b:
        m = draw.along(pts, a / (a + b) if a + b else 0.5)
        return [m, m]
    out = [draw.along(pts, a / total)]
    d = 0.0
    for p, q in segs:
        d += math.hypot(q[0] - p[0], q[1] - p[1])
        if a < d < total - b:
            out.append(q)
    out.append(draw.along(pts, (total - b) / total))
    return out


def reach(word, p, q):
    """How far a tag reaches along the segment p to q, from its centre, plus a small gap.
    A tag that travels is kept this far from both ends, so it never covers a box's words."""
    n = max(1e-6, math.hypot(q[0] - p[0], q[1] - p[1]))
    ux, uy = abs(q[0] - p[0]) / n, abs(q[1] - p[1]) / n
    return ux * (width(word, 13, "Semibold") / 2 + 0.1) + uy * 0.15 + 0.09


def mover(sc, st):
    """A function that moves a tag along a connector, inside its two ends."""
    def travel(pts, word, seconds=0.9, start=True, end=True):
        a = reach(word, pts[0], pts[1]) if start else 0
        b = reach(word, pts[-2], pts[-1]) if end else 0
        path = trim(pts, a, b)
        sc.tween(seconds, lambda u: st.update(tags=[(*draw.along(path, u), word)]))
        st["tags"] = []
    return travel


def link(c, pts, lit=False, arrow=True):
    """A connector: grey at rest, white and flowing while something moves on it."""
    if arrow:
        c.arrow(pts, active=lit, color=INK if lit else INK2)
    else:
        c.line(pts, active=lit, color=INK if lit else INK2)


def note(c, x, y, w, text, lit=False, align="left"):
    c.text(x, y, w, 0.28, text, 13, "Regular", INK if lit else INK2, align)


# ---------------------------------------------------------------- slide 1b: platform thinking
def platform():
    PX, PW, PY = 3.05, 4.55, 1.0                # the platform's boundary
    IX, IW = PX + 0.25, PW - 0.5                # the parts inside it
    RX = 10.0                                   # the consumers' column
    LX = PX + PW + 0.12                         # labels right of the boundary start here
    REG = (IX, 1.42, IW, 0.75)
    ENG = (IX, 2.62, IW, 2.13)
    PARTS = ["task tree", "steps\nand cost", "budget cap"]
    bw = (IW - 0.5) / 3
    WATCH, WEB = (RX, 2.65, 2.0, 0.8), (RX, 3.9, 1.15, 0.75)
    AX = IX + IW - 0.95                         # the instructions' connector
    P = dict(pub=[(1.2, 1.75), (IX, 1.75)],
             instr=[(AX, 2.17), (AX, 2.62)],
             ask=[(RX, 2.85), (IX + IW, 2.85)],
             ans=[(IX + IW, 3.2), (RX, 3.2)],
             web=[(RX, 4.1), (IX + IW, 4.1)],
             live=[(IX + IW, 4.45), (RX, 4.45)])
    # each connector's label: (text, x, y, width, align). A label stands 0.4 off its line,
    # so the tag that travels on the line never covers it.
    L = dict(pub=("publish an agent", 1.3, 1.35, 1.7, "left"),
             instr=("the agent's instructions", AX - 2.4, 2.26, 2.0, "right"),
             ask=("ask with an API key", LX, 2.45, 2.2, "left"),
             ans=("answer + findings + cost", LX, 3.32, 2.2, "left"),
             web=("ask, signed in", LX, 3.7, 2.2, "left"),
             live=("the run, live", LX, 4.57, 2.2, "left"))

    def paint(c, st):
        show, lit = st["show"], st["lit"]
        if "plat" in show:
            frame(c, PX, PY, PW, 3.92, "Lumen platform")
            comp(c, *REG, "Agent registry", "the agents that producers publish", lit="reg" in lit)
            comp(c, *ENG, "", lit="eng" in lit)
            c.text(IX + 0.14, ENG[1] + 0.07, IW, 0.32, "Run engine: the seed", 15, "Semibold", INK, "left")
            note(c, IX + 0.14, ENG[1] + 0.39, IW, "the session, worker and billing services")
            note(c, IX + 0.15, ENG[1] + 0.7, IW, "each question runs as")
            for i, p in enumerate(PARTS):
                comp(c, IX + 0.15 + i * (bw + 0.1), ENG[1] + 1.05, bw, 0.9, p, mark=False, size=14,
                     lit=p in lit)
        if "prod" in show:
            actor(c, 0.75, 1.95, "Producer")
            note(c, -0.25, 2.53, 2.0, "agent author", align="center")
        if "cons" in show:
            c.text(RX, 2.25, 2, 0.3, "Consumers", 14, "Semibold", INK2, "left")
            comp(c, *WATCH, "Literature\nwatch app", mark=False, lit="watch" in lit)
            comp(c, *WEB, "Web app", mark=False)
            actor(c, 11.7, 4.25, "People")
            c.line([(RX + 1.15, 4.03), (11.42, 4.03)], color=INK2)
        need = dict(pub="prod", instr="plat", ask="cons", ans="cons", web="cons", live="cons")
        for k, pts in P.items():
            if need[k] in show and "plat" in show:
                link(c, pts, k in lit)
                text, x, y, w, align = L[k]
                note(c, x, y, w, text, k in lit, align)
        for x, y, word in st["tags"]:
            tag(c, x, y, word)

    st = dict(show=set(), lit=set(), tags=[])
    sc = Scene("platform.gif", paint, st)
    travel = mover(sc, st)
    # build
    sc.step("The platform: an agent registry and the run engine", 2.4, show={"plat"}, lit={"reg", "eng"})
    sc.step("Producers publish agents to it", 2.0, show={"plat", "prod"}, lit=set())
    sc.step("Consumers ask: an app with an API key, or people", 2.6, show={"plat", "prod", "cons"})
    # flow: one agent is published, then one question runs with it
    sc.step("1. A producer publishes an agent", 0.3, lit={"pub"})
    travel(P["pub"], "agent", 1.0)
    sc.set(lit={"pub", "reg"})
    sc.hold(1.2)
    sc.step("2. The literature watch asks, with its API key", 0.3, lit={"ask", "watch"})
    travel(P["ask"], "question", 1.0)
    sc.set(lit={"ask", "eng"})
    sc.hold(0.8)
    sc.step("3. The run engine takes the agent's instructions", 0.3, lit={"instr", "reg", "eng"})
    travel(P["instr"], "agent", 0.7)
    sc.hold(0.8)
    sc.title = "4. The seed runs it under the account's cap"
    for p in PARTS:
        sc.set(lit={"eng", p})
        sc.hold(0.8)
    sc.step("5. The answer, its findings and its cost come back", 0.3, lit={"ans", "eng"})
    travel(P["ans"], "answer", 1.0)
    sc.set(lit={"ans", "watch"})
    sc.hold(1.4)
    # hold: the whole picture, calm
    sc.step("Producers publish, consumers ask, the seed runs it", 3.6, lit=set())
    sc.save()


# ---------------------------------------------------------------- slide 1c: scope
def usecases():
    BX, BY, BW, BH = 2.25, 1.0, 7.6, 3.9        # the system boundary
    OW, OH = 3.3, 0.76
    LCX, RCX = BX + 0.3 + OW / 2, BX + BW - 0.3 - OW / 2
    # The use cases are drawn and built in number order inside each actor's group: the left
    # column holds the producer's and the operator's, the right column the two consumers'.
    # Grouped this way, no two links cross.
    UC = {  # id: (centre x, centre y, short name)
        "UC1": (LCX, 2.15, "Publish an agent"),
        "UC2": (RCX, 1.78, "Ask a question"),
        "UC3": (RCX, 3.46, "Manage API keys"),
        "UC4": (RCX, 4.3, "Approve spend over cap"),
        "UC5": (LCX, 3.85, "Read usage"),
        "UC6": (RCX, 2.62, "Watch the literature"),
    }
    # The same actors as in platform.gif. (hip x, hip y, the name's two lines)
    ACT = {
        "Producer": (1.0, 2.1, "Producer\n(agent author)"),
        "Operator": (1.0, 4.05, "Operator"),
        "Literature watch app": (11.1, 2.05, "Literature\nwatch app"),
        "People in the web app": (11.1, 3.85, "People in\nthe web app"),
    }
    WHO = {"UC1": ["Producer"], "UC2": ["Literature watch app"], "UC3": ["People in the web app"],
           "UC4": ["People in the web app"], "UC5": ["Producer", "Operator"], "UC6": ["Literature watch app"]}
    SAY = {"UC1": "the producer", "UC2": "the literature watch app", "UC3": "people in the web app",
           "UC4": "people in the web app", "UC5": "the producer and the operator",
           "UC6": "the literature watch app"}

    def path(name, u):
        ax, ay, _ = ACT[name]
        sx, sy = ax + (0.32 if ax < BX else -0.32), ay - 0.22
        ux, uy, _ = UC[u]
        return [(sx, sy), on_oval(ux, uy, OW, OH, sx, sy)]

    def paint(c, st):
        if st["box"]:
            frame(c, BX, BY, BW, BH, "Lumen platform", color=INK2)
        for u in st["ucs"]:
            for name in WHO[u]:
                link(c, path(name, u), lit=u == st["now"], arrow=False)
        for u in st["ucs"]:
            ux, uy, n = UC[u]
            oval(c, ux, uy, OW, OH, u, n, lit=u == st["now"])
        if st["actors"]:
            for name, (ax, ay, label) in ACT.items():
                actor(c, ax, ay, label)
        for x, y, word in st["tags"]:
            tag(c, x, y, word)

    st = dict(box=False, actors=False, ucs=[], now=None, tags=[])
    sc = Scene("usecases.gif", paint, st)
    travel = mover(sc, st)
    # build: the actors, the boundary, then each use case with its links
    sc.step("Four actors use the platform", 2.0, actors=True)
    sc.step("The system boundary: Lumen platform", 1.6, box=True)
    for u in ["UC1", "UC2", "UC3", "UC4", "UC5", "UC6"]:
        sc.step("%s  %s: %s" % (u, UC[u][2], SAY[u]), 1.3, ucs=st["ucs"] + [u], now=u)
    # flow: the literature watch app asks a question (UC2)
    sc.step("Flow: the literature watch app asks a question (UC2)", 0.4, now="UC2")
    travel(path("Literature watch app", "UC2"), "question", 1.0)
    sc.hold(0.8)
    sc.title = "The app reads the answer, the findings and the cost"
    travel(path("Literature watch app", "UC2")[::-1], "answer", 1.0)
    sc.hold(1.2)
    # hold
    sc.step("Six use cases, four actors, all built", 3.6, now=None)
    sc.save()


# ---------------------------------------------------------------- slide 3a: key decisions
def decisions():
    PW = 3.75
    PX = [0.15, 4.2, 8.25]
    CY = 4.22                                   # the captions' line
    PAIRS = [("identity", "identity"), ("projects", "project"), ("session", "session"), ("steering", "worker"),
             ("billing", "billing")]
    ROW = [1.7 + i * 0.5 for i in range(5)]
    CAP = [("AD-01", "Five services, cut along the slices", "same image, a new entry point each"),
           ("AD-02", "A durable queue, not a direct call", "a slow model call never holds a request"),
           ("AD-04", "Session is the only writer of the trace", "a worker that dies loses no step")]
    # panel (b)
    b0 = PX[1]
    qx, qy = b0 + 1.35, 2.0
    WY = [1.45, 1.94, 2.43]
    FX = b0 + 2.55                              # where the queue's connector fans out
    # panel (c)
    c0 = PX[2]
    bx, bw = c0 + 0.1, 1.2
    MX = bx + bw / 2
    STEP = [(MX, 1.85), (MX, 2.45)]
    SAVE = [(MX, 2.9), (MX, 3.5)]

    def paint(c, st):
        a, lit = st["a"], st["lit"]
        for x in (4.05, 8.1):
            c.line([(x, 1.0), (x, 4.9)], color=RULE2)
        for k in range(3):
            if st["panel"] > k:
                x0 = PX[k]
                ident, line, sub = CAP[k]
                c.text(x0 + 0.1, 1.0, 1, 0.28, ident, 13, "Medium", INK2, "left")
                if st["cap"] > k:
                    c.text(x0 + 0.1, CY, PW, 0.32, line, 15, "Semibold", INK, "left")
                    c.text(x0 + 0.1, CY + 0.36, PW, 0.28, sub, 13, "Regular", INK2, "left")
        # (a) AD-01: each slice becomes a service
        if st["panel"] > 0:
            x0 = PX[0]
            c.text(x0 + 0.1, 1.32, 1.4, 0.28, "slices (main)", 13, "Regular", INK2)
            c.text(x0 + 2.15, 1.32, 1.4, 0.28, "services", 13, "Regular", INK2)
            for i, (s1, s2) in enumerate(PAIRS):
                y = ROW[i]
                c.box(x0 + 0.1, y, 1.4, 0.4, state="idle")
                c.text(x0 + 0.1, y, 1.4, 0.4, s1, 14, "Medium", INK2)
                if i < a:
                    on = i == a - 1 and st["now"] == "a"
                    comp(c, x0 + 2.15, y, 1.4, 0.4, s2, mark=False, size=14, lit=on)
                    link(c, [(x0 + 1.5, y + 0.2), (x0 + 2.15, y + 0.2)], on)
        # (b) AD-02: session, the queue, the workers; the direct call, crossed out
        if st["panel"] > 1:
            comp(c, b0 + 0.1, 1.85, 1.0, 0.6, "session", mark=False, size=14, lit="session" in lit)
            c.queue(qx, qy, 3, cell=0.3, active="queue" in lit)
            c.text(qx - 0.6, qy + 0.42, 2.1, 0.5, "RabbitMQ\nqueue of turns", 13, "Regular", INK2)
            link(c, [(b0 + 1.1, qy + 0.15), (qx, qy + 0.15)], "in" in lit)
            on = [w for w in range(3) if "w%d" % w in lit]
            link(c, [(qx + 0.9, qy + 0.15), (FX, qy + 0.15)], bool(on), arrow=False)
            c.line([(FX, WY[0] + 0.2), (FX, WY[-1] + 0.2)], color=INK2)
            for w, y in enumerate(WY):
                comp(c, b0 + 2.8, y, 0.95, 0.4, "worker", mark=False, size=14, lit=w in on)
                link(c, [(FX, y + 0.2), (b0 + 2.8, y + 0.2)], w in on)
            comp(c, b0 + 0.1, 3.45, 1.0, 0.42, "session", mark=False, size=14, faint=True)
            comp(c, b0 + 2.8, 3.45, 0.95, 0.42, "worker", mark=False, size=14, faint=True)
            c.arrow([(b0 + 1.1, 3.66), (b0 + 2.8, 3.66)], color=RULE)
            c.text(b0 + 1.1, 3.16, 1.7, 0.28, "direct HTTP call", 13, "Regular", INK3)
            c.cross(b0 + 1.85, 3.56, 0.2, 0.2, color=INK3)
        # (c) AD-04: the worker reports each step; session writes it
        if st["panel"] > 2:
            comp(c, bx, 1.4, bw, 0.45, "worker", mark=False, size=14, lit="worker" in lit)
            comp(c, bx, 2.45, bw, 0.45, "session", mark=False, size=14, lit="session" in lit)
            comp(c, bx, 3.5, bw, 0.45, "trace", mark=False, size=14, lit="trace" in lit)
            link(c, STEP, "step" in lit)
            # The labels stand clear of the "step" tag that travels down the connector.
            note(c, MX + 0.42, 1.86, 3, "POST /internal/turns/:id/step", "step" in lit)
            note(c, MX + 0.42, 2.12, 3, "one call per step")
            link(c, SAVE, "save" in lit)
            note(c, MX + 0.42, 3.06, 3, "SQL, the only writer", "save" in lit)
            note(c, bx + bw + 0.12, 3.58, 2, "PostgreSQL")
        for x, y, word in st["tags"]:
            tag(c, x, y, word)

    st = dict(panel=0, cap=0, a=0, now=None, lit=set(), tags=[])
    sc = Scene("decisions.gif", paint, st)
    travel = mover(sc, st)
    # AD-01: the slices, then each one becomes a service
    sc.step("AD-01: each existing slice becomes a service", 1.2, panel=1, now="a")
    for i in range(5):
        sc.set(a=i + 1)
        sc.hold(0.55)
    sc.step("AD-01: five services, cut along the slices", 1.6, cap=1, now=None)
    # AD-02: three turns go through the queue, each to a free worker
    sc.step("AD-02: a turn waits on a durable queue", 1.0, panel=2)
    for w in range(3):
        sc.title = "AD-02: any free worker takes the next turn"
        sc.set(lit={"session", "in"})
        travel([(b0 + 1.1, qy + 0.15), (qx + 0.45, qy + 0.15)], "turn", 0.5, end=False)
        sc.set(lit={"queue"}, tags=[(qx + 0.45, qy + 0.15, "turn")])
        sc.hold(0.3)
        sc.set(lit={"queue", "w%d" % w})
        y = WY[w] + 0.2
        travel([(qx + 0.45, qy + 0.15), (FX, qy + 0.15), (FX, y), (b0 + 2.8, y)], "turn", 0.7, start=False)
        sc.set(lit={"w%d" % w})
        sc.hold(0.3)
    sc.step("AD-02: a durable queue, not a direct call", 1.6, cap=2, lit=set())
    # AD-04: one step goes from the worker to session, and only session writes it
    sc.step("AD-04: the worker reports each step to session", 0.6, panel=3, lit={"worker", "step"})
    travel(STEP, "step", 0.7)
    sc.set(lit={"session", "save"})
    sc.title = "AD-04: session alone writes it to the trace"
    travel(SAVE, "step", 0.7)
    sc.set(lit={"trace"})
    sc.hold(1.0)
    sc.step("AD-04: session is the only writer of the trace", 1.4, cap=3, lit=set())
    # hold
    sc.step("Three key decisions of the logical design", 3.6)
    sc.save()


# ---------------------------------------------------------------- slide 3c: the context map
def contextmap():
    STEPS = ["use cases UC1 to UC6", "nouns users say: agent, question, step, cap", "5 bounded contexts",
             "their aggregates"]
    LX, LW = 0.2, 2.65                          # left column: Projects, Identity
    MX, MW = 4.6, 2.8                           # the core: Session
    RX, RW = 9.25, 2.7                          # right column: Execution, Billing
    CTX = {  # name: (x, y, w, h, aggregates)
        "Projects": (LX, 1.6, LW, 1.7, ["Project, Finding", "Agent registry:", "Agent, QuestionIntent"]),
        "Identity": (LX, 3.95, LW, 0.9, ["Account, ApiKey"]),
        "Session": (MX, 2.1, MW, 2.4, ["Session, the root", "its Task tree", "Step, a value"]),
        "Execution": (RX, 1.6, RW, 1.35, ["the worker loop;", "it keeps no state"]),
        "Billing": (RX, 3.3, RW, 1.55, ["Wallet, LedgerEntry", "Approval"]),
    }
    # the domain events in the order of one question: (event, tag, path, label side, from, to)
    EV = [("question asked", "question", [(LX + LW, 2.55), (MX, 2.55)], "above", "Projects", "Session"),
          ("turn queued", "turn", [(MX + MW, 2.35), (RX, 2.35)], "above", "Session", "Execution"),
          ("step recorded", "step", [(RX, 2.75), (MX + MW, 2.75)], "below", "Execution", "Session"),
          ("spend recorded", "spend", [(MX + MW, 3.6), (RX, 3.6)], "above", "Session", "Billing"),
          ("approval needed", "approval", [(MX + MW, 4.2), (RX, 4.2)], "above", "Session", "Billing"),
          ("finding recorded", "finding", [(MX, 3.1), (LX + LW, 3.1)], "below", "Session", "Projects")]
    TITLES = ["1. A question asked in a project opens a session",
              "2. Session queues a turn for execution",
              "3. Execution reports each step back to session",
              "4. Session records the spend in billing",
              "5. A step over the cap needs an approval",
              "6. A finding goes back to the project"]
    sw = [width(s) + 0.3 for s in STEPS]

    def paint(c, st):
        lit = st["lit"]
        x, y = 0.15, 1.0
        for i, s in enumerate(STEPS):
            if i < st["strip"]:
                on = i == st["strip"] - 1 and st["phase"] == "strip"
                c.box(x, y, sw[i], 0.38, state="active" if on else "idle")
                c.text(x, y, sw[i], 0.38, s, 13, "Regular", INK if on else INK2)
                if i:
                    c.arrow([(x - 0.36, y + 0.19), (x - 0.06, y + 0.19)], color=INK2)
            x += sw[i] + 0.42
        for name, (x, y, w, h, lines) in CTX.items():
            if name not in st["ctx"]:
                continue
            core = name == "Session"
            on = name in lit
            c.d.rectangle([c._p(x), c._p(y), c._p(x + w), c._p(y + h)], fill=RAISED if (core or on) else BLACK,
                          outline=INK if (core or on) else INK2, width=c._lw(2 if (core or on) else 1.5))
            top = y + 0.1
            if core:
                c.text(x + 0.15, top, w, 0.26, "«core domain»", 13, "Regular", INK2, "left")
                top += 0.26
            c.text(x + 0.15, top, w, 0.34, name, 16, "Semibold", INK, "left")
            if st["agg"]:
                for i, ln in enumerate(lines):
                    c.text(x + 0.15, top + 0.42 + i * 0.28, w - 0.2, 0.28, ln, 13, "Regular", INK2, "left")
        if st["links"]:
            for k, (name, _, pts, side, _, _) in enumerate(EV):
                on = k == st["now"]
                link(c, pts, on)
                if k in st["named"]:
                    (x1, y1), (x2, _) = pts
                    ty = y1 - 0.31 if side == "above" else y1 + 0.03
                    c.text((x1 + x2) / 2 - 1.0, ty, 2.0, 0.28, name, 13, "Regular", INK if on else INK2)
            # Identity is upstream of every context: it says who asks, with which key.
            c.arrow([(LX + 1.0, 3.95), (LX + 1.0, 3.3)], color=INK2)
            note(c, LX + 1.12, 3.48, 2.5, "account, API key")
        for x, y, word in st["tags"]:
            tag(c, x, y, word)

    st = dict(strip=0, phase="strip", ctx=set(), agg=False, links=False, named=set(), now=None, lit=set(),
              tags=[])
    sc = Scene("contextmap.gif", paint, st)
    travel = mover(sc, st)
    # build: how the contexts were found, then the map
    sc.title = "How we found the contexts"
    for i in range(4):
        sc.set(strip=i + 1)
        sc.hold(0.9)
    sc.step("Five bounded contexts; Session is the core domain", 2.2, phase="map", ctx=set(CTX))
    sc.step("Each context keeps its own aggregates", 2.2, agg=True)
    sc.step("They talk only through domain events", 1.6, links=True)
    # flow: the events of one question, in order
    for k, (name, word, pts, _, a, b) in enumerate(EV):
        sc.step(TITLES[k], 0.2, now=k, lit={a, b})
        travel(pts, word, 0.9)
        sc.set(named=st["named"] | {k})
        sc.hold(1.1)
    # hold
    sc.step("Five contexts, one core domain, six domain events", 3.6, now=None, lit=set())
    sc.save()


# ---------------------------------------------------------------- slide 4a: decisions that shape the physical side
def physdecisions():
    PW = 3.75
    PX = [0.15, 4.2, 8.25]
    CY = 4.22                                   # the captions' line
    CAP = [("AD-09", "k3s on one EC2 t3.medium, not EKS", "the laptop chart, unchanged; USD 1.3 a day"),
           ("AD-11", "HPA on CPU; KEDA on queue length", "a worker waits on the model, so its CPU is low"),
           ("AD-06", "One PostgreSQL, tables per context", "step, cost and ledger entry in one transaction")]
    # (a) AD-09: the pods that one Helm chart installs on k3s (deployment.png has the same nine)
    a0 = PX[0]
    PODS = ["identity", "project", "session", "worker", "billing", "postgres", "rabbitmq", "traefik", "keda"]
    # (b) AD-11
    b0 = PX[1]
    BAR = (b0 + 0.7, 1.3)                       # a CPU bar's left edge and width
    # (c) AD-06: the contexts' tables in the one database (report 3.2.3)
    c0 = PX[2]
    CTX = [("session", "steps, tasks", c0 + 0.25, 2.4, "steps"),
           ("billing", "ledger_entries", c0 + 1.98, 2.4, "ledger"),
           ("identity", "accounts", c0 + 0.25, 3.15, None),
           ("project", "projects, findings", c0 + 1.98, 3.15, None)]
    WRITE = [(c0 + 0.67, 1.72), (c0 + 0.67, 2.4)]

    def plural(n, top):
        return "%d pod%s (1 to %d)" % (n, "" if n == 1 else "s", top)

    def cpu_bar(c, x, y, u, faint=False):
        """A CPU bar: its outline, and a fill for the share in use."""
        w = BAR[1]
        c.d.rectangle([c._p(x), c._p(y), c._p(x + w), c._p(y + 0.18)], outline=RULE if faint else INK2,
                      width=c._lw(1.5))
        col = RULE if faint else (INK if u >= 0.7 else INK2)
        if u > 0:
            c.d.rectangle([c._p(x), c._p(y), c._p(x + w * u), c._p(y + 0.18)], fill=col)

    def pods(c, x, y, n, total, w, lit=False):
        for i in range(total):
            px = x + i * (w + 0.08)
            if i < n:
                c.d.rectangle([c._p(px), c._p(y), c._p(px + w), c._p(y + 0.3)], fill=RAISED,
                              outline=INK if lit else INK2, width=c._lw(1.5))
            else:
                c.d.rectangle([c._p(px), c._p(y), c._p(px + w), c._p(y + 0.3)], outline=RULE2, width=c._lw(1))

    def paint(c, st):
        lit = st["lit"]
        for x in (4.05, 8.1):
            c.line([(x, 1.0), (x, 4.9)], color=RULE2)
        for k in range(3):
            if st["panel"] > k:
                x0 = PX[k]
                ident, line, sub = CAP[k]
                c.text(x0 + 0.1, 1.0, 1, 0.28, ident, 13, "Medium", INK2, "left")
                if st["cap"] > k:
                    c.text(x0 + 0.1, CY, PW, 0.32, line, 15, "Semibold", INK, "left")
                    c.text(x0 + 0.1, CY + 0.36, PW, 0.28, sub, 13, "Regular", INK2, "left")
        # (a) one chart, one EC2 node, k3s on it, the pods in k3s; EKS crossed out
        if st["panel"] > 0:
            comp(c, a0 + 0.1, 1.32, 1.3, 0.38, "Helm chart", mark=False, size=14, lit="chart" in lit)
            comp(c, a0 + 2.45, 1.32, 1.1, 0.38, "EKS", mark=False, size=14, faint=True)
            c.arrow([(a0 + 1.4, 1.51), (a0 + 2.45, 1.51)], color=RULE)
            c.cross(a0 + 1.83, 1.41, 0.2, 0.2, color=INK3)
            node(c, a0 + 0.1, 2.0, 3.45, 2.1, "EC2 t3.medium")
            note(c, a0 + 1.75, 2.1, 1.6, "2 vCPU, 4 GB")
            link(c, [(a0 + 0.75, 1.7), (a0 + 0.75, 1.86)], "chart" in lit)
            node(c, a0 + 0.22, 2.6, 3.2, 1.4, "k3s", depth=0.1)
            for i, p in enumerate(PODS[:st["pods"]]):
                x, y = a0 + 0.34 + (i % 3) * 1.02, 3.05 + (i // 3) * 0.3
                on = i == st["pods"] - 1 and "chart" in lit
                comp(c, x, y, 0.95, 0.26, "", mark=False, lit=on)
                c.text(x, y, 0.95, 0.26, p, 13, "Regular", INK if on else INK2)
        # (b) HPA scales three services on CPU; KEDA scales the worker on the queue
        if st["panel"] > 1:
            hl, kl = "hpa" in lit, "keda" in lit
            c.text(b0 + 0.1, 1.3, 3, 0.3, "HPA on CPU", 14, "Semibold", INK, "left")
            note(c, b0 + 0.1, 1.55, 3, "identity, project, billing")
            note(c, b0 + 0.1, 1.85, 0.5, "CPU", hl)
            cpu_bar(c, BAR[0], 1.9, st["cpu"])
            mx = BAR[0] + BAR[1] * 0.7
            c.line([(mx, 1.84), (mx, 2.14)], color=INK)
            note(c, mx - 0.5, 2.14, 1.0, "70%", hl, "center")
            pods(c, b0 + 2.25, 1.84, st["hpa"], 3, 0.42, hl)
            note(c, b0 + 2.25, 2.16, 1.5, plural(st["hpa"], 3), hl)
            c.text(b0 + 0.1, 2.5, 3, 0.3, "KEDA on queue length", 14, "Semibold", INK, "left")
            note(c, b0 + 0.1, 2.75, 3, "worker")
            note(c, b0 + 0.1, 3.05, 0.5, "turns", kl)
            c.queue(BAR[0], 3.07, 6, cell=BAR[1] / 6, active=kl)
            cw = BAR[1] / 6
            for j in range(int(st["queue"])):
                x = BAR[0] + j * cw
                c.d.rectangle([c._p(x + 0.05), c._p(3.12), c._p(x + cw - 0.05), c._p(3.07 + cw - 0.05)],
                              fill=INK if kl else INK2)
            note(c, BAR[0], 3.36, 1.6, "queueLength 5", kl)
            pods(c, b0 + 2.25, 3.04, st["keda"], 4, 0.29, kl)
            note(c, b0 + 2.25, 3.36, 1.5, plural(st["keda"], 4), kl)
            # the alternative: HPA on the worker's CPU, which stays low while turns wait
            note(c, b0 + 0.1, 3.74, 0.5, "CPU")
            cpu_bar(c, BAR[0], 3.79, 0.12 + 0.04 * math.sin(draw.NOW * 3), faint=True)
            comp(c, b0 + 2.6, 3.72, 0.7, 0.32, "HPA", mark=False, size=14, faint=True)
            c.arrow([(BAR[0] + BAR[1], 3.88), (b0 + 2.6, 3.88)], color=RULE)
            c.cross(b0 + 2.18, 3.78, 0.2, 0.2, color=INK3)
        # (c) one database; each context owns its tables; a step commits with its cost
        if st["panel"] > 2:
            comp(c, c0 + 0.1, 1.32, 1.15, 0.4, "session", mark=False, size=14, lit="write" in lit)
            comp(c, c0 + 2.15, 1.32, 1.5, 0.4, "own database", mark=False, size=14, faint=True)
            c.arrow([(c0 + 1.25, 1.52), (c0 + 2.15, 1.52)], color=RULE)
            c.cross(c0 + 1.6, 1.42, 0.2, 0.2, color=INK3)
            c.text(c0 + 1.2, 1.66, 1.0, 0.28, "per service", 13, "Regular", INK3)
            c.d.rectangle([c._p(c0 + 0.1), c._p(1.95), c._p(c0 + 3.65), c._p(3.95)], outline=INK2,
                          width=c._lw(1.5))
            c.text(c0 + 1.6, 2.0, 1.9, 0.3, "PostgreSQL", 14, "Semibold", INK2, "right")
            link(c, WRITE, "write" in lit)
            for name, tables, x, y, key in CTX:
                on = key in lit
                c.d.rectangle([c._p(x), c._p(y), c._p(x + 1.62), c._p(y + 0.66)], outline=INK if on else RULE,
                              width=c._lw(2 if on else 1.5))
                c.text(x + 0.12, y + 0.03, 1.5, 0.3, name, 14, "Semibold", INK, "left")
                if on:
                    c.d.rectangle([c._p(x + 0.07), c._p(y + 0.35), c._p(x + 1.55), c._p(y + 0.6)], fill=RAISED)
                note(c, x + 0.12, y + 0.33, 1.5, tables, on)
        for x, y, word in st["tags"]:
            tag(c, x, y, word)

    st = dict(panel=0, cap=0, pods=0, cpu=0.25, hpa=1, queue=0, keda=1, lit=set(), tags=[])
    sc = Scene("physdecisions.gif", paint, st)
    travel = mover(sc, st)
    # AD-09: the chart installs every pod on the one node
    sc.step("AD-09: one Helm chart installs every pod on k3s", 0.6, panel=1, lit={"chart"})
    for i in range(len(PODS)):
        sc.set(pods=i + 1)
        sc.hold(0.3)
    sc.step("AD-09: k3s on one EC2 t3.medium, not EKS", 1.6, cap=1, lit=set())
    # AD-11: HPA follows CPU; KEDA follows the queue while the worker's CPU stays low
    sc.step("AD-11: HPA adds pods when CPU passes 70%", 0.4, panel=2, lit={"hpa"})

    def load(u):
        st["cpu"] = 0.25 + 0.65 * u
        st["hpa"] = 1 if st["cpu"] < 0.7 else (2 if st["cpu"] < 0.82 else 3)
    sc.tween(2.4, load)
    sc.tween(1.0, lambda u: st.update(cpu=0.9 - 0.35 * u))
    sc.hold(0.6)
    sc.step("AD-11: KEDA adds workers as turns wait in the queue", 0.3, lit={"keda"})
    sc.tween(2.6, lambda u: st.update(queue=6 * u, keda=1 + min(3, int(6 * u / 1.5))))
    sc.hold(0.8)
    sc.step("AD-11: HPA on CPU; KEDA on queue length", 1.6, cap=2, lit=set())
    # AD-06: one database; a step, its cost and its ledger entry commit together
    sc.step("AD-06: one PostgreSQL; each context owns its tables", 1.6, panel=3)
    sc.title = "AD-06: the step, its cost and the ledger entry in one transaction"
    sc.set(lit={"write"})
    travel(WRITE, "step", 0.7)
    sc.set(lit={"write", "steps"})
    sc.hold(0.5)
    sc.set(lit={"write", "steps", "ledger"})
    sc.hold(1.4)
    sc.step("AD-06: one PostgreSQL, tables per context", 1.4, cap=3, lit=set())
    # hold
    sc.step("Three decisions shape the physical architecture", 3.6)
    sc.save()


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
              interaction=interaction, physdecisions=physdecisions)
