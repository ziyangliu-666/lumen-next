"""Five scenes that tell the story: the problem, the question tree, the platform roles, the
bounded contexts and the API key. Each scene paints its whole picture from its state every
frame (README.md, "The look", has the rules; scenes_core.py sets the pattern).

Every number on these pictures comes from docs/platform/evidence/ or the public API contract:
the tree is one recorded run on 20 October ("How many primes are below 100?": a lead and three
readers, USD 0.03, 3 findings, under the USD 1 cap); the literature watch app is about 210 lines; a key may make 20 requests at once and 60
a minute.
"""
from draw import (BLACK, INK, INK2, INK3, RULE, RULE2, RAISED, S, X2, FPS, Scene, along, ease, font,
                  lerp, mix)
from icons import icon

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


def fly(sc, seconds, items, each=None):
    """Business objects move along their connectors. An item is (kind, pts, size) or
    (kind, pts, size, t0, t1): it travels in the part t0..t1 of the time, for staggered starts.
    each() runs once a frame, so a gear can turn while the work moves."""
    st = sc.st
    n = max(1, round(seconds * FPS))
    for i in range(n + 1):
        t = i / n
        objs = []
        for it in items:
            kind, pts, s = it[:3]
            t0, t1 = it[3:5] if len(it) > 3 else (0.0, 1.0)
            if t0 <= t <= t1 + 1e-9:
                objs.append((kind, *along(pts, ease((t - t0) / (t1 - t0))), s))
        st["fly"] = objs
        if each:
            each()
        sc._add(sc._draw(), round(1000 / FPS))
    st["fly"] = []


def busy(sc, seconds, each):
    """Frames where nothing moves but a worker turns its gear: 12.5 a second keeps the GIF small."""
    for _ in range(max(1, round(seconds * 12.5))):
        each()
        sc._add(sc._draw(), 80)


def draw_flying(c, st):
    """The moving objects, drawn last and lit. A turn in a queue keeps its square; a recorded step
    keeps its bar; everything else is the icon of its business object."""
    for kind, x, y, s in st.get("fly", ()):
        if kind in ("lead", "reader", "step"):
            c.job(x, y, kind)
        else:
            icon(c, kind, x, y, s, lit=True)


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
    PER = (0.9, 2.9)                            # you
    LEAD, LR = (3.9, 2.9), 0.55
    BUS, RX, RR = 5.6, 7.0, 0.3                 # the lead's connector splits at BUS to the readers
    RY = [1.9, 2.9, 3.9]
    CB, RAIL = 8.1, 1.35                        # the readers' coin line, and the rail to the wallet
    WAL = (10.2, 2.85)                          # the wallet: the cost counter
    REST = (1.78, LEAD[1])                      # where the question waits, and the answer lands
    QL = [(PER[0] + 0.45, LEAD[1]), (LEAD[0] - LR - 0.06, LEAD[1])]
    PAPERS = [(LEAD[0] - 0.42 + k * 0.42, 4.25) for k in range(3)]  # the findings, back at the lead

    def out_path(i):
        return [(LEAD[0] + LR + 0.04, LEAD[1]), (BUS, LEAD[1]), (BUS, RY[i]), (RX - RR - 0.04, RY[i])]

    LEAD_COIN = [(LEAD[0], LEAD[1] - LR - 0.04), (LEAD[0], RAIL), (WAL[0], RAIL), (WAL[0], WAL[1] - 0.44)]

    def coin_path(i):
        return [(RX + RR + 0.04, RY[i]), (CB, RY[i]), (CB, RAIL), (WAL[0], RAIL), (WAL[0], WAL[1] - 0.44)]

    def paint(c, st):
        q = st["q"]
        # you, the question, and the line to the lead
        c.line(QL, q)
        c.text(QL[0][0] + 0.05, 1.95, 2.2, 0.62, "How many primes\nare below 100?", 14, "Medium",
               INK if q else INK2, "left")
        icon(c, "person", *PER, 0.75, lit=q, label="you")
        # the lead, its readers, and the coin lines to the wallet
        for i in range(3):
            c.line(out_path(i), st["sent"])
            c.line(coin_path(i)[:3], st["paying"] == "readers")
        c.line(LEAD_COIN[:2], st["paying"] == "lead")
        c.arrow(LEAD_COIN[1:], bool(st["paying"]))
        c.sphere(*LEAD, LR, st["lead"])
        c.text(LEAD[0] - 1, LEAD[1] + LR + 0.06, 2, 0.32, st["lead_label"], 14, "Medium",
               INK if st["lead"] == BRIGHT else INK2)
        for i, y in enumerate(RY):
            c.sphere(RX, y, RR, st["readers"][i])
        c.text(RX - 0.8, RY[2] + RR + 0.06, 1.6, 0.3, "readers", 14, "Medium", INK2)
        for k in range(st["found"]):
            icon(c, "paper", *PAPERS[k], 0.38, lit=st["answer"] is None)
        # the wallet counts the cost against the cap
        icon(c, "wallet", *WAL, 0.8, lit=bool(st["paying"]))
        c.text(WAL[0] - 1.3, WAL[1] + 0.48, 2.6, 0.55, st["cost"], 32, "Semibold", INK)
        c.text(WAL[0] - 1.3, WAL[1] + 1.03, 2.6, 0.3, "of a $1.00 cap", 14, "Medium", INK2)
        # the question waits by you; the answer lands in the same place
        if st["ask"]:
            icon(c, "question", *REST, 0.42, lit=True)
        if st["answer"] == "here":
            icon(c, "paper", *REST, 0.5, lit=True)
            c.invert(0.35, 3.8, "answer, with 3 findings", 15, h=0.45)
        draw_flying(c, st)

    st = dict(q=True, ask=True, lead=DIM, lead_label="lead", sent=False, readers=[DIM] * 3, found=0,
              answer=None, cost="$0.00", paying=None, fly=[])
    sc = Scene("tree.gif", paint, st)

    sc.step("1. You ask a question", 1.0)
    sc.set(ask=False)
    fly(sc, 0.8, [("question", [REST, QL[1]], 0.42)])
    sc.set(lead=BRIGHT)
    sc.hold(2.2)
    sc.step("2. A lead agent plans the work", 0.6, q=False, paying="lead")
    fly(sc, 1.0, [("coin", LEAD_COIN, 0.32)])
    sc.set(paying=None, cost="$0.01")
    sc.hold(2.4)
    sc.step("3. Three readers work in parallel", 0.4, sent=True)
    fly(sc, 0.75, [("paper", out_path(i), 0.3) for i in range(3)])
    sc.set(readers=[BRIGHT] * 3, lead=DIM, lead_label="lead: waiting")
    sc.hold(2.4)
    sc.step("4. Every step is recorded with its cost: $0.02 of a $1.00 cap", 0.4)
    for j in range(1, 4):
        sc.set(paying="readers")
        fly(sc, 1.1, [("coin", coin_path(i), 0.32, i * 0.12, i * 0.12 + 0.76) for i in range(3)])
        sc.set(paying=None)
        if j == 2:
            sc.set(cost="$0.02")
        sc.hold(0.35)
    sc.hold(1.6)
    sc.step("5. Three findings and one answer come back: $0.03 total", 0.3)
    fly(sc, 0.8, [("paper", out_path(i)[::-1], 0.38) for i in range(3)])
    sc.set(readers=[DIM] * 3, found=3, cost="$0.03", lead=BRIGHT, lead_label="lead", sent=False)
    sc.hold(0.8)
    sc.set(answer="moving", q=True)
    fly(sc, 0.8, [("paper", [QL[1], REST], 0.5)])
    sc.set(answer="here", lead=DIM)
    sc.hold(3.0)
    sc.save()


# ============================================================ 3. producers, the platform, consumers
def platform():
    ROW1, ROW2 = 1.95, 3.45                     # publish on the top row, ask on the bottom row
    AUTH = (1.3, ROW1)
    FR = (3.3, 1.18, 5.0, 3.66)                 # the platform's frame
    REG, GEAR = (5.9, ROW1), (5.9, ROW2)
    STEPS, WAL = (4.3, 2.98), (4.3, 4.12)
    WEB, APP = (10.6, ROW1), (10.6, ROW2)
    KEY = (FR[0] + FR[2] - 0.6, ROW2)           # the API key sits just inside, where the app enters
    S2, BX = 0.6, 5.0                           # icon size; where the engine's records split
    TO_REG = [(AUTH[0] + 0.45, ROW1), (REG[0] - 0.36, ROW1)]
    TO_KEY = [(APP[0] - 0.42, ROW2), (KEY[0] + 0.3, ROW2)]
    TO_GEAR = [(KEY[0] - 0.3, ROW2), (GEAR[0] + 0.36, ROW2)]
    PICK = [(REG[0], 2.62), (REG[0], ROW2 - 0.36)]
    TO_STEPS = [(GEAR[0] - 0.36, ROW2), (BX, ROW2), (BX, STEPS[1]), (STEPS[0] + 0.34, STEPS[1])]
    TO_WAL = [(GEAR[0] - 0.36, ROW2), (BX, ROW2), (BX, WAL[1]), (WAL[0] + 0.34, WAL[1])]
    BACK = [(GEAR[0] + 0.36, ROW2), (APP[0] - 0.42, ROW2)]

    def paint(c, st):
        on = st["on"]
        c.text(AUTH[0] - 1.0, 1.02, 2.0, 0.3, "producers", 14, "Medium", INK2)
        c.text(WEB[0] - 1.0, 1.02, 2.0, 0.3, "consumers", 14, "Medium", INK2)
        c.d.rectangle([c._p(FR[0]), c._p(FR[1]), c._p(FR[0] + FR[2]), c._p(FR[1] + FR[3])], outline=RULE2,
                      width=c._lw(1.5))
        c.text(FR[0] + 0.14, FR[1] + 0.06, 1.6, 0.3, "platform", 14, "Medium", INK2, "left")
        # the connectors
        c.arrow(TO_REG, "author" in on)
        c.arrow([(WEB[0] - 0.42, ROW1), (REG[0] + 0.36, ROW1)])
        c.arrow([TO_KEY[0], TO_GEAR[1]], "ask" in on)
        c.arrow(PICK, "pick" in on)
        # The two record lines share their first part: draw the quiet one first, so the lit one stays whole.
        for pts, key in sorted([(TO_STEPS, "steps"), (TO_WAL, "bill")], key=lambda a: a[1] in on):
            c.arrow(pts, key in on)
        # the parts
        icon(c, "person", *AUTH, 0.7, lit="author" in on, label="agent author")
        icon(c, "registry", *REG, S2, lit="registry" in on, label="agent registry")
        if st["entry"]:
            hot = "entry" in on
            c.text(REG[0] - 1.2, 1.3, 2.4, 0.3, "literature-scout", 14, "Regular", INK if hot else INK2,
                   mono=True)
        icon(c, "gear", *GEAR, S2, lit="engine" in on, label="run engine", turn=st["turn"])
        icon(c, "stream", *STEPS, 0.55, lit="steps" in on, label="steps")
        icon(c, "wallet", *WAL, 0.55, lit="bill" in on, label=st["cost"] or "billing")
        icon(c, "key", *KEY, 0.5, lit="key" in on, label="API key")
        icon(c, "browser", *WEB, S2, label="web app")
        icon(c, "app", *APP, S2, lit="app" in on, label="literature watch")
        if st["answered"]:
            c.check(APP[0] + 0.42, ROW2 - 0.42, 0.26)
        if st["lines"]:
            c.invert(APP[0], 4.1, "about 210 lines", 16, h=0.44, align="center")
            c.text(APP[0] + 1.25 - 4, 4.58, 4, 0.3, "no database · no model · no billing", 14, "Medium", INK2,
                   "right")
        draw_flying(c, st)

    st = dict(on=set(), entry=False, cost="", answered=False, lines=False, turn=0.0, fly=[])
    sc = Scene("platform.gif", paint, st)

    def turning():
        st["turn"] += 0.04

    sc.step("1. A producer publishes an agent: instructions for one kind of question", 0.6, on={"author"})
    fly(sc, 0.8, [("paper", TO_REG, 0.34)])
    sc.set(on={"registry"}, entry=True)
    sc.hold(2.4)
    sc.step("2. A consumer app gets an API key and picks an agent", 0.5, on={"app", "ask"})
    fly(sc, 0.6, [("question", TO_KEY, 0.34)])
    sc.set(on={"key", "entry", "ask"})
    sc.hold(2.4)
    sc.step("3. The platform runs it, records each step and bills it", 0.3, on={"key", "ask", "pick", "entry"})
    fly(sc, 0.6, [("question", TO_GEAR, 0.34), ("paper", PICK, 0.34)])
    sc.set(on={"engine", "steps"})
    for _ in range(3):
        fly(sc, 0.5, [("step", TO_STEPS, 0)], each=turning)
        busy(sc, 0.25, turning)
    sc.set(on={"engine", "bill"})
    fly(sc, 0.55, [("coin", TO_WAL, 0.32)], each=turning)
    sc.set(cost="USD 0.01")
    busy(sc, 0.4, turning)
    sc.set(on={"app", "ask"})
    fly(sc, 0.75, [("paper", BACK, 0.34)])
    sc.set(on={"app"}, answered=True)
    sc.hold(2.4)
    sc.step("4. The app only asks; the platform does the rest", 0.3, on=set(), lines=True)
    sc.hold(2.8)
    sc.save()


# ============================================================ 4. the bounded contexts and their events
def contexts():
    POS = dict(projects=(1.4, 2.0), session=(6.0, 2.0), execution=(10.6, 2.0), identity=(1.4, 4.0),
               billing=(6.0, 4.0))
    NAME = dict(projects="Projects", session="Session", execution="Execution", identity="Identity",
                billing="Billing")
    KIND = dict(projects="folder", session="stream", execution="gear", identity="key", billing="wallet")
    SZ = 0.75
    UP, LOW = 1.82, 2.18                        # the two arrows in each gap of the top row
    L1, L2 = 1.4 + 0.5, 6.0 - 0.5               # the gap between Projects and Session
    R1, R2 = 6.0 + 0.5, 10.6 - 0.5              # the gap between Session and Execution
    DX, UX = 5.7, 6.3                           # the two arrows between Session and Billing
    V1, V2 = 2.82, 3.58
    # each event: its key, its name, from, to, its arrow, the object that moves, where its name sits
    EV = [
        ("asked", "question asked", "projects", "session", [(L1, UP), (L2, UP)], "question",
         (L1, UP - 0.38, L2 - L1, "center")),
        ("queued", "turn queued", "session", "execution", [(R1, UP), (R2, UP)], "lead",
         (R1, UP - 0.38, R2 - R1, "center")),
        ("step", "step recorded", "execution", "session", [(R2, LOW), (R1, LOW)], "step",
         (R1, LOW + 0.08, R2 - R1, "center")),
        ("spend", "spend recorded", "session", "billing", [(DX, V1), (DX, V2)], "coin",
         (DX - 2.55, 3.05, 2.4, "right")),
        ("cap", "over cap: approval needed", "billing", "session", [(UX, V2), (UX, V1)], "lock",
         (UX + 0.15, 3.05, 3.0, "left")),
        ("finding", "finding recorded", "session", "projects", [(L2, LOW), (L1, LOW)], "paper",
         (L1, LOW + 0.08, L2 - L1, "center")),
    ]

    def paint(c, st):
        on, seen, now = st["on"], st["seen"], st["now"]
        for key, name, a, b, pts, obj, (lx, ly, lw, align) in EV:
            active = key == now
            if key not in seen and not active:
                c.arrow(pts, color=RULE2)
                continue
            c.arrow(pts, active)
            c.text(lx, ly, lw, 0.3, name, 14, "Medium", INK if active else INK3, align)
        for key, (x, y) in POS.items():
            opts = dict(turn=st["turn"]) if key == "execution" else {}
            icon(c, KIND[key], x, y, SZ, lit=key in on, label=NAME[key], size=16, **opts)
        draw_flying(c, st)

    st = dict(on=set(), seen=set(), now=None, turn=0.0, fly=[])
    sc = Scene("contexts.gif", paint, st)
    titles = dict(asked="2. A question is asked in Projects; Session takes it",
                  queued="3. Session queues a turn for Execution",
                  step="4. Execution sends back each step it records",
                  spend="5. Session reports the spend to Billing",
                  cap="6. If a step would pass the cap, Billing asks for approval",
                  finding="7. The finding goes back to the project")

    def turning():
        # Execution works from the moment its turn arrives until its step is back.
        if st["now"] in ("queued", "step") or "execution" in st["on"]:
            st["turn"] += 0.04

    sc.step("1. The platform splits into five bounded contexts", 2.8)
    for key, name, a, b, pts, obj, _ in EV:
        sc.step(titles[key], 0.4, on={a}, now=None)
        sc.set(now=key)
        fly(sc, 0.8, [(obj, pts, 0.3)], each=turning)
        sc.set(on={b}, seen=st["seen"] | {key})
        if b == "execution":
            busy(sc, 0.8, turning)
        sc.hold(2.2)
    sc.step("8. One question: six events across five contexts", 3.0, on=set(), now=None)
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
