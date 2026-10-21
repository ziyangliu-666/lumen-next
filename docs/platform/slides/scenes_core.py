"""Two scenes that set the pattern for the rest: the services, and the queue per level.
Also the stills for the title and end slides."""
import os
import random

from draw import INK, INK2, OUT, W, Canvas, Scene, lerp


# ============================================================ the services, one question through them
def services():
    B = dict(browser=(0.3, 2.45, 1.3, 0.75), gateway=(1.95, 2.45, 1.45, 0.75),
             project=(3.85, 1.5, 1.6, 0.7), session=(3.85, 2.475, 1.6, 0.7),
             identity=(3.85, 3.45, 1.6, 0.6), billing=(3.85, 4.2, 1.6, 0.6),
             db=(10.4, 2.45, 1.45, 0.75))
    QX, QY, CELL, N = 6.0, 2.66, 0.32, 6
    WK = [(8.35, 1.3), (8.35, 2.05), (8.35, 2.8), (8.35, 3.55)]

    def paint(c, st):
        on = st["on"]
        for name in ("browser", "gateway", "project", "session", "identity", "billing"):
            x, y, w, h = B[name]
            label = {"browser": "browser", "gateway": "gateway", "db": "PostgreSQL"}.get(name, name)
            state = "active" if name in on else ("faint" if name in ("identity", "billing") else "idle")
            c.box(x, y, w, h, label, state, size=15, sub="Traefik" if name == "gateway" else None)
        c.arrow([(1.6, 2.82), (1.95, 2.82)], "gateway" in on)
        c.arrow([(3.4, 2.82), (3.62, 2.82), (3.62, 1.85), (3.85, 1.85)], "project" in on)
        c.arrow([(4.65, 2.2), (4.65, 2.475)], "session" in on and "project" in st["seen"])
        c.arrow([(5.45, 2.82), (QX, 2.82)], "queue" in on)
        c.queue(QX, QY, N, st["queue"], "RabbitMQ queue", "queue" in on, CELL)
        c.text(8.35, 0.98, 2, 0.3, "workers", 14, "Medium", INK2, "left")
        for i in range(st["workers"]):
            x, y = WK[i]
            name = "w%d" % i
            c.box(x, y, 1.5, 0.6, "worker", "active" if name in on else "idle", size=14)
            if i in st["busy"]:
                c.job(x + 1.28, y + 0.3, "lead", s=0.16)
        c.arrow([(QX + N * CELL, 2.82), (8.1, 2.82), (8.1, 1.6), (8.35, 1.6)], "w0" in on and "queue" in on)
        # every step is saved in the shared database
        c.line([(9.85, 1.6), (10.1, 1.6), (10.1, 2.82), (10.4, 2.82)], "db" in on)
        c.box(*B["db"], "PostgreSQL", "active" if "db" in on else "idle", size=15)

    sc = Scene("services.gif", paint, dict(on=set(), seen=set(), queue=[], workers=1, busy=set()))
    sc.step("1. The gateway sends a question to project", 0.6)
    sc.hop("lead", [(1.6, 2.82), (1.95, 2.82)], 0.6)
    sc.set(on={"gateway"})
    sc.hop("lead", [(3.4, 2.82), (3.62, 2.82), (3.62, 1.85), (3.85, 1.85)], 0.7)
    sc.set(on={"project"}, seen={"project"})
    sc.hold(2.4)
    sc.step("2. Project opens a session", 0.3)
    sc.hop("lead", [(4.65, 2.2), (4.65, 2.6)], 0.6)
    sc.set(on={"session"})
    sc.hold(2.4)
    sc.step("3. Session puts the work in a RabbitMQ queue", 0.3, on={"session", "queue"})
    sc.hop("lead", [(5.45, 2.82), (QX + CELL / 2, 2.82)], 0.7)
    sc.set(queue=["lead"])
    sc.hold(2.4)
    sc.step("4. A worker takes it and runs the agent", 0.3, on={"queue", "w0"})
    sc.set(queue=[])
    sc.hop("lead", [(QX + CELL / 2, 2.82), (QX + N * CELL, 2.82), (8.1, 2.82), (8.1, 1.6), (9.6, 1.6)], 0.9)
    sc.set(on={"w0"}, busy={0})
    sc.hold(2.4)
    sc.step("5. Every step is saved, and shown on the screen", 0.3, on={"w0", "db", "session"})
    for _ in range(2):
        sc.hop("step", [(9.85, 1.6), (10.1, 1.6), (10.1, 2.82), (10.4, 2.82)], 0.5)
        sc.hop("step", [(5.45, 3.0), (3.62, 3.0), (3.62, 2.95), (1.6, 2.95)], 0.6)
    sc.hold(2.0)
    sc.step("6. More work waiting means more workers", 0.4, on={"queue"}, busy=set())
    for k in range(1, 7):
        sc.set(queue=["lead"] * k)
        sc.hold(0.2)
    for n in (2, 3, 4):
        sc.set(workers=n, on={"queue", "w%d" % (n - 1)})
        sc.hold(0.6)
    sc.set(busy={0, 1, 2, 3}, on={"w0", "w1", "w2", "w3"})
    for k in range(6, -1, -1):
        sc.set(queue=["lead"] * k)
        sc.hold(0.25)
    sc.hold(2.6)
    sc.save()


# ============================================================ one queue per level: the deadlock, then the fix
def depth():
    TOP, LOW = 1.25, 3.25                      # the two rows: one queue, then a queue per level

    def worker(c, x, y, slots, contents, active=False, label="worker"):
        """A worker with its slots: each slot holds a job, or is empty."""
        w = 0.62 + 0.62 * len(slots)
        c.box(x, y, w + 0.2, 1.0, "", "active" if active else "idle")
        c.text(x, y + 0.04, w + 0.2, 0.3, label, 14, "Medium", INK if active else INK2)
        for k, slot in enumerate(slots):
            sx = x + 0.2 + k * 0.62
            c.box(sx, y + 0.38, 0.5, 0.5, "", "idle")
            item = contents[k]
            if item:
                kind, waiting = item
                c.job(sx + 0.25, y + 0.63, kind, hollow=waiting)
            if len(slots) > 1:
                c.text(sx - 0.05, y + 0.9, 0.6, 0.28, slot, 13, "Regular", INK2)
        if any(item and item[1] for item in contents) and len(slots) == 1:
            c.text(x, y + 1.05, w + 0.2, 0.3, "waiting", 13, "Medium", INK2)

    def paint(c, st):
        # row 1: one queue for every job
        c.text(0.3, TOP - 0.05, 4, 0.3, "one queue for every job", 14, "Medium", INK2, "left")
        c.queue(0.3, TOP + 0.45, 6, st["q"], "", st["qa"])
        c.arrow([(2.25, TOP + 0.61), (3.3, TOP + 0.61)], st["qa"])
        for i in range(2):
            worker(c, 3.4 + i * 1.55, TOP + 0.1, ["slot"], st["w"][i], st["wa"][i], "worker %d" % (i + 1))
        if st["stuck"]:
            c.invert(6.75, TOP + 0.38, "stuck: no worker is free", 16)
        # row 2: a queue for each level, and a slot for each level in every worker
        if st["fix"]:
            c.text(0.3, LOW - 0.05, 5, 0.3, "a queue for each level", 14, "Medium", INK, "left")
            c.queue(0.3, LOW + 0.4, 4, st["q0"], "", False)
            c.text(1.65, LOW + 0.4, 1.5, 0.32, "leads", 13, "Regular", INK2, "left")
            c.queue(0.3, LOW + 0.95, 4, st["q1"], "", False)
            c.text(1.65, LOW + 0.95, 1.5, 0.32, "readers", 13, "Regular", INK2, "left")
            c.arrow([(2.6, LOW + 0.85), (3.3, LOW + 0.85)])
            for i in range(2):
                worker(c, 3.4 + i * 2.15, LOW + 0.1, ["lead", "reader"], st["v"][i], st["va"][i],
                       "worker %d" % (i + 1))
            c.number(8.4, LOW + 0.05, 2.5, str(st["done"]), "questions done", 32)
            if st["all"]:
                c.invert(8.4, LOW + 1.05, "all 3 finish", 16)

    st = dict(q=["lead", "lead"], qa=True, w=[[None], [None]], wa=[False, False], stuck=False, fix=False,
              q0=[], q1=[], v=[[None, None], [None, None]], va=[False, False], done=0, all=False)
    sc = Scene("depth.gif", paint, st)
    sc.step("1. One shared queue: two leads take both workers", 0.8)
    sc.hop("lead", [(0.46, TOP + 0.61), (3.85, TOP + 0.85)], 0.7)
    sc.set(q=["lead"], w=[[("lead", False)], [None]], wa=[True, False])
    sc.hop("lead", [(0.46, TOP + 0.61), (5.4, TOP + 0.85)], 0.7)
    sc.set(q=[], w=[[("lead", False)], [("lead", False)]], wa=[True, True])
    sc.hold(2.4)
    sc.step("2. Each lead asks for readers, and waits for them", 0.5,
            w=[[("lead", True)], [("lead", True)]], wa=[False, False])
    for k in range(1, 7):
        sc.set(q=["reader"] * k)
        sc.hold(0.25)
    sc.hold(1.6)
    sc.step("3. The readers wait for a worker; the workers wait for the readers", 3.2, stuck=True)
    sc.step("4. Our fix: every worker has a slot for each level, fed by its own queue", 2.8,
            fix=True, q0=["lead", "lead", "lead"])
    sc.title = "5. A lead waits in its slot; its readers run in the reader slots"
    for n in range(3):
        sc.set(q0=["lead"] * (2 - n))
        sc.hop("lead", [(0.46, LOW + 0.56), (3.85, LOW + 0.73)], 0.5)
        sc.set(v=[[("lead", True), None], [None, None]], va=[True, False], q1=["reader"] * 3)
        sc.hold(0.5)
        for r in range(3):
            target = (4.47, LOW + 0.73) if r % 2 == 0 else (6.62, LOW + 0.73)
            sc.set(q1=["reader"] * (2 - r))
            sc.hop("reader", [(0.46, LOW + 1.11), target], 0.4)
            slot = [[("lead", True), ("reader", False)], [None, None]] if r % 2 == 0 else \
                [[("lead", True), None], [None, ("reader", False)]]
            sc.set(v=slot, va=[True, r % 2 == 1])
            sc.hold(0.35)
        sc.set(v=[[None, None], [None, None]], va=[False, False], done=n + 1)
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
