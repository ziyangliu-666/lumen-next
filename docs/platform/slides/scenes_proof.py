"""Three scenes that show the platform works: it scales, it survives a killed worker, and
every push goes through the checks. Every number comes from docs/platform/evidence/ or
from the deploy workflow's two real runs."""
import os
import re

from draw import BLACK, EVIDENCE, INK, INK2, INK3, RULE, RULE2, S, X2, font, lerp
from icons import icon
from scenes_core import Live, carry, gear


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
    RX = 9.3                                # the right panel
    LOAD = 125                              # the users stop asking; after this no worker is busy

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
        # beside the chart: one gear for each worker that runs now, and the jobs that wait
        w_now, j_now = (seen[-1][1], seen[-1][2]) if seen else (1, 0)
        c.text(RX, 1.15, 2.6, 0.3, "workers", 13, "Medium", INK2, "left")
        for k in range(w_now):
            gear(c, RX + 0.3 + k * 0.66, 1.85, 0.52, busy=t < LOAD, turn=st["turn"] + k * 0.3)
        c.number(RX, 2.45, 2.5, str(j_now), "jobs waiting", 32)
        if st["result"]:
            _invert_lines(c, RX, 3.45, ["135 questions", "median 6.1 s", "0 of 1,040 failed"])

    sc = Live("scale.gif", paint, dict(t=0.0, result=False))

    def sweep(t_end, rate=26.0):
        t_start = sc.st["t"]
        n = max(1, round((t_end - t_start) / rate * 25))
        for i in range(1, n + 1):
            sc.st["t"] = lerp(t_start, t_end, i / n)
            sc.st["busy"] = {0} if sc.st["t"] < LOAD else set()
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
    sc.step("4. With 4 workers, the queue stops growing", 0.3)
    sweep(115)
    sc.hold(2.4)
    sc.step("5. The load stops, the queue empties, and a minute later: 1 worker", 0.3)
    sweep(215, 32)
    sc.hold(2.4)
    sc.step("6. Every question finished, and no request failed", 3.2, result=True)
    sc.save()


# ============================================================ kill: a worker dies with jobs in hand
def kill():
    KINDS = ["lead", "reader", "reader"]    # the evidence: one lead turn, two reader turns
    CY = 2.85                                # the question and the queue
    QX, CELL, N = 2.05, 0.44, 4
    QI = (0.85, CY)                          # the question icon
    A, B = (6.2, 1.75), (6.2, 3.95)          # the two gears
    GS = 0.62
    BUS = 5.0
    HX = 9.0                                 # Kubernetes, beside the two workers
    OUT_X = 8.55                             # where B's finished papers land

    def cell(i):
        return QX + (i + 0.5) * CELL, CY

    def hand(w, i):
        """The job worker w holds, to the right of its gear."""
        return w[0] + 0.62 + i * 0.36, w[1]

    def to(w, i):
        return [cell(i), (QX + N * CELL, CY), (BUS, CY), (BUS, w[1]), (w[0] - GS / 2 - 0.08, w[1]), hand(w, i)]

    def paint(c, st):
        on = st["on"]
        icon(c, "question", *QI, GS, "q" in on, "question")
        c.text(QI[0] - 0.7, CY + GS / 2 + 0.36, 1.4, 0.3, st["status"], 13, "Regular",
               INK if st["status"] == "ended" else INK3)
        c.arrow([(QI[0] + GS / 2 + 0.05, CY), (QX, CY)], "q" in on and "queue" in on)
        c.queue(QX, CY - CELL / 2, N, (), "", "queue" in on, CELL)
        c.text(QX, CY + CELL / 2 + 0.06, N * CELL, 0.3, "RabbitMQ", 14, "Medium",
               INK if "queue" in on else INK2, "left")
        c.text(QX, CY + CELL / 2 + 0.4, 3, 0.3, "hollow: taken, not acknowledged", 13, "Regular", INK3, "left")
        for i, s in enumerate(st["cells"]):
            if s:
                x, y = cell(i)
                c.job(x, y, KINDS[i], hollow=(s == "taken"), s=0.24)
        c.line([(QX + N * CELL, CY), (BUS, CY)], "a" in on or "b" in on)
        c.arrow([(BUS, CY), (BUS, A[1]), (A[0] - GS / 2 - 0.08, A[1])], "a" in on)
        if st["b"] != "none":
            c.arrow([(BUS, CY), (BUS, B[1]), (B[0] - GS / 2 - 0.08, B[1])], "b" in on)
        # worker A: it turns while it holds the jobs; deleted, it stops and gets a cross
        dead = st["a"] == "dead"
        gear(c, *A, GS, "worker A", busy=st["a"] == "busy", turn=st["turn"], faint=dead)
        if dead:
            c.cross(A[0] - GS / 2, A[1] - GS / 2, GS, GS)
        for i in range(3):
            if st["ajobs"][i]:
                c.job(*hand(A, i), KINDS[i], s=0.2)
        # Kubernetes starts worker B
        icon(c, "helm", HX, A[1], 0.56, "k8s" in on, "Kubernetes")
        if st["b"] != "none":
            gear(c, *B, GS, "worker B", busy=st["b"] == "busy", turn=st["turn"] + 0.4)
            for i in range(3):
                if st["bjobs"][i]:
                    c.job(*hand(B, i), KINDS[i], s=0.2)
            c.arrow([(hand(B, 2)[0] + 0.22, B[1]), (OUT_X - 0.26, B[1])], "out" in on)
        # the finished work: one paper with a check for each job
        for i in range(st["papers"]):
            carry(c, OUT_X + i * 0.55, B[1], "done", 0.36)
        if st["result"]:
            _invert_lines(c, 9.55, 2.6, ["the question ended", "in 12.6 s"])

    st = dict(on={"q"}, status="running", cells=[None] * 3, a="idle", ajobs=[0, 0, 0], b="none",
              bjobs=[0, 0, 0], papers=0, result=False)
    sc = Live("kill.gif", paint, st)
    sc.step("1. Worker A holds three jobs; they stay in the queue until A says done", 0.6)
    sc.set(on={"q", "queue"})
    for i in range(3):
        sc.hop(KINDS[i], [(QI[0] + GS / 2 + 0.05, CY), cell(i)], 0.5)
        sc.st["cells"][i] = "ready"
    sc.hold(0.5)
    sc.set(on={"queue", "a"}, cells=["taken"] * 3)
    sc.hop(KINDS[0], to(A, 0), 0.9, also=[(KINDS[i], to(A, i)) for i in (1, 2)])
    sc.set(on={"a"}, a="busy", ajobs=[1, 1, 1], busy={0})
    sc.hold(2.6)
    sc.step("2. We force-delete worker A", 0.3, on=set(), a="dead", busy=set())
    sc.hold(2.2)
    sc.step("3. Nobody said done, so the three jobs return to the queue", 0.4, on={"queue"}, ajobs=[0, 0, 0])
    sc.hop(KINDS[0], to(A, 0)[::-1], 0.9, also=[(KINDS[i], to(A, i)[::-1]) for i in (1, 2)])
    sc.set(cells=["ready"] * 3)
    sc.hold(2.4)
    sc.step("4. Kubernetes starts worker B, and B takes them", 0.6, on={"k8s"}, b="idle")
    sc.set(on={"queue", "b", "k8s"}, cells=["taken"] * 3)
    sc.hop(KINDS[0], to(B, 0), 0.9, also=[(KINDS[i], to(B, i)) for i in (1, 2)])
    sc.set(on={"b", "k8s"}, b="busy", bjobs=[1, 1, 1], busy={0})
    sc.hold(2.2)
    sc.step("5. B says done for each job, and each job leaves the queue", 0.4, on={"b", "out"})
    for i in (2, 1, 0):
        sc.st["bjobs"][i] = 0
        sc.st["cells"][i] = None
        sc.hop("done", [(hand(B, 2)[0] + 0.22, B[1]), (OUT_X + (2 - i) * 0.55, B[1])], 0.5)
        sc.st["papers"] += 1
        sc.hold(0.3)
    sc.set(on={"q"}, status="ended", b="idle", busy=set())
    sc.hold(2.2)
    sc.step("6. Worker B finishes the work, and the question ends", 3.4, result=True)
    sc.save()


# ============================================================ pipeline: every push, two real runs
def pipeline():
    CY = 2.7
    GS = 0.52
    POS = dict(push=(0.75, CY), verify=(2.55, 1.45), sca=(2.55, CY), sast=(2.55, 3.95),
               scan=(4.75, CY), deploy=(6.95, CY), dast=(9.15, 2.0), load=(9.15, 3.4))
    KIND = dict(push="branch", verify="test", sca="shield", sast="shield", scan="image", deploy="helm",
                dast="shield", load="gauge")
    TOOL = dict(push="push", verify="tests", sca="npm audit", sast="CodeQL", scan="Trivy", deploy="Helm",
                dast="OWASP ZAP", load="k6")
    KIND2 = dict(sca="SCA", sast="SAST", scan="image scan", deploy="k3s", dast="DAST", load="smoke")
    B1, B2, B3 = 1.65, 3.55, 8.15           # the three buses

    def l(k):
        return POS[k][0] - GS / 2 - 0.06, POS[k][1]

    def r(k):
        return POS[k][0] + GS / 2 + 0.06, POS[k][1]

    def to(k, bus, start):
        return [start, (bus, start[1]), (bus, l(k)[1]), l(k)]

    paths = dict(
        verify=to("verify", B1, r("push")), sca=to("sca", B1, r("push")), sast=to("sast", B1, r("push")),
        scan=[(B2, CY), l("scan")], deploy=[r("scan"), l("deploy")],
        dast=to("dast", B3, r("deploy")), load=to("load", B3, r("deploy")))

    def to_scan(k):
        return [r(k), (B2, POS[k][1]), (B2, CY), l("scan")]

    def stage(c, k, state, mark):
        x, y = POS[k]
        icon(c, KIND[k], x, y, GS, state in ("active", "pass", "fail", "lit"), TOOL[k], faint=state == "faint")
        if k in KIND2:
            c.text(x - 0.8, y + GS / 2 + 0.36, 1.6, 0.28, KIND2[k], 13, "Regular", INK3)
        if mark == "pass":
            c.check(x + GS / 2 + 0.06, y - GS / 2 - 0.12, 0.22)
        elif mark == "fail":
            _xmark(c, x + GS / 2 + 0.07, y - GS / 2 - 0.1, 0.2)

    def paint(c, st):
        s, m, lit = st["state"], st["mark"], st["lit"]
        for k in ("verify", "sca", "sast"):
            c.arrow(paths[k], k in lit)
            c.line(to_scan(k)[:3], "scan" in lit)
        c.arrow(paths["scan"], "scan" in lit)
        c.arrow(paths["deploy"], "deploy" in lit)
        for k in ("dast", "load"):
            c.arrow(paths[k], k in lit)
        stage(c, "push", "lit" if "push" in lit else "idle", None)
        for k in POS:
            if k != "push":
                stage(c, k, s[k], m.get(k))
        # Trivy looks through the image: a line that sweeps down over its icon
        if st["sweep"] is not None:
            x, y = POS["scan"]
            yy = y - GS / 2 + st["sweep"] * GS
            c.line([(x - GS / 2 - 0.06, yy), (x + GS / 2 + 0.06, yy)], pt=2, color=INK)
        # the image that Trivy stopped at its gate
        if st["parked"]:
            x, y = l("scan")
            px = x - 0.4
            carry(c, px, y, "image", 0.34)
            c.cross(px - 0.2, y - 0.2, 0.4, 0.4)
        if st["stopped"]:
            c.invert(POS["scan"][0] - 0.75, 3.75, "5 critical: deploy stopped", 16)
        if st["fix"]:
            x, y = POS["scan"][0], 4.15
            icon(c, "image", x, y, 0.46, True)
            c.text(x + 0.4, y - 0.3, 3, 0.3, "docker.io: removed", 13, "Medium", INK, "left")
            c.text(x + 0.4, y + 0.0, 3, 0.3, "perl-base: patched at build", 13, "Medium", INK, "left")
        if st["live"]:
            c.invert(POS["deploy"][0], 3.75, "live in 12.5 min", 16, align="center")

    def fresh():
        return dict(state={k: "idle" for k in POS if k != "push"}, mark={}, lit=set(), stopped=False,
                    fix=False, live=False, sweep=None, parked=False)

    sc = Live("pipeline.gif", paint, fresh())
    st = sc.st

    def run_through(keys, seconds=0.75):
        """The image goes into the stages in keys, at once, and each one passes."""
        st["lit"] |= set(keys)
        sc.hop("image", paths[keys[0]], seconds, also=[("image", paths[k]) for k in keys[1:]])
        for k in keys:
            st["state"][k] = "active"
        sc.hold(0.5)
        for k in keys:
            st["state"][k], st["mark"][k] = "pass", "pass"
        st["lit"] -= set(keys)

    def into_scan(stop):
        """The checked image goes to Trivy, which sweeps it. stop: Trivy finds critical issues."""
        st["lit"] |= {"scan"}
        end = (l("scan")[0] - 0.4, CY) if stop else l("scan")
        sc.hop("image", to_scan("verify")[:-1] + [end], 0.8,
               also=[("image", to_scan(k)[:-1] + [end]) for k in ("sca", "sast")])
        if stop:
            st["parked"] = True
        st["state"]["scan"] = "active"
        sc.tween(1.0, lambda u: st.update(sweep=u))
        st["sweep"] = None

    sc.step("1. Every push runs six checks around one deploy", 0.6, lit={"push"})
    run_through(["verify", "sca", "sast"])
    sc.hold(2.0)
    sc.step("2. Run 1: Trivy finds 5 critical issues, so the deploy stops", 0.2)
    into_scan(stop=True)
    st["lit"] = set()
    st["state"]["scan"], st["mark"]["scan"] = "fail", "fail"
    for k in ("deploy", "dast", "load"):
        st["state"][k] = "faint"
    sc.hold(0.4)
    sc.set(stopped=True)
    sc.hold(2.8)
    sc.step("3. The fix: a platform image without Docker, patched at build", 3.0, **dict(fresh(), fix=True))
    sc.step("4. Run 2: every check passes, and the deploy goes live", 0.4, fix=False, lit={"push"})
    run_through(["verify", "sca", "sast"], 0.7)
    into_scan(stop=False)
    st["state"]["scan"], st["mark"]["scan"] = "pass", "pass"
    st["lit"] = {"deploy"}
    sc.hop("image", paths["deploy"], 0.6)
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
