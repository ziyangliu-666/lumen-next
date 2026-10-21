"""The physical part of the deck: where the platform runs, what it stores, one use case as a
sequence diagram, and how the source becomes a running pod.

Facts come from docs/platform/contract.md ("Public deployment", "Data", "Internal calls"),
deploy/k8s (the chart and the AWS host), .github/workflows/platform-deploy.yml and the
migrations in apps/server/src/core/db/migrations.

Every part is an icon from icons.py with a short label under it. The thing that moves is the
business object: a question bubble, a turn, a recorded step, an answer paper, an image box.
"""
from draw import BLACK, INK, INK2, INK3, RULE, RULE2, S, X2, Scene, font
from icons import icon


# ============================================================ small helpers this module needs
def dashed(c, x, y0, y1, dash=0.07, gap=0.06, color=RULE, pt=1.5):
    """A crisp dashed vertical line, for a lifeline."""
    y = y0
    while y < y1:
        c.line([(x, y), (x, min(y1, y + dash))], color=color, pt=pt)
        y += dash + gap


def label(c, x, y, w, h, s, size=13, weight="Regular", color=INK2, align="center", mono=False):
    """Words on a black block, so that a line under them never cuts through the letters."""
    f = font(size, weight, mono)
    tw = f.getlength(s) / (S * X2)
    pad = 0.05
    if align == "center":
        bx = x + (w - tw) / 2
    elif align == "right":
        bx = x + w - tw
    else:
        bx = x
    c.d.rectangle([c._p(bx - pad), c._p(y + 0.02), c._p(bx + tw + pad), c._p(y + h - 0.02)], fill=BLACK)
    c.text(x, y, w, h, s, size, weight, color, align, mono)


def blank(c, x, y, w, h):
    c.d.rectangle([c._p(x), c._p(y), c._p(x + w), c._p(y + h)], fill=BLACK)


def thing(c, kind, x, y, s=0.3, lit=True):
    """One business object: an icon kind, a turn ('lead'), a recorded step ('step'), or a commit."""
    if kind in ("lead", "reader", "step"):
        c.job(x, y, kind, color=INK if lit else INK2)
    elif kind == "commit":
        r = 0.08
        c.d.ellipse([c._p(x - r), c._p(y - r), c._p(x + r), c._p(y + r)], fill=INK)
    else:
        icon(c, kind, x, y, s, lit=lit)


def carry(sc, st, moves, seconds=0.7, each=None):
    """Objects travel along drawn connectors. moves: (kind, pts, size). The paint function
    draws st["obj"] last. each(u) may change more state per frame, such as a gear's turn."""
    from draw import along

    def at(u):
        st["obj"] = [(k, *along(p, u), s) for k, p, s in moves]
        if each:
            each(u)

    sc.tween(seconds, at)
    st["obj"] = []


def objects(c, st):
    for k, x, y, s in st.get("obj", []):
        thing(c, k, x, y, s)


# ============================================================ hosting: one server, its ports, its pods
def hosting():
    SG = 2.3                                   # the security group: the server's left edge
    TOPY, BOTY, RIGHT = 1.05, 4.75, 11.83      # the server's frame
    TY, GY = 2.2, 4.0                          # the request line and the deploy line
    PORT = {"443": TY, "80": 2.8, "6443": 3.4, "22": GY}
    OUT_X = 1.0                                # the browser and GitHub, outside
    GW, HELM = (3.7, TY), (3.7, GY)
    BUS_IN, BUS_TOP = 4.6, 1.6                 # Traefik's routes run along the top
    PODS = ["identity", "project", "session", "worker", "billing"]
    KIND = dict(identity="key", project="folder", session="stream", worker="gear", billing="wallet")
    PX = {p: 5.2 + 1.0 * i for i, p in enumerate(PODS)}
    PY, PS = 2.15, 0.48
    NET = 3.2                                  # the cluster network under the services
    DATA = {"PostgreSQL": (8.2, 3.95), "RabbitMQ": (9.9, 3.95)}

    def paint(c, st):
        on = st["on"]
        ports = "ports" in on
        # the server: a thin frame; its left edge is the security group
        for a, b in (((SG, TOPY), (RIGHT, TOPY)), ((RIGHT, TOPY), (RIGHT, BOTY)), ((RIGHT, BOTY), (SG, BOTY))):
            c.line([a, b], color=RULE2)
        icon(c, "cloud", 2.64, 1.33, 0.42, lit="server" in on)
        c.text(2.95, 1.17, 6, 0.32, "AWS ap-southeast-1 · t3.medium · k3s", 13, "Medium",
               INK if "server" in on else INK2, "left")
        c.text(0.3, 1.0, SG - 0.45, 0.32, "security group", 13, "Medium", INK if ports else INK2, "right")
        # outside: the browser and GitHub
        icon(c, "browser", OUT_X, TY, 0.55, lit="browser" in on, label="browser")
        icon(c, "branch", OUT_X, GY, 0.55, lit="github" in on, label="GitHub")
        c.arrow([(OUT_X + 0.34, TY), (GW[0] - 0.36, TY)], "browser" in on or "443" in on)
        c.line([(1.9, PORT["80"]), (2.9, PORT["80"]), (2.9, TY)], "80" in on)
        c.arrow([(OUT_X + 0.34, GY), (HELM[0] - 0.36, GY)], "github" in on or st["helm"])
        # the ports: a gap in the wall where it is open, a cross where it is closed
        edges = [TOPY] + [v for p, y in PORT.items() if p != "6443" for v in (y - 0.09, y + 0.09)] + [BOTY]
        for a, b in zip(edges[::2], edges[1::2]):
            c.line([(SG, a), (SG, b)], ports)
        for p, y in PORT.items():
            closed = p == "6443"
            if closed:
                c.cross(SG - 0.11, y - 0.11, 0.22, 0.22, INK if ports else INK3)
                c.text(SG + 0.16, y - 0.16, 1.0, 0.32, p, 14, "Medium", INK3, "left", mono=True)
                continue
            lit = ports or p in on
            c.text(SG + 0.1, y - 0.36, 1.0, 0.3, p, 14, "Medium", INK if lit else INK2, "left", mono=True)
        # inside: Traefik routes by path along the top line to each service
        r = st["route"]
        c.line([(GW[0] + 0.32, TY), (BUS_IN, TY), (BUS_IN, BUS_TOP)], bool(r))
        c.line([(BUS_IN, BUS_TOP), (PX[PODS[-1]], BUS_TOP)])
        if r:
            c.line([(BUS_IN, BUS_TOP), (PX[r], BUS_TOP)], True)
        for p in PODS:
            c.arrow([(PX[p], BUS_TOP), (PX[p], PY - PS / 2 - 0.04)], p == r)
        # the cluster network: services and the two stores
        c.line([(PX[PODS[0]], NET), (DATA["RabbitMQ"][0], NET)])
        for p in PODS:
            c.line([(PX[p], PY + 0.62), (PX[p], NET)])
        for name, (x, y) in DATA.items():
            c.line([(x, NET), (x, y - 0.3)], name in on)
        if st["internal"]:
            path = [(PX["project"], PY + 0.62), (PX["project"], NET), (PX["session"], NET)]
            c.line(path, True)
            c.arrow([(PX["session"], NET), (PX["session"], PY + 0.64)], True)
            c.text(5.0, 3.36, 2.6, 0.3, "/internal", 14, "Medium", INK, "left", mono=True)
            c.text(5.0, 3.68, 2.6, 0.3, "x-lumen-internal", 13, "Regular", INK2, "left", mono=True)
        icon(c, "gateway", *GW, 0.6, lit="traefik" in on, label="Traefik · HTTPS")
        icon(c, "helm", *HELM, 0.55, lit=st["helm"], label="helm")
        for p in PODS:
            gone = p == st["gone"]
            icon(c, KIND[p], PX[p], PY, PS, lit=p in on, faint=gone, label=p)
            if p in st["new"]:
                c.check(PX[p] + 0.28, PY - 0.3, 0.18)
        for name, (x, y) in DATA.items():
            kind = "database" if name == "PostgreSQL" else None
            if kind:
                icon(c, kind, x, y, 0.5, lit=name in on, label=name)
            else:
                c.queue(x - 0.39, y - 0.13, 3, [], "", name in on, 0.26)
                c.text(x - 1.2, y + 0.31, 2.4, 0.3, name, 14, "Medium", INK if name in on else INK2)
        if st["lock"]:
            icon(c, "lock", 4.25, TY, 0.36, lit=True)
            c.text(OUT_X - 0.8, TY - 0.72, 1.6, 0.3, "/internal", 14, "Medium", INK, mono=True)
        objects(c, st)

    st = dict(on={"server"}, route=None, internal=False, lock=False, new=set(), helm=False, gone=None, obj=[])
    sc = Scene("hosting.gif", paint, st)
    door = [(OUT_X + 0.4, TY), (GW[0] - 0.4, TY)]
    sc.step("1. One t3.medium server in AWS Singapore, about USD 1.3 a day", 2.8)
    sc.step("2. Only ports 22, 80 and 443 are open; 6443 stays closed", 2.8, on={"ports"})
    sc.step("3. A request enters on 443; Traefik serves HTTPS", 0.3, on={"browser", "443"})
    carry(sc, st, [("ask", door, 0.34)], 0.8)
    sc.set(on={"443", "traefik"})
    sc.hold(1.8)
    sc.title = "4. Traefik routes the request by its path to a service"
    sc.set(route="project")
    carry(sc, st, [("ask", [(GW[0] + 0.3, TY), (BUS_IN, TY), (BUS_IN, BUS_TOP), (PX["project"], BUS_TOP),
                                 (PX["project"], PY - 0.45)], 0.34)], 0.9)
    sc.set(on={"project"})
    sc.hold(2.6)
    sc.step("5. Services call each other on /internal with a secret header", 0.3, route=None, internal=True)
    carry(sc, st, [("ask", [(PX["project"], PY + 0.66), (PX["project"], NET), (PX["session"], NET),
                                 (PX["session"], PY + 0.7)], 0.34)], 0.9)
    sc.set(on={"session"})
    sc.hold(2.6)
    sc.step("6. From outside, /internal has no route: it stops at Traefik", 0.3, internal=False, on={"browser"})
    carry(sc, st, [("ask", door, 0.34)], 0.8)
    sc.set(on={"traefik"}, lock=True)
    sc.hold(2.8)
    sc.step("7. A push deploys over SSH; the pods are replaced one by one", 0.3, lock=False, on={"github"})
    carry(sc, st, [("image", [(OUT_X + 0.4, GY), (HELM[0] - 0.4, GY)], 0.36)], 0.9)
    sc.set(helm=True, on=set())
    sc.hold(0.4)
    for p in PODS:
        sc.set(gone=p)
        sc.hold(0.35)
        sc.set(gone=None, on={p})
        sc.hold(0.3)
        sc.set(on=set(), new=st["new"] | {p})
    sc.hold(2.6)
    sc.save()


# ============================================================ persistence: what is stored where
def persistence():
    PG = (1.6, 1.05, 6.65, 2.95)
    CX, CW, GAP = 3.0, 1.66, 0.08              # the first table cell, a cell, the gap between
    RY, RH = 1.5, 0.48                          # the first context row, a row's height
    ROWS = [("identity", ["accounts", "auth_sessions", "platform_api_keys"]),
            ("projects", ["projects", "platform_agents", "findings"]),
            ("session", ["sessions", "tasks", "steps"]),
            ("billing", ["billing_wallets", "billing_approvals", "ledger_entries"])]
    RYS = [RY + i * 0.62 for i in range(4)]
    RC = {name: y + RH / 2 for (name, _), y in zip(ROWS, RYS)}
    MQ = (8.6, 1.05, 11.83 - 8.6, 2.3)
    QS = ["lumen.turns.0", "lumen.turns.1", "lumen.turns.2"]
    QX, QYS, CELL = 8.8, [1.55, 2.13, 2.71], 0.32
    VOL = (8.6, 3.55, 11.83 - 8.6, 0.45)
    BUS = 8.42
    Q = (0.3, RC["session"] - 0.3, 1.05, 0.6)

    def cell_at(row, k):
        return CX + k * (CW + GAP), RYS[row]

    def paint(c, st):
        on, lit = st["on"], st["lit"]
        c.well(*PG)
        c.text(PG[0] + 0.15, 1.1, 5, 0.32, "PostgreSQL · one database", 15, "Medium",
               INK if "pg" in on else INK2, "left")
        for i, (ctx, tables) in enumerate(ROWS):
            c.text(1.78, RYS[i], 1.2, RH, ctx, 15, "Medium", INK if ctx in on else INK2, "left")
            for k, t in enumerate(tables):
                x, y = cell_at(i, k)
                state = "active" if t in lit else ("done" if t in st["written"] else "idle")
                c.box(x, y, CW, RH, "", state)
                c.text(x, y, CW, RH, t, 13, "Regular", INK if state != "idle" else INK2)
        if st["hash"]:
            x, y = cell_at(0, 2)
            c.bar(x, y, CW, RH, INK)
            c.text(x, y, CW, RH, "SHA-256 hashes", 14, "Semibold", BLACK)
        # RabbitMQ and its three durable queues
        c.well(*MQ)
        c.text(MQ[0] + 0.15, 1.1, 3, 0.32, "RabbitMQ · durable queues", 15, "Medium",
               INK if "mq" in on else INK2, "left")
        for q, y in zip(QS, QYS):
            items = st["queue"] if q == "lumen.turns.0" else []
            act = q == "lumen.turns.0" and "q0" in on
            c.queue(QX, y, 4, items, "", act, CELL)
            c.text(QX + 4 * CELL + 0.18, y, 1.6, CELL, q, 13, "Regular", INK if act else INK2, "left", mono=True)
        if st["ack"]:
            c.check(QX + 0.05, QYS[0] + 0.04, 0.22)
        # the volume for project files
        c.box(*VOL, "", "active" if "vol" in on else "idle")
        c.text(VOL[0] + 0.15, VOL[1], 1.6, VOL[3], "project files", 15, "Medium",
               INK if "vol" in on else INK2, "left")
        c.text(VOL[0] + 1.55, VOL[1], 1.55, VOL[3], "a 2 Gi volume", 13, "Regular", INK3, "right")
        # the question, and the line from the database's rows to the queue
        c.box(*Q, "question", "active" if "question" in on else "idle")
        c.arrow([(Q[0] + Q[2], RC["session"]), (PG[0], RC["session"])], "question" in on)
        path_on = "q0" in on
        c.line([(PG[0] + PG[2], RC["session"]), (BUS, RC["session"])], path_on)
        c.line([(BUS, QYS[0] + CELL / 2), (BUS, RC["billing"])], path_on)
        c.arrow([(BUS, QYS[0] + CELL / 2), (QX, QYS[0] + CELL / 2)], path_on)
        for ctx in ("projects", "billing"):
            c.arrow([(BUS, RC[ctx]), (PG[0] + PG[2], RC[ctx])], ctx in on)
        if st["last"]:
            c.text(0.3, 4.22, 11.53, 0.4, "one database; each context owns its tables",
                   15, "Medium", INK2, "left")

    st = dict(on={"pg"}, lit=set(), written=set(), queue=[], ack=False, hash=False, last=False)
    sc = Scene("persistence.gif", paint, st)
    q_in = (QX + CELL / 2, QYS[0] + CELL / 2)

    def back(ctx):
        """The path from the turn in the queue back to the right edge of a context's row."""
        return [q_in, (BUS, q_in[1]), (BUS, RC[ctx]), (PG[0] + PG[2] - 0.15, RC[ctx])]

    sc.step("1. One PostgreSQL database; each context keeps its own tables", 3.0,
            on={"pg", "identity", "projects", "session", "billing"})
    sc.step("2. An API key is stored only as its SHA-256 hash", 2.8, on={"identity"},
            lit={"platform_api_keys"}, hash=True)
    sc.step("3. RabbitMQ keeps three durable queues; files go on a volume", 2.8,
            on={"mq", "vol"}, lit=set(), hash=False)
    sc.step("4. A question writes its session and task rows", 0.3, on={"question"})
    sc.hop("lead", [(Q[0] + Q[2], RC["session"]), (PG[0] + 0.05, RC["session"])], 0.6)
    sc.set(on={"session"}, lit={"sessions"})
    sc.hold(0.5)
    sc.set(lit={"tasks"}, written={"sessions"})
    sc.hold(1.8)
    sc.step("5. Its turn waits in lumen.turns.0 until a worker is done", 0.3, on={"q0"},
            lit=set(), written={"sessions", "tasks"})
    sc.hop("lead", [(PG[0] + PG[2], RC["session"]), (BUS, RC["session"]), (BUS, q_in[1]), q_in], 0.8)
    sc.set(queue=["lead"])
    sc.hold(2.4)
    sc.step("6. The work writes step rows, a ledger row and a finding", 0.3)
    for _ in range(2):
        sc.hop("step", back("session"), 0.55)
        sc.set(lit={"steps"}, on={"q0", "session"})
        sc.hold(0.35)
        sc.set(lit=set(), written=st["written"] | {"steps"})
    sc.hop("step", back("billing"), 0.6)
    sc.set(lit={"ledger_entries"}, on={"q0", "billing"})
    sc.hold(0.5)
    sc.set(lit=set(), written=st["written"] | {"ledger_entries"})
    sc.hop("step", back("projects"), 0.6)
    sc.set(lit={"findings"}, on={"q0", "projects"})
    sc.hold(0.6)
    sc.set(lit=set(), written=st["written"] | {"findings"}, on={"q0"})
    sc.hold(2.2)
    sc.step("7. The worker acknowledges, and the turn leaves the queue", 0.3, queue=[])
    sc.hop("lead", [q_in, (QX + 4 * CELL - CELL / 2, q_in[1])], 0.6)
    sc.set(ack=True)
    sc.hold(2.4)
    sc.step("8. Every step is saved; a turn leaves the queue only when it is done", 3.2, on=set(), ack=False, last=True)
    sc.save()


# ============================================================ sequence: ask a question with a chosen agent
def sequence():
    W_, G, P, SE, MQ, WK, MD = range(7)
    HEADS = [("app", "watch app"), ("gateway", "gateway"), ("folder", "project"), ("stream", "session"),
             (None, "RabbitMQ"), ("gear", "worker"), ("model", "model")]
    LX = [1.05 + 1.67 * i for i in range(7)]
    HY, HS = 1.32, 0.46
    LIFE0, LIFE1 = 1.98, 4.82
    Y0, DY = 2.18, 0.28
    # (from, to, words, mono, the object it carries); from == to is a call to itself
    MSG = [(W_, G, "question + API key", False, "ask"),
           (G, G, "check the key", False, "key"),
           (G, P, "create project", False, "ask"),
           (P, SE, "start session", False, "ask"),
           (SE, MQ, "lumen.turns.0", True, "lead"),
           (MQ, WK, "take turn", False, "lead"),
           (WK, WK, "apply the agent", False, "gear"),
           (WK, MD, "gpt-4.1-nano", True, "ask"),
           (WK, SE, "steps", False, "step"),
           (SE, W_, "answer", False, "paper")]

    def y_of(i):
        return Y0 + i * DY

    def paint(c, st):
        n, cur = st["n"], st["cur"]
        acting = set(st["busy"])
        for i in cur:
            acting |= {MSG[i][0], MSG[i][1]}
        for k, ((kind, name), x) in enumerate(zip(HEADS, LX)):
            lit = k in acting
            dashed(c, x, LIFE0, LIFE1, color=INK3 if lit else RULE)
            if kind is None:
                c.queue(x - 0.39, HY - 0.13, 3, st["queue"], "", lit, 0.26)
                c.text(x - 1.2, HY + HS / 2 + 0.06, 2.4, 0.3, name, 14, "Medium", INK if lit else INK2)
            else:
                opts = dict(turn=st["turn"]) if kind == "gear" else {}
                icon(c, kind, x, HY, HS, lit=lit, label=name, **opts)
        for i in range(n):
            a, b, words, mono, obj = MSG[i]
            y = y_of(i)
            now = i in cur
            col = INK if now else RULE
            tcol = INK if now else INK3
            if a == b:
                x = LX[a]
                c.line([(x, y - 0.04), (x + 0.3, y - 0.04), (x + 0.3, y + 0.1)], color=col)
                c.arrow([(x + 0.3, y + 0.1), (x + 0.02, y + 0.1)], color=col)
                thing(c, obj, x + 0.55, y - 0.065, 0.26, now)
                label(c, x + 0.73, y - 0.2, 3, 0.27, words, 13, "Regular", tcol, "left", mono)
                continue
            x1, x2 = LX[a], LX[b]
            d = 1 if x2 > x1 else -1
            grow = st["grow"] if i == n - 1 and now else 1.0
            xe = x1 + (x2 - x1) * grow
            if abs(xe - x1) > 0.12:
                c.arrow([(x1 + d * 0.02, y + 0.08), (xe - d * 0.02, y + 0.08)], color=col)
            lw = font(13, "Regular", mono).getlength(words) / (S * X2)
            mid = (x1 + x2) / 2 + 0.15
            label(c, mid - lw / 2 - 0.1, y - 0.2, lw + 0.2, 0.27, words, 13, "Regular", tcol, "center", mono)
            if grow >= 1.0:
                thing(c, obj, mid - lw / 2 - 0.27, y - 0.065, 0.26, now)
        objects(c, st)

    st = dict(n=0, cur=set(), grow=1.0, busy=set(), turn=0.0, queue=[], obj=[])
    sc = Scene("sequence.gif", paint, st)

    def send(i, seconds=0.7):
        st["n"] = i + 1
        st["cur"] = st["cur"] | {i}
        a, b, _, _, obj = MSG[i]
        if a == b:
            st["grow"] = 1.0
            if obj == "gear":
                # The worker works: its gear turns.
                t0 = st["turn"]
                sc.tween(1.2, lambda u: st.update(turn=t0 + 1.5 * u))
            else:
                sc.hold(0.5)
            return
        y = y_of(i) + 0.08
        if a == MQ:
            st["queue"] = []
        t0 = st["turn"]

        def each(u):
            st["grow"] = u
            if WK in (a, b):
                st["turn"] = t0 + 0.8 * u
        carry(sc, st, [(obj, [(LX[a], y), (LX[b], y)], 0.3)], seconds, each)
        if b == MQ:
            st["queue"] = ["lead"]
        st["grow"] = 1.0
        sc.hold(0.3)

    def begin(title, *msgs, hold=2.4):
        sc.title = title
        st["cur"] = set()
        sc.hold(0.3)
        for i in msgs:
            send(i)
        sc.hold(hold)

    sc.title = "1. The literature watch app asks a question; the gateway checks its key"
    sc.hold(0.8)
    send(0)
    send(1)
    sc.hold(2.4)
    begin("2. Project creates a project and asks session to start", 2, 3)
    begin("3. Session puts the first turn on the lumen.turns.0 queue", 4)
    begin("4. A worker takes the turn and applies the agent's instructions", 5, 6)
    begin("5. The worker calls gpt-4.1-nano and reports each step", 7, 8)
    begin("6. The worker is done; the app gets the answer as a paper", 9, hold=3.0)
    sc.save()


# ============================================================ source: from a commit to a running pod
def source():
    REPO = (0.3, 1.05, 6.0, 4.75)              # the monorepo's frame: left, top, right, bottom
    DIRS = [("server", 0.95), ("web", 2.15), ("watch", 3.35), ("k8s", 4.55)]
    DIR_Y = 1.72
    MAIN_Y, PLAT_Y, MEM_Y = 2.85, 3.6, 4.35
    LX0, LX1 = 2.15, 5.75                      # where the branch lines start and end
    MERGES = [(2.6, 3.25), (3.6, 4.25), (4.6, 5.25)]   # member branch: start x, merge x
    ROW = 2.0                                  # the pipeline's line
    GEAR, IMG, K3S, HELM = (7.25, ROW), (8.6, ROW), (9.9, ROW), (11.2, ROW)
    PODS = ["identity", "project", "session", "worker", "billing"]
    POD_X = {p: 7.2 + 1.0 * i for i, p in enumerate(PODS)}
    POD_Y, BUS = 3.95, 3.25

    def paint(c, st):
        on = st["on"]
        x0, y0, x1, y1 = REPO
        c.box(x0, y0, x1 - x0, y1 - y0, "", "faint")
        c.text(x0 + 0.15, y0 + 0.06, 3, 0.3, "one monorepo", 13, "Medium", INK if "repo" in on else INK2, "left")
        for name, x in DIRS:
            icon(c, "folder", x, DIR_Y, 0.42, lit="repo" in on, label=name)
        # the branches
        br = "branches" in on
        c.text(0.45, MAIN_Y - 0.17, 1.6, 0.32, "main", 14, "Medium", INK if br else INK2, "left", mono=True)
        c.line([(LX0, MAIN_Y), (LX1, MAIN_Y)], br)
        c.text(0.45, PLAT_Y - 0.17, 1.7, 0.32, "ass/platform", 14, "Medium", INK if br or "plat" in on else INK2,
               "left", mono=True)
        c.line([(LX0 + 0.1, MAIN_Y), (LX0 + 0.5, PLAT_Y)], br)
        c.line([(LX0 + 0.5, PLAT_Y), (LX1, PLAT_Y)], br or "plat" in on)
        c.text(0.45, MEM_Y - 0.17, 1.7, 0.32, "members", 14, "Medium", INK if "mem" in on else INK2, "left")
        for k, (a, m) in enumerate(MERGES):
            act = "mem" in on and k == 2
            c.line([(a, MEM_Y), (m - 0.3, MEM_Y), (m, PLAT_Y)], act)
            c.d.ellipse([c._p(a - 0.05), c._p(MEM_Y - 0.05), c._p(a + 0.05), c._p(MEM_Y + 0.05)],
                        fill=INK if act else INK2)
        for a, m in MERGES[:2] + (MERGES[2:] if st["merged"] else []):
            c.d.ellipse([c._p(m - 0.06), c._p(PLAT_Y - 0.06), c._p(m + 0.06), c._p(PLAT_Y + 0.06)],
                        fill=INK if br or "plat" in on else INK2)
        # the pipeline: build, carry over SSH, import into k3s, helm upgrade
        stage = st["stage"]
        c.line([(LX1, PLAT_Y), (6.3, PLAT_Y), (6.3, ROW), (GEAR[0] - 0.36, ROW)], stage == 0)
        c.arrow([(6.3, ROW), (GEAR[0] - 0.36, ROW)], stage == 0)
        c.arrow([(GEAR[0] + 0.34, ROW), (IMG[0] - 0.32, ROW)], stage == 0)
        c.arrow([(IMG[0] + 0.32, ROW), (K3S[0] - 0.34, ROW)], stage == 1)
        c.text(IMG[0] + 0.3, ROW - 0.4, K3S[0] - IMG[0] - 0.6, 0.3, "SSH", 14, "Medium",
               INK if stage == 1 else INK2, mono=True)
        c.arrow([(K3S[0] + 0.34, ROW), (HELM[0] - 0.34, ROW)], stage == 2)
        # helm reaches every pod
        c.line([(HELM[0], ROW + 0.62), (HELM[0], BUS)], stage == 2)
        c.line([(POD_X[PODS[0]], BUS), (HELM[0], BUS)], stage == 2)
        for p in PODS:
            c.arrow([(POD_X[p], BUS), (POD_X[p], POD_Y - 0.27)], p == st["pod"])
        icon(c, "gear", *GEAR, 0.6, lit=stage == 0, label="GitHub Actions", turn=st["turn"])
        if st["image"]:
            icon(c, "image", *IMG, 0.52, lit=stage == 0, label="image")
            c.text(IMG[0] - 1.2, ROW - 0.72, 2.4, 0.3, "lumen-next:<sha>", 13, "Medium",
                   INK if stage == 0 else INK2, mono=True)
        else:
            icon(c, "image", *IMG, 0.52, faint=True, label="image")
        icon(c, "server", *K3S, 0.55, lit=stage == 1, label="k3s")
        if st["imported"]:
            c.check(K3S[0] + 0.32, ROW - 0.36, 0.2)
        icon(c, "helm", *HELM, 0.55, lit=stage == 2, label="helm upgrade")
        for p in PODS:
            gone = p == st["gone"]
            icon(c, "server", POD_X[p], POD_Y, 0.42, lit=p == st["pod"], faint=gone, label=p, size=13)
            if p in st["new"]:
                c.check(POD_X[p] + 0.25, POD_Y - 0.3, 0.18)
        objects(c, st)

    st = dict(on={"repo"}, stage=-1, image=False, imported=False, merged=False, pod=None, gone=None,
              new=set(), turn=0.0, obj=[])
    sc = Scene("source.gif", paint, st)
    a, m = MERGES[2]
    sc.step("1. One monorepo holds the server, both apps and the chart", 2.8)
    sc.step("2. main is Lumen; ass/platform splits it into services", 2.8, on={"branches"})
    sc.step("3. Each member works on a branch and merges it into ass/platform", 0.3, on={"mem"})
    carry(sc, st, [("commit", [(a, MEM_Y), (m - 0.3, MEM_Y), (m, PLAT_Y)], 0)], 0.8)
    sc.set(on={"mem", "plat"}, merged=True)
    sc.hold(2.2)
    sc.step("4. The push builds one image, tagged with the commit SHA", 0.3, on={"plat"}, stage=0)
    carry(sc, st, [("commit", [(m, PLAT_Y), (LX1, PLAT_Y), (6.3, PLAT_Y), (6.3, ROW), (GEAR[0] - 0.3, ROW)], 0)], 0.9)
    sc.tween(1.2, lambda u: st.update(turn=2.0 * u))
    carry(sc, st, [("image", [(GEAR[0] + 0.3, ROW), (IMG[0], ROW)], 0.4)], 0.6)
    sc.set(image=True)
    sc.hold(2.4)
    sc.step("5. No registry: the image goes over SSH, straight into k3s", 0.3, on=set(), stage=1)
    carry(sc, st, [("image", [(IMG[0] + 0.3, ROW), (K3S[0] - 0.1, ROW)], 0.4)], 0.8)
    sc.set(imported=True)
    sc.hold(2.4)
    sc.step("6. helm upgrade replaces the pods with the new image", 0.3, stage=2)
    for p in PODS:
        carry(sc, st, [("image", [(HELM[0], ROW + 0.62), (HELM[0], BUS), (POD_X[p], BUS),
                                  (POD_X[p], POD_Y - 0.3)], 0.26)], 0.5)
        sc.set(gone=p)
        sc.hold(0.25)
        sc.set(gone=None, pod=p, new=st["new"] | {p})
        sc.hold(0.25)
    sc.set(pod=None)
    sc.hold(2.8)
    sc.save()


SCENES = dict(hosting=hosting, persistence=persistence, sequence=sequence, source=source)
