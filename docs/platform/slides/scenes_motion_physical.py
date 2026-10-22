"""The physical and DevOps pictures, redrawn with the motion grammar (SWE5006 slides/MOTION.md).

Each motion has one meaning, and each picture stays the standard diagram the lecturer knows:
- a line grows from its source to its target, and the target pulses once: a dependency;
- a spotlight lights one element with every related element, and dims the rest to 28%;
- a refactoring morph moves boxes into their new shape: a decision's before and after;
- divide and merge: replicas split out of a pod and merge back, which is elasticity;
- parallel lanes grow at the same time, and a loop grows one step after another.

No tag travels along a line here: none of these pictures shows a message at run time.
Every picture ends on its complete diagram, held, with nothing lit.

The facts come from scenes_std.py, scenes_std_overview.py, scenes_std_design.py,
scenes_std_devops.py and docs/platform/report/report.md.
"""
import math

import draw
from draw import BLACK, FPS, INK, INK2, INK3, RAISED, RULE, RULE2, W, Canvas, Scene, font, lerp, mix, S, X2
from scenes_proof import _invert_lines, _scaling

DIM = 0.28                                     # the ink of an element outside the spotlight


# ---------------------------------------------------------------- drawing helpers
def ink(color, a):
    """A colour faded towards the black page: a = 1 is the colour, a = 0 is invisible."""
    return mix(BLACK, color, a)


def tw(text, size=13, weight="Regular", mono=False):
    """The width of one line of text, in inches."""
    return font(size, weight, mono).getlength(text) / (S * X2)


def grow(pts, u):
    """The first fraction u of a polyline: a line that grows from its source."""
    if u >= 1:
        return list(pts)
    segs = list(zip(pts, pts[1:]))
    lens = [math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in segs]
    left = max(0.0, u) * sum(lens)
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


def line(c, pts, col, pt=1.5, dashed=False):
    """A plain or dashed polyline in one colour."""
    if len(pts) < 2:
        return
    if not dashed:
        c.d.line([(c._p(x), c._p(y)) for x, y in pts], fill=col, width=c._lw(pt), joint="curve")
        return
    on, left = True, 0.08
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        seg = math.hypot(x2 - x1, y2 - y1)
        pos = 0.0
        while pos < seg - 1e-9:
            run = min(left, seg - pos)
            if on:
                a, b = pos / seg, (pos + run) / seg
                c.d.line([(c._p(lerp(x1, x2, a)), c._p(lerp(y1, y2, a))),
                          (c._p(lerp(x1, x2, b)), c._p(lerp(y1, y2, b)))], fill=col, width=c._lw(pt))
            pos += run
            left -= run
            if left <= 1e-9:
                on = not on
                left = 0.08 if on else 0.06


def arrowhead(c, tip, frm, col, open_=False):
    """An arrowhead at tip, pointing away from frm: filled, or open (two strokes)."""
    (x2, y2), (x1, y1) = tip, frm
    n = max(1e-6, math.hypot(x2 - x1, y2 - y1))
    ux, uy = (x2 - x1) / n, (y2 - y1) / n
    L, Wd = (0.11, 0.06) if open_ else (0.1, 0.055)
    a = (x2 - ux * L - uy * Wd, y2 - uy * L + ux * Wd)
    b = (x2 - ux * L + uy * Wd, y2 - uy * L - ux * Wd)
    if open_:
        for p in (a, b):
            c.d.line([(c._p(x2), c._p(y2)), (c._p(p[0]), c._p(p[1]))], fill=col, width=c._lw(1.5))
    else:
        c.d.polygon([(c._p(x2), c._p(y2)), (c._p(a[0]), c._p(a[1])), (c._p(b[0]), c._p(b[1]))], fill=col)


def arrow(c, pts, u, col, pt=1.5, dashed=False, open_=False):
    """A connector grown to fraction u; its head shows once it reaches its target."""
    if u <= 0:
        return
    part = grow(pts, u)
    line(c, part, col, pt, dashed)
    if u >= 1:
        arrowhead(c, pts[-1], pts[-2], col, open_)


def pulse(st, key, length=0.5):
    """How strongly a target pulses now: 0, rising to 1 and back over `length` seconds after
    st['pulse'][key] was set. A target pulses once when a line reaches it."""
    t0 = st.get("pulse", {}).get(key)
    if t0 is None:
        return 0.0
    u = (draw.NOW - t0) / length
    return math.sin(math.pi * u) if 0 <= u <= 1 else 0.0


def text(c, x, y, w, h, s, size=13, weight="Regular", col=INK2, align="left", mono=False):
    c.text(x, y, w, h, s, size, weight, col, align, mono)


def box(c, x, y, w, h, a=1.0, lit=False, p=0.0, fill=None, pt=None):
    """A plain box. lit: white edge on a raised fill; p: a pulse, 0 to 1."""
    edge = ink(INK if (lit or p > 0.05) else INK2, a)
    f = fill if fill is not None else (ink(RAISED, a) if lit else BLACK)
    if p > 0.05 and not lit:
        f = mix(BLACK, RAISED, p)
    width = pt if pt is not None else (2 if lit else 1.5) + 1.5 * p
    c.d.rectangle([c._p(x), c._p(y), c._p(x + w), c._p(y + h)], fill=f, outline=edge, width=c._lw(width))


def comp(c, x, y, w, h, name, note="", a=1.0, lit=False, p=0.0, size=15, name_col=None):
    """A part: a box with its name, and an optional note under the name."""
    box(c, x, y, w, h, a, lit, p)
    nc = name_col or INK
    if note:
        text(c, x + 0.14, y + 0.08, w - 0.2, 0.3, name, size, "Semibold", ink(nc, a))
        text(c, x + 0.14, y + 0.4, w - 0.2, h - 0.48, note, 13, "Regular", ink(INK2, a))
    else:
        text(c, x, y, w, h, name, size, "Semibold", ink(nc, a), "center")


def node(c, x, y, w, h, name="", stereo="", depth=0.14, a=1.0, lit=False, p=0.0, sub=""):
    """A UML deployment node: a box seen from above right, with its stereotype and name."""
    edge = ink(INK if (lit or p > 0.05) else INK2, a)
    lw = c._lw(1.5 + (0.5 if lit else 0) + 1.5 * p)
    d = depth
    if lit:
        c.d.rectangle([c._p(x), c._p(y), c._p(x + w), c._p(y + h)], fill=ink(RAISED, a))
    c.d.polygon([(c._p(x), c._p(y)), (c._p(x + d), c._p(y - d)), (c._p(x + w + d), c._p(y - d)),
                 (c._p(x + w), c._p(y))], outline=edge, width=lw)
    c.d.polygon([(c._p(x + w), c._p(y)), (c._p(x + w + d), c._p(y - d)), (c._p(x + w + d), c._p(y + h - d)),
                 (c._p(x + w), c._p(y + h))], outline=edge, width=lw)
    c.d.rectangle([c._p(x), c._p(y), c._p(x + w), c._p(y + h)], outline=edge, width=lw)
    top = y + 0.06
    if stereo:
        text(c, x + 0.14, top, w, 0.28, "«%s»" % stereo, 13, "Regular", ink(INK2, a))
        top += 0.26
    if name:
        lines = name.count("\n") + 1
        text(c, x + 0.14, top, w, 0.3 * lines, name, 15, "Semibold", ink(INK, a))
        if sub:
            text(c, x + 0.24 + tw(name.split("\n")[0], 15, "Semibold"), top + 0.01, w, 0.3, sub, 13, "Regular",
                 ink(INK2, a))


def rect_lerp(r0, r1, u):
    return tuple(lerp(r0[i], r1[i], u) for i in range(4))


def scaled(r, u, anchor=None):
    """Rect r grown to fraction u around an anchor point (its centre by default)."""
    x, y, w, h = r
    ax, ay = anchor or (x + w / 2, y + h / 2)
    return (lerp(ax, x, u), lerp(ay, y, u), w * u, h * u)


class HighScene(Scene):
    """A scene whose step title sits higher than draw.Scene's, for a picture that needs the
    whole height (the ER diagram, the sequence diagram)."""

    def _draw(self):
        draw.NOW = self.t
        c = Canvas()
        c.text(0.3, 0.02, W - 0.6, 0.44, self.title, 23, "Medium", INK, "left")
        self.paint(c, self.st)
        return c.frame()


def kick(sc, key):
    """Start the one pulse of a target, now."""
    sc.st.setdefault("pulse", {})[key] = sc.t


def divide_offset(p, stretch):
    """Divide and merge, as two numbers from one progress p (0 to 1): how far the parent pod
    has stretched, and how far the child has slid out of it towards its own place."""
    if p <= 0:
        return 0.0, 0.0
    if p < 0.4:
        return stretch * draw.ease(p / 0.4), 0.0
    s = draw.ease((p - 0.4) / 0.6)
    return stretch * (1 - s), s


def pod_row(c, slots, w, h, prog, horizontal=True, label="", a=1.0, lit=False, stretch=0.18, size=13):
    """Replicas of one pod. slots: the (x, y) of each replica; prog[k]: how far replica k has
    divided out of replica k - 1 (0 hidden, 1 in its place). Replica 0 always shows."""
    n = len(slots)
    ext = [0.0] * n                            # how much each parent stretches now
    pos = [slots[0]] + [None] * (n - 1)
    for k in range(1, n):
        if prog[k] <= 0:
            continue
        s_par, s = divide_offset(prog[k], stretch)
        ext[k - 1] += s_par
        # from where the parent is now, so a parent that merges takes its child with it
        px, py = pos[k - 1] if pos[k - 1] is not None else slots[k - 1]
        pos[k] = (lerp(px, slots[k][0], s), lerp(py, slots[k][1], s))
    for k in reversed(range(n)):               # a parent stays on top of the child it divides into
        if pos[k] is None:
            continue
        x, y = pos[k]
        bw, bh = (w + ext[k], h) if horizontal else (w, h + ext[k])
        box(c, x, y, bw, bh, a, lit, fill=ink(RAISED, a))
        if label:
            text(c, x, y, bw, bh, label if "%d" not in label else label % (k + 1), size, "Semibold" if size > 13
                 else "Medium", ink(INK, a), "center")


# ---------------------------------------------------------------- 4a: physdecisions
def physdecisions():
    """AD-09, AD-11 and AD-06, each as a small before-and-after morph."""
    PX = [0.15, 4.2, 8.25]
    CY = 4.18                                   # the captions' line
    CAP = [("AD-09", "k3s on one EC2 t3.medium, not EKS", "the laptop chart, unchanged; USD 1.3 a day"),
           ("AD-11", "HPA on CPU; KEDA on queue length", "a worker waits on the model, so its CPU is low"),
           ("AD-06", "One PostgreSQL, tables per context", "one transaction: step, cost, ledger entry")]

    # (a) AD-09
    a0 = PX[0]
    CHART = (a0 + 0.1, 1.32, 1.3, 0.4)
    EKS_SMALL = (a0 + 2.65, 1.32, 1.1, 0.38)
    OUTER0, OUTER1 = (a0 + 0.04, 1.98, 3.6, 2.1), (a0 + 0.1, 2.02, 3.45, 2.04)
    K3S = (a0 + 0.22, 2.6, 3.2, 1.36)
    PLANE = (a0 + 0.24, 2.66, 3.22, 0.4)
    NODES = [(a0 + 0.24 + i * 1.1, 3.26, 1.0, 0.7) for i in range(3)]
    PODS = ["identity", "project", "session", "worker", "billing", "postgres", "rabbitmq", "traefik", "keda"]
    TO_CLUSTER = [(a0 + 0.75, CHART[1] + CHART[3]), (a0 + 0.75, OUTER1[1] - 0.16)]
    TO_EKS = [(CHART[0] + CHART[2], 1.51), (EKS_SMALL[0], 1.51)]

    # (b) AD-11
    b0 = PX[1]
    PODX, PODW, PODH = b0 + 0.95, 0.55, 0.24       # every pod has one size, HPA's and KEDA's
    HROWS = [("identity", 1.95), ("project", 2.24), ("billing", 2.53)]
    QX, QCELL, QN, QY = b0 + 0.95, 0.25, 8, 3.2
    WROW, WW = 3.52, 0.55
    CPU2 = 3.84

    # (c) AD-06: before, a database per service; after, one PostgreSQL with a frame per context
    c0 = PX[2]
    FW, FH = 1.62, 0.84
    CTX = [("identity", ["accounts"], (c0 + 0.08, 1.38), (c0 + 0.24, 2.1)),
           ("project", ["projects", "findings"], (c0 + 2.05, 1.38), (c0 + 1.9, 2.1)),
           ("session", ["steps", "tasks.own_cost"], (c0 + 0.08, 2.9), (c0 + 0.24, 2.98)),
           ("billing", ["ledger_entries"], (c0 + 2.05, 2.9), (c0 + 1.9, 2.98))]
    PG = (c0 + 0.1, 1.5, 3.55, 2.55)
    TX = {"steps", "tasks.own_cost", "ledger_entries"}     # the rows of the one transaction

    def cylinder(c, x, y, w, h, ry, a=1.0, lit=False, fill=BLACK):
        """A database: a cylinder; ry is the height of its top ellipse (0 gives a plain frame)."""
        edge = ink(INK if lit else INK2, a)
        lw = c._lw(2 if lit else 1.5)
        if ry < 0.01:
            c.d.rectangle([c._p(x), c._p(y), c._p(x + w), c._p(y + h)], fill=fill, outline=edge, width=lw)
            return
        c.d.rectangle([c._p(x), c._p(y + ry), c._p(x + w), c._p(y + h - ry)], fill=fill)
        c.d.ellipse([c._p(x), c._p(y + h - 2 * ry), c._p(x + w), c._p(y + h)], fill=fill, outline=edge, width=lw)
        c.d.rectangle([c._p(x) + lw, c._p(y + ry), c._p(x + w) - lw, c._p(y + h - ry)], fill=fill)
        c.d.line([(c._p(x), c._p(y + ry)), (c._p(x), c._p(y + h - ry))], fill=edge, width=lw)
        c.d.line([(c._p(x + w), c._p(y + ry)), (c._p(x + w), c._p(y + h - ry))], fill=edge, width=lw)
        c.d.ellipse([c._p(x), c._p(y), c._p(x + w), c._p(y + 2 * ry)], fill=fill, outline=edge, width=lw)

    def cpu_bar(c, x, y, u, w=1.2, faint=False):
        c.d.rectangle([c._p(x), c._p(y), c._p(x + w), c._p(y + 0.18)], outline=INK2, width=c._lw(1.5))
        if u > 0:
            c.d.rectangle([c._p(x), c._p(y), c._p(x + w * u), c._p(y + 0.18)], fill=INK if u >= 0.7 else INK2)
        mx = x + w * 0.7
        c.line([(mx, y - 0.06), (mx, y + 0.24)], color=INK)

    def paint(c, st):
        for x in (4.05, 8.1):
            c.line([(x, 1.0), (x, 4.78)], color=RULE2)
        for k in range(3):
            if st["panel"] > k:
                x0 = PX[k]
                ident, cap, sub = CAP[k]
                text(c, x0 + 0.1, 0.98, 1, 0.28, ident, 13, "Medium", INK2)
                if st["cap"] > k:
                    text(c, x0 + 0.1, CY, 3.8, 0.32, cap, 15, "Semibold", INK)
                    text(c, x0 + 0.1, CY + 0.34, 3.8, 0.28, sub, 13, "Regular", INK2)

        # (a) AD-09: an EKS cluster becomes one EC2 node with k3s; the chart reaches both
        if st["panel"] > 0:
            m = st["m09"]                       # the morph: 0 is EKS, 1 is k3s on one EC2 node
            comp(c, *CHART, "Helm chart", size=14, lit=st["lit09"], p=pulse(st, "chart"))
            outer = rect_lerp(OUTER0, OUTER1, m)
            if m < 0.5:
                node(c, *outer, "EKS cluster", "AWS", a=1 - m * 1.4, p=pulse(st, "eks"))
            else:
                node(c, *outer, "EC2 t3.medium", "", a=(m - 0.5) * 2, sub="2 vCPU, 4 GB")
            if m < 1:
                fade = 1 - min(1, m * 2.2)       # the managed control plane goes first
                if fade > 0:
                    comp(c, *PLANE, "managed control plane", size=13, a=fade, name_col=INK2)
                for i, r in enumerate(NODES):
                    rr = rect_lerp(r, K3S, draw.ease(min(1, m * 1.25)))
                    a = 1.0 if i == 1 else 1 - min(1, m * 1.5)
                    if a > 0.02:
                        node(c, *rr, "EC2" if m < 0.5 else "", depth=0.09, a=a)
            if m >= 0.5:
                g = st["k3s"]
                if g > 0:
                    node(c, *K3S, "k3s", depth=0.1, a=min(1, g), p=pulse(st, "k3s"))
                for i, p in enumerate(PODS):
                    u = st["pods"][i]
                    if u <= 0:
                        continue
                    r = (a0 + 0.34 + (i % 3) * 1.027, 3.0 + (i // 3) * 0.29, 0.944, 0.24)
                    rr = scaled(r, 0.5 + 0.5 * u)
                    box(c, *rr, a=u)
                    if u > 0.6:
                        text(c, *r, p, 13, "Regular", ink(INK2, u), "center")
            arrow(c, TO_CLUSTER, st["a_down"], INK if st["lit09"] else INK2)
            if st["a_eks"] > 0:
                comp(c, *EKS_SMALL, "EKS", size=14, a=min(1, st["a_eks"] * 2), p=pulse(st, "eks2"),
                     name_col=INK2)
                arrow(c, TO_EKS, st["a_eks"], INK if st["lit09"] else INK2, dashed=True)
                if st["a_eks"] >= 1:
                    text(c, TO_EKS[0][0], 1.14, TO_EKS[1][0] - TO_EKS[0][0], 0.28, "same chart", 13, "Regular", INK2,
                         "center")

        # (b) AD-11: two autoscalers, for two kinds of load
        if st["panel"] > 1:
            hl, kl = st["hl"], st["kl"]
            text(c, b0 + 0.1, 1.26, 3.6, 0.3, "HPA: CPU above 70%", 14, "Semibold", INK)
            text(c, b0 + 0.1, 1.62, 0.8, 0.28, "CPU", 13, "Regular", INK if hl else INK2)
            cpu_bar(c, PODX, 1.67, st["cpu"])
            for k, (name, y) in enumerate(HROWS):
                text(c, b0 + 0.1, y - 0.02, 0.85, PODH + 0.04, name, 13, "Regular", INK if hl else INK2)
                slots = [(PODX + i * (PODW + 0.08), y) for i in range(3)]
                pod_row(c, slots, PODW, PODH, st["hpa"], label="pod", lit=False, stretch=0.16)
            text(c, b0 + 0.1, 2.84, 3.6, 0.3, "KEDA: 5 turns per worker", 14, "Semibold", INK)
            text(c, b0 + 0.1, QY - 0.03, 0.85, 0.3, "turns", 13, "Regular", INK if kl else INK2)
            c.queue(QX, QY, QN, cell=QCELL, active=kl)
            for j in range(int(st["queue"])):
                x = QX + j * QCELL
                c.d.rectangle([c._p(x + 0.05), c._p(QY + 0.05), c._p(x + QCELL - 0.05), c._p(QY + QCELL - 0.05)],
                              fill=INK if kl else INK2)
            text(c, b0 + 0.1, WROW - 0.02, 0.85, PODH + 0.04, "worker", 13, "Regular", INK if kl else INK2)
            slots = [(PODX + i * (WW + 0.08), WROW) for i in range(4)]
            pod_row(c, slots, WW, PODH, st["keda"], label="pod", stretch=0.14)
            text(c, b0 + 0.1, CPU2 - 0.05, 0.85, 0.28, "CPU", 13, "Regular", INK if kl else INK2)
            cpu_bar(c, PODX, CPU2, 0.12 + (0.03 * math.sin(draw.NOW * 3) if kl else 0))

        # (c) AD-06: a database per service merges into one PostgreSQL, a frame per context
        if st["panel"] > 2:
            m = st["m06"]
            if m > 0:
                cylinder(c, *scaled(PG, 0.6 + 0.4 * m), 0.13 * m, a=m, fill=BLACK)
                if m > 0.6:
                    text(c, PG[0], PG[1] + 0.24, PG[2], 0.3, "PostgreSQL", 14, "Semibold",
                         ink(INK2, (m - 0.6) / 0.4), "center")
            spot = st["spot"]
            for name, rows, p0, p1 in CTX:
                x, y = lerp(p0[0], p1[0], m), lerp(p0[1], p1[1], m)
                ry = 0.08 * (1 - m)
                on = spot and any(r in TX for r in rows)
                a = DIM if spot and not on else 1.0
                h = FH + 2 * ry
                cylinder(c, x, y, FW, h, ry, a=a, lit=on, fill=BLACK)
                top = y + 2 * ry
                text(c, x + 0.12, top + 0.02, FW, 0.3, name if m > 0.5 else name + " DB", 14, "Semibold", ink(INK, a))
                for i, r in enumerate(rows):
                    ly = top + 0.32 + i * 0.22
                    lit_row = spot and r in TX
                    if lit_row:
                        c.d.rectangle([c._p(x + 0.07), c._p(ly + 0.01), c._p(x + FW - 0.07), c._p(ly + 0.21)],
                                      fill=RAISED)
                    text(c, x + 0.12, ly, FW - 0.2, 0.22, r, 13, "Regular", ink(INK if lit_row else INK2, a))

    st = dict(panel=0, cap=0, m09=0.0, k3s=0.0, pods=[0.0] * 9, a_down=0.0, a_eks=0.0, lit09=False,
              cpu=0.22, hpa=[1.0, 0.0, 0.0], keda=[1.0, 0.0, 0.0, 0.0], queue=0.0, hl=False, kl=False,
              m06=0.0, spot=False, pulse={})
    sc = Scene("physdecisions.gif", paint, st)

    # AD-09: the proposal, then the morph, then the chart reaches both
    sc.step("AD-09, before: the proposal put the chart on an EKS cluster", 0.2, panel=1, lit09=True)
    sc.tween(0.6, lambda u: st.update(a_down=u))
    kick(sc, "eks")
    sc.hold(1.4)
    sc.title = "AD-09, after: the cluster shrinks to one EC2 node, with k3s on it"
    sc.set(lit09=False)                         # the chart's arrow stays while the cluster shrinks
    sc.tween(1.4, lambda u: st.update(m09=u))
    sc.tween(0.4, lambda u: st.update(k3s=u))
    for i in range(9):
        sc.tween(0.12, lambda u, i=i: st["pods"].__setitem__(i, u))
    sc.hold(0.4)
    sc.title = "AD-09: the same Helm chart installs on either one"
    sc.set(lit09=True)
    kick(sc, "k3s")
    sc.hold(0.5)
    sc.tween(0.6, lambda u: st.update(a_eks=u))
    kick(sc, "eks2")
    sc.hold(1.2)
    sc.set(lit09=False, cap=1)
    sc.hold(0.8)

    # AD-11: CPU rises and three services divide; turns wait and the worker divides
    sc.step("AD-11: CPU passes 70%; identity, project and billing divide", 0.3, panel=2, hl=True)

    def load(u):
        st["cpu"] = 0.22 + 0.7 * u
        st["hpa"][1] = max(0.0, min(1.0, (st["cpu"] - 0.7) / 0.08))
        st["hpa"][2] = max(0.0, min(1.0, (st["cpu"] - 0.8) / 0.08))
    sc.tween(2.6, load)
    sc.hold(0.5)
    sc.step("AD-11: turns wait; the worker divides while its CPU stays low", 0.2, hl=False, kl=True)

    def turns(u):
        st["queue"] = QN * u
        for k in (1, 2, 3):
            st["keda"][k] = max(0.0, min(1.0, (st["queue"] - 1.6 * k) / 1.2))
    sc.tween(3.2, turns)
    sc.hold(0.6)
    sc.set(kl=False, cap=2)
    sc.hold(0.8)

    # AD-06: the databases merge; one transaction lights its three rows together
    sc.step("AD-06, before: a database for each service", 1.6, panel=3)
    sc.title = "AD-06, after: one PostgreSQL; each context keeps its own tables"
    sc.tween(1.5, lambda u: st.update(m06=u))
    sc.hold(1.0)
    sc.step("AD-06: one transaction writes the step, its cost and the ledger entry", 2.4, spot=True)
    sc.set(spot=False, cap=3)
    sc.title = "Three decisions shape the physical architecture"
    sc.hold(3.0)
    sc.save()



# ---------------------------------------------------------------- 4b: the deployment diagram
def deployment():
    """The UML deployment diagram, built by containment, then three paths in a spotlight."""
    AWS = (2.75, 1.05, 9.05, 3.7)
    K3S = (3.05, 1.85, 8.45, 2.55)
    TRAEFIK = (3.25, 2.6, 1.55, 1.55)
    SVC = [("identity", "1–3  HPA"), ("project", "1–3  HPA"), ("session", "1"), ("worker", "1–4  KEDA"),
           ("billing", "1–3  HPA")]
    PX = [5.15 + i * 1.25 for i in range(5)]
    # the data row lines up with the service row above it
    DATA = [("postgres", (PX[0], 3.5, PX[1] + 1.12 - PX[0], 0.66), "PostgreSQL", "StatefulSet + 2Gi volume"),
            ("rabbitmq", (PX[2], 3.5, PX[3] + 1.12 - PX[2], 0.66), "RabbitMQ", "StatefulSet"),
            ("keda", (PX[4], 3.5, 1.12, 0.66), "KEDA", "autoscaler")]
    OUT = {"browser": ((0.22, 1.35, 1.3, 0.8), "Browser", "device"),
           "watch": ((0.22, 2.55, 1.3, 0.8), "Watch app", "client"),
           "gha": ((0.22, 3.7, 1.3, 1.0), "GitHub\nActions", "CI/CD"),
           "openai": ((10.25, 0.35, 1.5, 0.45), "OpenAI API", "")}
    BUS_Y = 2.42
    BUS = [(4.55, 2.6), (4.55, BUS_Y), (PX[4] + 0.56, BUS_Y)]   # right of the cluster's name
    DROPS = [[(PX[i] + 0.56, BUS_Y), (PX[i] + 0.56, 2.6)] for i in range(5)]
    # each connector starts on its node's side face and ends on its target's border; the
    # model call leaves the worker right of the bus drop, so the two never share a line
    WIRES = dict(browser=[(1.66, 1.75), (2.6, 1.75), (2.6, 3.0), (3.25, 3.0)],
                 watch=[(1.66, 2.95), (2.6, 2.95), (2.6, 3.0), (3.25, 3.0)],
                 ssh=[(1.66, 4.25), (3.05, 4.25)],
                 openai=[(9.86, 2.6), (9.86, 1.5), (11.0, 1.5), (11.0, 0.8)])
    WORDS = dict(browser=("HTTPS 443", 1.72, 1.42), ssh=("SSH 22", 1.72, 3.92), openai=("HTTPS", 9.96, 1.2))
    # the spotlight: each path and the parts it lights
    PATHS = dict(https={"browser", "watch", "w_browser", "w_watch", "traefik", "bus", "identity", "project",
                        "session", "worker", "billing"},
                 ssh={"gha", "w_ssh", "k3s"},
                 openai={"worker", "w_openai", "openai"})

    def paint(c, st):
        spot = PATHS.get(st["spot"], None)

        def a(key, frame=False):
            if spot is None:
                return 1.0
            if key in spot:
                return 1.0
            return 0.5 if frame else DIM

        def lit(key):
            return spot is not None and key in spot

        g = st["g"]
        if g.get("aws", 0) > 0:
            u = g["aws"]
            r = scaled(AWS, u)
            node(c, *r, "EC2 t3.medium  ·  ap-southeast-1" if u > 0.8 else "", "AWS" if u > 0.8 else "",
                 depth=0.09 * u, a=a("aws", True) * min(1, u * 1.5), p=pulse(st, "aws"))
            if u >= 1:
                text(c, 2.85, 4.48, 3.5, 0.28, "security group: 22, 80, 443 open", 13, "Regular", ink(INK2, a("aws", True)))
        if g.get("k3s", 0) > 0:
            u = g["k3s"]
            r = rect_lerp(AWS, K3S, u)
            ka = a("k3s", True) * min(1, u * 1.5)
            node(c, *r, "k3s cluster" if u > 0.8 else "", "Kubernetes" if u > 0.8 else "", depth=0.12, a=ka,
                 lit=st["spot"] == "ssh", p=pulse(st, "k3s"))
            if u >= 1:
                text(c, 5.15, 1.95, 4, 0.28, "namespace lumen", 13, "Regular", ink(INK2, ka))
        # the parts inside k3s, each grown in from the cluster's outline
        if g.get("bus", 0) > 0:
            col = ink(INK if lit("bus") else INK2, a("bus"))
            line(c, grow(BUS, g["bus"]), col)
            for d in DROPS:
                if g["bus"] >= 1:
                    line(c, d, col)
        parts = [("traefik", TRAEFIK, "Traefik", "ingress,\nHTTPS,\nrate limit")]
        parts += [(n, (PX[i], 2.6, 1.12, 0.72), n, rep) for i, (n, rep) in enumerate(SVC)]
        parts += [(k, r, name, note) for k, r, name, note in DATA]
        for key, r, name, note in parts:
            u = g.get(key, 0)
            if u <= 0:
                continue
            rr = rect_lerp(K3S, r, u)
            if u < 1:                           # an outline only, so it never hides a part already drawn
                c.d.rectangle([c._p(rr[0]), c._p(rr[1]), c._p(rr[0] + rr[2]), c._p(rr[1] + rr[3])],
                              outline=ink(INK2, u), width=c._lw(1.5))
                continue
            comp(c, *r, name, note, a=a(key), lit=lit(key), p=pulse(st, key), size=15 if key == "traefik" else 14)
        for key, (r, name, stereo) in OUT.items():
            u = g.get(key, 0)
            if u <= 0:
                continue
            node(c, *r, name, stereo, a=a(key) * u, lit=lit(key), p=pulse(st, key))
        for key, pts in WIRES.items():
            u = g.get("w_" + key, 0)
            if u <= 0:
                continue
            on = lit("w_" + key)
            arrow(c, pts, u, ink(INK if on else INK2, a("w_" + key)), pt=2 if on else 1.5)
            if key in WORDS and u >= 1:
                w, x, y = WORDS[key]
                text(c, x, y, 1.0, 0.28, w, 13, "Regular", ink(INK if on else INK2, a("w_" + key)))

    st = dict(g={}, spot=None, pulse={})
    sc = Scene("deployment.gif", paint, st)
    G = st["g"]

    def grow_in(keys, seconds, stagger=0.0):
        """Parts grow in together, or one a little after another."""
        n = len(keys)
        span = 1 + stagger * (n - 1)

        def fn(u):
            for i, k in enumerate(keys):
                G[k] = max(0.0, min(1.0, (u * span - stagger * i)))
        sc.tween(seconds, fn)
        for k in keys:
            kick(sc, k)

    # 1. build: each level grows in from its parent
    sc.step("One AWS node: an EC2 t3.medium in Singapore", 0.2)
    grow_in(["aws"], 0.9)
    sc.hold(1.0)
    sc.title = "k3s runs inside it, in the namespace lumen"
    grow_in(["k3s"], 0.9)
    sc.hold(0.9)
    sc.title = "Inside k3s: Traefik and the five service pods"
    grow_in(["traefik", "identity", "project", "session", "worker", "billing"], 1.6, 0.35)
    sc.tween(0.5, lambda u: G.__setitem__("bus", u))
    sc.hold(0.6)
    sc.title = "PostgreSQL and RabbitMQ as StatefulSets, and KEDA"
    grow_in(["postgres", "rabbitmq", "keda"], 1.0, 0.3)
    sc.hold(0.8)
    sc.title = "Outside the node: the clients, CI/CD and the model API"
    grow_in(["browser", "watch", "gha", "openai"], 0.8, 0.2)
    for key, target in (("browser", "traefik"), ("watch", "traefik"), ("ssh", "k3s"), ("openai", "openai")):
        sc.tween(0.45, lambda u, key=key: G.__setitem__("w_" + key, u))
        kick(sc, target)
    sc.hold(1.0)

    # 2. the paths, one at a time
    sc.step("HTTPS on 443 to Traefik, which routes to the service pods", 2.8, spot="https")
    sc.step("GitHub Actions deploys over SSH 22 into k3s", 2.4, spot="ssh")
    sc.step("The worker pod calls the OpenAI API over HTTPS", 2.4, spot="openai")
    sc.step("One EC2 node runs the whole platform in k3s", 3.0, spot=None)
    sc.save()



# ---------------------------------------------------------------- 6b: scalability
def scaling():
    """The load test of 20 October as a time chart, with the worker pods beside it. The pods
    divide and merge (scale2 in scenes_motion.py) at the moment the chart's cursor passes the
    sample where KEDA changed the replica count."""
    data = [d for d in _scaling() if d[0] <= 215]
    T1 = 220
    X0, X1 = 1.05, 9.1                          # the plot, left and right
    YB, YT, JMAX = 4.4, 2.0, 30                 # the plot's baseline, top, top value
    BW = 0.28                                   # a bar's width
    RX, RW, RH = 9.75, 2.1, 0.32                # the worker pods, right of the chart
    SLOTS = [(RX, 2.05 + k * 0.38) for k in range(4)]
    DIV = 0.9                                   # seconds one division or merge takes

    # when KEDA added and removed each worker: the first sample with more, then with fewer
    added, removed, prev = {}, {}, 1
    for ts, w, j in data:
        for k in range(prev, w):
            added[k] = ts
        for k in range(w, prev):
            removed[k] = ts
        prev = w

    def tx(t):
        return X0 + t / T1 * (X1 - X0)

    def jy(n):
        return YB - n / JMAX * (YB - YT)

    def dashed_h(c, pts, col):
        line(c, pts, col, dashed=True)

    def paint(c, st):
        t = st["t"]
        seen = [d for d in data if d[0] <= t + 1e-6]
        text(c, 0.3, 0.98, 10, 0.28, "load test, 20 October: the paced worker, no model calls", 13, "Regular", INK3)
        LY = 1.42
        c.bar(X0, LY + 0.07, 0.16, 0.16, INK2)
        text(c, X0 + 0.26, LY, 3, 0.3, "jobs waiting (three queues)", 13, "Medium", INK2)
        lx = X0 + 0.26 + tw("jobs waiting (three queues)", 13, "Medium") + 0.45
        dashed_h(c, [(lx, LY + 0.15), (lx + 0.42, LY + 0.15)], INK)
        text(c, lx + 0.55, LY, 5.5, 0.3, "target: 5 waiting jobs per worker", 13, "Medium", INK2)
        for n in (0, 10, 20, 30):
            y = jy(n)
            if n:
                c.line([(X0, y), (X1, y)], pt=1, color=RULE2)
            c.text(0.3, y - 0.15, 0.6, 0.3, str(n), 13, "Regular", INK3, "right")
        c.line([(X0, YB), (X1, YB)], pt=1.5, color=RULE)
        if st["cursor"]:
            c.line([(tx(t), YT - 0.1), (tx(t), YB)], pt=2, color=INK)
        for ts, w, j in seen:
            if j:
                c.bar(tx(ts) - BW / 2, jy(j), BW, YB - jy(j), INK if (st["cursor"] and ts == seen[-1][0]) else INK2)
        pts = []
        for i, (ts, w, j) in enumerate(seen):
            end = min(t, data[i + 1][0]) if i + 1 < len(data) else t
            y = jy(5 * w)
            if pts:
                pts.append((tx(ts), y))
            pts += [(tx(ts), y), (tx(end), y)]
        if len(pts) > 1:
            # a black edge under the dashes, so the target line stays apart from a bar top it meets
            line(c, pts, BLACK, pt=4.5)
            dashed_h(c, pts, INK)
        for sec in (0, 60, 120, 180):
            c.line([(tx(sec), YB), (tx(sec), YB + 0.08)], pt=1, color=RULE)
            c.text(tx(sec) - 0.5, YB + 0.1, 1.0, 0.3, "%d s" % sec, 13, "Regular", INK3)
        # the worker pods: each extra pod divides out of the one above it, and merges back
        now = draw.NOW
        prog = [1.0, 0.0, 0.0, 0.0]
        for k in (1, 2, 3):
            if k in st["t_add"]:
                prog[k] = min(1.0, (now - st["t_add"][k]) / DIV)
            if k in st["t_rem"]:
                prog[k] = max(0.0, 1 - (now - st["t_rem"][k]) / DIV)
        n = 1 + sum(1 for k in (1, 2, 3) if prog[k] >= 0.5)
        text(c, RX, 1.7, RW + 0.3, 0.3, "worker pods (KEDA): %d" % n, 14, "Semibold", INK)
        for k in (1, 2, 3):                     # where a pod can go: its empty place
            x, y = SLOTS[k]
            c.d.rectangle([c._p(x), c._p(y), c._p(x + RW), c._p(y + RH)], outline=RULE2, width=c._lw(1))
        pod_row(c, SLOTS, RW, RH, prog, horizontal=False, label="worker %d", stretch=0.16, size=14)
        if st["result"]:
            # the result: as wide as the worker pods above it
            c.bar(RX, 3.66, RW, 1.04, INK)
            for i, s_ in enumerate(["135 questions", "median 6.1 s", "0 of 1,040 failed"]):
                text(c, RX + 0.18, 3.76 + i * 0.28, RW, 0.28, s_, 15, "Semibold", BLACK)

    st = dict(t=0.0, cursor=True, result=False, t_add={}, t_rem={})
    sc = Scene("scaling.gif", paint, st)

    def sweep(t_end, rate=26.0):
        """The cursor moves on; a pod divides or merges as the cursor passes its sample."""
        t_start = st["t"]
        n = max(1, round((t_end - t_start) / rate * FPS))
        for i in range(1, n + 1):
            st["t"] = lerp(t_start, t_end, i / n)
            for k, ts in added.items():
                if st["t"] >= ts and k not in st["t_add"]:
                    st["t_add"][k] = sc.t
            for k, ts in removed.items():
                if st["t"] >= ts and k not in st["t_rem"]:
                    st["t_rem"][k] = sc.t
            sc._add(sc._draw(), round(1000 / FPS))

    sc.step("Ten users ask questions without pause", 1.6)
    sweep(30)
    sc.hold(1.0)
    sc.step("One worker falls behind; the queue grows", 0.2)
    sweep(41)
    sc.hold(1.4)
    sc.step("Above 5 jobs per worker, KEDA adds a pod: the worker divides", 0.2)
    sweep(79, 12)
    sc.hold(1.4)
    sc.step("With 4 workers, the queue stops growing, then drains", 0.2)
    sweep(130, 22)
    sc.hold(1.0)
    sc.step("A minute after the load, KEDA removes the extra pods: they merge back", 0.2)
    sweep(215, 20)
    sc.hold(1.2)
    sc.step("Up to 4 workers at the peak, back to 1 after; no request failed", 3.4, cursor=False, result=True)
    sc.save()



# ---------------------------------------------------------------- 4c: the ER diagram
def er():
    """The schema of report 3.2.3 (the layout of scenes_std_design.er), in a spotlight: one
    table at a time lights with its related tables, and each relationship grows from the one
    side to the many side with its crow's foot. The step title says it in a plain sentence."""
    from scenes_std_design import width_of

    # A denser table than scenes_std_design's, so the whole schema fits under the same title band
    # as the other pictures and keeps 30 px from every edge. 13 pt text still fits a 0.18 in row.
    ROW, HEAD_H, PAD = 0.18, 0.27, 0.05

    class Table:
        def __init__(self, name, cols, x, y, w=None):
            self.name, self.cols, self.x, self.y = name, cols, x, y
            marks = [width_of(m_, 13, "Medium") for m_, _ in cols if m_]
            self.mark = max(marks) + 0.12 if marks else 0
            need = max([width_of(name, 14, "Semibold")] + [self.mark + width_of(n) for _, n in cols]) + 0.22
            self.w = w or need
            self.h = HEAD_H + len(cols) * ROW + PAD

        def row_y(self, name):
            i = [n for _, n in self.cols].index(name)
            return self.y + HEAD_H + (i + 0.5) * ROW

        @property
        def r(self):
            return self.x + self.w

        @property
        def b(self):
            return self.y + self.h

    LEFT, RIGHT = 0.22, 11.92                  # 30 px from each side
    LINE_Y, F0, GAP = 0.8, 0.88, 0.4
    T0 = F0 + 0.27
    accounts = Table("accounts", [("PK", "id"), ("", "email"), ("", "display_name"), ("", "role")], LEFT + 0.1, T0,
                     1.85)
    keys = Table("platform_api_keys", [("PK", "id"), ("FK", "account_id"), ("", "prefix"), ("", "key_hash"),
                                       ("", "scopes"), ("", "revoked_at")], LEFT + 0.1, accounts.b + 0.26, 1.85)
    px = accounts.r + 0.35
    projects = Table("projects", [("PK", "id"), ("", "account_id"), ("", "title"), ("", "mode")], px, T0)
    findings = Table("findings", [("PK", "id"), ("FK", "project_id"), ("FK", "session_id"), ("FK", "task_id"),
                                  ("", "title")], 0, T0)
    agents = Table("platform_agents", [("PK", "id"), ("FK", "owner_account_id"), ("", "slug"), ("", "instructions"),
                                       ("", "withdrawn_at")], 0, T0)
    intents = Table("platform_question_intents", [("PK", "id"), ("", "account_id"), ("FK", "agent_id"),
                                                  ("", "question"), ("", "session_id")], 0, T0)
    # the project frame reaches far enough below its tables to hold the crow's foot under findings
    top_b = max(t.b for t in (projects, findings, agents, intents)) + 0.19
    F1 = top_b + 0.12
    B0 = F1 + 0.27
    sessions = Table("sessions", [("PK", "id"), ("", "project_id"), ("", "account_id")], px, B0)
    tasks = Table("tasks", [("PK", "id"), ("FK", "session_id"), ("FK", "parent_id"), ("", "agent"), ("", "depth"),
                            ("", "status"), ("", "own_cost"), ("", "pending")], 0, B0)
    steps = Table("steps", [("PK FK", "task_id"), ("PK", "index"), ("", "kind"), ("", "text"), ("", "detail")], 0, B0)
    wallets = Table("billing_wallets", [("PK", "account_id"), ("", "cap")], 0, B0)
    ledger = Table("ledger_entries", [("PK", "id"), ("", "account_id"), ("FK", "task_id"), ("", "amount")], 0, 0)
    approvals = Table("billing_approvals", [("PK", "id"), ("", "account_id"), ("", "task_id"), ("", "attempt_id"),
                                            ("", "status"), ("", "resume_pending")], 0, B0)
    findings.x = projects.r + GAP
    tasks.x = findings.x
    tasks.w = findings.w = max(tasks.w, findings.w)
    agents.x = findings.r + 0.24
    intents.x = agents.r + 0.24
    sessions.w = projects.w = max(sessions.w, projects.w)
    steps.x = tasks.r + GAP
    bx = steps.r + 0.32
    wallets.x = ledger.x = bx
    wallets.w = ledger.w = max(wallets.w, ledger.w)
    ledger.y = wallets.b + 0.08
    approvals.x = ledger.r + 0.34
    low_b = max(tasks.b, ledger.b, approvals.b) + 0.04
    T = dict(accounts=accounts, keys=keys, projects=projects, findings=findings, agents=agents, intents=intents,
             sessions=sessions, tasks=tasks, steps=steps, wallets=wallets, ledger=ledger, approvals=approvals)
    CONTEXTS = [("identity", (LEFT, F0, accounts.r + 0.1 - LEFT, keys.b + 0.08 - F0), ["accounts", "keys"]),
                ("project", (px - 0.1, F0, intents.r + 0.1 - (px - 0.1), top_b - F0),
                 ["projects", "findings", "agents", "intents"]),
                ("session", (px - 0.1, F1, steps.r + 0.1 - (px - 0.1), low_b - F1), ["sessions", "tasks", "steps"]),
                ("billing", (bx - 0.1, F1, approvals.r + 0.1 - (bx - 0.1), low_b - F1),
                 ["wallets", "ledger", "approvals"]),
                ("worker", (intents.r + 0.18, F0, RIGHT - (intents.r + 0.18), top_b - F0), [])]
    WORKER_BOX = CONTEXTS[-1][1]
    assert WORKER_BOX[2] >= 0.7 and approvals.r + 0.1 <= RIGHT and low_b <= 4.79, (WORKER_BOX, approvals.r, low_b)
    mx = projects.r + GAP / 2                  # the column between sessions and tasks
    ly1, ly2 = tasks.row_y("pending") - 0.42, tasks.row_y("pending")
    sid = sessions.y + HEAD_H + ROW / 2        # the middle of the sessions id row
    # each relationship: (the one side, the many side, its points from one to many, dashed?)
    L = dict(
        keys=("accounts", "keys", [(1.1, accounts.b), (1.1, keys.y)], False),
        acc_proj=("accounts", "projects", [(accounts.r, projects.row_y("account_id")),
                                           (projects.x, projects.row_y("account_id"))], True),
        acc_agents=("accounts", "agents", [(1.75, accounts.y), (1.75, LINE_Y), (agents.x + 0.5, LINE_Y),
                                           (agents.x + 0.5, agents.y)], False),
        intents=("agents", "intents", [(agents.r, intents.row_y("agent_id")),
                                       (intents.x, intents.row_y("agent_id"))], False),
        proj_find=("projects", "findings", [(projects.r, findings.row_y("project_id")),
                                            (findings.x, findings.row_y("project_id"))], False),
        proj_sess=("projects", "sessions", [(projects.x + 0.95, projects.b), (sessions.x + 0.95, sessions.y)], True),
        # up the column between the tables, so no line runs along the gap between two frames
        sess_find=("sessions", "findings", [(sessions.r, sid), (mx, sid), (mx, findings.row_y("session_id")),
                                            (findings.x, findings.row_y("session_id"))], False),
        sess_tasks=("sessions", "tasks", [(sessions.r, tasks.row_y("session_id")),
                                          (tasks.x, tasks.row_y("session_id"))], False),
        task_find=("tasks", "findings", [(tasks.x + 0.95, tasks.y), (tasks.x + 0.95, findings.b)], False),
        task_steps=("tasks", "steps", [(tasks.r, steps.row_y("task_id")), (steps.x, steps.row_y("task_id"))], False),
        task_self=("tasks", "tasks", [(tasks.x, ly1), (tasks.x - 0.22, ly1), (tasks.x - 0.22, ly2), (tasks.x, ly2)],
                   False),
        task_ledger=("tasks", "ledger", [(tasks.r, ledger.row_y("task_id")), (ledger.x, ledger.row_y("task_id"))],
                     False),
    )

    def ends(c, pts, col):
        """The one side's bar at pts[0], the many side's crow's foot at pts[-1]."""
        (x1, y1), (x2, y2) = pts[0], pts[1]
        n = math.hypot(x2 - x1, y2 - y1)
        ux, uy = (x2 - x1) / n, (y2 - y1) / n
        bx_, by_ = x1 + ux * 0.1, y1 + uy * 0.1
        c.d.line([(c._p(bx_ - uy * 0.08), c._p(by_ + ux * 0.08)), (c._p(bx_ + uy * 0.08), c._p(by_ - ux * 0.08))],
                 fill=col, width=c._lw(1.5))
        (x1, y1), (x2, y2) = pts[-2], pts[-1]
        n = math.hypot(x2 - x1, y2 - y1)
        ux, uy = (x2 - x1) / n, (y2 - y1) / n
        fx, fy = x2 - ux * 0.17, y2 - uy * 0.17
        for s_ in (-1, 1):
            c.d.line([(c._p(fx), c._p(fy)), (c._p(x2 - uy * 0.09 * s_), c._p(y2 + ux * 0.09 * s_))], fill=col,
                     width=c._lw(1.5))

    def table(c, t, a, lit, p):
        x, y, w, h = t.x, t.y, t.w, t.h
        edge = ink(INK if (lit or p > 0.05) else INK2, a)
        lw = c._lw((2 if lit else 1.5) + 1.5 * p)
        c.d.rectangle([c._p(x), c._p(y), c._p(x + w), c._p(y + h)], fill=ink(RAISED, a) if lit else BLACK,
                      outline=edge, width=lw)
        c.d.rectangle([c._p(x), c._p(y), c._p(x + w), c._p(y + HEAD_H)], fill=ink(RAISED, a), outline=edge, width=lw)
        c.text(x + 0.11, y, w - 0.2, HEAD_H, t.name, 14, "Semibold", ink(INK, a), "left")
        for i, (m, n) in enumerate(t.cols):
            ry = y + HEAD_H + i * ROW + 0.01
            if m:
                c.text(x + 0.11, ry, t.mark, ROW, m, 13, "Medium", ink(INK3, a), "left")
            c.text(x + 0.11 + t.mark, ry, w - t.mark - 0.2, ROW, n, 13, "Regular",
                   ink(INK if ("PK" in m or lit) else INK2, a), "left")

    def paint(c, st):
        focus = st["focus"]
        related = set()
        if focus:
            related = {focus}
            for k, (one, many, _, _) in L.items():
                if st["rels"].get(k, 0) > 0 and focus in (one, many):
                    related |= {one, many}

        def ta(name):
            return 1.0 if not focus or name in related else DIM

        fa = 0.5 if focus else 1.0
        for name, (x, y, w, h), _ in CONTEXTS:
            if st["ctx"].get(name, 0) <= 0:
                continue
            a = st["ctx"][name] * (1.0 if focus == name else fa)
            c.d.rectangle([c._p(x), c._p(y), c._p(x + w), c._p(y + h)], outline=ink(INK if focus == name else RULE, a),
                          width=c._lw(1.5 if focus == name else 1))
            c.text(x + 0.1, y + 0.03, 3, 0.25, name, 13, "Medium", ink(INK if focus == name else INK3, a), "left")
        if st["ctx"].get("worker", 0) > 0:
            x, y, w, h = WORKER_BOX
            a = st["ctx"]["worker"] * (1.0 if focus in (None, "worker") else DIM)
            c.text(x, y + 0.3, w, h - 0.3, "no\ntables", 13, "Regular", ink(INK if focus == "worker" else INK2, a))
        for k, (one, many, pts, dashed) in L.items():
            g = st["rels"].get(k, 0)
            if g <= 0:
                continue
            on = focus is not None and focus in (one, many)
            a = 1.0 if (not focus or on) else DIM
            col = ink(INK if (on and k in st["now"]) else INK2, a)
            line(c, grow(pts, g), col, 2 if (on and k in st["now"]) else 1.5, dashed)
            if g >= 1:
                ends(c, pts, col)
        for name, t in T.items():
            u = st["tables"].get(name, 0)
            if u <= 0:
                continue
            table(c, t, ta(name) * u, name == focus, pulse(st, name))
        if st["legend"]:
            ky = keys.b + 0.12
            c.line([(LEFT + 0.1, ky + 0.12), (LEFT + 0.47, ky + 0.12)], color=INK2)
            c.text(LEFT + 0.58, ky, 1.5, 0.24, "foreign key", 13, "Regular", INK2, "left")
            line(c, [(LEFT + 0.1, ky + 0.36), (LEFT + 0.47, ky + 0.36)], INK2, dashed=True)
            c.text(LEFT + 0.58, ky + 0.24, 1.5, 0.24, "id, no foreign key", 13, "Regular", INK2, "left")
            c.text(LEFT + 0.1, ky + 0.5, 2.0, 0.24, "files: a 2Gi volume", 13, "Regular", INK2, "left")

    st = dict(ctx={}, tables={}, rels={}, focus=None, now=set(), legend=False, pulse={})
    sc = Scene("er.gif", paint, st)

    # 1. the contexts and their tables come in
    sc.title = "Five contexts in one PostgreSQL; four of them own tables"
    for name, _, tables in CONTEXTS:
        def fn(u, name=name, tables=tables):
            st["ctx"][name] = u
            for t in tables:
                st["tables"][t] = u
        sc.tween(0.45, fn)
    sc.hold(1.0)

    # 2. one table at a time, with its relationships
    def rel(sentence, *ks, hold=1.15):
        sc.title = sentence
        st["now"] = set(ks)
        sc.tween(0.6, lambda u: [st["rels"].__setitem__(k, u) for k in ks])
        for k in ks:
            if L[k][1] != L[k][0]:
                kick(sc, L[k][1])
        sc.hold(hold)

    sc.set(focus="accounts")
    rel("An account has many API keys", "keys")
    rel("An account owns the agents it registers", "acc_agents")
    rel("A project keeps its account_id: an id from identity, no foreign key", "acc_proj", hold=1.6)
    sc.set(focus="agents")
    rel("A question intent names one agent", "intents")
    sc.set(focus="projects")
    rel("A project has many findings, and its sessions keep its id", "proj_find", "proj_sess", hold=1.6)
    sc.set(focus="sessions")
    rel("A session has many tasks and many findings", "sess_tasks", "sess_find", hold=1.5)
    sc.set(focus="tasks")
    rel("A task has child tasks: parent_id is the call tree", "task_self")
    rel("A task has many steps, in order", "task_steps")
    rel("A reader's task records findings", "task_find")
    rel("Each model call of a task is a ledger entry", "task_ledger", hold=1.5)
    sc.set(focus="worker", now=set())
    sc.title = "The worker runs the agents and owns no tables"
    sc.hold(1.6)
    sc.set(focus=None, legend=True)
    sc.title = "PostgreSQL 16, money as numeric(12,6); turns stay in RabbitMQ"
    sc.hold(3.0)
    sc.save()



# ---------------------------------------------------------------- 4d: the sequence of use case A
def sequence():
    """Use case A as a UML sequence diagram. The messages grow in time order. After the
    publish, a par fragment holds two lanes that grow at the same time: the app gets 201 and
    reads the answer, while the worker consumes the turn and runs its loop. The loop grows
    one step after another, then runs again.

    Traefik is not a lifeline here: it only forwards, and its two forward rows would push the
    diagram past the bottom margin. A note on the app's lifeline says that every call passes it."""
    NAMES = ["Watch app", "project", "session", "PostgreSQL", "RabbitMQ", "worker", "OpenAI API"]
    X = [0.85, 3.12, 5.85, 7.17, 8.6, 9.8, 11.3]
    A, C, D, E, F, G, H = range(7)
    HY, HH = 0.8, 0.34
    BAR = 0.06
    P, PA = 0.27, 0.29                          # a message row; a row of the app's lane
    r = {}
    r["ask"] = HY + HH + 0.3
    r["guard"] = r["ask"] + P
    r["start"] = r["guard"] + 0.45             # the self call and its nested bar take more room
    r["publish"] = r["start"] + P
    par_top = r["publish"] + 0.08
    r["accepted"] = par_top + 0.33
    r["get"] = r["accepted"] + PA
    r["answer"] = r["get"] + PA
    sep = r["answer"] + 0.08
    r["consume"] = sep + 0.28
    loop_top = r["consume"] + 0.06
    r["llm"] = loop_top + 0.27
    r["step"] = r["llm"] + P
    r["insert"] = r["step"] + P
    loop_bottom = r["insert"] + 0.08
    par_bottom = loop_bottom + 0.04
    LIFE_END = par_bottom
    assert par_bottom <= 4.79, par_bottom      # 30 px from the bottom edge
    PX0, PX1 = 0.25, 11.9
    LX0, LX1 = X[D] - 0.42, 11.84

    MSG = [("ask", A, C, "POST /api/v1/questions", False),
           ("guard", C, C, "key guard check", False),
           ("start", C, D, "POST /internal/directory/start", False),
           ("publish", D, F, "publish lumen.turns.0", False),
           ("accepted", C, A, "201 {sessionId}", True),
           ("get", A, D, "GET /api/v1/questions/:id", False),
           ("answer", D, A, "200 {status, answer, findings, cost}", True),
           ("consume", F, G, "consume", False),
           ("llm", G, H, "chat completion", False),
           ("step", G, D, "POST /internal/turns/:id/step", False),
           ("insert", D, E, "INSERT steps", False)]
    BY = {m[0]: m for m in MSG}
    # activation bars: (lifeline, from, to, nested). PostgreSQL and RabbitMQ get none: an arrow
    # to them ends on the lifeline itself.
    BARS = [(A, r["ask"], r["accepted"], 0), (C, r["ask"], r["accepted"], 0),
            (C, r["guard"] + 0.1, r["guard"] + 0.18, 1), (D, r["start"], r["publish"] + 0.1, 0),
            (A, r["get"], r["answer"], 0), (D, r["get"], r["answer"], 0),
            (G, r["consume"], r["insert"] + 0.1, 0), (H, r["llm"], r["llm"] + 0.12, 0),
            (D, r["step"], r["insert"] + 0.1, 0)]

    def lane(y):
        """Which clock a row belongs to: before the par fragment, its first lane or its second."""
        return "m" if y < par_top else ("a" if y < sep else "b")

    def edge(i, y, toward):
        """Where a message meets lifeline i at row y: the side of its bar, or the lifeline."""
        for j, y0, y1, nest in BARS:
            if j == i and not nest and y0 - 1e-6 <= y <= y1 + 1e-6:
                return X[i] + (BAR if toward > X[i] else -BAR)
        return X[i]

    def tag_box(c, x, y, word, extra=""):
        """The pentagon name tag of a combined fragment, with its guard beside it."""
        w = tw(word, 13, "Semibold") + 0.2
        c.d.polygon([(c._p(x), c._p(y)), (c._p(x + w + 0.08), c._p(y)), (c._p(x + w + 0.08), c._p(y + 0.17)),
                     (c._p(x + w), c._p(y + 0.26)), (c._p(x), c._p(y + 0.26))], outline=INK2, fill=BLACK)
        c.d.line([(c._p(x + w + 0.08), c._p(y)), (c._p(x + w + 0.08), c._p(y + 0.17)), (c._p(x + w), c._p(y + 0.26)),
                  (c._p(x), c._p(y + 0.26))], fill=INK2, width=c._lw(1))
        c.text(x + 0.08, y + 0.01, w, 0.24, word, 13, "Semibold", INK, "left")
        if extra:
            c.text(x + w + 0.18, y + 0.01, 3, 0.24, extra, 13, "Regular", INK2, "left")

    def label(c, x, y, s_, col):
        """A message label on a black ground, so a lifeline it crosses stops short of the text."""
        w = tw(s_)
        c.d.rectangle([c._p(x - 0.04), c._p(y - 0.255), c._p(x + w + 0.04), c._p(y - 0.025)], fill=BLACK)
        c.text(x, y - 0.25, w, 0.22, s_, 13, "Regular", col, "left")

    NOTE = (1.0, sep + 0.14, 1.95, 0.9)

    def paint(c, st):
        clock = st["clock"]
        hu = st["heads"]
        for i, n in enumerate(NAMES):
            w = tw(n, 14, "Semibold") + 0.16
            if hu <= 0:
                continue
            on = i in st["on"]
            c.d.rectangle([c._p(X[i] - w / 2), c._p(HY), c._p(X[i] + w / 2), c._p(HY + HH)],
                          fill=RAISED if on else BLACK, outline=ink(INK if on else INK2, hu), width=c._lw(1.5))
            c.text(X[i] - w / 2, HY, w, HH, n, 14, "Semibold", ink(INK, hu))
            end = lerp(HY + HH, LIFE_END, hu)
            line(c, [(X[i], HY + HH), (X[i], end)], RULE, 1, dashed=True)
        if st["par"] > 0:
            a = st["par"]
            c.d.rectangle([c._p(PX0), c._p(par_top), c._p(PX1), c._p(par_bottom)], outline=ink(INK2, a),
                          width=c._lw(1))
            line(c, [(PX0, sep), (PX1, sep)], ink(INK2, a), 1, dashed=True)
            tag_box(c, PX0, par_top, "par")
            # a UML note on the app's lifeline: the gateway every call passes
            x, y, w, h = NOTE
            k = 0.14
            c.d.polygon([(c._p(x), c._p(y)), (c._p(x + w - k), c._p(y)), (c._p(x + w), c._p(y + k)),
                         (c._p(x + w), c._p(y + h)), (c._p(x), c._p(y + h))], fill=BLACK, outline=ink(INK2, a),
                        width=c._lw(1))
            c.d.line([(c._p(x + w - k), c._p(y)), (c._p(x + w - k), c._p(y + k)), (c._p(x + w), c._p(y + k))],
                     fill=ink(INK2, a), width=c._lw(1))
            line(c, [(X[A], y + h / 2), (x, y + h / 2)], ink(INK2, a), 1, dashed=True)
            c.text(x + 0.12, y + 0.1, w - 0.2, h - 0.2, "Every call of the app\npasses Traefik,\nthe API gateway",
                   13, "Regular", ink(INK2, a), "left")
        if st["loop"] > 0:
            a = st["loop"]
            c.d.rectangle([c._p(LX0), c._p(loop_top), c._p(LX1), c._p(loop_bottom)], outline=ink(INK2, a),
                          width=c._lw(1))
            tag_box(c, LX0, loop_top, "loop", "[each step]")
        for i, y0, y1, nest in BARS:
            t = clock[lane(y0)]
            if y0 > t:
                continue
            y1 = min(y1, t)
            x = X[i] + nest * 0.07
            c.d.rectangle([c._p(x - BAR), c._p(y0), c._p(x + BAR), c._p(max(y1, y0 + 0.02))], fill=RAISED,
                          outline=INK2, width=c._lw(1))
        for key, fr, to, text_, ret in MSG:
            if key not in st["shown"]:
                continue
            u = st["shown"][key]
            now = key in st["now"]
            col = INK if now else INK2
            y = r[key]
            if fr == to:                       # a call to itself
                x0 = X[fr] + BAR
                pts = [(x0, y), (x0 + 0.32, y), (x0 + 0.32, y + 0.14), (X[fr] + 0.07 + BAR, y + 0.14)]
                arrow(c, pts, u, col)
                if u >= 1:
                    w = tw(text_)
                    c.d.rectangle([c._p(x0 + 0.38), c._p(y - 0.11), c._p(x0 + 0.46 + w), c._p(y + 0.11)], fill=BLACK)
                    c.text(x0 + 0.42, y - 0.12, w, 0.22, text_, 13, "Regular", col, "left")
                continue
            x0 = edge(fr, y, X[to])
            x1 = edge(to, y, X[fr])
            arrow(c, [(x0, y), (x1, y)], u, col, dashed=ret, open_=ret)
            ov = st["over"].get(key, 0)
            if ov > 0:                          # the loop runs again: the step grows once more, in white
                arrow(c, [(x0, y), (x1, y)], ov, INK, pt=2)
            if u >= 1:
                w = tw(text_)
                lo, hi = min(x0, x1), max(x0, x1)
                lx = min(max(lo + 0.06, (lo + hi) / 2 - w / 2), hi - 0.06 - w)
                label(c, lx, y, text_, INK if (now or ov > 0) else INK2)

    st = dict(clock=dict(m=0.0, a=0.0, b=0.0), shown={}, now=set(), on=set(), heads=0.0, par=0.0, loop=0.0,
              over={})
    sc = Scene("sequence.gif", paint, st)

    def send(*keys, seconds=0.55, hold=0.35):
        """The messages grow at the same time, each on its own lane's clock."""
        st["now"] = set(keys)
        st["on"] = {i for k in keys for i in BY[k][1:3]}
        start = dict(st["clock"])
        target = {}
        for k in keys:
            ln = lane(r[k])
            target[ln] = max(target.get(ln, 0), r[k] + (0.2 if k == "guard" else 0.0))

        def fn(u):
            for k in keys:
                st["shown"][k] = u
            for ln, t in target.items():
                lanes = ("m", "a", "b") if ln == "m" else (ln,)
                for l2 in lanes:
                    st["clock"][l2] = lerp(start[l2], max(start[l2], t), u)
        sc.tween(seconds, fn)
        sc.hold(hold)

    sc.title = "UC2: ask a question with a chosen agent"
    sc.tween(0.9, lambda u: st.update(heads=u))
    sc.hold(0.8)
    sc.title = "The app sends the question; project checks the key"
    send("ask")
    send("guard", hold=0.5)
    sc.title = "Project opens a session; session publishes the root turn"
    send("start")
    send("publish", hold=0.6)
    sc.title = "par: from here, two lanes run at the same time"
    sc.set(now=set(), on=set())
    sc.tween(0.5, lambda u: st.update(par=u))
    sc.hold(0.8)
    sc.title = "The app gets 201 at once, while a worker takes the turn"
    send("accepted", "consume", seconds=0.8, hold=0.9)
    sc.tween(0.4, lambda u: st.update(loop=u))
    sc.title = "The app reads the answer while the worker runs its steps"
    send("get", "llm", seconds=0.6, hold=0.4)
    send("answer", "step", seconds=0.7, hold=0.4)
    send("insert", seconds=0.5, hold=0.8)
    sc.title = "loop: the worker runs one step after another"
    sc.set(now=set(), on=set())
    for _ in range(2):
        for k in ("llm", "step", "insert"):
            sc.set(on=set(BY[k][1:3]))
            sc.tween(0.45, lambda u, k=k: st["over"].__setitem__(k, u))
        sc.hold(0.25)
        sc.set(over={})
    sc.set(on=set())
    sc.title = "The app gets 201 at once and reads the answer while the worker runs"
    sc.hold(3.2)
    sc.save()


# ---------------------------------------------------------------- 5a: source and artifacts
def branches():
    """The branches of the remote (scenes_std_devops.branches has the git facts): ass/platform
    grows out of main, a short-lived branch grows out of it and back, and every push grows
    into an image, the EC2 host and the live platform, one after another."""
    from scenes_std_devops import _dot, _length

    X0 = 2.75
    MAIN, PLAT, FEAT = 1.45, 2.45, 3.3
    END = 7.55
    N, BASE, MERGE = 46, 36, 40
    AX, AW = 8.25, 3.65
    IMG, NODE, LIVE = (1.8, 0.76), (3.14, 0.62), (4.26, 0.5)
    AL = AX + 0.45

    def cx(i):
        """The x of the i-th commit on ass/platform: one pitch for all of them (0.1 in)."""
        return lerp(X0 + 0.22, END - 0.15, (i - 1) / (N - 1))

    FB, FM = cx(BASE), cx(MERGE)
    FEATP = [(FB, PLAT), (FB, FEAT), (FM, FEAT), (FM, PLAT + 0.07)]
    FDOTS = [lerp(FB, FM, 0.33), lerp(FB, FM, 0.67)]
    P = dict(push=[(END, PLAT), (AX, PLAT)], ssh=[(AL, IMG[0] + IMG[1]), (AL, NODE[0] - 0.14)],
             helm=[(AL, NODE[0] + NODE[1]), (AL, LIVE[0])])

    def paint(c, st):
        if st["main"]:
            text(c, 0.22, MAIN - 0.3, 2.4, 0.32, "main", 15, "Semibold", INK2)
            text(c, 0.22, MAIN, 2.4, 0.28, "Lumen, the base product", 13, "Regular", INK3)
            xe = lerp(X0, END, st["main"])
            c.line([(X0, MAIN), (xe, MAIN)], pt=2, color=INK2)
            for x in (X0, 4.1, 5.6, 7.0):
                if xe >= x - 1e-6:
                    _dot(c, x, MAIN)
        if st["drop"]:
            text(c, 0.22, PLAT - 0.3, 2.4, 0.32, "ass/platform", 15, "Semibold", INK)
            text(c, 0.22, PLAT, 2.4, 0.28, "the platform's branch", 13, "Regular", INK2)
            c.line([(X0, MAIN), (X0, lerp(MAIN, PLAT, st["drop"]))], pt=2.5, color=INK)
            if st["drop"] >= 1:
                text(c, X0 + 0.12, (MAIN + PLAT) / 2 - 0.14, 2, 0.28, "left main on 19 October", 13, "Regular", INK2)
        if st["px"] > X0:
            c.line([(X0, PLAT), (st["px"], PLAT)], pt=2.5, color=INK)
            for i in range(1, N + 1):
                if cx(i) <= st["px"] + 1e-6:
                    r_ = 0.022 if i != MERGE else 0.022 + 0.045 * min(1, st["merged"]) + 0.05 * pulse(st, "merge")
                    _dot(c, cx(i), PLAT, INK, r=r_)
        if st["feat"]:
            col = INK if st["featlit"] else INK2
            pts = grow(FEATP, st["feat"])
            line(c, pts, col)
            if st["feat"] >= 1:
                arrowhead(c, FEATP[-1], FEATP[-2], col)
                text(c, FM + 0.1, (PLAT + FEAT) / 2 - 0.14, 1.2, 0.28, "PR #148", 13, "Semibold", col)
            text(c, 0.22, FEAT - 0.15, 2.4, 0.3, "a feature branch", 13, "Regular", INK2)
            text(c, FB - 3.7, FEAT - 0.15, 3.48, 0.3, "codex/platform-approval-acceptance", 13, "Regular", INK2,
                 "right")
            done = st["feat"] * _length(FEATP)
            for x in FDOTS:
                if done >= (FEAT - PLAT) + (x - FB):
                    _dot(c, x, FEAT, col, r=0.035)
        n = sum(1 for i in range(1, N + 1) if cx(i) <= st["px"] + 1e-6 and i != MERGE)
        n += sum(1 for x in FDOTS if st["feat"] * _length(FEATP) >= (FEAT - PLAT) + (x - FB))
        n += 1 if cx(MERGE) <= st["px"] + 1e-6 else 0
        if st["px"] > X0:
            text(c, X0, 3.95, 5, 0.3, "%d commits on ass/platform" % n, 14, "Semibold", INK)
        if st["merged"] >= 1:
            text(c, X0, 4.3, 5, 0.3, "1 pull request merged into it", 14, "Semibold", INK)
        # the deploy column is there, dimmed, from the start; each part lights as its line reaches it
        g = st["art"]

        def la(key):
            return 1.0 if g.get(key, 0) >= 1 else DIM

        line(c, P["push"], ink(INK2, DIM))
        arrow(c, P["push"], g.get("push", 0), INK2)
        arrowhead(c, P["push"][-1], P["push"][-2], ink(INK2, la("push")))
        text(c, END - 0.05, PLAT - 0.4, AX - END + 0.1, 0.28, "push", 13, "Regular", ink(INK2, la("push")), "center")
        comp(c, AX, IMG[0], AW, IMG[1], "lumen-next:<commit sha>", "image, built from deploy/k8s/Dockerfile",
             a=la("push"), p=pulse(st, "image"))
        line(c, P["ssh"], ink(INK2, DIM))
        arrow(c, P["ssh"], g.get("ssh", 0), INK2)
        arrowhead(c, P["ssh"][-1], P["ssh"][-2], ink(INK2, la("ssh")))
        text(c, AL + 0.13, IMG[0] + IMG[1] + 0.08, 3, 0.28, "copy over SSH (scp)", 13, "Regular", ink(INK2, la("ssh")))
        node(c, AX, NODE[0], AW - 0.14, NODE[1], "EC2 host", "AWS", a=la("ssh"), p=pulse(st, "node"))
        text(c, AX + 1.45, NODE[0] + 0.32, 2.0, 0.3, "k3s ctr images import", 13, "Regular", ink(INK2, la("ssh")))
        line(c, P["helm"], ink(INK2, DIM))
        arrow(c, P["helm"], g.get("helm", 0), INK2)
        arrowhead(c, P["helm"][-1], P["helm"][-2], ink(INK2, la("helm")))
        text(c, AL + 0.13, NODE[0] + NODE[1] + 0.1, 3, 0.28, "helm upgrade --install --wait", 13, "Regular",
             ink(INK2, la("helm")))
        comp(c, AX, LIVE[0], AW, LIVE[1], "Lumen platform, live", a=la("helm"), p=pulse(st, "live"))

    st = dict(main=0.0, drop=0.0, px=X0, feat=0.0, featlit=False, merged=0.0, art={}, pulse={})
    sc = Scene("branches.gif", paint, st)

    sc.title = "main holds Lumen, the base product"
    sc.tween(1.0, lambda u: st.update(main=u))
    sc.hold(0.8)
    sc.title = "ass/platform grows out of main on 19 October"
    sc.tween(0.7, lambda u: st.update(drop=max(u, 1e-3)))
    sc.hold(0.4)
    sc.title = "Commits land on ass/platform"
    sc.tween(2.2, lambda u: st.update(px=lerp(X0, cx(BASE), u)))
    sc.hold(0.4)
    sc.title = "A short-lived branch grows out for one change"
    sc.set(featlit=True)
    sc.tween(1.2, lambda u: st.update(feat=max(u * 0.72, 1e-3)))
    sc.hold(0.4)
    sc.title = "Pull request #148 grows back into ass/platform"
    sc.tween(0.9, lambda u: st.update(feat=lerp(0.72, 1.0, u), px=lerp(cx(BASE), cx(MERGE), u)))
    kick(sc, "merge")
    sc.tween(0.3, lambda u: st.update(merged=u))
    sc.hold(1.2)
    sc.title = "More commits land; each one is pushed"
    sc.set(featlit=False)
    sc.tween(1.0, lambda u: st.update(px=lerp(cx(MERGE), END - 0.1, u)))
    sc.hold(0.4)
    for key, target, title in (("push", "image", "A push builds one image: lumen-next:<commit sha>"),
                               ("ssh", "node", "The image goes over SSH into k3s on the EC2 host"),
                               ("helm", "live", "helm upgrade --install --wait puts it live")):
        sc.title = title
        sc.tween(0.7, lambda u, key=key: st["art"].__setitem__(key, u))
        kick(sc, target)
        sc.hold(1.5)
    sc.title = "One integration branch, one image per commit"
    sc.hold(3.0)
    sc.save()


# ---------------------------------------------------------------- 5b: the CI/CD pipeline
def cicd():
    """The pipeline as a flowchart (the layout of scenes_std_devops.cicd). A run grows along
    it: the three checks at the same time, then the gate, then the deploy steps one after
    another. In the first run the line breaks at the Trivy gate; the fixed image passes."""
    from scenes_std_devops import _diamond, _job, _terminal

    # 0.1 in higher than the old layout, so the deploy frame keeps 30 px from the bottom edge
    TRIG = (0.22, 2.05, 1.43, 1.6)
    PAR = [("verify", "lint, types, tests", "", "5 min 05 s"), ("SCA", "dependency audit", "npm audit", "33 s"),
           ("SAST", "static analysis", "CodeQL", "2 min 54 s")]
    PX, PW, PH, PY = 1.95, 1.7, 1.2, [0.95, 2.25, 3.55]
    FR = (3.9, 0.95, 3.6, 3.82)
    SX, SW, SH = 4.05, 2.75, 0.45
    STEPS = [("build", "build image", "2 min 50 s", 1.42), ("copy", "copy and import", "1 min 04 s", 2.87),
             ("helm", "helm upgrade --wait", "22 s", 3.5), ("health", "health check", "", 4.13)]
    GATE = (SX + SW / 2, 2.35, 2.0, 0.62)
    STOP = (6.75, 2.17, 0.6, 0.36)
    AFT = [("dast", "DAST", "live scan", "OWASP ZAP", "1 min 40 s", 1.25),
           ("smoke", "Smoke load", "2 users for 30 s", "k6", "1 min 15 s", 2.75)]
    AX, AW, AH = 7.85, 1.6, 1.2
    SUM = (9.8, 2.37, 1.5, 0.6)
    RES_Y = 3.45                                # a result block, centred under the summary

    def mid(y, h):
        return y + h / 2

    TY = mid(TRIG[1], TRIG[3])
    BUS1, BUS2, BUS3, BUS4 = 1.8, 3.78, 7.68, 9.63
    DY = 2.85
    gx, gy, gw, gh = GATE
    K = {}                                      # every connector of the flowchart, by name
    for (name, *_), y in zip(PAR, PY):
        k = name.lower()
        K["in_" + k] = [(TRIG[0] + TRIG[2], TY), (BUS1, TY), (BUS1, mid(y, PH)), (PX, mid(y, PH))]
        K["out_" + k] = [(PX + PW, mid(y, PH)), (BUS2, mid(y, PH)), (BUS2, DY), (FR[0], DY)]
    K["image"] = [(gx, STEPS[0][3] + SH), (gx, gy - gh / 2)]
    K["pass"] = [(gx, gy + gh / 2), (gx, STEPS[1][3])]
    K["fail"] = [(gx + gw / 2, gy), (STOP[0], gy)]
    K["helm"] = [(gx, STEPS[1][3] + SH), (gx, STEPS[2][3])]
    K["health"] = [(gx, STEPS[2][3] + SH), (gx, STEPS[3][3])]
    for key, *_, y in AFT:
        K["in_" + key] = [(FR[0] + FR[2], DY), (BUS3, DY), (BUS3, mid(y, AH)), (AX, mid(y, AH))]
        K["out_" + key] = [(AX + AW, mid(y, AH)), (BUS4, mid(y, AH)), (BUS4, DY), (SUM[0], DY)]

    def paint(c, st):
        g, ok, dur, seen = st["g"], st["ok"], st["dur"], st["seen"]

        def on(key):
            return pulse(st, key) > 0.05

        def faint(key):
            return key not in seen
        # the connectors: a faint path, and the run's part grown over it
        for key, pts in K.items():
            if key == "pass" and st["broken"]:
                (x, y0), (_, y1) = pts
                m = (y0 + y1) / 2
                # a clear gap in the line, with a small cross in it: the image does not pass
                c.line([(x, y0), (x, m - 0.07)], color=INK, pt=2)
                c.line([(x, m + 0.07), (x, y1)], color=RULE2)
                c.cross(x - 0.05, m - 0.05, 0.1, 0.1)
                continue
            u = g.get(key, 0)
            col = RULE2 if u <= 0 else (INK if 0 < u < 1 else INK2)
            if u < 1:
                line(c, pts, RULE2)
            if u > 0:
                arrow(c, pts, u, INK if u < 1 else INK2, pt=2 if u < 1 else 1.5)
            else:
                arrowhead(c, pts[-1], pts[-2], col)
        _terminal(c, *TRIG, "trigger", "push to\nass/platform,\nor a manual\nrun", lit=on("trig"))
        for (name, note, tool, d), y in zip(PAR, PY):
            k = name.lower()
            _job(c, PX, y, PW, PH, name, note, tool, d if dur else "", lit=on(k), faint=faint(k), ok=k in ok)
        fx, fy, fw, fh = FR
        c.d.rectangle([c._p(fx), c._p(fy), c._p(fx + fw), c._p(fy + fh)],
                      outline=RULE2 if faint("deploy") else RULE, width=c._lw(1.5))
        text(c, fx + 0.15, fy + 0.07, 2, 0.3, "deploy", 15, "Semibold", INK3 if faint("deploy") else INK)
        if dur:
            text(c, fx + 1.0, fy + 0.08, 1.5, 0.3, "5 min 30 s", 13, "Regular", INK2)
        if "deploy" in ok:
            c.check(fx + fw - 0.38, fy + 0.1, 0.22)
        for key, name, d, y in STEPS:
            fa = faint(key)
            box(c, SX, y, SW, SH, lit=on(key), pt=1.5)
            if fa:
                c.d.rectangle([c._p(SX), c._p(y), c._p(SX + SW), c._p(y + SH)], outline=RULE2, width=c._lw(1.5))
            text(c, SX + 0.14, y, SW, SH, name, 14, "Semibold", INK3 if fa else INK)
            if dur and d:
                text(c, SX, y, SW - 0.14, SH, d, 13, "Regular", INK2, "right")
            if key in ok and not (dur and d):
                c.check(SX + SW - 0.36, y + 0.1, 0.22)
        text(c, gx + 0.14, gy + gh / 2 - 0.02, 0.6, 0.24, "pass", 13, "Regular", INK2)
        _diamond(c, *GATE, "Trivy gate", lit=on("gate"))
        if dur:
            text(c, SX - 0.02, gy - 0.15, 0.6, 0.3, "25 s", 13, "Regular", INK2)
        text(c, gx + gw / 2 + 0.02, gy - 0.34, 0.6, 0.26, "fail", 13, "Regular", INK2)
        _terminal(c, *STOP, "stop", lit=st["stopped"], faint=not st["stopped"])
        for key, name, note, tool, d, y in AFT:
            _job(c, AX, y, AW, AH, name, note, tool, d if dur else "", lit=on(key), faint=faint(key), ok=key in ok)
        _terminal(c, *SUM, "summary" + ("  4 s" if dur else ""), lit=on("sum"), faint=faint("sum"))
        if st["result"]:
            w = max(tw(s_, 16, "Semibold") for s_ in st["result"]) + 0.36
            _invert_lines(c, SUM[0] + SUM[2] / 2 - w / 2, RES_Y, st["result"])

    st = dict(g={}, ok=set(), dur=False, seen=set(), broken=False, stopped=False, result=None, pulse={})
    sc = Scene("pipeline.gif", paint, st)
    G = st["g"]

    def reach(*keys):
        st["seen"] |= set(keys)
        for k in keys:
            kick(sc, k)

    def grow_k(keys, seconds=0.6):
        sc.tween(seconds, lambda u: [G.__setitem__(k, u) for k in keys])

    def run(fast):
        t = 0.45 if fast else 0.6
        reach("trig")
        sc.hold(0.3)
        grow_k(["in_verify", "in_sca", "in_sast"], t)
        reach("verify", "sca", "sast")
        sc.hold(0.5 if fast else 0.9)
        sc.set(ok=st["ok"] | {"verify", "sca", "sast"})
        sc.hold(0.3)
        grow_k(["out_verify", "out_sca", "out_sast"], t)
        reach("deploy", "build")
        sc.hold(0.4)
        grow_k(["image"], t)
        reach("gate")
        sc.hold(0.5)

    sc.step("The pipeline: .github/workflows/platform-deploy.yml", 2.0)
    sc.title = "The first run: verify, SCA and SAST grow at the same time, and pass"
    run(False)
    sc.title = "5 critical CVEs: the line breaks at the Trivy gate"
    sc.tween(0.4, lambda u: G.__setitem__("pass", 0.5 * u))
    sc.set(broken=True)
    sc.hold(0.3)
    grow_k(["fail"], 0.5)
    sc.set(stopped=True, result=["5 critical CVEs:", "deploy stopped"])
    sc.hold(2.0)
    sc.step("The fix: a smaller platform image, with no Docker inside", 1.6, result=None)
    sc.set(g={}, ok=set(), seen=set(), broken=False, stopped=False, dur=True)
    G = st["g"]
    sc.title = "The next run: the fixed image"
    run(True)
    sc.title = "The image passes the gate; the deploy steps run one after another"
    for key, step_ in (("pass", "copy"), ("helm", "helm"), ("health", "health")):
        grow_k([key], 0.45)
        reach(step_)
        sc.hold(0.25)
    sc.set(ok=st["ok"] | {"deploy", "health"})
    sc.title = "DAST and a smoke load run at the same time against the live address"
    grow_k(["in_dast", "in_smoke"], 0.5)
    reach("dast", "smoke")
    sc.hold(0.7)
    sc.set(ok=st["ok"] | {"dast", "smoke"})
    grow_k(["out_dast", "out_smoke"], 0.5)
    reach("sum")
    sc.hold(0.5)
    sc.step("Every stage passed: all jobs done in 12 min 30 s", 3.2, result=["all jobs done", "in 12 min 30 s"])
    sc.save()


# ---------------------------------------------------------------- 5c: technical findings
def findings():
    """Three findings, each as a before-and-after morph: one queue divides into a queue per
    level; the image with Docker shrinks and passes the gate; the 300 s bar shrinks to 60 s."""
    CW, GAP = 3.75, 0.27
    XS = [0.45 + i * 4.0 for i in range(3)]     # even columns, about the same margin on both sides
    HY = 1.0
    HEADS = [("Per-level queues", "found in design"), ("Trivy gate", "image scan"), ("KEDA scale-down", "load test")]
    WORDS = [("Leads wait for readers that wait\nin the same queue: a deadlock.",
              "One queue per level of the task tree\n(AD-03)."),
             ("5 critical CVEs, most in the docker.io\npackage. The gate stopped the deploy.",
              "deploy/k8s/Dockerfile: smaller, patched\nat build. The next run passed."),
             ("KEDA waits 300 s by default\nbefore it removes a worker.",
              "The chart sets 60 s, so the workers\ngo back to 1 a minute after the load.")]
    DY0, DH = 1.5, 0.84                         # the diagram band
    PW_Y, SOL_Y, SW_Y = 2.72, 3.36, 3.7          # problem words, the solution arrow, solution words
    x0, x1, x2 = XS
    ONE = (x0, DY0 + 0.06, 1.45, 0.72)
    LEV = [(x0, DY0 + i * 0.28, 1.45, 0.21) for i in range(3)]
    SLOTS = (x0 + 1.85, DY0 + 0.06, 1.9, 0.72)
    MIDY = DY0 + 0.42

    def paint(c, st):
        seen = st["seen"]
        for i, (h, sub) in enumerate(HEADS):
            if ("p", i) not in seen:
                continue
            x = XS[i]
            text(c, x, HY, CW, 0.34, h, 16, "Semibold", INK)
            text(c, x + tw(h, 16, "Semibold") + 0.2, HY + 0.03, CW, 0.3, sub, 13, "Regular", INK3)
            if ("pw", i) in seen:
                text(c, x, PW_Y, CW, 0.54, WORDS[i][0], 13, "Regular", INK2)
            if ("sw", i) in seen:
                arrow(c, [(x + 0.08, SOL_Y), (x + 0.08, SOL_Y + 0.26)], 1, INK2)
                text(c, x + 0.22, SOL_Y - 0.02, 1.5, 0.28, "solution", 13, "Medium", INK3)
                text(c, x, SW_Y, CW, 0.54, WORDS[i][1], 13, "Regular", INK)

        # 1. one queue divides into a queue per level
        if ("p", 0) in seen:
            m = st["m"][0]
            if m < 1:
                comp(c, *ONE, "one queue", "readers wait", a=1 - m, p=pulse(st, "q"))
            if m > 0:
                for i, r in enumerate(LEV):
                    rr = rect_lerp(ONE, r, draw.ease(m))
                    box(c, *rr, a=m)
                    if m > 0.6:
                        text(c, *r, "level %d" % i, 13, "Medium", ink(INK, (m - 0.6) / 0.4), "center")
            jx = x0 + 1.65
            if m < 1:
                arrow(c, [(x0 + 1.45, MIDY), (SLOTS[0], MIDY)], 1, ink(INK2, 1 - m))
            if m > 0:
                for r in LEV:
                    line(c, [(x0 + 1.45, r[1] + 0.105), (jx, r[1] + 0.105)], ink(INK2, m))
                line(c, [(jx, LEV[0][1] + 0.105), (jx, LEV[2][1] + 0.105)], ink(INK2, m))
                arrow(c, [(jx, MIDY), (SLOTS[0], MIDY)], 1, ink(INK2, m))
            comp(c, *SLOTS, "worker slots", "all held by leads" if m < 0.5 else "readers always run",
                 p=pulse(st, "slots"))

        # 2. the image with Docker shrinks, and passes the gate
        if ("p", 1) in seen:
            m = st["m"][1]
            w = lerp(2.05, 1.72, m)
            comp(c, x1, MIDY - 0.36, w, 0.72, "Lumen image" if m < 0.5 else "platform image",
                 "with Docker" if m < 0.5 else "no Docker", p=pulse(st, "img"))
            gxc = x1 + 2.75
            arrow(c, [(x1 + w, MIDY), (gxc - 0.5, MIDY)], st["g1"], INK2)
            from scenes_std_devops import _diamond
            _diamond(c, gxc, MIDY, 1.0, 0.62, "gate", lit=pulse(st, "gate") > 0.05)
            arrow(c, [(gxc + 0.5, MIDY), (x1 + 3.42, MIDY)], st["g2"], INK2)
            if st["g2"] >= 1:
                if m < 0.5:
                    c.cross(x1 + 3.5, MIDY - 0.12, 0.24, 0.24)
                else:
                    c.check(x1 + 3.5, MIDY - 0.12, 0.24)

        # 3. the scale-down window, to scale: 300 s shrinks to 60 s
        if ("p", 2) in seen:
            m = st["m"][2]
            # the default stays as a dim outline; a copy of its bar moves down and shrinks to 60 s
            y1, y2 = DY0 + 0.28, DY0 + 0.7
            u = st["fill"]
            L300 = 2.45
            text(c, x2, y1 - 0.36, 1.6, 0.28, "load ends", 13, "Regular", INK2)
            c.line([(x2 + 0.05, y1 - 0.08), (x2 + 0.05, (y2 if m > 0 else y1) + 0.36)], color=INK2)
            c.d.rectangle([c._p(x2 + 0.05), c._p(y1), c._p(x2 + 0.05 + L300), c._p(y1 + 0.28)],
                          outline=mix(RULE, INK3, m), width=c._lw(1))
            if u > 0 and m < 1:
                c.bar(x2 + 0.05, y1, L300 * u, 0.28, ink(INK3, 1 - m))
            if u >= 1:
                text(c, x2 + 0.05, y1, L300, 0.28, "300 s", 13, "Semibold", mix(BLACK, INK3, m), "center")
                text(c, x2 + L300 + 0.17, y1 - 0.01, 1.2, 0.3, "default", 13, "Regular", INK2)
            if m > 0:
                L = lerp(L300, L300 * 60 / 300, m)
                y = lerp(y1, y2, m)
                c.bar(x2 + 0.05, y, L, 0.28, mix(INK3, INK, m))
                secs = round(lerp(300, 60, m))
                text(c, x2 + 0.05, y, L, 0.28, "%d s" % secs, 13, "Semibold", BLACK, "center")
                if m >= 1:
                    text(c, x2 + L + 0.17, y - 0.01, 1.5, 0.3, "in the chart", 13, "Regular", INK2)

    st = dict(seen=set(), m=[0.0, 0.0, 0.0], g1=0.0, g2=0.0, fill=0.0, pulse={})
    sc = Scene("findings.gif", paint, st)

    def show(*keys):
        st["seen"] |= set(keys)

    # 1. per-level queues
    sc.step("1. One queue for all turns: leads hold every worker slot", 1.4, seen={("p", 0)})
    sc.title = "1. Their readers wait in the same queue: a deadlock"
    show(("pw", 0))
    kick(sc, "q")
    sc.hold(1.8)
    sc.title = "1. The one queue divides into a queue per level"
    sc.tween(1.3, lambda u: st["m"].__setitem__(0, u))
    kick(sc, "slots")
    show(("sw", 0))
    sc.hold(1.8)
    # 2. the Trivy gate
    sc.step("2. The Lumen image carries Docker: the gate stops it", 0.2)
    show(("p", 1))
    sc.tween(0.6, lambda u: st.update(g1=u))
    kick(sc, "gate")
    sc.tween(0.4, lambda u: st.update(g2=u))
    show(("pw", 1))
    sc.hold(1.8)
    sc.title = "2. The image shrinks: no Docker inside, and it passes"
    sc.set(g1=0.0, g2=0.0)
    sc.tween(1.1, lambda u: st["m"].__setitem__(1, u))
    sc.tween(0.5, lambda u: st.update(g1=u))
    kick(sc, "gate")
    sc.tween(0.35, lambda u: st.update(g2=u))
    show(("sw", 1))
    sc.hold(1.6)
    # 3. the KEDA scale-down window
    sc.step("3. By default, KEDA waits 300 s before it removes a worker", 0.2)
    show(("p", 2))
    sc.tween(1.6, lambda u: st.update(fill=u))
    show(("pw", 2))
    sc.hold(1.4)
    sc.title = "3. The chart sets 60 s: the bar shrinks to a fifth"
    sc.tween(1.2, lambda u: st["m"].__setitem__(2, u))
    show(("sw", 2))
    sc.hold(1.6)
    sc.title = "Three technical findings and how the team fixed them"
    sc.hold(3.0)
    sc.save()


SCENES = dict(physdecisions=physdecisions, deployment=deployment, scaling=scaling, er=er, sequence=sequence,
              branches=branches, cicd=cicd, findings=findings)
