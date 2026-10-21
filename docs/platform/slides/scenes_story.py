"""Five scenes that tell the story: the problem, the question tree, the platform roles, the
bounded contexts and the API key. Each scene paints its whole picture from its state every
frame (README.md, "The look", has the rules; scenes_core.py sets the pattern).

Every number on these pictures comes from docs/platform/evidence/ or the public API contract:
the tree is one demo-mode run on 20 October ("How many primes are below 100?": a lead and three
readers, USD 0.03, 3 findings, under the USD 1 cap); the literature watch app is about 210 lines; a key may make 20 requests at once and 60
a minute.
"""
from draw import (BLACK, INK, INK2, INK3, RULE, RULE2, RAISED, S, X2, FPS, Scene, along, ease, font,
                  lerp, mix)

BRIGHT, DIM = 1.0, 0.42                         # an agent at work, and an agent at rest


# ============================================================ small helpers this module needs
def width(text, size, weight="Medium", mono=False):
    """The width of a line of words, in inches."""
    return font(size, weight, mono).getlength(text) / (S * X2)


def faded_box(c, x, y, w, h, a, fill=None, outline=RULE):
    """A box drawn at strength a (0 = gone, 1 = full): the colours mix toward the black page."""
    box = [c._p(x), c._p(y), c._p(x + w), c._p(y + h)]
    c.d.rectangle(box, fill=mix(BLACK, fill, a) if fill else None, outline=mix(BLACK, outline, a),
                  width=c._lw(1.5))


def glide(sc, seconds, fn):
    """Like Scene.tween, but in plain time (no easing): for a stream of jobs."""
    n = max(1, round(seconds * FPS))
    for i in range(n + 1):
        fn(i / n)
        sc._add(sc._draw(), round(1000 / FPS))
    sc.moving = []


# ============================================================ 1. the problem: one chat, then Lumen
def problem():
    CX, CW = 0.3, 4.4                           # the chat column
    BOTTOM, WL, P, RH = 4.68, 1.24, 0.34, 0.28  # chat bottom, the window line, row pitch, row height
    ROWS = []
    for k in range(1, 6):
        ROWS.append(("you", "part %d of 5 of my question" % k))
        ROWS.append(("ai", "answer to part %d" % k))
    ROWS += [("you", "a follow-up on part 1"), ("ai", "an answer without part 1")]
    LEAD, LR = (7.05, 2.95), 0.55
    READERS, RR = [(8.85, 1.8), (8.85, 2.95), (8.85, 4.1)], 0.3
    MX = 9.75                                   # the cost counter and the bill

    def paint(c, st):
        lumen = st["lumen"]
        # the chat: rows push up from the bottom; above the window line they fade out
        k = st["k"]
        for i in range(int(k + 0.999)):
            who, words = ROWS[i]
            top = BOTTOM - (k - i) * P
            a = max(0.0, min(1.0, (top - (WL - 0.75 * P)) / (0.75 * P)))  # gone a row above the line
            if i > k - 1:
                a = min(a, k - i)                                   # the newest row fades in
            if a <= 0:
                continue
            if lumen:
                a *= 0.45
            you = who == "you"
            x, w = (CX + 0.9, CW - 0.9) if you else (CX, CW - 0.9)
            faded_box(c, x, top, w, RH, a, fill=RAISED if you else None, outline=RULE if you else RULE2)
            c.text(x + 0.14, top, w - 0.28, RH, words, 14, "Regular", mix(BLACK, INK if you else INK2, a),
                   "left")
        # the window line: the model reads only the rows below it
        c.line([(CX - 0.02, WL), (CX + CW + 0.02, WL)], color=INK2 if not lumen else RULE)
        c.text(CX + CW + 0.15, WL - 0.16, 3.6, 0.32, "the model reads only below this line", 14, "Medium", INK2 if not lumen else INK3, "left")
        # the cost counter: "?" until the bill drops in; live in Lumen
        if lumen:
            c.number(MX, 1.05, 2.08, st["cost"], "cost in Lumen", 32)
        else:
            c.number(MX, 1.05, 2.08, "?", "cost of this chat", 36)
        if st["bill"] is not None:
            by = st["bill"]
            c.invert(MX, by, "bill: after the work", 15, h=0.5)
        if lumen:
            # the same question, given to a lead and three readers
            for (rx, ry) in READERS:
                c.line([(LEAD[0] + LR, LEAD[1]), (8.05, LEAD[1]), (8.05, ry), (rx - RR - 0.06, ry)],
                       st["readers"] == BRIGHT)
            c.arrow([(CX + CW + 0.05, LEAD[1]), (LEAD[0] - LR - 0.08, LEAD[1])], st["sent"])
            c.sphere(*LEAD, LR, st["lead"])
            c.text(LEAD[0] - 1, LEAD[1] + LR + 0.08, 2, 0.32, "lead", 14, "Medium", INK2)
            for (rx, ry) in READERS:
                c.sphere(rx, ry, RR, st["readers"])
            c.text(READERS[0][0] - 0.8, READERS[0][1] - RR - 0.38, 1.6, 0.32, "readers", 14, "Medium", INK2)

    st = dict(k=0.0, bill=None, lumen=False, cost="$0.00", lead=DIM, readers=DIM, sent=False)
    sc = Scene("problem.gif", paint, st)

    def push(n, seconds=0.45, pause=0.2):
        for _ in range(n):
            k0 = st["k"]
            sc.tween(seconds, lambda u: st.update(k=k0 + u))
            sc.hold(pause)

    sc.step("1. Today: five parts of a question take five rounds", 0.5)
    push(10, 0.4, 0.12)
    sc.hold(2.2)
    sc.step("2. A long chat drops its first messages without warning", 0.3)
    push(2, 0.7, 0.5)
    sc.hold(2.4)
    sc.step("3. Nobody sees the cost until the bill", 0.6)
    sc.tween(0.7, lambda u: st.update(bill=lerp(0.6, 2.25, u)))
    sc.hold(2.6)
    sc.step("4. Lumen: a lead splits it, readers work at once, cost shown live", 0.3,
            bill=None, lumen=True)
    sc.hop("lead", [(CX + CW + 0.05, LEAD[1]), (LEAD[0] - LR - 0.08, LEAD[1])], 0.7)
    sc.set(lead=BRIGHT, sent=True)
    sc.hold(0.5)
    sc.hop("reader", [(LEAD[0] + LR, LEAD[1]), (8.05, LEAD[1]), (8.05, READERS[0][1]), (READERS[0][0] - RR, READERS[0][1])],
           0.7, also=[("reader", [(LEAD[0] + LR, LEAD[1]), (8.05, LEAD[1]), (READERS[1][0] - RR, READERS[1][1])]),
                      ("reader", [(LEAD[0] + LR, LEAD[1]), (8.05, LEAD[1]), (8.05, READERS[2][1]),
                                  (READERS[2][0] - RR, READERS[2][1])])])
    sc.set(readers=BRIGHT, lead=DIM)
    for cents in (0.5, 1, 1.5, 2, 2.5, 3):
        sc.set(cost="$%.2f" % (cents / 100 + 1e-9))
        sc.hold(0.35)
    sc.set(readers=DIM, lead=BRIGHT)
    sc.hold(2.6)
    sc.save()


# ============================================================ 2. one real question becomes a tree
def tree():
    Q = (0.3, 2.3, 2.3, 1.2)
    LEAD, LR = (3.65, 2.9), 0.55
    RX, RR = 6.0, 0.3
    RY = [1.7, 2.9, 4.1]
    BUS = 4.9                                   # where the lead's connector splits to the readers
    SX = 6.62                                   # the first recorded step beside a reader
    FX, FW = 7.95, 1.3                          # the findings
    A = (9.6, 2.45, 2.23, 1.0)                  # the answer
    FAN = 9.42                                  # where the findings join on the way to the answer

    def reader_path(i):
        return [(LEAD[0] + LR, LEAD[1]), (BUS, LEAD[1]), (BUS, RY[i]), (RX - RR - 0.04, RY[i])]

    def paint(c, st):
        # the question, with its real text
        c.text(Q[0], Q[1] - 0.4, Q[2], 0.32, "question", 14, "Medium", INK2, "left")
        c.box(*Q, "", "active" if st["q"] else "idle")
        c.text(Q[0] + 0.16, Q[1], Q[2] - 0.2, Q[3], "How many primes\nare below 100?", 15, "Medium",
               INK if st["q"] else INK2, "left")
        c.arrow([(Q[0] + Q[2], LEAD[1]), (LEAD[0] - LR - 0.08, LEAD[1])], st["q"])
        # the lead and its connectors to the readers
        for i in range(3):
            c.arrow(reader_path(i), st["sent"])
        c.sphere(*LEAD, LR, st["lead"])
        c.text(LEAD[0] - 1, LEAD[1] + LR + 0.06, 2, 0.32, st["lead_label"], 14, "Medium",
               INK if st["lead"] == BRIGHT else INK2)
        for j in range(st["lead_steps"]):
            c.job(LEAD[0] - 0.16 + j * 0.32, LEAD[1] + LR + 0.6, "step", color=INK2)
        # the column heads
        c.text(RX - 0.6, 1.02, 1.2, 0.3, "readers", 14, "Medium", INK2)
        c.text(SX - 0.12, 1.02, 0.88, 0.3, "steps", 14, "Medium", INK2)
        c.text(FX, 1.02, FW, 0.3, "findings", 14, "Medium", INK2, "left")
        for i, y in enumerate(RY):
            c.sphere(RX, y, RR, st["readers"][i])
            for j in range(st["steps"][i]):
                c.job(SX + j * 0.32, y, "step", color=INK if st["readers"][i] == BRIGHT else INK2)
            if st["found"] > i:
                c.box(FX, y - 0.25, FW, 0.5, "finding %d" % (i + 1), "idle", size=14)
                c.line([(FX + FW, y), (FAN, y), (FAN, A[1] + A[3] / 2)], st["answer"])
        if st["found"]:
            c.arrow([(FAN, A[1] + A[3] / 2), (A[0], A[1] + A[3] / 2)], st["answer"])
        # the cost counter, against the cap
        c.number(A[0], 1.0, A[2], st["cost"], "cost so far", 32)
        c.text(A[0], 1.88, A[2], 0.3, "of a $1.00 cap", 14, "Medium", INK2, "left")
        # the answer
        c.text(A[0], A[1] + A[3] + 0.08, A[2], 0.3, "answer", 14, "Medium", INK2, "left")
        if st["answer"]:
            c.bar(A[0], A[1], A[2], A[3], INK)
            c.text(A[0] + 0.16, A[1], A[2] - 0.2, A[3], "answered,\nwith 3 findings", 15,
                   "Semibold", BLACK, "left")
        else:
            c.box(*A, "", "idle")

    st = dict(q=True, lead=DIM, lead_label="lead", lead_steps=0, sent=False, readers=[DIM] * 3,
              steps=[0, 0, 0], found=0, answer=False, cost="$0.00")
    sc = Scene("tree.gif", paint, st)

    sc.step("1. You ask a question", 0.8)
    sc.hop("lead", [(Q[0] + Q[2], LEAD[1]), (LEAD[0] - LR, LEAD[1])], 0.7)
    sc.set(lead=BRIGHT)
    sc.hold(2.2)
    sc.step("2. A lead agent plans the work", 0.6, q=False)
    sc.set(lead_steps=1, cost="$0.01")
    sc.hold(2.4)
    sc.step("3. Three readers work in parallel", 0.4, sent=True)
    sc.hop("reader", reader_path(0), 0.75, also=[("reader", reader_path(1)), ("reader", reader_path(2))])
    sc.set(readers=[BRIGHT] * 3, lead=DIM, lead_label="lead: waiting")
    sc.hold(2.4)
    sc.step("4. Every step is recorded with its cost: $0.02 of a $1.00 cap", 0.4)
    for j in range(1, 4):
        sc.set(steps=[j] * 3)
        if j == 2:
            sc.set(cost="$0.02")
        sc.hold(0.55)
    sc.hold(1.8)
    sc.step("5. Three findings and one answer come back: $0.03 total", 0.3,
            readers=[DIM] * 3, found=3, cost="$0.03")
    sc.hold(0.6)
    sc.set(lead=BRIGHT, lead_label="lead", answer=True)
    sc.hold(3.0)
    sc.save()


# ============================================================ 3. producers, the platform, consumers
def platform():
    AUTH = (0.3, 1.6, 2.4, 0.75)
    WELL = (4.3, 1.35, 3.6, 2.7)
    REG = (4.55, 1.55, 3.1, 0.95)
    ENG = (4.55, 2.85, 3.1, 0.95)
    WEB = (8.9, 1.6, 2.93, 0.75)
    APP = (8.9, 2.95, 2.93, 0.75)
    YR, YE = REG[1] + REG[3] / 2, ENG[1] + ENG[3] / 2
    GATE = (8.17, YE - 0.27, 0.2, 0.54)
    GX = GATE[0] + GATE[2] / 2

    def paint(c, st):
        on = st["on"]
        c.text(AUTH[0], 1.02, 2.4, 0.3, "producers", 14, "Medium", INK2, "left")
        c.text(WEB[0], 1.02, 2.4, 0.3, "consumers", 14, "Medium", INK2, "left")
        c.box(*AUTH, "agent author", "active" if "author" in on else "idle", 15)
        # the platform: the registry and the run engine
        c.box(*WELL, state="well")
        c.text(WELL[0] + 0.25, 1.02, 3.0, 0.3, "platform", 14, "Medium", INK2, "left")
        reg_on = "registry" in on
        c.box(*REG, "", "active" if reg_on else "idle")
        c.text(REG[0], REG[1] + 0.08, REG[2], 0.4, "agent registry", 15, "Medium", INK if reg_on else INK2)
        if st["entry"]:
            hot = "entry" in on
            c.text(REG[0], REG[1] + 0.48, REG[2], 0.36, "literature-scout", 14, "Regular",
                   INK if hot else INK2, mono=True)
            if hot:
                ew = width("literature-scout", 14, mono=True)
                x0 = REG[0] + (REG[2] - ew) / 2
                c.line([(x0, REG[1] + 0.86), (x0 + ew, REG[1] + 0.86)], color=INK)
        eng_on = "engine" in on
        c.box(*ENG, "", "active" if eng_on else "idle")
        c.text(ENG[0], ENG[1] + 0.08, ENG[2], 0.4, "run engine", 15, "Medium", INK if eng_on else INK2)
        for j in range(st["steps"]):
            c.job(ENG[0] + 0.85 + j * 0.34, ENG[1] + 0.68, "step", color=INK if eng_on else INK2)
        if st["cost"]:
            c.text(ENG[0] + 1.95, ENG[1] + 0.52, 1.0, 0.32, st["cost"], 14, "Medium", INK if eng_on else INK2,
                   "left")
        # the two arrows: the producer publishes into it, the consumers ask it
        c.arrow([(AUTH[0] + AUTH[2], YR), (REG[0], YR)], "author" in on)
        c.arrow([(WEB[0], YR), (REG[0] + REG[2], YR)])
        c.arrow([(APP[0], YE), (ENG[0] + ENG[2], YE)], "app" in on)
        # the API key: a gate on the consumer's arrow
        gate_on = "gate" in on
        c.d.rectangle([c._p(GATE[0]), c._p(GATE[1]), c._p(GATE[0] + GATE[2]), c._p(GATE[1] + GATE[3])],
                      fill=RAISED if gate_on else BLACK, outline=INK if gate_on else INK2,
                      width=c._lw(2 if gate_on else 1.5))
        c.text(GX - 0.7, GATE[1] - 0.36, 1.4, 0.3, "API key", 14, "Medium", INK if gate_on else INK2)
        c.box(*WEB, "web app", "idle", 15)
        app_on = "app" in on
        c.box(*APP, "", "active" if app_on else "idle")
        c.text(APP[0] + 0.22, APP[1], APP[2], APP[3], "literature watch app", 15, "Medium",
               INK if app_on else INK2, "left")
        if st["answered"]:
            c.check(APP[0] + APP[2] - 0.42, APP[1] + 0.24, 0.26)
        if st["lines"]:
            text = "literature watch app: about 210 lines"
            w = width(text, 16, "Semibold") + 0.32
            c.invert(APP[0] + APP[2] - w, 3.98, text, 16)
            c.text(APP[0] + APP[2] - 4, 4.5, 4, 0.3, "no database · no model · no billing", 14, "Medium", INK2,
                   "right")

    st = dict(on=set(), entry=False, steps=0, cost="", answered=False, lines=False)
    sc = Scene("platform.gif", paint, st)

    sc.step("1. A producer publishes an agent: instructions for one kind of question", 0.5, on={"author"})
    sc.hop("lead", [(AUTH[0] + AUTH[2], YR), (REG[0] + 0.3, YR)], 0.75)
    sc.set(on={"registry"}, entry=True)
    sc.hold(2.4)
    sc.step("2. A consumer app gets an API key and picks an agent", 0.5, on={"app"})
    sc.hop("lead", [(APP[0], YE), (GX + 0.3, YE)], 0.6)
    sc.set(on={"app", "gate", "entry"})
    sc.hold(2.4)
    sc.step("3. The platform runs it, records each step and bills it", 0.3, on={"gate"})
    sc.hop("lead", [(GX, YE), (ENG[0] + ENG[2], YE)], 0.5)
    sc.set(on={"engine"})
    for j in range(1, 4):
        sc.set(steps=j)
        sc.hold(0.4)
    sc.set(cost="USD 0.01")
    sc.hold(0.8)
    sc.hop("lead", [(ENG[0] + ENG[2], YE), (APP[0], YE)], 0.75)
    sc.set(on={"app"}, answered=True)
    sc.hold(2.4)
    sc.step("4. The app only asks; the platform does the rest", 0.3, on=set(), lines=True)
    sc.hold(2.8)
    sc.save()


# ============================================================ 4. the bounded contexts and their events
def contexts():
    BOX = dict(projects=(0.3, 1.3, 2.35, 1.3), session=(4.75, 1.3, 2.6, 1.3), execution=(9.48, 1.3, 2.35, 1.3),
               identity=(0.3, 3.3, 2.35, 1.35), billing=(4.75, 3.3, 2.6, 1.35))
    NAME = dict(projects="Projects", session="Session", execution="Execution", identity="Identity",
                billing="Billing")
    AGG = dict(projects=["Project", "Agent registry"], session=["Session", "Task tree"],
               execution=["worker turns"], identity=["Account", "ApiKey"],
               billing=["Wallet", "Ledger", "Approval"])
    UP, LOW = 1.75, 2.17                        # the two arrows in each gap of the middle row
    L1, L2 = 2.65, 4.75                         # the gap between Projects and Session
    R1, R2 = 7.35, 9.48                         # the gap between Session and Execution
    DX, UX = 5.45, 6.65                         # the two arrows between Session and Billing
    V1, V2 = 2.6, 3.3
    # each event: its arrow, and where its name sits
    EV = [
        ("asked", "question asked", "projects", "session", [(L1, UP), (L2, UP)], (L1, UP - 0.36, L2 - L1, "center")),
        ("queued", "turn queued", "session", "execution", [(R1, UP), (R2, UP)], (R1, UP - 0.36, R2 - R1, "center")),
        ("step", "step recorded", "execution", "session", [(R2, LOW), (R1, LOW)], (R1, LOW + 0.06, R2 - R1, "center")),
        ("spend", "spend recorded", "session", "billing", [(DX, V1), (DX, V2)], (DX - 2.5, 2.8, 2.38, "right")),
        ("cap", "over cap: approval needed", "billing", "session", [(UX, V2), (UX, V1)],
         (UX + 0.14, 2.8, 2.8, "left")),
        ("finding", "finding recorded", "session", "projects", [(L2, LOW), (L1, LOW)],
         (L1, LOW + 0.06, L2 - L1, "center")),
    ]

    def paint(c, st):
        on, seen, now = st["on"], st["seen"], st["now"]
        for key, (x, y, w, h) in BOX.items():
            hot = key in on
            c.box(x, y, w, h, "", "active" if hot else "idle")
            c.text(x, y + 0.1, w, 0.4, NAME[key], 16, "Medium", INK if hot else INK2)
            for j, a in enumerate(AGG[key]):
                c.text(x, y + 0.52 + j * 0.27, w, 0.27, a, 13, "Regular", INK2 if hot else INK3)
        for key, name, a, b, pts, (lx, ly, lw, align) in EV:
            if key not in seen and key != now:
                c.arrow(pts, color=RULE2)
                continue
            active = key == now
            c.arrow(pts, active)
            if active or key in seen:
                c.text(lx, ly, lw, 0.3, name, 14, "Medium", INK if active else INK3, align)
        if st["legend"]:
            lx = 7.95
            for j, line in enumerate(("box = bounded context", "grey = aggregates", "arrow = domain event")):
                c.text(lx, 3.45 + j * 0.36, 3.88, 0.32, line, 14, "Medium", INK2, "left")

    st = dict(on=set(), seen=set(), now=None, legend=False)
    sc = Scene("contexts.gif", paint, st)
    titles = dict(asked="2. A question is asked in Projects; Session takes it",
                  queued="3. Session queues a turn for Execution",
                  step="4. Execution sends back each step it records",
                  spend="5. Session reports the spend to Billing",
                  cap="6. If a step would pass the cap, Billing asks for approval",
                  finding="7. The finding goes back to the project")

    sc.step("1. The platform splits into five bounded contexts", 2.8)
    for key, name, a, b, pts, _ in EV:
        sc.step(titles[key], 0.4, on={a}, now=None)
        sc.set(now=key)
        sc.hop("lead", pts, 0.75)
        sc.set(on={b}, seen=st["seen"] | {key})
        sc.hold(2.2)
    sc.step("8. One question: six events across five contexts", 3.0, on=set(), now=None, legend=True)
    sc.save()


# ============================================================ 5. an API key: scopes, the gateway, the rate
def keys():
    K = (0.3, 1.2, 2.75, 2.3)
    G = (3.9, 1.2, 1.4, 2.3)
    BUS = 5.88
    AX, AW, AH = 6.45, 3.0, 0.7
    ACT = [("publish an agent", "POST /api/v1/agents", 1.2), ("list agents", "GET /api/v1/agents", 2.0),
           ("a web app page", "GET /api/projects", 2.8)]
    RX = 9.7                                    # the results
    YK = K[1] + K[3] / 2
    BX, BY, BW, BH, N = 3.9, 4.02, 5.55, 0.34, 20  # the bar of requests at once

    def path(i):
        y = ACT[i][2] + AH / 2
        return [(K[0] + K[2], YK), (G[0] + G[2], YK), (BUS, YK), (BUS, y), (AX, y)]

    def paint(c, st):
        on = st["on"]
        # the key and its scopes
        kon = "key" in on
        c.box(*K, "", "active" if kon else "idle")
        c.text(K[0] + 0.18, K[1] + 0.1, K[2], 0.34, "API key", 16, "Medium", INK if kon else INK2, "left")
        c.text(K[0] + 0.18, K[1] + 0.44, K[2], 0.28, "lmn_…", 13, "Regular", INK3, "left", mono=True)
        for j, s in enumerate(("agents:read", "agents:write", "questions:read", "questions:write", "usage:read")):
            c.text(K[0] + 0.18, K[1] + 0.8 + j * 0.27, K[2], 0.27, s, 13, "Regular", INK2 if kon else INK3,
                   "left", mono=True)
        c.arrow([(K[0] + K[2], YK), (G[0], YK)], "gate" in on)
        # the gateway, where every request is checked
        gon = "gate" in on
        c.box(*G, "gateway", "active" if gon else "idle", 15)
        for i, (label, route, y) in enumerate(ACT):
            hot = "a%d" % i in on
            c.arrow([(G[0] + G[2], YK), (BUS, YK), (BUS, y + AH / 2), (AX, y + AH / 2)], hot)
            c.box(AX, y, AW, AH, "", "active" if hot else "idle")
            c.text(AX, y + 0.07, AW, 0.32, label, 15, "Medium", INK if hot else INK2)
            c.text(AX, y + 0.37, AW, 0.26, route, 13, "Regular", INK2 if hot else INK3, mono=True)
            r = st["res"][i]
            if r:
                c.text(RX, y, 1.0, AH, r, 16, "Semibold", INK, "left")
                mx = RX + width(r, 16, "Semibold") + 0.14
                if r.startswith("4"):
                    c.cross(mx, y + 0.24, 0.22, 0.22)
                else:
                    c.check(mx, y + 0.22, 0.26)
        # requests at once: a bar of 20 cells
        c.text(K[0], BY - 0.36, 3.0, 0.3, "requests at once (max 20)", 14, "Medium", INK2, "left")
        c.text(K[0] + K[2] - 1.2, BY - 0.12, 1.2, 0.58, str(st["n"]), 28, "Semibold",
               INK if st["n"] else INK3, "right")
        cell = BW / N
        c.d.rectangle([c._p(BX), c._p(BY), c._p(BX + BW), c._p(BY + BH)], outline=INK if st["n"] else RULE,
                      width=c._lw(2 if st["n"] else 1.5))
        for j in range(1, N):
            xx = c._p(BX + j * cell)
            c.d.line([(xx, c._p(BY)), (xx, c._p(BY + BH))], fill=RULE2, width=c._lw(1))
        for j in range(st["n"]):
            c.bar(BX + j * cell + 0.035, BY + 0.05, cell - 0.07, BH - 0.1, INK)
        if st["slow"]:
            c.invert(RX, BY - 0.08, "429 slow down", 16)

    st = dict(on=set(), res=[None, None, None], n=0, slow=False)
    sc = Scene("keys.gif", paint, st)

    sc.step("1. A key carries scopes: what an app may do", 2.6, on={"key"})
    sc.step("2. Inside its scopes, the key works: 201, 200", 0.3, on={"key", "gate"})
    for i, code in ((0, "201"), (1, "200")):
        sc.hop("lead", path(i), 0.9)
        sc.set(on={"gate", "a%d" % i}, res=[code if j == i else st["res"][j] for j in range(3)])
        sc.hold(0.7)
    sc.hold(1.8)
    sc.step("3. On the web app's own pages, the gateway refuses it: 403", 0.3, on={"key", "gate"})
    sc.hop("lead", [(K[0] + K[2], YK), (G[0] + G[2] / 2, YK)], 0.6)
    sc.set(on={"gate"}, res=[st["res"][0], st["res"][1], "403 refused"])
    sc.hold(2.6)
    sc.step("4. Past 20 at once or 60 a minute: 429", 0.3, on={"key", "gate"})
    lane = [(K[0] + K[2], YK), (G[0] + G[2] / 2, YK)]
    spacing, travel = 0.09, 0.45                # a new request every 90 ms

    def stream(t):
        now = t * (N * spacing + travel)
        jobs = []
        for j in range(N + 1):
            u = (now - j * spacing) / travel
            if 0 <= u < 1:
                jobs.append((*along(lane, u), "lead"))
        st["n"] = max(0, min(N, int((now - travel) / spacing) + 1)) if now >= travel else 0
        sc.moving = jobs
    glide(sc, N * spacing + travel, stream)
    st["n"] = N
    sc.hold(0.3)
    sc.hop("lead", lane, 0.5)
    sc.set(slow=True)
    sc.hold(2.8)
    sc.save()


SCENES = dict(problem=problem, tree=tree, platform=platform, contexts=contexts, keys=keys)
