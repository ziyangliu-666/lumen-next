"""Three scenes that show the platform works: it scales, it survives a killed worker, and
every push goes through the checks. Every number comes from docs/platform/evidence/ or
from the deploy workflow's two real runs."""
import os
import re

from draw import (BLACK, EVIDENCE, INK, INK2, INK3, RAISED, RULE, RULE2, S, X2, Canvas, Scene,
                  font, lerp)


# ============================================================ small helpers this file needs
def _tw(s, size, weight="Regular", mono=False):
    """The width of a line of text, in inches."""
    return font(size, weight, mono).getlength(s) / (S * X2)


def _dashed(c, pts, color=INK2, pt=1.5, dash=0.09, gap=0.06):
    """A dashed polyline. The dash pattern runs on across corners."""
    on, left = True, dash
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        seg = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
        pos = 0.0
        while pos < seg - 1e-9:
            run = min(left, seg - pos)
            if on:
                a, b = pos / seg, (pos + run) / seg
                c.line([(lerp(x1, x2, a), lerp(y1, y2, a)), (lerp(x1, x2, b), lerp(y1, y2, b))],
                       pt=pt, color=color)
            pos += run
            left -= run
            if left <= 1e-9:
                on = not on
                left = dash if on else gap


def _invert_lines(c, x, y, lines, size=16, pad=0.18, lh=0.36):
    """A result that matters, on more than one line: black words on one white block."""
    w = max(_tw(s, size, "Semibold") for s in lines) + 2 * pad
    h = lh * len(lines) + 2 * 0.1
    c.bar(x, y, w, h, INK)
    for i, s in enumerate(lines):
        c.text(x + pad, y + 0.1 + i * lh, w, lh, s, size, "Semibold", BLACK, "left")
    return w, h


def _xmark(c, x, y, s=0.22):
    """A small crisp cross, the same size as a check mark: a stage that failed."""
    c.cross(x, y, s, s)


# ============================================================ the real run, read from the evidence
def _scaling():
    """The 10-second samples of the load test: (seconds from the first sample, workers,
    jobs in the three queues). A job counts when it is in a queue, taken or not, because
    KEDA's QueueLength rule counts it so (the management API counts unacknowledged
    messages too, deploy/k8s/lumen/templates/autoscaling.yaml)."""
    with open(os.path.join(EVIDENCE, "2026-10-20-load-and-scaling.md")) as f:
        text = f.read()
    rows = []
    for m in re.finditer(r"^(\d\d):(\d\d):(\d\d) workers=(\d)/\d queues=(.*)$", text, re.M):
        h, mi, s, w, qs = m.groups()
        secs = int(h) * 3600 + int(mi) * 60 + int(s)
        jobs = sum(int(n) for n in re.findall(r"lumen\.turns\.\d:(\d+):\d+", qs))
        rows.append((secs, int(w), jobs))
    t0 = rows[0][0]
    return [(t - t0, w, j) for t, w, j in rows]


# ============================================================ scale: the queue and the workers on one time axis
def scale():
    data = [d for d in _scaling() if d[0] <= 215]
    T1 = 220
    X0, X1 = 1.05, 8.65                     # the plot, left and right
    YB, YT, JMAX = 3.2, 1.6, 30             # the jobs plot: baseline, top, top value
    WB, WH = 4.18, 0.17                     # the worker strip: its bottom, one worker's height
    BW = 0.28                               # a bar's width
    RX = 9.25                               # the right panel

    def tx(t):
        return X0 + t / T1 * (X1 - X0)

    def jy(n):
        return YB - n / JMAX * (YB - YT)

    def paint(c, st):
        t = st["t"]
        seen = [d for d in data if d[0] <= t + 1e-6]
        # the legend, one line under the title band
        c.bar(X0, 1.09, 0.16, 0.16, INK2)
        c.text(X0 + 0.26, 1.02, 3, 0.3, "jobs waiting (three queues)", 13, "Medium", INK2, "left")
        lx = X0 + 0.26 + _tw("jobs waiting (three queues)", 13, "Medium") + 0.45
        _dashed(c, [(lx, 1.17), (lx + 0.42, 1.17)], INK)
        c.text(lx + 0.55, 1.02, 3, 0.3, "5 waiting jobs per worker", 13, "Medium", INK2, "left")
        # the y axis: a few round ticks
        for n in (0, 10, 20, 30):
            y = jy(n)
            if n:
                c.line([(X0, y), (X1, y)], pt=1, color=RULE2)
            c.text(0.3, y - 0.15, 0.6, 0.3, str(n), 13, "Regular", INK3, "right")
        c.text(0.3, YT - 0.42, 0.6, 0.3, "jobs", 13, "Medium", INK2, "right")
        c.line([(X0, YB), (X1, YB)], pt=1.5, color=RULE)
        # the cursor, behind the bars so the current bar stays whole
        c.line([(tx(t), YT - 0.12), (tx(t), WB + 0.02)], pt=2, color=INK)
        # the bars, and the threshold that rises with the workers
        for i, (ts, w, j) in enumerate(seen):
            if j:
                c.bar(tx(ts) - BW / 2, jy(j), BW, YB - jy(j), INK if ts == seen[-1][0] else INK2)
        pts = []
        for i, (ts, w, j) in enumerate(seen):
            end = min(t, data[i + 1][0]) if i + 1 < len(data) else t
            y = jy(5 * w)
            if pts:
                pts.append((tx(ts), y))
            pts += [(tx(ts), y), (tx(end), y)]
        if len(pts) > 1:
            _dashed(c, pts, INK)
        # the workers, as stacked boxes on the same time axis
        c.text(0.3, WB - 4 * WH - 0.1, 0.6, 4 * WH + 0.1, "workers", 13, "Medium", INK2, "right")
        for ts, w, j in seen:
            for k in range(w):
                y = WB - (k + 1) * (WH + 0.03) + 0.03
                c.bar(tx(ts) - BW / 2, y, BW, WH, INK if ts == seen[-1][0] else INK3)
        # the time axis
        for s in (0, 60, 120, 180):
            c.line([(tx(s), WB + 0.02), (tx(s), WB + 0.1)], pt=1, color=RULE)
            c.text(tx(s) - 0.5, WB + 0.12, 1.0, 0.3, "%d s" % s, 13, "Regular", INK3)
        # the two counters, in sync with the cursor
        w_now, j_now = (seen[-1][1], seen[-1][2]) if seen else (1, 0)
        c.number(RX, 1.15, 2.5, str(w_now), "workers (max 4)", 32)
        c.number(RX, 2.1, 2.5, str(j_now), "jobs waiting", 32)
        if st["result"]:
            _invert_lines(c, RX, 3.2, ["135 questions", "median 6.1 s", "0 of 1,040 failed"])

    sc = Scene("scale.gif", paint, dict(t=0.0, result=False))

    def sweep(t_end, rate=26.0):
        t_start = sc.st["t"]
        n = max(1, round((t_end - t_start) / rate * 25))
        for i in range(1, n + 1):
            sc.st["t"] = lerp(t_start, t_end, i / n)
            sc._add(sc._draw(), 40)

    sc.step("1. Ten users ask questions without pause", 0.5)
    sweep(30)
    sc.hold(2.4)
    sc.step("2. One worker falls behind; the queue grows", 0.3)
    sweep(41)
    sc.hold(2.4)
    sc.step("3. Above 5 waiting jobs per worker, KEDA adds one: 1 to 4 in 49 s", 0.3)
    sweep(79, 18)
    sc.hold(2.6)
    sc.step("4. At the limit of 4 workers, the queue stops growing", 0.3)
    sweep(115)
    sc.hold(2.4)
    sc.step("5. The load stops, the queue empties, and a minute later: 1 worker", 0.3)
    sweep(215, 32)
    sc.hold(2.4)
    sc.step("6. Every question finished, and no request failed", 3.2, result=True)
    sc.save()


# ============================================================ kill: a worker dies with jobs in hand
def kill():
    QB = dict(x=0.3, y=2.3, w=1.45, h=0.9)
    QX, QY, CELL, N = 2.2, 2.53, 0.44, 4
    KINDS = ["lead", "reader", "reader"]    # the evidence: one lead turn, two reader turns
    A, B = (5.6, 1.3), (5.6, 3.2)
    WW, WHT = 2.3, 1.0
    BUS = 5.2
    CY = QY + CELL / 2
    RX = 8.45

    def cell(i):
        return QX + (i + 0.5) * CELL, CY

    def slot(w, i):
        return w[0] + 0.25 + i * 0.64 + 0.25, w[1] + 0.63

    def worker(c, xy, label, state, jobs, marks):
        x, y = xy
        c.box(x, y, WW, WHT, "", state)
        color = INK if state == "active" else (RULE if state == "faint" else INK2)
        c.text(x, y + 0.04, WW, 0.3, label, 15, "Medium", color)
        for i in range(3):
            sx = x + 0.25 + i * 0.64
            c.box(sx, y + 0.38, 0.5, 0.5, "", "faint" if state == "faint" else "idle")
            if jobs[i]:
                c.job(sx + 0.25, y + 0.63, KINDS[i])
            if marks[i]:
                c.check(sx + 0.12, y + 0.5, 0.26)

    def paint(c, st):
        on = st["on"]
        c.box(*QB.values(), "question", "active" if "q" in on else "idle", 15, sub=st["status"])
        c.arrow([(QB["x"] + QB["w"], CY), (QX, CY)], "q" in on and "queue" in on)
        c.queue(QX, QY, N, (), "RabbitMQ queue", "queue" in on, CELL)
        for i, s in enumerate(st["cells"]):
            if s:
                x, y = cell(i)
                c.job(x, y, KINDS[i], hollow=(s == "taken"), s=0.24)
        c.text(QX, QY + CELL + 0.12, 3, 0.3, "hollow: taken, not acknowledged", 13, "Medium", INK2, "left")
        c.text(QX, QY + CELL + 0.42, 3, 0.3, "a job leaves only when", 13, "Regular", INK3, "left")
        c.text(QX, QY + CELL + 0.7, 3, 0.3, "its worker says done", 13, "Regular", INK3, "left")
        c.line([(QX + N * CELL, CY), (BUS, CY)], "a" in on or "b" in on)
        c.arrow([(BUS, CY), (BUS, A[1] + 0.5), (A[0], A[1] + 0.5)], "a" in on)
        c.arrow([(BUS, CY), (BUS, B[1] + 0.5), (B[0], B[1] + 0.5)], "b" in on)
        worker(c, A, "worker A", st["a"], st["ajobs"], [0, 0, 0])
        if st["a"] == "dead":
            c.cross(A[0] + 0.1, A[1] + 0.1, WW - 0.2, WHT - 0.2)
        worker(c, B, "worker B", st["b"], st["bjobs"], st["bmarks"])
        if st["result"]:
            _invert_lines(c, RX, 2.05, ["ended in 12.6 s (median 6.1 s)", "cost 8¢ instead of 3¢:",
                                        "the jobs ran twice"])

    st = dict(on={"q"}, status="running", cells=[None] * 3, a="idle", ajobs=[0, 0, 0], b="faint",
              bjobs=[0, 0, 0], bmarks=[0, 0, 0], result=False)
    sc = Scene("kill.gif", paint, st)
    sc.step("1. Worker A holds three jobs; they stay in the queue until A says done", 0.6)
    sc.set(on={"q", "queue"})
    for i in range(3):
        sc.hop(KINDS[i], [(QB["x"] + QB["w"], CY), cell(i)], 0.5)
        sc.st["cells"][i] = "ready"
    sc.hold(0.5)
    sc.set(on={"queue", "a"}, cells=["taken"] * 3)
    sc.hop(KINDS[0], [cell(0), (BUS, CY), (BUS, A[1] + 0.5), slot(A, 0)], 0.8,
           also=[(KINDS[i], [cell(i), (BUS, CY), (BUS, A[1] + 0.5), slot(A, i)]) for i in (1, 2)])
    sc.set(on={"a"}, a="active", ajobs=[1, 1, 1])
    sc.hold(2.8)
    sc.step("2. We force-delete worker A", 0.3, on=set(), a="dead", ajobs=[0, 0, 0])
    sc.hold(2.4)
    sc.step("3. Nobody said done, so the three jobs return to the queue", 0.4, on={"queue"})
    sc.hop(KINDS[0], [slot(A, 0), (BUS, A[1] + 0.5), (BUS, CY), cell(0)], 0.8,
           also=[(KINDS[i], [slot(A, i), (BUS, A[1] + 0.5), (BUS, CY), cell(i)]) for i in (1, 2)])
    sc.set(cells=["ready"] * 3)
    sc.hold(2.6)
    sc.step("4. Kubernetes starts worker B, and B takes them", 0.4, b="idle")
    sc.hold(0.4)
    sc.set(on={"queue", "b"}, cells=["taken"] * 3)
    sc.hop(KINDS[0], [cell(0), (BUS, CY), (BUS, B[1] + 0.5), slot(B, 0)], 0.8,
           also=[(KINDS[i], [cell(i), (BUS, CY), (BUS, B[1] + 0.5), slot(B, i)]) for i in (1, 2)])
    sc.set(on={"b"}, b="active", bjobs=[1, 1, 1])
    sc.hold(2.6)
    sc.step("5. B says done for each job, and each job leaves the queue", 0.5)
    for i in (2, 1, 0):
        sc.st["bjobs"][i] = 0
        sc.st["bmarks"][i] = 1
        sc.st["cells"][i] = None
        sc.hold(0.6)
    sc.set(on={"q"}, status="ended", b="idle")
    sc.hold(2.4)
    sc.step("6. The question still ends, later and at a higher cost", 3.4, result=True)
    sc.save()


# ============================================================ pipeline: every push, two real runs
def pipeline():
    BW, BH = 1.9, 0.78
    CY = 2.73
    C1, C2, C3, C4 = 1.55, 4.3, 6.95, 9.6
    BOX = dict(verify=(C1, 1.3), sca=(C1, CY - BH / 2), sast=(C1, 4.16 - BH),
               scan=(C2, CY - BH / 2), deploy=(C3, CY - BH / 2),
               dast=(C4, CY - 0.55 - BH / 2), load=(C4, CY + 0.55 - BH / 2))
    NAME = dict(verify="verify", sca="SCA", sast="SAST", scan="image scan", deploy="deploy",
                dast="DAST", load="smoke load")
    TOOL = dict(verify="tests", sca="npm audit", sast="CodeQL", scan="Trivy", deploy="Helm on k3s",
                dast="OWASP ZAP", load="k6")
    PX = 0.3                                    # where a push starts

    def mid(k, side):
        x, y = BOX[k]
        return (x if side == "l" else x + BW), y + BH / 2

    B1, B2, B3 = C1 - 0.2, C1 + BW + 0.42, C4 - 0.4    # the three buses

    def to(k, bus, start):
        return [start, (bus, start[1]), (bus, mid(k, "l")[1]), mid(k, "l")]

    paths = dict(
        verify=to("verify", B1, (PX + 0.95, CY)), sca=to("sca", B1, (PX + 0.95, CY)),
        sast=to("sast", B1, (PX + 0.95, CY)),
        scan=[(B2, CY), mid("scan", "l")], deploy=[mid("scan", "r"), mid("deploy", "l")],
        dast=to("dast", B3, mid("deploy", "r")), load=to("load", B3, mid("deploy", "r")))

    def stage(c, k, state, mark):
        x, y = BOX[k]
        if state == "active":
            c.box(x, y, BW, BH, "", "active")
        else:
            c.box(x, y, BW, BH, "", "faint" if state == "faint" else "idle")
        name_col = INK if state in ("active", "pass", "fail") else (RULE if state == "faint" else INK2)
        tool_col = INK2 if state in ("active", "pass", "fail") else (RULE if state == "faint" else INK3)
        c.text(x + 0.18, y + 0.1, BW, 0.32, NAME[k], 15, "Medium", name_col, "left")
        c.text(x + 0.18, y + 0.4, BW, 0.28, TOOL[k], 13, "Regular", tool_col, "left")
        if mark == "pass":
            c.check(x + BW - 0.42, y + BH / 2 - 0.13, 0.26)
        elif mark == "fail":
            _xmark(c, x + BW - 0.4, y + BH / 2 - 0.11, 0.22)

    def paint(c, st):
        s, m, lit = st["state"], st["mark"], st["lit"]
        c.text(PX, CY - 0.18, 1.0, 0.36, "push", 15, "Medium", INK if "push" in lit else INK2, "left",
               mono=True)
        for k in ("verify", "sca", "sast"):
            c.arrow(paths[k], k in lit)
        for k in ("verify", "sca", "sast"):
            c.line([mid(k, "r"), (B2, mid(k, "r")[1]), (B2, CY)], "scan" in lit)
        c.arrow(paths["scan"], "scan" in lit)
        c.arrow(paths["deploy"], "deploy" in lit)
        for k in ("dast", "load"):
            c.arrow(paths[k], k in lit)
        for k in BOX:
            stage(c, k, s[k], m.get(k))
        if st["stopped"]:
            c.invert(C2, 3.45, "5 critical: deploy stopped", 16)
        if st["fix"]:
            x, y = C2, 3.4
            c.well(x, y, 2.9, 0.82)
            c.text(x + 0.16, y + 0.1, 2.8, 0.3, "perl-base: patched at build", 13, "Medium", INK, "left")
            c.text(x + 0.16, y + 0.42, 2.8, 0.3, "docker.io: removed", 13, "Medium", INK, "left")
        if st["live"]:
            c.invert(C3 + BW / 2, 3.45, "live in 12.5 min", 16, align="center")

    def fresh():
        return dict(state={k: "idle" for k in BOX}, mark={}, lit=set(), stopped=False, fix=False,
                    live=False)

    sc = Scene("pipeline.gif", paint, fresh())
    st = sc.st

    def run_through(keys, seconds=0.75, after=None):
        """The push job goes into the stages in keys, at once, and each one passes."""
        for k in keys:
            st["lit"].add(k)
        sc.hop("lead", paths[keys[0]], seconds, also=[("lead", paths[k]) for k in keys[1:]])
        for k in keys:
            st["state"][k] = "active"
        sc.hold(0.5)
        for k in keys:
            if after != "fail":
                st["state"][k], st["mark"][k] = "pass", "pass"
        st["lit"] -= set(keys)

    def to_scan():
        st["lit"] |= {"scan"}
        sc.hop("lead", [mid("verify", "r"), (B2, mid("verify", "r")[1]), (B2, CY), mid("scan", "l")], 0.8,
               also=[("lead", [mid(k, "r"), (B2, mid(k, "r")[1]), (B2, CY), mid("scan", "l")])
                     for k in ("sca", "sast")])
        st["state"]["scan"] = "active"
        sc.hold(0.6)

    sc.step("1. Every push runs six checks around one deploy", 0.6, lit={"push"})
    run_through(["verify", "sca", "sast"])
    sc.hold(2.2)
    sc.step("2. Run 1: Trivy finds 5 critical issues, so the deploy stops", 0.3)
    to_scan()
    st["lit"] = set()
    st["state"]["scan"], st["mark"]["scan"] = "fail", "fail"
    for k in ("deploy", "dast", "load"):
        st["state"][k] = "faint"
    sc.hold(0.5)
    sc.set(stopped=True)
    sc.hold(2.8)
    sc.step("3. The fix: a platform image without Docker, patched at build", 3.0, **dict(fresh(), fix=True))
    sc.step("4. Run 2: every check passes, and the deploy goes live", 0.4, fix=False, lit={"push"})
    run_through(["verify", "sca", "sast"], 0.7)
    to_scan()
    st["state"]["scan"], st["mark"]["scan"] = "pass", "pass"
    st["lit"] = {"deploy"}
    sc.hop("lead", paths["deploy"], 0.6)
    st["state"]["deploy"] = "active"
    sc.hold(0.6)
    st["state"]["deploy"], st["mark"]["deploy"] = "pass", "pass"
    st["lit"] = set()
    run_through(["dast", "load"], 0.7)
    sc.hold(0.3)
    sc.set(live=True)
    sc.hold(3.2)
    sc.save()


SCENES = dict(scale=scale, kill=kill, pipeline=pipeline)
