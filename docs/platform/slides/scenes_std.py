"""The redesigned deck's pictures: standard notation that a lecturer reads without a key.

A part is a box with its real name and one line that says what it does. A component box
carries the UML component mark; a node in the deployment diagram is the UML 3D box. A
thing that moves is a word in a small white tag ("question", "turn", "step"), never a
symbol the audience has to guess. Animation is kept for flows only.
"""
from draw import BLACK, INK, INK2, INK3, RAISED, RULE, RULE2, W, Canvas, Scene, font, S, X2

import draw


# ---------------------------------------------------------------- shared drawing
def comp(c, x, y, w, h, name, note="", lit=False, faint=False, mark=True, size=15):
    """A UML component: a box with the component mark at its top right."""
    edge = INK if lit else (RULE2 if faint else RULE)
    fill = RAISED if lit else BLACK
    c.d.rectangle([c._p(x), c._p(y), c._p(x + w), c._p(y + h)], fill=fill, outline=edge,
                  width=c._lw(2 if lit else 1.5))
    if mark:
        mx, my = x + w - 0.3, y + 0.1
        c.d.rectangle([c._p(mx), c._p(my), c._p(mx + 0.18), c._p(my + 0.22)], outline=edge, width=c._lw(1))
        for dy in (0.04, 0.12):
            c.d.rectangle([c._p(mx - 0.05), c._p(my + dy), c._p(mx + 0.05), c._p(my + dy + 0.06)], fill=fill,
                          outline=edge, width=c._lw(1))
    ink = INK if lit else (INK3 if faint else INK)
    if note:
        c.text(x + 0.14, y + 0.1, w - 0.5, 0.32, name, size, "Semibold", ink, "left")
        c.text(x + 0.14, y + 0.42, w - 0.2, h - 0.5, note, 13, "Regular", INK2 if not faint else INK3, "left")
    else:
        c.text(x, y, w, h, name, size, "Semibold", ink)


def node(c, x, y, w, h, name, stereo="", depth=0.14, lit=False):
    """A UML deployment node: a box seen from above right, with its stereotype and name."""
    edge = INK if lit else INK2
    d = depth
    c.d.polygon([(c._p(x), c._p(y)), (c._p(x + d), c._p(y - d)), (c._p(x + w + d), c._p(y - d)),
                 (c._p(x + w), c._p(y))], outline=edge, width=c._lw(1.5))
    c.d.polygon([(c._p(x + w), c._p(y)), (c._p(x + w + d), c._p(y - d)), (c._p(x + w + d), c._p(y + h - d)),
                 (c._p(x + w), c._p(y + h))], outline=edge, width=c._lw(1.5))
    c.d.rectangle([c._p(x), c._p(y), c._p(x + w), c._p(y + h)], outline=edge, width=c._lw(1.5))
    if stereo:
        c.text(x + 0.14, y + 0.06, w, 0.28, "«%s»" % stereo, 13, "Regular", INK2, "left")
    lines = name.count("\n") + 1
    c.text(x + 0.14, y + (0.3 if stereo else 0.08), w, 0.3 * lines, name, 15, "Semibold", INK, "left")


def tag(c, x, y, word, size=13):
    """A word that travels: black on a small white tag, centred on (x, y)."""
    f = font(size, "Semibold")
    tw = f.getlength(word) / (S * X2)
    w, h = tw + 0.2, 0.3
    c.d.rectangle([c._p(x - w / 2), c._p(y - h / 2), c._p(x + w / 2), c._p(y + h / 2)], fill=INK)
    c.text(x - w / 2, y - h / 2, w, h, word, size, "Semibold", BLACK)


def label_on(c, pts, text, lit=False, side="above", at=0.5):
    """The protocol or path name of a connector, written beside it."""
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    if len(pts) > 2:
        (x1, y1), (x2, y2) = pts[len(pts) // 2 - 1], pts[len(pts) // 2]
    mx, my = x1 + (x2 - x1) * at, y1 + (y2 - y1) * at
    col = INK if lit else INK3
    if abs(y2 - y1) < 1e-6:                     # horizontal
        c.text(mx - 1.2, my - 0.32 if side == "above" else my + 0.04, 2.4, 0.28, text, 13, "Regular", col)
    else:                                       # vertical
        c.text(mx + 0.08, my - 0.14, 2.6, 0.28, text, 13, "Regular", col, "left")


def typing(c, x, y, lines, chars, size=13):
    """Text that is being written: the agent's live output, with a cursor."""
    left = chars
    for i, line in enumerate(lines):
        shown = line[:max(0, left)]
        left -= len(line)
        c.text(x, y + i * 0.27, 4, 0.27, shown, size, "Regular", INK if i == len(lines) - 1 else INK2, "left",
               mono=True)
        if 0 <= left < 0 or (left < 0 and len(shown) < len(line)):
            pass
        if len(shown) < len(line):
            f = font(size, mono=True)
            cx = x + f.getlength(shown) / (S * X2) + 0.02
            if int(draw.NOW * 2.5) % 2 == 0:
                c.d.rectangle([c._p(cx), c._p(y + i * 0.27 + 0.05), c._p(cx + 0.08), c._p(y + i * 0.27 + 0.24)],
                              fill=INK)
            break


# ---------------------------------------------------------------- slide 7: the logical architecture
def logical():
    # four tiers, top to bottom; their names stand at the left edge
    TIERS = [("clients", 1.05), ("edge", 2.0), ("services", 2.85), ("data", 4.1)]
    BW, BH = 1.85, 0.95
    SX = [1.35 + i * 2.02 for i in range(5)]
    SY = 2.85
    SVC = [("Identity", "sign-in, API keys"), ("Project", "projects, agent\nregistry"),
           ("Session", "runs the agents'\ntask tree"), ("Worker", "agent loop,\ncalls the LLM"),
           ("Billing", "budget cap,\napprovals")]
    WEB, WATCH = (1.35, 1.05, 2.3, 0.6), (3.9, 1.05, 2.3, 0.6)
    GW = (1.35, 1.95, 5.7, 0.5)
    PG, MQ = (1.35, 4.1, 3.4, 0.7), (6.4, 4.1, 3.4, 0.7)
    LLM = (10.0, 4.1, 1.85, 0.85)
    OUTX, OUTY = 7.45, 1.0                     # where the agent's live output is written

    def cx(i):
        return SX[i] + BW / 2

    # the request's path, as connectors
    P = dict(
        ask=[(WATCH[0] + 1.15, WATCH[1] + WATCH[3]), (WATCH[0] + 1.15, GW[1])],
        route=[(cx(1), GW[1] + GW[3]), (cx(1), SY)],
        start=[(SX[1] + BW, SY + 0.41), (SX[2], SY + 0.41)],
        turn=[(cx(2) + 0.3, SY + BH), (cx(2) + 0.3, MQ[1])],
        take=[(SX[3] + 0.3, MQ[1]), (SX[3] + 0.3, SY + BH)],
        llm=[(SX[3] + BW - 0.35, SY + BH), (SX[3] + BW - 0.35, 3.98), (LLM[0] + 0.9, 3.98), (LLM[0] + 0.9, LLM[1])],
        step=[(SX[3], SY + 0.55), (SX[2] + BW, SY + 0.55)],
        save=[(SX[2] + 0.25, SY + BH), (SX[2] + 0.25, PG[1] + 0.4), (PG[0] + PG[2], PG[1] + 0.4)],
        answer=[(cx(2), SY), (cx(2), 1.75), (WATCH[0] + 1.75, 1.75), (WATCH[0] + 1.75, WATCH[1] + WATCH[3])],
    )
    # each protocol name, beside its connector: (x, y, align)
    NAMES = dict(ask=("HTTPS  /api/v1", WATCH[0] - 1.05, 1.66, "right"),
                 turn=("AMQP", cx(2) + 0.4, 3.82, "left"),
                 save=("SQL", PG[0] + PG[2] + 0.06, PG[1] + 0.1, "left"))

    def paint(c, st):
        on = st["on"]
        for name, y in TIERS:
            c.text(0.2, y, 1.0, 0.4, name, 13, "Medium", INK3, "left")
        comp(c, *WEB, "Web app", lit="web" in on, mark=False)
        comp(c, *WATCH, "Literature watch app", lit="watch" in on, mark=False)
        comp(c, *LLM, "LLM", "gpt-4.1-nano,\nan external API", lit="llm" in on, mark=False)
        comp(c, *GW, "", lit="gw" in on, mark=False)
        c.text(GW[0] + 0.15, GW[1], 4, GW[3], "API gateway  (Traefik)", 15, "Semibold", INK, "left")
        for i, (n, note) in enumerate(SVC):
            comp(c, SX[i], SY, BW, BH, n, note, lit=n.lower() in on, faint=n in ("Identity", "Billing") and
                 not st["all"])
        comp(c, *PG, "PostgreSQL", "one database, tables per context", lit="pg" in on)
        comp(c, *MQ, "RabbitMQ", "one queue per level of the task tree", lit="mq" in on)
        for key, pts in P.items():
            if key in st["seen"] or key == st["now"]:
                c.arrow(pts, key == st["now"])
                if key in NAMES:
                    text, lx, ly, align = NAMES[key]
                    c.text(lx, ly, 2.1, 0.28, text, 13, "Regular", INK if key == st["now"] else INK3, align)
        if st["think"] is not None:
            c.text(OUTX, OUTY - 0.02, 4, 0.26, "the worker's agent, live", 13, "Medium", INK2, "left")
            typing(c, OUTX, OUTY + 0.26, ["thinking: split into 3 sub-questions", "reading: 3 papers on arXiv",
                                          "writing: the answer, with sources"], st["think"])
        for x, y, word in st["tags"]:
            tag(c, x, y, word)

    st = dict(on=set(), seen=set(), now=None, tags=[], think=None, all=True)
    sc = Scene("logical.gif", paint, st)

    def move(key, word, seconds=0.9):
        pts = P[key]
        sc.set(now=key)
        sc.tween(seconds, lambda u: st.update(tags=[(*draw.along(pts, u), word)]))
        sc.set(seen=st["seen"] | {key}, tags=[])

    sc.step("Four tiers: clients, the API gateway, five services, the data", 3.0)
    sc.step("1. An app sends a question through the gateway", 0.3, all=False, on={"watch"})
    move("ask", "question")
    sc.set(on={"gw"})
    move("route", "question")
    sc.set(on={"project"})
    sc.hold(0.6)
    sc.title = "2. Project opens a session"
    move("start", "question")
    sc.set(on={"session"})
    sc.hold(1.0)
    sc.title = "3. Session puts a turn on a durable queue"
    move("turn", "turn")
    sc.set(on={"mq"})
    sc.hold(0.8)
    sc.title = "4. Any free worker takes the turn and runs the agent"
    move("take", "turn")
    sc.set(on={"worker"})
    move("llm", "prompt", 0.8)
    sc.set(on={"worker", "llm"})
    sc.tween(3.2, lambda u: st.update(think=int(u * 102)))
    sc.hold(0.6)
    sc.title = "5. Each step goes back to session, which saves it"
    sc.set(on={"worker", "session"})
    move("step", "step", 0.7)
    sc.set(on={"session", "pg"})
    move("save", "step", 0.8)
    sc.hold(0.8)
    sc.title = "6. The app reads the answer"
    sc.set(on={"session", "watch"}, think=None)
    move("answer", "answer", 1.1)
    sc.hold(2.4)
    sc.step("Five services, one gateway, one queue between session and workers", 3.0, on=set(), all=True)
    sc.save()


# ---------------------------------------------------------------- slide 11: the deployment diagram
def deployment():
    import os

    c = Canvas()

    def wire(pts, lit=True):
        c.arrow(pts, color=INK if lit else INK2)

    # No title in the picture: the slide's own title says it.
    # outside the server
    node(c, 0.15, 1.35, 1.35, 0.8, "Browser", "device")
    node(c, 0.15, 2.55, 1.35, 0.8, "Watch app", "client")
    node(c, 0.15, 3.7, 1.35, 1.0, "GitHub\nActions", "CI/CD")
    node(c, 10.35, 0.35, 1.5, 0.45, "OpenAI API")
    # the AWS node, the cluster inside it, and the pods inside that
    node(c, 2.75, 1.05, 9.05, 3.75, "EC2 t3.medium  ·  ap-southeast-1", "AWS", depth=0.18)
    c.text(2.85, 4.48, 3.5, 0.28, "security group: 22, 80, 443 open", 13, "Regular", INK2, "left")
    node(c, 3.05, 1.85, 8.45, 2.55, "k3s cluster", "Kubernetes", depth=0.12)
    c.text(5.15, 1.95, 4, 0.28, "namespace lumen", 13, "Regular", INK2, "left")
    comp(c, 3.25, 2.6, 1.55, 1.55, "Traefik", "ingress,\nHTTPS,\nrate limit", mark=False)
    pods = [("identity", "1–3  HPA"), ("project", "1–3  HPA"), ("session", "1"), ("worker", "1–4  KEDA"),
            ("billing", "1–3  HPA")]
    for i, (n, rep) in enumerate(pods):
        x = 5.15 + i * 1.25
        comp(c, x, 2.6, 1.12, 0.72, n, rep, mark=False, size=14)
        c.line([(x + 0.56, 2.42), (x + 0.56, 2.6)], color=INK2)
    c.line([(4.02, 2.6), (4.02, 2.42), (5.15 + 4 * 1.25 + 0.56, 2.42)], color=INK2)
    comp(c, 5.15, 3.5, 2.4, 0.66, "PostgreSQL", "StatefulSet + 2Gi volume", mark=False, size=14)
    comp(c, 7.65, 3.5, 2.4, 0.66, "RabbitMQ", "StatefulSet", mark=False, size=14)
    comp(c, 10.15, 3.5, 1.2, 0.66, "KEDA", "autoscaler", mark=False, size=14)
    # connectors, each with its protocol and port
    wire([(1.68, 1.75), (2.6, 1.75), (2.6, 3.0), (3.25, 3.0)])
    wire([(1.68, 2.95), (2.6, 2.95)])
    c.text(1.72, 1.42, 1.0, 0.28, "HTTPS 443", 13, "Regular", INK, "left")
    wire([(1.68, 4.25), (3.25, 4.25), (3.25, 4.4)], lit=False)
    c.text(1.72, 3.92, 1.0, 0.28, "SSH 22", 13, "Regular", INK2, "left")
    wire([(9.46, 2.6), (9.46, 1.5), (11.1, 1.5), (11.1, 0.8)], lit=False)
    c.text(9.56, 1.2, 1.0, 0.28, "HTTPS", 13, "Regular", INK2, "left")
    c.frame().save(os.path.join(draw.OUT, "deployment.png"))
    print("deployment.png")


SCENES = dict(logical=logical, deployment=deployment)
