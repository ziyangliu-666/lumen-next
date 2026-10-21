"""Two scenes that set the pattern for the rest: the services, and the queue per level.
Also the stills for the title and end slides.

Live is the Scene these scenes use: a worker is a gear that turns while it is busy, and the
thing that moves is the business object (a question, a paper, a container image), drawn as
its icon. scenes_proof.py uses Live too."""
import os
import random

from draw import FPS, INK, INK2, INK3, OUT, W, Canvas, Scene
from icons import KINDS, icon

SPIN = 0.06                                    # how far a busy gear turns in one frame, in teeth


class Live(Scene):
    """A Scene whose busy gears turn. st["busy"] is true while any gear works: then every
    frame of a hold is drawn, so the gear keeps turning, and st["turn"] grows each frame.
    A moving thing whose kind is an icon kind is drawn as that icon; "done" is a paper with
    a check; lead, reader and step stay the plain jobs."""

    def __init__(self, name, paint, state):
        state.setdefault("turn", 0.0)
        state.setdefault("busy", set())
        super().__init__(name, paint, state)
        self.spun = []                         # the last frame of each turning hold, for checking

    def _draw(self):
        if self.st["busy"]:
            self.st["turn"] += SPIN
        c = Canvas()
        c.text(0.3, 0.18, W - 0.6, 0.55, self.title, 23, "Medium", INK, "left")
        self.paint(c, self.st)
        for (x, y, kind) in self.moving:
            carry(c, x, y, kind)
        return c.frame()

    def hold(self, seconds):
        if not self.st["busy"]:
            return super().hold(seconds)
        for _ in range(max(1, round(seconds * FPS))):
            self._add(self._draw(), round(1000 / FPS))
        if seconds >= 1.5:
            self.spun.append(len(self.frames) - 1)

    def save(self):
        super().save()
        for k, i in enumerate(self.spun):
            self.frames[i].save(os.path.join(OUT, "steps", "%s-turn%02d.png" % (self.name[:-4], k)))


def carry(c, x, y, kind, s=0.32):
    """One moving thing, centred on (x, y)."""
    if kind == "done":
        icon(c, "paper", x, y, s, lit=True)
        c.check(x + s * 0.3, y - s * 0.72, s * 0.5)
    elif kind in KINDS:
        icon(c, kind, x, y, s, lit=True)
    else:
        c.job(x, y, kind)


def gear(c, x, y, s, label=None, busy=False, turn=0.0, lit=None, faint=False, size=14):
    """A worker. It turns only while busy; a still gear does no work."""
    icon(c, "gear", x, y, s, lit=busy if lit is None else lit, label=label, faint=faint, size=size,
         turn=turn if busy else 0.0)


def clock(c, x, y, r=0.1, color=INK2):
    """A small clock: the thing beside it waits."""
    c.d.ellipse([c._p(x - r), c._p(y - r), c._p(x + r), c._p(y + r)], fill=(0, 0, 0), outline=color,
                width=c._lw(1.5))
    c.d.line([(c._p(x), c._p(y - r * 0.62)), (c._p(x), c._p(y)), (c._p(x + r * 0.5), c._p(y))], fill=color,
             width=c._lw(1.5), joint="curve")


# ============================================================ the services, one question through them
def services():
    Y = 2.75                                   # the main line
    S6 = 0.62                                  # icon size
    P = dict(browser=0.75, gateway=2.1, project=3.5, session=4.9, db=11.15)
    QX, CELL, N = 5.85, 0.32, 6
    QY = Y - CELL / 2
    GX, GS = 9.1, 0.5                          # the workers' gears
    GY = [1.45, 2.25, 3.05, 3.85]
    BUS = 8.45                                 # where the queue fans out to the workers
    UP = 1.75                                  # the path back to the screen, above the main line
    DBX = 10.15                                # where the workers' line to the database turns

    def r(name):
        return P[name] + S6 / 2

    def l(name):
        return P[name] - S6 / 2

    to_project = [(r("browser"), Y), (l("gateway"), Y)]
    to_session = [(r("project"), Y), (l("session"), Y)]
    to_queue = [(r("session"), Y), (QX, Y)]
    back = [(P["session"], Y - S6 / 2), (P["session"], UP), (P["browser"], UP), (P["browser"], Y - S6 / 2)]

    def to_worker(i):
        return [(QX + N * CELL, Y), (BUS, Y), (BUS, GY[i]), (GX - GS / 2, GY[i])]

    to_db = [(GX + GS / 2, GY[0]), (DBX, GY[0]), (DBX, Y), (P["db"] - S6 / 2, Y)]

    def paint(c, st):
        on = st["on"]
        c.arrow(to_project, "gateway" in on)
        c.arrow([(r("gateway"), Y), (l("project"), Y)], "project" in on)
        c.arrow(to_session, "session" in on)
        c.arrow(to_queue, "queue" in on)
        c.arrow(back, "back" in on)
        # the browser shows each step as a short line in its window
        icon(c, "browser", P["browser"], Y, S6, "browser" in on or "back" in on, "browser")
        for k in range(st["shown"]):
            x0 = P["browser"] - S6 * 0.34
            yy = Y - S6 / 2 + S6 * (0.44 + 0.13 * k)
            c.line([(x0, yy), (x0 + S6 * (0.6 - 0.14 * k), yy)], pt=1.5, color=INK)
        icon(c, "gateway", P["gateway"], Y, S6, "gateway" in on, "Traefik")
        icon(c, "folder", P["project"], Y, S6, "project" in on, "project")
        icon(c, "stream", P["session"], Y, S6, "session" in on, "session")
        # the two services that this question does not need
        icon(c, "key", P["project"], 4.15, 0.5, label="identity", faint=True)
        icon(c, "wallet", P["session"], 4.15, 0.5, label="billing", faint=True)
        c.queue(QX, QY, N, st["queue"], "", "queue" in on, CELL)
        c.text(QX, Y + CELL / 2 + 0.06, N * CELL, 0.3, "RabbitMQ", 14, "Medium",
               INK if "queue" in on else INK2)
        # the workers
        n = st["workers"]
        c.text(GX - 0.7, GY[0] - 0.62, 1.4, 0.3, "workers", 14, "Medium", INK2)
        c.line([(QX + N * CELL, Y), (BUS, Y)], "w" in on)
        c.line([(BUS, min(GY[0], Y)), (BUS, max(GY[n - 1], Y))], "w" in on)
        for i in range(n):
            c.arrow([(BUS, GY[i]), (GX - GS / 2, GY[i])], "w" in on and i in st["busy"])
            gear(c, GX, GY[i], GS, busy=i in st["busy"], turn=st["turn"] + i * 0.37)
        # every step is saved in the shared database, as one more short line
        c.arrow(to_db, "db" in on)
        icon(c, "database", P["db"], Y, S6, "db" in on, "PostgreSQL")
        for k in range(st["saved"]):
            yy = Y + S6 / 2 + 0.48 + 0.1 * k
            c.line([(P["db"] - 0.25, yy), (P["db"] + 0.25, yy)], pt=1.5, color=INK)

    sc = Live("services.gif", paint, dict(on=set(), queue=[], workers=1, shown=0, saved=0))
    sc.step("1. The gateway sends a question to project", 0.8)
    sc.set(on={"gateway"})
    sc.hop("question", to_project, 0.7)
    sc.hop("question", [(r("gateway"), Y), (l("project"), Y)], 0.7)
    sc.set(on={"project"})
    sc.hold(2.2)
    sc.step("2. Project opens a session", 0.3, on={"project", "session"})
    sc.hop("question", to_session, 0.7)
    sc.set(on={"session"})
    sc.hold(2.2)
    sc.step("3. Session puts the work in a RabbitMQ queue", 0.3, on={"session", "queue"})
    sc.hop("lead", [(r("session"), Y), (QX + CELL / 2, Y)], 0.7)
    sc.set(queue=["lead"])
    sc.hold(2.2)
    sc.step("4. A worker takes it and runs the agent", 0.3, on={"queue", "w"})
    sc.set(queue=[])
    sc.hop("lead", [(QX + CELL / 2, Y)] + to_worker(0)[1:], 0.9)
    sc.set(on={"w"}, busy={0})
    sc.hold(2.2)
    sc.step("5. Every step is saved, and shown on the screen", 0.3, on={"w", "db", "back", "session"})
    for k in range(3):
        sc.hop("step", to_db, 0.45)
        sc.set(saved=k + 1)
        sc.hop("step", back, 0.6)
        sc.set(shown=k + 1)
    sc.hold(2.2)
    sc.step("6. More work waiting means more workers", 0.4, on={"queue"}, busy={0}, shown=0, saved=0)
    for k in range(1, 7):
        sc.set(queue=["lead"] * k)
        sc.hold(0.2)
    for n in (2, 3, 4):
        sc.set(workers=n, on={"queue", "w"})
        sc.hold(0.5)
    sc.set(busy={0, 1, 2, 3})
    for k in range(6, -1, -1):
        sc.set(queue=["lead"] * k)
        sc.hold(0.3)
    sc.hold(1.2)
    sc.set(busy=set(), on=set())
    sc.hold(2.0)
    sc.save()


# ============================================================ one queue per level: the deadlock, then the fix
def depth():
    TOP, LOW = 1.15, 3.0                       # the two rows: one queue, then a queue per level
    GS = 0.6
    R1 = [(3.75, TOP + 0.75), (5.15, TOP + 0.75)]                  # row 1: one gear per worker
    FR = [(3.2, LOW + 0.05), (5.55, LOW + 0.05)]                   # row 2: a frame per worker
    FW, FH = 2.1, 1.55

    def slot_xy(i, k):
        """Row 2: worker i's gear for level k (0 lead, 1 reader)."""
        x, y = FR[i]
        return x + 0.6 + k * 0.95, y + 0.88

    def held(c, x, y, item, turn):
        """A gear and the job it holds: a busy gear turns, a waiting gear stops and shows a clock."""
        if not item:
            gear(c, x, y, GS)
            return
        kind, waiting = item
        gear(c, x, y, GS, busy=not waiting, lit=True, turn=turn)
        r = 0.12
        c.d.rectangle([c._p(x - r), c._p(y - r), c._p(x + r), c._p(y + r)], fill=(0, 0, 0))
        c.job(x, y, kind, hollow=waiting, s=0.17)
        if waiting:
            clock(c, x + GS * 0.48, y - GS * 0.48)

    def paint(c, st):
        t = st["turn"]
        # row 1: one queue for every job
        c.text(0.3, TOP - 0.05, 4, 0.3, "one queue", 14, "Medium", INK2, "left")
        c.queue(0.3, TOP + 0.59, 6, st["q"], "", st["qa"])
        c.arrow([(2.3, TOP + 0.75), (R1[0][0] - GS / 2 - 0.08, TOP + 0.75)], st["qa"])
        for i, (x, y) in enumerate(R1):
            held(c, x, y, st["w"][i][0], t + i * 0.4)
            c.text(x - 0.7, y + GS / 2 + 0.06, 1.4, 0.3, "worker %d" % (i + 1), 14, "Medium", INK2)
        if st["stuck"]:
            c.invert(6.3, TOP + 0.5, "deadlock: no worker is free", 16)
        # row 2: a queue for each level, and a gear for each level in every worker
        if not st["fix"]:
            return
        c.text(0.3, LOW - 0.05, 5, 0.3, "a queue for each level", 14, "Medium", INK, "left")
        c.queue(0.3, LOW + 0.45, 4, st["q0"], "", False)
        c.text(1.66, LOW + 0.45, 1.5, 0.32, "leads", 13, "Regular", INK2, "left")
        c.queue(0.3, LOW + 1.0, 4, st["q1"], "", False)
        c.text(1.66, LOW + 1.0, 1.5, 0.32, "readers", 13, "Regular", INK2, "left")
        c.arrow([(2.6, LOW + 0.93), (FR[0][0] - 0.08, LOW + 0.93)])
        for i, (x, y) in enumerate(FR):
            c.box(x, y, FW, FH, "", "faint")
            c.text(x + 0.1, y + 0.04, FW, 0.28, "worker %d" % (i + 1), 13, "Medium", INK3, "left")
            for k, name in enumerate(("lead", "reader")):
                gx, gy = slot_xy(i, k)
                held(c, gx, gy, st["v"][i][k], t + i * 0.3 + k * 0.5)
                c.text(gx - 0.5, gy + GS / 2 + 0.04, 1.0, 0.28, name, 13, "Regular", INK2)
        c.number(8.4, LOW + 0.05, 2.5, str(st["done"]), "questions done", 32)
        if st["all"]:
            c.invert(8.4, LOW + 1.05, "all 3 finish", 16)

    def busy_of(st):
        """The gears that turn: those that hold a job and do not wait."""
        rows = [st["w"][0][0], st["w"][1][0]] + [it for v in st["v"] for it in v]
        return {k for k, it in enumerate(rows) if it and not it[1]}

    st = dict(q=["lead", "lead"], qa=True, w=[[None], [None]], stuck=False, fix=False,
              q0=[], q1=[], v=[[None, None], [None, None]], done=0, all=False)
    sc = Live("depth.gif", paint, st)

    def put(**changes):
        sc.set(**changes)
        sc.st["busy"] = busy_of(sc.st)

    gate = R1[0][0] - GS / 2 - 0.08
    sc.step("1. One shared queue: two leads take both workers", 0.8)
    put(q=["lead"])
    sc.hop("lead", [(0.46, TOP + 0.75), (gate, TOP + 0.75), R1[0]], 0.7)
    put(w=[[("lead", False)], [None]])
    put(q=[])
    sc.hop("lead", [(0.78, TOP + 0.75), (gate, TOP + 0.75), (R1[1][0], TOP + 0.75)], 0.8)
    put(w=[[("lead", False)], [("lead", False)]])
    sc.hold(2.4)
    sc.step("2. Each lead asks for readers, and waits for them", 0.3)
    put(w=[[("lead", True)], [("lead", True)]])
    for k in range(1, 7):
        sc.set(q=["reader"] * k)
        sc.hold(0.25)
    sc.hold(1.6)
    sc.step("3. The readers wait for a worker; the workers wait for the readers", 2.9, stuck=True, qa=False)
    sc.step("4. Our fix: every worker has a slot for each level, fed by its own queue", 2.6,
            fix=True, q0=["lead", "lead", "lead"])
    sc.title = "5. A lead waits in its slot; its readers run in the reader slots"
    entry = (FR[0][0] - 0.08, LOW + 0.93)
    for n in range(3):
        put(q0=["lead"] * (2 - n))
        sc.hop("lead", [(0.46, LOW + 0.61), (2.6, LOW + 0.93), entry, slot_xy(0, 0)], 0.5)
        put(v=[[("lead", False), None], [None, None]])
        sc.hold(0.3)
        put(v=[[("lead", True), None], [None, None]], q1=["reader"] * 3)
        sc.hold(0.3)
        for k in range(3):
            i = k % 2
            sc.set(q1=["reader"] * (2 - k))
            sc.hop("reader", [(0.46, LOW + 1.16), (2.6, LOW + 0.93), entry,
                              (entry[0] + 0.15, LOW + 0.93), (entry[0] + 0.15, LOW + 0.47),
                              (slot_xy(i, 1)[0], LOW + 0.47), slot_xy(i, 1)], 0.45)
            v = [[("lead", True), None], [None, None]]
            v[i][1] = ("reader", False)
            put(v=v)
            sc.hold(0.35)
            v[i][1] = None
            put(v=v)
        put(v=[[None, None], [None, None]], done=n + 1)
        sc.hold(0.5)
    sc.step("6. The deepest level waits for nothing, so every question finishes", 3.0, all=True)
    sc.save()


# ============================================================ stills for the title and end slides
def stills():
    """lumen's sphere among stars, as the landing page draws it: the one halftone picture."""
    import draw
    old = draw.W, draw.H
    draw.W, draw.H = 13.333, 7.5
    try:
        c = Canvas()
        rnd = random.Random(7)
        for _ in range(240):
            x, y = rnd.uniform(7.8, 13.3), rnd.uniform(0.1, 7.4)
            r = rnd.choice((0.012, 0.018, 0.026))
            c.d.ellipse([c._p(x - r), c._p(y - r), c._p(x + r), c._p(y + r)], fill=(255, 255, 255))
        c.sphere(10.4, 3.75, 2.45, 1.0)
        c.frame().save(os.path.join(OUT, "title.png"))
    finally:
        draw.W, draw.H = old
    print("title.png")


SCENES = dict(services=services, depth=depth, stills=stills)
