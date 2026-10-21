"""The physical part of the deck: where the platform runs, what it stores, one use case as a
sequence diagram, and how the source becomes a running pod.

Facts come from docs/platform/contract.md ("Public deployment", "Data", "Internal calls"),
deploy/k8s (the chart and the AWS host), .github/workflows/platform-deploy.yml and the
migrations in apps/server/src/core/db/migrations.
"""
from draw import BLACK, INK, INK2, INK3, RULE, RULE2, S, X2, Scene, font


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


# ============================================================ hosting: one server, its ports, its pods
def hosting():
    SG = 2.45                                  # the security group: the server's left edge
    WELL = (SG, 1.05, 11.83 - SG, 3.65)
    TY, GY = 1.95, 4.15                        # the request line and the deploy line
    PORT = {"443": TY, "80": 2.65, "6443": 3.35, "22": GY}
    PW, PH = 0.72, 0.42
    BROWSER = (0.3, TY - 0.3, 1.45, 0.6)
    GITHUB = (0.3, GY - 0.3, 1.45, 0.6)
    TRAEFIK = (3.15, TY - 0.375, 2.0, 0.75)
    PODS = ["identity", "project", "session", "worker", "billing"]
    PX, PWID, PHT = 5.75, 1.7, 0.48
    PY = {p: 1.6 + 0.6 * i for i, p in enumerate(PODS)}
    PC = {p: PY[p] + PHT / 2 for p in PODS}    # the centre line of each pod
    BUS_IN, BUS_OUT = 5.45, 7.75                 # Traefik's routes, and the cluster network
    DATA = {"PostgreSQL": (9.6, 1.75, 2.0, 0.7), "RabbitMQ": (9.6, 2.9, 2.0, 0.7)}

    def paint(c, st):
        on = st["on"]
        c.well(*WELL)
        c.text(2.95, 1.13, 5, 0.32, "AWS ap-southeast-1 · one t3.medium · k3s", 15, "Medium",
               INK if "server" in on else INK2, "left")
        # the security group: one edge, broken only where a port is open
        c.text(0.3, 1.0, SG - 0.4, 0.32, "security group", 13, "Medium", INK if "ports" in on else INK2, "right")
        c.line([(SG, 1.05), (SG, 4.7)], "ports" in on)
        for p, y in PORT.items():
            x = SG - PW / 2
            blank(c, x, y - PH / 2, PW, PH)
            closed = p == "6443"
            state = "faint" if closed else ("active" if p in on or "ports" in on else "idle")
            c.box(x, y - PH / 2, PW, PH, "", state)
            c.text(x, y - PH / 2, PW, PH, p, 14, "Medium", INK3 if closed else (INK if state == "active" else INK2),
                   mono=True)
            if closed:
                c.cross(x - 0.42, y - 0.12, 0.24, 0.24, INK if "ports" in on else INK2)
                c.text(0.3, y - 0.16, x - 0.55 - 0.3, 0.32, "closed", 13, "Medium",
                       INK if "ports" in on else INK2, "right")
        # outside: the browser and GitHub
        c.box(*BROWSER, "browser", "active" if "browser" in on else "idle")
        c.arrow([(BROWSER[0] + BROWSER[2], TY), (SG - PW / 2, TY)], "browser" in on)
        c.box(*GITHUB, "GitHub", "active" if "github" in on else "idle")
        c.arrow([(GITHUB[0] + GITHUB[2], GY), (SG - PW / 2, GY)], "github" in on)
        # inside: Traefik, the ingress
        c.arrow([(SG + PW / 2, TY), (TRAEFIK[0], TY)], "443" in on)
        c.line([(SG + PW / 2, 2.65), (3.6, 2.65), (3.6, TRAEFIK[1] + TRAEFIK[3])], "80" in on)
        c.box(*TRAEFIK, "Traefik", "active" if "traefik" in on else "idle", sub="HTTPS · Let's Encrypt")
        if st["noroute"]:
            c.cross(TRAEFIK[0], 2.89, 0.22, 0.22)
            c.text(TRAEFIK[0] + 0.34, 2.84, 2.0, 0.32, "no route to /internal", 13, "Medium", INK, "left")
        # Traefik routes by path to every service
        lit = st["route"]
        c.line([(TRAEFIK[0] + TRAEFIK[2], TY), (BUS_IN, TY)], bool(lit))
        c.line([(BUS_IN, PC["identity"]), (BUS_IN, PC["billing"])])
        if lit:
            c.line([(BUS_IN, TY), (BUS_IN, PC[lit])], True)
        for p in PODS:
            c.arrow([(BUS_IN, PC[p]), (PX, PC[p])], p == lit)
        # the pods, and the cluster network behind them
        c.line([(BUS_OUT, PC["identity"]), (BUS_OUT, PC["billing"])])
        for p in PODS:
            c.line([(PX + PWID, PC[p]), (BUS_OUT, PC[p])])
        for name, (x, y, w, h) in DATA.items():
            c.line([(BUS_OUT, y + h / 2), (x, y + h / 2)], name in on)
        if st["internal"]:
            c.line([(PX + PWID, PC["project"]), (BUS_OUT, PC["project"]), (BUS_OUT, PC["session"])], True)
            c.arrow([(BUS_OUT, PC["session"]), (PX + PWID, PC["session"])], True)
            c.text(8.0, 3.72, 2.2, 0.3, "/internal", 14, "Regular", INK, "left", mono=True)
            c.text(8.0, 4.04, 2.2, 0.3, "x-lumen-internal", 13, "Regular", INK, "left", mono=True)
            c.text(8.0, 4.34, 2.2, 0.3, "the shared secret header", 13, "Regular", INK2, "left")
        for p in PODS:
            state = "active" if p in on else "idle"
            c.box(PX, PY[p], PWID, PHT, p, state, size=15)
            if p in st["new"]:
                c.check(PX + PWID - 0.34, PY[p] + 0.12, 0.22)
        for name, (x, y, w, h) in DATA.items():
            c.box(x, y, w, h, name, "active" if name in on else "idle", sub="StatefulSet · volume")
        if st["helm"]:
            c.arrow([(SG + PW / 2, GY), (3.15, GY)], True)
            c.text(3.25, GY - 0.16, 1.9, 0.32, "helm upgrade", 14, "Regular", INK, "left", mono=True)

    st = dict(on={"server"}, route=None, internal=False, noroute=False, new=set(), helm=False)
    sc = Scene("hosting.gif", paint, st)
    sc.step("1. One t3.medium server in AWS Singapore, about USD 1.3 a day", 2.8)
    sc.step("2. Only ports 22, 80 and 443 are open; 6443 stays closed", 2.8, on={"ports"})
    sc.step("3. A request enters on 443; Traefik serves HTTPS", 0.3, on={"browser"})
    sc.hop("lead", [(1.75, TY), (3.15, TY)], 0.7)
    sc.set(on={"443", "traefik"})
    sc.hold(1.6)
    sc.title = "4. Traefik routes the request by its path to a service"
    sc.set(route="project")
    sc.hop("lead", [(TRAEFIK[0] + TRAEFIK[2], TY), (BUS_IN, TY), (BUS_IN, PC["project"]), (PX + 0.25, PC["project"])], 0.7)
    sc.set(on={"project"})
    sc.hold(2.6)
    sc.step("5. Services call each other on /internal with a secret header", 0.3, route=None, internal=True)
    sc.hop("lead", [(PX + PWID, PC["project"]), (BUS_OUT, PC["project"]), (BUS_OUT, PC["session"]),
                    (PX + PWID - 0.25, PC["session"])], 0.8)
    sc.set(on={"session"})
    sc.hold(2.6)
    sc.step("6. From outside, /internal has no route: it stops at Traefik", 0.3, internal=False, on={"browser"})
    sc.hop("lead", [(1.75, TY), (3.15, TY)], 0.7)
    sc.set(on={"traefik"})
    sc.hop("lead", [(3.15, TY), (3.0, TY + 0.4), (TRAEFIK[0] + 0.11, 3.0)], 0.5)
    sc.set(noroute=True)
    sc.hold(2.6)
    sc.step("7. A push deploys over SSH; the pods are replaced one by one", 0.3, noroute=False, on={"github"})
    sc.hop("lead", [(1.75, GY), (3.1, GY)], 0.8)
    sc.set(helm=True, on=set())
    sc.hold(0.4)
    for p in PODS:
        sc.set(on={p})
        sc.hold(0.45)
        sc.set(on=set(), new=st["new"] | {p})
        sc.hold(0.2)
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
            c.text(0.3, 4.22, 11.53, 0.4, "one database, tables split by context  ·  next: one database per service",
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
    sc.step("8. Today one database for all; next, one per service", 3.2, on=set(), ack=False, last=True)
    sc.save()


# ============================================================ sequence: ask a question with a chosen agent
def sequence():
    LIVES = ["literature\nwatch app", "gateway", "project", "session", "RabbitMQ", "worker", "model"]
    LX = [1.05 + 1.67 * i for i in range(7)]
    HY, HH, HW = 1.0, 0.55, 1.45
    Y0, DY = 1.9, 0.29
    W_, G, P, SE, MQ, WK, MD = range(7)
    # (from, to, words, mono); from == to is a call to itself
    MSG = [(W_, G, "POST /api/v1/questions", True),
           (G, P, "create project", False),
           (P, SE, "start session", False),
           (SE, MQ, "turn on lumen.turns.0", True),
           (MQ, WK, "take turn", False),
           (WK, WK, "apply agent instructions", False),
           (WK, MD, "call gpt-4.1-nano", False),
           (WK, SE, "report steps", False),
           (WK, SE, "done", False),
           (W_, SE, "GET answer", False)]

    def y_of(i):
        return Y0 + i * DY

    def paint(c, st):
        n, cur = st["n"], st["cur"]
        acting = set()
        for i in cur:
            a, b = MSG[i][0], MSG[i][1]
            acting |= {a, b}
        for k, (name, x) in enumerate(zip(LIVES, LX)):
            c.box(x - HW / 2, HY, HW, HH, "", "active" if k in acting else "idle")
            c.text(x - HW / 2, HY, HW, HH, name, 14 if "\n" in name else 15, "Medium",
                   INK if k in acting else INK2)
            dashed(c, x, HY + HH, 4.66)
        for i in range(n):
            a, b, words, mono = MSG[i]
            y = y_of(i)
            col = INK if i in cur else RULE
            tcol = INK if i in cur else INK3
            if a == b:
                x = LX[a]
                c.line([(x, y - 0.04), (x + 0.3, y - 0.04), (x + 0.3, y + 0.08)], color=col)
                c.arrow([(x + 0.3, y + 0.08), (x + 0.02, y + 0.08)], color=col)
                label(c, x + 0.38, y - 0.16, 3, 0.27, words, 13, "Regular", tcol, "left", mono)
                continue
            x1, x2 = LX[a], LX[b]
            d = 1 if x2 > x1 else -1
            grow = st["grow"] if i == n - 1 and i in cur else 1.0
            xe = x1 + (x2 - x1) * grow
            if abs(xe - x1) > 0.12:
                c.arrow([(x1 + d * 0.02, y + 0.08), (xe - d * 0.02, y + 0.08)], color=col)
            lw = font(13, "Regular", mono).getlength(words) / (S * X2)
            mid = (x1 + x2) / 2
            label(c, mid - lw / 2 - 0.1, y - 0.2, lw + 0.2, 0.27, words, 13, "Regular", tcol, "center", mono)

    st = dict(n=0, cur=set(), grow=1.0)
    sc = Scene("sequence.gif", paint, st)

    def send(i, seconds=0.6):
        st["n"] = i + 1
        st["cur"] = st["cur"] | {i}
        a, b = MSG[i][0], MSG[i][1]
        if a == b:
            st["grow"] = 1.0
            sc.hold(0.4)
            return
        y = y_of(i) + 0.08
        sc.tween(seconds, lambda u: (st.update(grow=u),
                                     setattr(sc, "moving", [(LX[a] + (LX[b] - LX[a]) * u, y, "lead")])))
        sc.moving = []
        st["grow"] = 1.0
        sc.hold(0.3)

    def begin(title, *msgs, hold=2.4):
        sc.title = title
        st["cur"] = set()
        sc.hold(0.3)
        for i in msgs:
            send(i)
        sc.hold(hold)

    sc.title = "1. The literature watch app asks a question with its API key"
    sc.hold(0.6)
    send(0)
    sc.hold(2.4)
    begin("2. Project creates a project and asks session to start", 1, 2)
    begin("3. Session puts the first turn on the lumen.turns.0 queue", 3)
    begin("4. A worker takes the turn and applies the agent's instructions", 4, 5)
    begin("5. The worker calls gpt-4.1-nano and reports each step", 6, 7)
    begin("6. The worker says done; the app reads the answer", 8, 9, hold=3.0)
    sc.save()


# ============================================================ source: from a commit to a running pod
def source():
    REPO = (0.3, 1.05, 6.35, 3.65)
    MAIN_Y, PLAT_Y, MEM_Y = 2.55, 3.45, 4.3
    LX0, LX1 = 2.15, 6.3                       # where the branch lines start and end
    STAGES = [("build the image", "lumen-next:<commit sha>", True),
              ("copy it over SSH", "scp to the server, port 22", False),
              ("import it into k3s", "k3s ctr images import", True),
              ("helm upgrade", "the pods roll one by one", False)]
    SX, SW, SH = 7.45, 4.38, 0.64
    SYS = [1.4 + i * (SH + 0.22) for i in range(4)]
    MERGES = [(2.7, 3.4), (3.85, 4.55), (5.0, 5.7)]   # member branch: start x, merge x

    def paint(c, st):
        on = st["on"]
        c.well(*REPO)
        c.text(0.45, 1.12, 3, 0.32, "one monorepo", 15, "Medium", INK if "repo" in on else INK2, "left")
        for k, d in enumerate(["apps/server", "apps/web", "apps/watch", "deploy/k8s"]):
            c.text(0.45 + (k % 2) * 1.75, 1.5 + (k // 2) * 0.32, 1.7, 0.3, d, 13, "Regular",
                   INK if "repo" in on else INK3, "left", mono=True)
        # the branches
        br = "branches" in on
        c.text(0.45, MAIN_Y - 0.17, 1.6, 0.32, "main", 15, "Regular", INK if br else INK2, "left", mono=True)
        c.line([(LX0, MAIN_Y), (LX1, MAIN_Y)], br)
        c.text(LX0 + 0.75, MAIN_Y - 0.36, 4, 0.3, "the monolith, graded by another course", 13, "Regular",
               INK2 if br else INK3, "left")
        c.text(0.45, PLAT_Y - 0.17, 1.7, 0.32, "ass/platform", 15, "Regular", INK if br or "plat" in on else INK2,
               "left", mono=True)
        c.line([(LX0 + 0.25, MAIN_Y), (LX0 + 0.7, PLAT_Y)], br)
        c.line([(LX0 + 0.7, PLAT_Y), (LX1, PLAT_Y)], br or "plat" in on)
        c.text(LX0 + 0.75, PLAT_Y - 0.36, 3.5, 0.3, "this platform", 13, "Regular", INK2 if br else INK3, "left")
        c.text(0.45, MEM_Y - 0.17, 1.7, 0.32, "member branches", 13, "Medium", INK if "mem" in on else INK2, "left")
        for k, (x0, xm) in enumerate(MERGES):
            act = "mem" in on and k == 2
            c.line([(x0, MEM_Y), (xm - 0.35, MEM_Y), (xm, PLAT_Y)], act)
        for x0, xm in MERGES:
            c.d.ellipse([c._p(xm - 0.05), c._p(PLAT_Y - 0.05), c._p(xm + 0.05), c._p(PLAT_Y + 0.05)],
                        fill=INK2 if not br else INK)
        # the pipeline
        c.text(SX, 1.05, 4, 0.3, "GitHub Actions, on every push", 13, "Medium",
               INK if st["stage"] >= 0 else INK2, "left")
        c.line([(LX1, PLAT_Y), (7.05, PLAT_Y), (7.05, SYS[0] + SH / 2)], st["stage"] >= 0)
        c.arrow([(7.05, SYS[0] + SH / 2), (SX, SYS[0] + SH / 2)], st["stage"] >= 0)
        for k, (name, sub, mono) in enumerate(STAGES):
            y = SYS[k]
            state = "active" if st["stage"] == k else "idle"
            c.box(SX, y, SW, SH, "", state)
            c.text(SX + 0.18, y + 0.03, 2.5, 0.32, name, 15, "Medium", INK if state == "active" else INK2, "left")
            c.text(SX + 0.18, y + 0.32, 3.8, 0.28, sub, 13, "Regular", INK2 if state == "active" else INK3,
                   "left", mono=mono)
            if k in st["done"]:
                c.check(SX + SW - 0.4, y + 0.19, 0.26)
            if k < 3:
                c.arrow([(SX + 0.8, y + SH), (SX + 0.8, SYS[k + 1])], st["stage"] == k + 1)

    st = dict(on={"repo"}, stage=-1, done=set())
    sc = Scene("source.gif", paint, st)
    x0, xm = MERGES[2]
    sc.step("1. One monorepo holds the server, both apps and the chart", 2.8)
    sc.step("2. main is the monolith; ass/platform is this platform", 2.8, on={"branches"})
    sc.step("3. Each member works on a branch and merges it into ass/platform", 0.3, on={"mem"})
    sc.hop("lead", [(x0, MEM_Y), (xm - 0.35, MEM_Y), (xm, PLAT_Y)], 0.8)
    sc.set(on={"mem", "plat"})
    sc.hold(2.2)
    sc.step("4. The push builds one image, tagged with the commit SHA", 0.3, on={"plat"}, stage=0)
    sc.hop("lead", [(xm, PLAT_Y), (LX1, PLAT_Y), (7.05, PLAT_Y), (7.05, SYS[0] + SH / 2),
                    (SX + 0.8, SYS[0] + SH / 2)], 0.9)
    sc.set(done={0})
    sc.hold(2.4)
    sc.step("5. No registry: the image goes over SSH, straight into k3s", 0.3, on=set(), stage=1)
    sc.hop("lead", [(SX + 0.8, SYS[0] + SH / 2), (SX + 0.8, SYS[1] + SH / 2)], 0.6)
    sc.set(done={0, 1})
    sc.hold(0.6)
    sc.set(stage=2)
    sc.hop("lead", [(SX + 0.8, SYS[1] + SH / 2), (SX + 0.8, SYS[2] + SH / 2)], 0.6)
    sc.set(done={0, 1, 2})
    sc.hold(2.2)
    sc.step("6. helm upgrade replaces the pods with the new image", 0.3, stage=3)
    sc.hop("lead", [(SX + 0.8, SYS[2] + SH / 2), (SX + 0.8, SYS[3] + SH / 2)], 0.6)
    sc.set(done={0, 1, 2, 3})
    sc.hold(2.8)
    sc.save()


SCENES = dict(hosting=hosting, persistence=persistence, sequence=sequence, source=source)
