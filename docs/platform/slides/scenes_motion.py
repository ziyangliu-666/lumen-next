"""Prototype of the motion grammar for the ASS deck: elasticity as divide and merge.

scale2: the worker deployment divides like a cell when the queue passes KEDA's target, and the
replicas merge back when the load ends. The picture stays a UML deployment view.
"""
from draw import BLACK, INK, INK2, INK3, RAISED, RULE, Scene, lerp, mix
from scenes_std import comp, node


def ink(color, a):
    return mix(BLACK, color, a)


def scale2():
    K3S = (0.5, 1.15, 11.1, 3.7)                # the k3s cluster inside the EC2 node
    QX, QY, CELL, NQ = 1.0, 3.0, 0.3, 16        # the RabbitMQ queue: 16 cells
    WX, WY, WW, WH, GAP = 7.2, 2.1, 1.6, 0.55, 0.66   # worker replicas, stacked
    KEDA = (1.0, 1.75, 4.8, 0.82)

    def paint(c, st):
        node(c, *K3S, "k3s cluster on one EC2 t3.medium", "Kubernetes", depth=0.12)
        # KEDA watches the queue and sets the replica count
        jobs, workers = st["jobs"], st["workers"]
        per = jobs / max(1, workers)
        lit = st["keda"]
        comp(c, *KEDA, "KEDA", "%d turns waiting / %d worker%s = %.1f per worker   (target 5)" %
             (jobs, workers, "" if workers == 1 else "s", per), lit=lit, mark=False)
        # the queue
        c.text(QX, QY - 0.36, 4, 0.3, "RabbitMQ: turns waiting", 13, "Regular", INK2, "left")
        c.d.rectangle([c._p(QX), c._p(QY), c._p(QX + NQ * CELL), c._p(QY + CELL)], outline=INK2,
                      width=c._lw(1.5))
        for j in range(1, NQ):
            xx = c._p(QX + j * CELL)
            c.d.line([(xx, c._p(QY)), (xx, c._p(QY + CELL))], fill=RULE, width=c._lw(1))
        for j in range(min(NQ, jobs)):
            x = QX + j * CELL + 0.06
            c.d.rectangle([c._p(x), c._p(QY + 0.06), c._p(x + CELL - 0.12), c._p(QY + CELL - 0.06)], fill=INK)
        if jobs > NQ:
            c.text(QX + NQ * CELL - 1.0, QY - 0.36, 1.0, 0.3, "+%d more" % (jobs - NQ), 13, "Regular", INK, "right")
        # the line from the queue to the workers
        c.d.line([(c._p(QX + NQ * CELL), c._p(QY + CELL / 2)), (c._p(WX - 0.25), c._p(QY + CELL / 2))],
                 fill=INK2, width=c._lw(1.5))
        # worker replicas: each is a pod; a new one splits out of the one above it
        c.text(WX, WY - 0.36, 3, 0.3, "worker deployment", 13, "Regular", INK2, "left")
        for i, y in reversed(list(enumerate(st["ys"]))):   # the parent stays on top of a child
            a = st["alpha"][i]
            if a <= 0.01:
                continue
            w = WW + st["stretch"][i]
            edge = ink(INK if st["busy"] else INK2, a)
            c.d.rectangle([c._p(WX), c._p(y), c._p(WX + w), c._p(y + WH)], fill=ink(RAISED, a) if st["busy"]
                          else BLACK, outline=edge, width=c._lw(2 if st["busy"] else 1.5))
            c.text(WX, y, w, WH, "worker %d" % (i + 1), 14, "Semibold", ink(INK, a))
        c.text(WX + WW + 0.4, WY + 0.15, 3.0, 0.4, "%d pod%s" % (workers, "" if workers == 1 else "s"),
               26, "Semibold", INK, "left")
        c.text(WX + WW + 0.4, WY + 0.6, 3.0, 0.3, "replicas 1 to 4", 13, "Regular", INK3, "left")

    st = dict(jobs=0, workers=1, keda=False, busy=False, ys=[WY, WY, WY, WY], alpha=[1, 0, 0, 0],
              stretch=[0, 0, 0, 0])
    sc = Scene("scale2.gif", paint, st)
    sc.step("One worker pod; KEDA watches the queue of turns", 2.2)

    def divide(i):
        """Pod i splits out of pod i - 1: the parent stretches, then the child slides down."""
        sc.tween(0.35, lambda v: st["stretch"].__setitem__(i - 1, 0.35 * v))
        st["alpha"][i] = 1.0
        y0, y1 = st["ys"][i - 1], WY + i * GAP
        sc.tween(0.6, lambda v: (st["ys"].__setitem__(i, lerp(y0, y1, v)),
                                 st["stretch"].__setitem__(i - 1, 0.35 * (1 - v))))
        st["workers"] = i + 1

    def merge(i):
        """Pod i slides back into pod i - 1 and is gone."""
        y0, y1 = st["ys"][i], st["ys"][i - 1]
        sc.tween(0.6, lambda v: (st["ys"].__setitem__(i, lerp(y0, y1, v)),
                                 st["alpha"].__setitem__(i, 1 - v)))
        st["workers"] = i

    sc.title = "Ten users ask without pause: turns pile up faster than one worker takes them"
    sc.set(busy=True)
    for j in (2, 4, 6, 8):
        sc.set(jobs=j)
        sc.hold(0.35)
    for n in (1, 2, 3):
        sc.title = "Above 5 waiting turns per worker, KEDA adds a pod: the worker divides"
        sc.set(jobs=st["jobs"] + 4, keda=True)
        sc.hold(0.6)
        divide(n)
        sc.set(keda=False)
        sc.hold(0.4)
    sc.title = "Four workers take turns faster than they arrive: the queue drains"
    for j in range(st["jobs"], -1, -2):
        sc.set(jobs=j)
        sc.hold(0.18)
    sc.hold(0.8)
    sc.title = "The load ends; a minute later KEDA removes the extra pods: they merge back"
    sc.set(busy=False, keda=True)
    sc.hold(0.8)
    for n in (3, 2, 1):
        merge(n)
        sc.hold(0.3)
    sc.set(keda=False)
    sc.title = "Load test, 20 October: 1 to 4 workers in 49 s, back to 1 after the load"
    sc.hold(2.4)
    sc.save()


SCENES = dict(scale2=scale2)
