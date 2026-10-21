"""The DevOps pictures of the redesigned deck, in standard notation: a git branch diagram,
the pipeline as a flowchart, the technical findings as problem and solution, and the
autoscaling run as a time chart. Every name and number comes from docs/platform/report/
report.md (sections 2.1, 5.1 to 5.3 and 6.1) or from docs/platform/evidence/.
"""
import os

import draw
from draw import BLACK, INK, INK2, INK3, RAISED, RULE, RULE2, Canvas, Scene, lerp
from scenes_proof import _dashed, _invert_lines, _scaling, _tw
from scenes_std import comp, node, tag


# ---------------------------------------------------------------- shared drawing
def _dot(c, x, y, color=INK2, r=0.075):
    """A commit on a branch line."""
    c.d.ellipse([c._p(x - r), c._p(y - r), c._p(x + r), c._p(y + r)], fill=color)


def _terminal(c, x, y, w, h, name, note="", lit=False, faint=False):
    """A flowchart start or end: a box with round ends."""
    edge = INK if lit else (RULE2 if faint else RULE)
    c.d.rounded_rectangle([c._p(x), c._p(y), c._p(x + w), c._p(y + h)], radius=c._p(min(h / 2, 0.22)),
                          fill=RAISED if lit else BLACK, outline=edge, width=c._lw(2 if lit else 1.5))
    ink = INK3 if faint else INK
    if note:
        c.text(x + 0.16, y + 0.1, w - 0.3, 0.3, name, 15, "Semibold", ink, "left")
        c.text(x + 0.16, y + 0.42, w - 0.3, h - 0.52, note, 13, "Regular", INK3 if faint else INK2, "left")
    else:
        c.text(x, y, w, h, name, 14, "Semibold", ink)


def _diamond(c, cx, cy, w, h, name, lit=False):
    """A flowchart decision."""
    edge = INK if lit else RULE
    pts = [(cx, cy - h / 2), (cx + w / 2, cy), (cx, cy + h / 2), (cx - w / 2, cy)]
    c.d.polygon([(c._p(x), c._p(y)) for x, y in pts], fill=RAISED if lit else BLACK, outline=edge,
                width=c._lw(2 if lit else 1.5))
    c.text(cx - w / 2, cy - h / 2, w, h, name, 14, "Semibold", INK)


# ---------------------------------------------------------------- shared motion
def _length(pts):
    return sum(((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5 for a, b in zip(pts, pts[1:]))


def _part(pts, u):
    """The first fraction u of a polyline, so a line can grow."""
    if u >= 1:
        return list(pts)
    left = u * _length(pts)
    out = [pts[0]]
    for a, b in zip(pts, pts[1:]):
        seg = ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5
        if left <= seg:
            f = 0 if seg == 0 else left / seg
            out.append((lerp(a[0], b[0], f), lerp(a[1], b[1], f)))
            return out
        out.append(b)
        left -= seg
    return out


# ---------------------------------------------------------------- 5a: source and artifacts
def branches():
    X0 = 2.75                                   # where the branch lines start
    MAIN, PLAT = 1.25, 2.0                      # the two long-lived branches
    END = 7.55                                  # where ass/platform hands over to the pipeline
    # Each member's branch, from the WBS (report 2.1) and the branch list (report 5.1).
    MEMBERS = [("Liu Ziyang", "ass/session"), ("Lu Yi", "ass/identity"), ("Peng Xujian", "ass/project"),
               ("Li Zhuoyang", "ass/worker"), ("He Rong", "ass/deploy")]
    LANES = [2.6 + k * 0.53 for k in range(5)]
    MX = 5.0                                    # where main merges into ass/platform
    AX, AW = 8.25, 3.65                         # the artifact column
    IMG, NODE, LIVE = (1.6, 0.8), (3.05, 0.72), (4.26, 0.58)
    AL = AX + 0.45                              # the artifact column's connectors

    def lane(k):
        # The member branches nest: the lowest starts first and merges last, so no line crosses.
        start, end = 2.95 + (4 - k) * 0.36, 5.5 + k * 0.42
        y = LANES[k]
        return [(start, PLAT), (start, y), (end, y), (end, PLAT + 0.09)]

    P = dict(main=[(X0, MAIN), (END, MAIN)], plat=[(X0, MAIN), (X0, PLAT), (END, PLAT)],
             merge=[(MX, MAIN), (MX, PLAT - 0.09)], push=[(END, PLAT), (AX, PLAT)],
             ssh=[(AL, IMG[0] + IMG[1]), (AL, NODE[0])], helm=[(AL, NODE[0] + NODE[1]), (AL, LIVE[0])])

    def paint(c, st):
        on = st["on"]
        g = st["grow"]
        if g.get("main"):
            c.text(0.2, MAIN - 0.17, 2.4, 0.34, "main: Lumen", 15, "Semibold", INK2, "left")
            c.line(_part(P["main"], g["main"]), pt=2, color=INK if "main" in on else INK2)
            for x in (X0, 3.7, MX, 6.4):
                if X0 + g["main"] * (END - X0) >= x - 1e-6:
                    _dot(c, x, MAIN)
        if g.get("plat"):
            c.text(0.2, PLAT - 0.17, 2.4, 0.34, "ass/platform", 15, "Semibold", INK, "left")
            c.line(_part(P["plat"], g["plat"]), pt=2.5, color=INK)
            _dot(c, X0, PLAT, INK)
            if g["plat"] >= 1:
                _dot(c, END - 0.12, PLAT, INK)
        if g.get("merge"):
            pts = _part(P["merge"], g["merge"])
            if g["merge"] >= 1:
                c.arrow(pts, color=INK if "merge" in on else INK2)
                c.text(MX + 0.1, (MAIN + PLAT) / 2 - 0.14, 1.0, 0.28, "merge main", 13, "Regular", INK2, "left")
            else:
                c.line(pts, color=INK)
        for k, (who, br) in enumerate(MEMBERS):
            u = g.get(k, 0)
            if not u:
                continue
            lit = k in on
            col = INK if lit else INK2
            y = LANES[k]
            c.text(0.2, y - 0.17, 1.35, 0.34, who, 15, "Semibold", INK, "left")
            c.text(1.62, y - 0.15, 1.2, 0.3, br, 13, "Regular", INK2, "left")
            pts = lane(k)
            if u >= 1:
                c.line(pts[:3], color=col, active=lit)
                c.arrow(pts[2:], color=col)
                c.text(pts[2][0] + 0.07, y - 0.42, 0.4, 0.26, "PR", 13, "Regular", col, "left")
            else:
                c.line(_part(pts, u), color=col, active=lit)
            # the commits appear as the tag passes them
            total = _length(pts)
            start, end = pts[0][0], pts[2][0]
            for x in (start + 0.3, lerp(start + 0.3, end, 0.55)):
                if u * total >= (y - PLAT) + (x - start):
                    _dot(c, x, y, col)
        if st["art"]:
            c.arrow(P["push"], color=INK if "push" in on else INK2)
            c.text(END - 0.05, PLAT - 0.4, AX - END + 0.1, 0.28, "push", 13, "Regular", INK2)
            comp(c, AX, IMG[0], AW, IMG[1], "lumen-next:<commit sha>", "image, built from deploy/k8s/Dockerfile",
                 lit="image" in on, mark=False)
            c.arrow(P["ssh"], color=INK if "ssh" in on else INK2)
            c.text(AL + 0.13, IMG[0] + IMG[1] + 0.1, 3, 0.28, "copy over SSH (scp)", 13, "Regular", INK2, "left")
            node(c, AX, NODE[0], AW - 0.14, NODE[1], "EC2 host", "AWS", lit="node" in on)
            c.text(AX + 1.45, NODE[0] + 0.33, 2.0, 0.3, "k3s ctr images import", 13, "Regular", INK2, "left")
            c.arrow(P["helm"], color=INK if "helm" in on else INK2)
            c.text(AL + 0.13, NODE[0] + NODE[1] + 0.08, 3, 0.28, "helm upgrade --install --wait", 13, "Regular",
                   INK2, "left")
            comp(c, AX, LIVE[0], AW, LIVE[1], "Lumen platform, live", "", lit="live" in on, mark=False)
        for x, y, word in st["tags"]:
            tag(c, x, y, word)

    st = dict(on=set(), grow={}, art=False, tags=[])
    sc = Scene("branches.gif", paint, st)

    def grow(key, seconds, word=None, lit=()):
        pts = lane(key) if isinstance(key, int) else P[key]
        sc.set(on=set(lit))

        def f(u):
            st["grow"][key] = max(u, 1e-3)
            st["tags"] = [(*draw.along(pts, u), word)] if word else []
        sc.tween(seconds, f)
        sc.set(tags=[])

    def move(key, word, seconds=0.9):
        sc.tween(seconds, lambda u: st.update(tags=[(*draw.along(P[key], u), word)]))
        sc.set(tags=[])

    # Build: the two long-lived branches, then each member's branch in turn.
    sc.step("main holds Lumen", 0.3)
    grow("main", 1.0, lit={"main"})
    sc.hold(0.9)
    sc.title = "ass/platform starts from main: the integration branch"
    grow("plat", 1.0)
    sc.hold(1.0)
    for k, (who, br) in enumerate(MEMBERS):
        sc.title = "%s works on %s and merges it through a PR" % (who, br)
        grow(k, 1.3, "commit", lit={k})
        sc.hold(0.6)
    sc.title = "A change to Lumen goes to main first, then merges in"
    sc.set(on={"merge"})
    move("merge", "merge", 0.7)
    grow("merge", 0.01, lit={"merge"})
    sc.hold(1.0)
    sc.step("Every push to ass/platform builds one image and deploys it", 1.8, on=set(), art=True)
    # Flow: one push becomes one image, and the image goes live.
    sc.title = "1. A push builds lumen-next:<commit sha>"
    sc.set(on={"push"})
    move("push", "push", 0.7)
    sc.set(on={"image"})
    sc.hold(1.2)
    sc.title = "2. The image goes over SSH to the EC2 host and into k3s"
    sc.set(on={"ssh"})
    move("ssh", "lumen-next:<commit sha>", 1.0)
    sc.set(on={"node"})
    sc.hold(1.2)
    sc.title = "3. helm upgrade --install --wait puts it live"
    sc.set(on={"helm"})
    move("helm", "lumen-next:<commit sha>", 0.8)
    sc.set(on={"live"})
    sc.hold(1.4)
    sc.step("Five member branches into ass/platform; one image per commit", 3.6, on=set())
    sc.save()


# ---------------------------------------------------------------- 5b: the CI/CD pipeline
def cicd():
    TRIG = (0.2, 2.15, 1.45, 1.6)
    PAR = [("verify", "lint, types, tests", "5 min 05 s"), ("SCA", "npm audit", "33 s"),
           ("SAST", "CodeQL", "2 min 54 s")]
    PX, PW, PH, PY = 2.0, 1.55, 1.0, [1.2, 2.45, 3.7]
    FR = (3.9, 1.05, 3.6, 3.82)                # the deploy job's frame
    SX, SW, SH = 4.05, 2.75, 0.45                # its steps
    STEPS = [("build", "build image", "2 min 50 s", 1.52), ("copy", "copy and import", "1 min 04 s", 2.97),
             ("helm", "helm upgrade --wait", "22 s", 3.6), ("health", "health check", "", 4.23)]
    GATE = (SX + SW / 2, 2.45, 2.0, 0.62)       # the Trivy gate: centre, width, height
    STOP = (6.75, 2.27, 0.6, 0.36)
    AFT = [("dast", "DAST", "OWASP ZAP", "1 min 40 s", 1.5), ("smoke", "Smoke load", "k6", "1 min 15 s", 2.95)]
    AX, AW, AH = 7.85, 1.6, 1.05
    SUM = (9.8, 2.47, 1.5, 0.6)
    RES = (9.75, 3.55)

    def mid(y, h):
        return y + h / 2

    TY = mid(TRIG[1], TRIG[3])
    BUS1, BUS2, BUS3, BUS4 = 1.82, 3.72, 7.68, 9.63
    DY = 2.95                                   # where the deploy frame's in and out connectors meet it
    gx, gy, gw, gh = GATE
    P = dict(
        push=[(TRIG[0] + TRIG[2], TY), (BUS1, TY)],
        image=[(gx, STEPS[0][3] + SH / 2), (gx, gy)],
        fail=[(gx, gy), (STOP[0] + STOP[2] / 2, gy)],
        ship=[(gx, gy), (gx, STEPS[3][3] + SH / 2)],
    )

    def paint(c, st):
        on, ok, bad, faint = st["on"], st["ok"], st["bad"], st["faint"]
        dur = st["dur"]
        # trigger
        _terminal(c, *TRIG, "trigger", "push to\nass/platform,\nor a manual\nrun", lit="trig" in on)
        # the three jobs in parallel, and the fork and join around them
        c.line([(TRIG[0] + TRIG[2], TY), (BUS1, TY)], color=INK2)
        c.line([(BUS1, mid(PY[0], PH)), (BUS1, mid(PY[2], PH))], color=INK2)
        c.line([(BUS2, mid(PY[0], PH)), (BUS2, mid(PY[2], PH))], color=INK2)
        for (key, note, d), y in zip(PAR, PY):
            k = key.lower()
            c.arrow([(BUS1, mid(y, PH)), (PX, mid(y, PH))], color=INK2)
            c.line([(PX + PW, mid(y, PH)), (BUS2, mid(y, PH))], color=INK2)
            comp(c, PX, y, PW, PH, key, note + ("\n" + d if dur else ""), lit=k in on, mark=False)
            if k in ok:
                c.check(PX + PW - 0.36, y + 0.12, 0.22)
        c.arrow([(BUS2, DY), (FR[0], DY)], color=INK2)
        # the deploy job: a frame with its steps as a vertical flowchart
        fx, fy, fw, fh = FR
        c.d.rectangle([c._p(fx), c._p(fy), c._p(fx + fw), c._p(fy + fh)], outline=INK if "deploy" in on else RULE,
                      width=c._lw(1.5))
        c.text(fx + 0.15, fy + 0.07, 2, 0.3, "deploy", 15, "Semibold", INK, "left")
        if dur:
            c.text(fx + 1.0, fy + 0.08, 1.5, 0.3, "5 min 30 s", 13, "Regular", INK2, "left")
        if "deploy" in ok:
            c.check(fx + fw - 0.38, fy + 0.1, 0.22)
        for key, name, d, y in STEPS:
            lit = key in on
            fa = "deploy" in faint and key != "build"
            edge = INK if lit else (RULE2 if fa else RULE)
            c.d.rectangle([c._p(SX), c._p(y), c._p(SX + SW), c._p(y + SH)], fill=RAISED if lit else BLACK,
                          outline=edge, width=c._lw(2 if lit else 1.5))
            c.text(SX + 0.14, y, SW, SH, name, 14, "Semibold", INK3 if fa else INK, "left")
            if dur and d:
                c.text(SX, y, SW - 0.14, SH, d, 13, "Regular", INK2, "right")
            if key in ok and not (dur and d):
                c.check(SX + SW - 0.36, y + 0.1, 0.22)
        # the connectors between the steps
        c.arrow([(gx, STEPS[0][3] + SH), (gx, gy - gh / 2)], color=INK2)
        c.arrow([(gx, gy + gh / 2), (gx, STEPS[1][3])], color=INK2)
        c.text(gx + 0.1, gy + gh / 2 - 0.02, 0.6, 0.24, "pass", 13, "Regular", INK2, "left")
        c.arrow([(gx, STEPS[1][3] + SH), (gx, STEPS[2][3])], color=INK2)
        c.arrow([(gx, STEPS[2][3] + SH), (gx, STEPS[3][3])], color=INK2)
        _diamond(c, *GATE, "Trivy gate", lit="gate" in on)
        if dur:
            c.text(SX - 0.08, gy - 0.15, 0.6, 0.3, "25 s", 13, "Regular", INK2, "left")
        c.arrow([(gx + gw / 2, gy), (STOP[0], gy)], color=INK if "stop" in on else INK2)
        c.text(gx + gw / 2 + 0.02, gy - 0.34, 0.6, 0.26, "fail", 13, "Regular", INK2, "left")
        _terminal(c, *STOP, "stop", lit="stop" in on)
        # after the deploy: two jobs in parallel against the live address, then the summary
        c.line([(fx + fw, DY), (BUS3, DY)], color=INK2)
        c.line([(BUS3, mid(AFT[0][4], AH)), (BUS3, mid(AFT[1][4], AH))], color=INK2)
        c.line([(BUS4, mid(AFT[0][4], AH)), (BUS4, mid(AFT[1][4], AH))], color=INK2)
        for key, name, note, d, y in AFT:
            fa = key in faint
            c.arrow([(BUS3, mid(y, AH)), (AX, mid(y, AH))], color=RULE2 if fa else INK2)
            c.line([(AX + AW, mid(y, AH)), (BUS4, mid(y, AH))], color=RULE2 if fa else INK2)
            comp(c, AX, y, AW, AH, name, note + ("\n" + d if dur else ""), lit=key in on, faint=fa, mark=False)
            if key in ok:
                c.check(AX + AW - 0.36, y + AH - 0.36, 0.22)
            if fa:
                c.text(AX, y + AH + 0.04, AW, 0.28, "skipped", 13, "Regular", INK3)
        c.arrow([(BUS4, DY), (SUM[0], DY)], color=INK2)
        _terminal(c, *SUM, "summary" + ("  4 s" if dur else ""), lit="sum" in on)
        if st["result"]:
            _invert_lines(c, *RES, st["result"])
        for x, y, word in st["tags"]:
            tag(c, x, y, word)

    st = dict(on=set(), ok=set(), bad=set(), faint=set(), dur=False, result=None, tags=[])
    sc = Scene("pipeline.gif", paint, st)

    def move(pts, word, seconds=0.8):
        sc.tween(seconds, lambda u: st.update(tags=[(*draw.along(pts, u), word)]))

    sc.step("The pipeline: .github/workflows/platform-deploy.yml", 3.0)
    # The first run: the gate stops the image.
    sc.step("Run 39439752963 starts on a push to ass/platform", 0.4, on={"trig"})
    move(P["push"], "push", 0.6)
    sc.set(tags=[], on={"verify", "sca", "sast"})
    sc.title = "Verify, SCA and SAST run in parallel, and all pass"
    sc.hold(1.2)
    sc.set(ok={"verify", "sca", "sast"})
    sc.hold(1.2)
    sc.title = "The deploy job builds the image and scans it"
    sc.set(on={"deploy", "build"})
    move(P["image"], "image", 0.9)
    sc.set(on={"deploy", "gate"})
    sc.hold(1.0)
    sc.title = "5 critical CVEs: the gate stops the deploy"
    move(P["fail"], "image", 0.8)
    sc.set(on={"stop"}, tags=[], faint={"deploy", "dast", "smoke"}, result=["5 critical CVEs:", "deploy stopped"])
    sc.hold(1.4)
    sc.title = "The pipeline works: a vulnerable image never reaches the host"
    sc.hold(3.0)
    sc.step("The fix: a smaller platform image, no Docker inside (2b5e460)", 2.8, tags=[], result=None)
    # The second run: every stage passes; the real durations show.
    sc.step("Run 39441445313: the fixed image", 0.4, on={"trig"}, ok=set(), faint=set(), dur=False)
    move(P["push"], "push", 0.6)
    sc.set(tags=[], on={"verify", "sca", "sast"}, dur=True)
    sc.hold(0.8)
    sc.set(ok={"verify", "sca", "sast"})
    sc.title = "The image passes the gate and goes to the host"
    sc.set(on={"deploy", "build"})
    move(P["image"], "image", 0.7)
    sc.set(on={"deploy", "gate"})
    sc.hold(0.4)
    seg = P["ship"]
    sc.set(on={"deploy", "copy", "helm", "health"})
    move(seg, "image", 1.4)
    sc.set(tags=[], ok=st["ok"] | {"deploy", "health"}, on={"dast", "smoke"})
    sc.title = "DAST and a smoke load run against the live address"
    sc.hold(1.4)
    sc.set(ok=st["ok"] | {"dast", "smoke"}, on={"sum"})
    sc.hold(0.6)
    sc.step("Every stage passed: live in 12 min 30 s", 3.6, on=set(), result=["live in", "12 min 30 s"])
    sc.save()


# ---------------------------------------------------------------- 5c: technical findings
def findings():
    CW, GAP = 3.75, 0.27
    XS = [0.18 + i * (CW + GAP) for i in range(3)]
    HY = 1.0                                    # the column heads
    PY, SY = 1.45, 3.32                         # the top of the problem and the solution diagrams
    PW, SW = 2.3, 4.26                         # the top of their words
    HEADS = [("Per-depth queues", "found in design"), ("Trivy gate", "run 39439752963"),
             ("KEDA scale-down", "load test")]
    WORDS = [("Parents wait for children that wait\nin the same queue: a deadlock.",
              "One queue per level of the task tree\n(AD-03)."),
             ("5 critical CVEs, most in the docker.io\npackage. The gate stopped the deploy.",
              "deploy/k8s/Dockerfile: smaller, patched\nat build (2b5e460). The next run passed."),
             ("KEDA's HPA waits 300 s by default\nbefore it removes a worker.",
              "The chart sets 60 s, so the workers\ngo back to 1 a minute after the load.")]
    DEPTHS = [SY - 0.03 + i * 0.3 for i in range(3)]   # the three queues, top edges
    DH = 0.27

    # the connectors the tags travel along
    x0, x1, x2 = XS
    PM, SM = PY + 0.36, SY + 0.36               # the middle line of each diagram
    P = dict(
        parent=[(x0 + 1.45, PM), (x0 + 1.85 + 0.6, PM)],
        d0=[(x0 + 1.45, DEPTHS[0] + DH / 2), (x0 + 1.65, DEPTHS[0] + DH / 2), (x0 + 1.65, SM),
            (x0 + 1.85 + 0.6, SM)],
        d1=[(x0 + 1.45, DEPTHS[1] + DH / 2), (x0 + 1.65, DEPTHS[1] + DH / 2), (x0 + 1.65, SM),
            (x0 + 1.85 + 0.6, SM)],
        d2=[(x0 + 1.45, DEPTHS[2] + DH / 2), (x0 + 1.65, DEPTHS[2] + DH / 2), (x0 + 1.65, SM),
            (x0 + 1.85 + 0.6, SM)],
        bad=[(x1 + 1.3, PM), (x1 + 2.6, PM)],
        good=[(x1 + 1.3, SM), (x1 + 2.6, SM), (x1 + 3.2, SM)],
    )

    def paint(c, st):
        on, seen = st["on"], st["seen"]

        def words(i, row):
            text = WORDS[i][row]
            c.text(XS[i], PW if row == 0 else SW, CW, 0.54, text, 13, "Regular", INK2 if row == 0 else INK, "left")

        for i, (h, sub) in enumerate(HEADS):
            if ("p", i) not in seen:
                continue
            x = XS[i]
            c.text(x, HY, CW, 0.34, h, 16, "Semibold", INK, "left")
            c.text(x + _tw(h, 16, "Semibold") + 0.2, HY + 0.03, CW, 0.3, sub, 13, "Regular", INK3, "left")
            if ("pw", i) in seen:
                words(i, 0)
            if ("s", i) in seen:
                c.arrow([(x + 0.3, 2.9), (x + 0.3, 3.18)], color=INK2)
                c.text(x + 0.45, 2.9, 1.5, 0.28, "solution", 13, "Medium", INK3, "left")
            if ("sw", i) in seen:
                words(i, 1)

        # 1. one queue for all turns can deadlock; one queue per depth cannot
        if ("p", 0) in seen:
            x = x0
            comp(c, x, PY, 1.45, 0.72, "one queue", st["q_note"], lit="queue" in on, mark=False)
            c.arrow([(x + 1.45, PM), (x + 1.85, PM)], color=INK2)
            comp(c, x + 1.85, PY, 1.9, 0.72, "worker slots", st["slot_note"], lit="slots" in on, mark=False)
        if ("s", 0) in seen:
            x = x0
            for i, d in enumerate(("depth 0", "depth 1", "depth 2")):
                y = DEPTHS[i]
                lit = ("d%d" % i) in on
                c.d.rectangle([c._p(x), c._p(y), c._p(x + 1.45), c._p(y + DH)], fill=RAISED if lit else BLACK,
                              outline=INK if lit else INK2, width=c._lw(1.5))
                c.text(x, y, 1.45, DH, d, 13, "Medium", INK)
                c.line([(x + 1.45, y + DH / 2), (x + 1.65, y + DH / 2)], color=INK2)
            c.line([(x + 1.65, DEPTHS[0] + DH / 2), (x + 1.65, DEPTHS[2] + DH / 2)], color=INK2)
            c.arrow([(x + 1.65, SM), (x + 1.85, SM)], color=INK2)
            comp(c, x + 1.85, SY, 1.9, 0.72, "worker slots", st["slot2_note"], lit="slots2" in on, mark=False)

        # 2. the Lumen image carried Docker; the platform image has none
        for row, (y, name, note, ok) in enumerate(((PM, "Lumen image", "with Docker", False),
                                                    (SM, "platform image", "no Docker", True))):
            if ((("p", 1) if row == 0 else ("s", 1))) not in seen:
                continue
            x = x1
            key = "img%d" % row
            comp(c, x, y - 0.36, 1.85, 0.72, name, note, lit=key in on, mark=False)
            c.arrow([(x + 1.85, y), (x + 2.1, y)], color=INK2)
            _diamond(c, x + 2.6, y, 1.0, 0.62, "gate", lit=("gate%d" % row) in on)
            c.arrow([(x + 3.1, y), (x + 3.35, y)], color=INK2)
            if ("end", row) in seen:
                if ok:
                    c.check(x + 3.43, y - 0.12, 0.24)
                else:
                    c.cross(x + 3.43, y - 0.12, 0.24, 0.24)

        # 3. the HPA's scale-down window, to scale: 300 s by default, 60 s in the chart
        for row, (y, secs, lit) in enumerate(((PY + 0.4, 300, False), (SY + 0.4, 60, True))):
            if ((("p", 2) if row == 0 else ("s", 2))) not in seen:
                continue
            x = x2
            u = st["fill"][row]
            L = 2.45 * secs / 300
            c.text(x, y - 0.38, 1.6, 0.28, "load ends", 13, "Regular", INK2, "left")
            c.line([(x + 0.05, y - 0.08), (x + 0.05, y + 0.36)], color=INK2)
            c.d.rectangle([c._p(x + 0.05), c._p(y), c._p(x + 0.05 + L), c._p(y + 0.28)], outline=RULE,
                          width=c._lw(1))
            if u > 0:
                c.bar(x + 0.05, y, L * u, 0.28, INK if lit else INK3)
            if u >= 1:
                c.text(x + 0.05, y, L, 0.28, "%d s" % secs, 13, "Semibold", BLACK)
                c.text(x + L + 0.17, y - 0.01, 1.2, 0.3, "scale-down", 13, "Regular", INK2, "left")

        for x, y, word in st["tags"]:
            tag(c, x, y, word)

    st = dict(on=set(), seen=set(), tags=[], fill=[0.0, 0.0], q_note="all turns", slot_note="",
              slot2_note="", )
    sc = Scene("findings.gif", paint, st)

    def move(key, word, seconds=0.7):
        sc.tween(seconds, lambda u: st.update(tags=[(*draw.along(P[key], u), word)]))
        sc.set(tags=[])

    def show(*keys):
        sc.set(seen=st["seen"] | set(keys))

    # 1. per-depth queues
    sc.step("1. One queue for all turns: parents fill every worker slot", 0.6, seen={("p", 0)}, on={"queue"})
    for n in range(2):
        move("parent", "parent", 0.6)
        sc.set(on={"slots"}, slot_note="held by a parent")
        sc.hold(0.3)
    sc.set(slot_note="all held by parents", q_note="children wait", on={"queue", "slots"})
    sc.hold(0.6)
    sc.title = "1. Their children wait in the same queue: a deadlock"
    show(("pw", 0))
    sc.hold(2.0)
    sc.step("1. One queue per depth: children always run", 0.4, on={"d1", "d2"})
    show(("s", 0))
    sc.hold(0.4)
    move("d1", "child", 0.6)
    sc.set(on={"d2", "slots2"}, slot2_note="children always run")
    move("d2", "child", 0.6)
    sc.set(on={"slots2"})
    show(("sw", 0))
    sc.hold(1.8)
    # 2. the Trivy gate
    sc.step("2. The Lumen image carries Docker: the gate stops it", 0.4, on={"img0"})
    show(("p", 1))
    move("bad", "image", 0.8)
    sc.set(on={"gate0"})
    show(("end", 0), ("pw", 1))
    sc.hold(2.2)
    sc.step("2. A smaller platform image without Docker passes", 0.4, on={"img1"})
    show(("s", 1))
    move("good", "image", 1.0)
    sc.set(on={"gate1"})
    show(("end", 1), ("sw", 1))
    sc.hold(2.0)
    # 3. the KEDA scale-down window
    sc.step("3. By default, KEDA waits 300 s before it removes a worker", 0.4, on=set())
    show(("p", 2))
    sc.tween(2.4, lambda u: st["fill"].__setitem__(0, u))
    show(("pw", 2))
    sc.hold(1.8)
    sc.step("3. The chart sets 60 s: back to 1 worker a minute after the load", 0.4)
    show(("s", 2))
    sc.tween(1.0, lambda u: st["fill"].__setitem__(1, u))
    show(("sw", 2))
    sc.hold(2.0)
    sc.step("Three technical findings and how the team fixed them", 3.6, on=set())
    sc.save()


# ---------------------------------------------------------------- 6b: scalability
def scaling():
    data = [d for d in _scaling() if d[0] <= 215]
    T1 = 220
    X0, X1 = 1.05, 8.4                          # the plot, left and right
    YB, YT, JMAX = 4.25, 1.55, 30               # the plot's baseline, top, top value
    BW = 0.28                                   # a bar's width
    RX, RW, RH = 9.15, 2.55, 0.36               # the worker pods, right of the chart
    RY = [1.45 + k * 0.45 for k in range(4)]

    def tx(t):
        return X0 + t / T1 * (X1 - X0)

    def jy(n):
        return YB - n / JMAX * (YB - YT)

    def paint(c, st):
        t = st["t"]
        seen = [d for d in data if d[0] <= t + 1e-6]
        # the legend, one line under the title band
        c.bar(X0, 1.08, 0.16, 0.16, INK2)
        c.text(X0 + 0.26, 1.01, 3, 0.3, "jobs waiting (three queues)", 13, "Medium", INK2, "left")
        lx = X0 + 0.26 + _tw("jobs waiting (three queues)", 13, "Medium") + 0.45
        _dashed(c, [(lx, 1.16), (lx + 0.42, 1.16)], INK)
        c.text(lx + 0.55, 1.01, 3, 0.3, "target: 5 jobs per worker", 13, "Medium", INK2, "left")
        for n in (0, 10, 20, 30):
            y = jy(n)
            if n:
                c.line([(X0, y), (X1, y)], pt=1, color=RULE2)
            c.text(0.3, y - 0.15, 0.6, 0.3, str(n), 13, "Regular", INK3, "right")
        c.line([(X0, YB), (X1, YB)], pt=1.5, color=RULE)
        c.line([(tx(t), YT - 0.1), (tx(t), YB)], pt=2, color=INK)
        for ts, w, j in seen:
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
        for s in (0, 60, 120, 180):
            c.line([(tx(s), YB), (tx(s), YB + 0.08)], pt=1, color=RULE)
            c.text(tx(s) - 0.5, YB + 0.1, 1.0, 0.3, "%d s" % s, 13, "Regular", INK3)
        # the worker pods: one box for each pod that runs now
        w_now = seen[-1][1] if seen else 1
        c.text(RX, 1.05, RW, 0.3, "worker pods (KEDA)", 13, "Medium", INK2, "left")
        for k in range(4):
            if k < w_now:
                new = st["added"].get(k, -99) > t - 9
                comp(c, RX, RY[k], RW, RH, "worker %d" % (k + 1), lit=new, mark=False, size=14)
            else:
                c.d.rectangle([c._p(RX), c._p(RY[k]), c._p(RX + RW), c._p(RY[k] + RH)], outline=RULE2,
                              width=c._lw(1))
        if st["result"]:
            _invert_lines(c, RX, 3.42, ["135 questions", "median 6.1 s", "0 of 1,040 failed"])

    # when KEDA added each worker, from the samples: the first sample with more workers
    added, prev = {}, 1
    for ts, w, j in data:
        for k in range(prev, w):
            added[k] = ts
        prev = w
    sc = Scene("scaling.gif", paint, dict(t=0.0, result=False, added=added))

    def sweep(t_end, rate=26.0):
        t_start = sc.st["t"]
        n = max(1, round((t_end - t_start) / rate * 25))
        for i in range(1, n + 1):
            sc.st["t"] = lerp(t_start, t_end, i / n)
            sc._add(sc._draw(), 40)

    sc.step("1. Ten users ask questions without pause", 2.0)
    sweep(30)
    sc.hold(2.0)
    sc.step("2. One worker falls behind; the queue grows", 0.3)
    sweep(41)
    sc.hold(2.2)
    sc.step("3. Above 5 jobs per worker, KEDA adds one: 1 to 4 in 49 s", 0.3)
    sweep(79, 14)
    sc.hold(2.6)
    sc.step("4. With 4 workers, the queue stops growing", 0.3)
    sweep(115)
    sc.hold(2.2)
    sc.step("5. The load stops, the queue empties, and a minute later: 1 worker", 0.3)
    sweep(215, 32)
    sc.hold(2.2)
    sc.step("6. Every question finished, and no request failed", 3.6, result=True)
    sc.save()


SCENES = dict(branches=branches, cicd=cicd, findings=findings, scaling=scaling)
