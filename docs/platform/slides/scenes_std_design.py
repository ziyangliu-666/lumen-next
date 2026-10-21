"""The design slides of the redesigned deck, in standard notation.

- queues.gif (slide 3a): why AD-03 gives each level of the task tree its own queue.
- er.png (slide 4c): the main tables of report 3.2.3 as an ER diagram, one frame per context.
- sequence.gif (slide 4d): use case A of report 3.2.4 as a UML sequence diagram.

Every part is a plain box with its real name. A thing that moves is a word on a white tag.
"""
import os

from draw import BLACK, INK, INK2, INK3, RAISED, RULE, RULE2, Canvas, Scene, font, S, X2  # noqa: F401

import draw
from scenes_std import tag


# ---------------------------------------------------------------- shared drawing
def dashed(c, pts, color=INK2, pt=1.5, dash=0.08, gap=0.06):
    """A dashed polyline, in inches."""
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        n = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
        if n == 0:
            continue
        ux, uy = (x2 - x1) / n, (y2 - y1) / n
        d = 0.0
        while d < n:
            e = min(n, d + dash)
            c.d.line([(c._p(x1 + ux * d), c._p(y1 + uy * d)), (c._p(x1 + ux * e), c._p(y1 + uy * e))],
                     fill=color, width=c._lw(pt))
            d = e + gap


def width_of(text, size=13, weight="Regular", mono=False):
    return font(size, weight, mono).getlength(text) / (S * X2)


def head(c, x, y, ux, uy, color, pt=1.5):
    """An open UML arrowhead (two strokes) whose tip is (x, y), pointing along (ux, uy)."""
    L, Wd = 0.11, 0.06
    for s in (1, -1):
        c.d.line([(c._p(x), c._p(y)), (c._p(x - ux * L - uy * Wd * s), c._p(y - uy * L + ux * Wd * s))],
                 fill=color, width=c._lw(pt))


# ---------------------------------------------------------------- slide 4c: the ER diagram
ROW, HEAD_H, PAD = 0.21, 0.3, 0.06           # a column row, the table name row, the bottom pad


class Table:
    def __init__(self, name, cols, x, y, w=None):
        self.name, self.cols, self.x, self.y = name, cols, x, y
        mark = max(width_of(m, 13, "Medium") for m, _ in cols if m) if any(m for m, _ in cols) else 0
        self.mark = mark + 0.12 if mark else 0
        need = max([width_of(name, 14, "Semibold")] + [self.mark + width_of(n) for _, n in cols]) + 0.22
        self.w = w or need
        self.h = HEAD_H + len(cols) * ROW + PAD

    def row_y(self, name):
        """The middle of a column's row, for a connector that meets that column."""
        i = [n for _, n in self.cols].index(name)
        return self.y + HEAD_H + (i + 0.5) * ROW

    @property
    def r(self):
        return self.x + self.w

    @property
    def b(self):
        return self.y + self.h

    def draw(self, c):
        x, y, w, h = self.x, self.y, self.w, self.h
        c.d.rectangle([c._p(x), c._p(y), c._p(x + w), c._p(y + h)], fill=BLACK, outline=INK2, width=c._lw(1.5))
        c.d.rectangle([c._p(x), c._p(y), c._p(x + w), c._p(y + HEAD_H)], fill=RAISED, outline=INK2,
                      width=c._lw(1.5))
        c.text(x + 0.11, y, w - 0.2, HEAD_H, self.name, 14, "Semibold", INK, "left")
        for i, (m, n) in enumerate(self.cols):
            ry = y + HEAD_H + i * ROW + 0.02
            if m:
                c.text(x + 0.11, ry, self.mark, ROW, m, 13, "Medium", INK3, "left")
            c.text(x + 0.11 + self.mark, ry, w - self.mark - 0.2, ROW, n, 13, "Regular", INK if "PK" in m else INK2,
                   "left")


def crow(c, pts, dashed_line=False, color=INK2):
    """A one-to-many relationship: one bar at pts[0] (the one side), a crow's foot at pts[-1]."""
    if dashed_line:
        dashed(c, pts, color)
    else:
        c.line(pts, color=color)
    # the one side: a bar across the line, 0.1 in from the table edge
    (x1, y1), (x2, y2) = pts[0], pts[1]
    n = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
    ux, uy = (x2 - x1) / n, (y2 - y1) / n
    bx, by = x1 + ux * 0.1, y1 + uy * 0.1
    c.d.line([(c._p(bx - uy * 0.08), c._p(by + ux * 0.08)), (c._p(bx + uy * 0.08), c._p(by - ux * 0.08))],
             fill=color, width=c._lw(1.5))
    # the many side: three prongs that open onto the table edge
    (x1, y1), (x2, y2) = pts[-2], pts[-1]
    n = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
    ux, uy = (x2 - x1) / n, (y2 - y1) / n
    fx, fy = x2 - ux * 0.17, y2 - uy * 0.17
    for s in (-1, 1):
        c.d.line([(c._p(fx), c._p(fy)), (c._p(x2 - uy * 0.09 * s), c._p(y2 + ux * 0.09 * s))], fill=color,
                 width=c._lw(1.5))


def frame(c, x, y, w, h, name):
    c.d.rectangle([c._p(x), c._p(y), c._p(x + w), c._p(y + h)], outline=RULE, width=c._lw(1))
    c.text(x + 0.1, y + 0.02, 3, 0.26, name, 13, "Medium", INK3, "left")


def er():
    c = Canvas()
    T0 = 0.48                                  # the top of the tables in both top frames
    GAP = 0.42
    # identity, on the left, for both rows
    accounts = Table("accounts", [("PK", "id"), ("", "email"), ("", "display_name"), ("", "role")], 0.18, T0, 1.85)
    keys = Table("platform_api_keys", [("PK", "id"), ("FK", "account_id"), ("", "prefix"), ("", "key_hash"),
                                       ("", "scopes"), ("", "revoked_at")], 0.18, 1.98, 1.85)
    # project, the top row
    px = 2.38
    projects = Table("projects", [("PK", "id"), ("", "account_id"), ("", "title"), ("", "mode")], px, T0)
    findings = Table("findings", [("PK", "id"), ("FK", "project_id"), ("FK", "session_id"), ("FK", "task_id"),
                                  ("", "title")], 0, T0)
    agents = Table("platform_agents", [("PK", "id"), ("FK", "owner_account_id"), ("", "slug"), ("", "instructions"),
                                       ("", "withdrawn_at")], 0, T0)
    intents = Table("platform_question_intents", [("PK", "id"), ("", "account_id"), ("FK", "agent_id"),
                                                  ("", "question"), ("", "session_id")], 0, T0)
    # session and billing, the bottom row
    B0 = 2.45
    sessions = Table("sessions", [("PK", "id"), ("", "project_id"), ("", "account_id")], px, B0)
    tasks = Table("tasks", [("PK", "id"), ("FK", "session_id"), ("FK", "parent_id"), ("", "agent"), ("", "depth"),
                            ("", "status"), ("", "own_cost"), ("", "pending")], 0, B0)
    steps = Table("steps", [("PK FK", "task_id"), ("PK", "index"), ("", "kind"), ("", "text"), ("", "detail")], 0, B0)
    wallets = Table("billing_wallets", [("PK", "account_id"), ("", "cap")], 0, B0)
    ledger = Table("ledger_entries", [("PK", "id"), ("", "account_id"), ("FK", "task_id"), ("", "amount")], 0, 0)
    approvals = Table("billing_approvals", [("PK", "id"), ("", "account_id"), ("", "task_id"), ("", "attempt_id"),
                                            ("", "status"), ("", "resume_pending")], 0, B0)
    # the columns line up: findings over tasks
    findings.x = projects.r + GAP
    tasks.x = findings.x
    tasks.w = findings.w = max(tasks.w, findings.w)
    agents.x = findings.r + GAP
    intents.x = agents.r + GAP
    sessions.w = projects.w = max(sessions.w, projects.w)
    steps.x = tasks.r + GAP
    bx = steps.r + 0.1 + 0.15 + 0.1
    wallets.x = ledger.x = bx
    wallets.w = ledger.w = max(wallets.w, ledger.w)
    ledger.y = wallets.b + 0.16
    approvals.x = ledger.r + GAP

    # the frames, one per owning context
    frame(c, 0.08, 0.2, 2.05, keys.b + 0.1 - 0.2, "identity")
    top_b = max(t.b for t in (projects, findings, agents, intents)) + 0.08
    frame(c, 2.28, 0.2, intents.r + 0.1 - 2.28, top_b - 0.2, "project")
    low_b = max(tasks.b, ledger.b, approvals.b) + 0.08
    frame(c, 2.28, B0 - 0.28, steps.r + 0.1 - 2.28, low_b - B0 + 0.28, "session")
    frame(c, bx - 0.1, B0 - 0.28, approvals.r + 0.1 - (bx - 0.1), low_b - B0 + 0.28, "billing")

    # relationships: solid is a foreign key, dashed an id from another context
    crow(c, [(1.1, accounts.b), (1.1, keys.y)])
    y = projects.row_y("account_id")
    crow(c, [(accounts.r, y), (projects.x, y)], dashed_line=True)
    crow(c, [(1.75, accounts.y), (1.75, 0.1), (agents.x + 0.5, 0.1), (agents.x + 0.5, agents.y)])
    y = intents.row_y("agent_id")
    crow(c, [(agents.r, y), (intents.x, y)])
    y = findings.row_y("project_id")
    crow(c, [(projects.r, y), (findings.x, y)])
    crow(c, [(projects.x + 0.95, projects.b), (sessions.x + 0.95, sessions.y)], dashed_line=True)
    mid = (top_b + B0 - 0.28) / 2
    crow(c, [(sessions.r - 0.15, sessions.y), (sessions.r - 0.15, mid), (findings.x + 0.3, mid),
             (findings.x + 0.3, findings.b)])
    y = tasks.row_y("session_id")
    crow(c, [(sessions.r, y), (tasks.x, y)])
    crow(c, [(tasks.x + 0.95, tasks.y), (tasks.x + 0.95, findings.b)])
    y = steps.row_y("task_id")
    crow(c, [(tasks.r, y), (steps.x, y)])
    # parent_id: a task has many child tasks; the loop runs in the space under sessions
    ly1, ly2 = tasks.row_y("pending") - 0.42, tasks.row_y("pending")
    crow(c, [(tasks.x, ly1), (tasks.x - 0.22, ly1), (tasks.x - 0.22, ly2), (tasks.x, ly2)])
    yl = ledger.row_y("task_id")
    crow(c, [(tasks.r, yl), (ledger.x, yl)])

    for t in (accounts, keys, projects, findings, agents, intents, sessions, tasks, steps, wallets, ledger, approvals):
        t.draw(c)

    # the key to the lines, under identity
    ky = keys.b + 0.32
    c.line([(0.18, ky + 0.13), (0.55, ky + 0.13)], color=INK2)
    c.text(0.66, ky, 1.5, 0.26, "foreign key", 13, "Regular", INK2, "left")
    dashed(c, [(0.18, ky + 0.47), (0.55, ky + 0.47)])
    c.text(0.66, ky + 0.34, 1.5, 0.26, "id, no foreign key", 13, "Regular", INK2, "left")

    c.text(0.1, 4.68, 11.93, 0.28,
           "PostgreSQL 16  ·  money as numeric(12,6)  ·  RabbitMQ keeps turns in flight  ·  files on a 2Gi volume",
           13, "Regular", INK2, "left")
    c.frame().save(os.path.join(draw.OUT, "er.png"))
    print("er.png")


# ---------------------------------------------------------------- slide 4d: the sequence of use case A
def sequence():
    # The lifelines, left to right. PostgreSQL stands next to session, which is the only
    # service here that writes to it, so no message crosses an activation bar.
    NAMES = ["Watch\napp", "Traefik", "project\nservice", "session\nservice", "PostgreSQL", "RabbitMQ",
             "worker\nservice", "OpenAI\nAPI"]
    GAPS = [2.3, 1.0, 2.6, 1.35, 1.3, 1.1, 1.5]
    X = [0.5]
    for g in GAPS:
        X.append(X[-1] + g)
    A, B, C, D, E, F, G, H = range(8)
    HY, HH = 0.76, 0.54                         # the heads of the lifelines
    LIFE_END = 4.97
    BAR = 0.06                                 # half the width of an activation bar
    P = 0.26                                   # one message row
    r = {}
    y = 1.64
    for k in ("ask", "forward", "guard"):
        r[k] = y
        y += P
    y += 0.26                                  # the self call takes two rows
    for k in ("start", "publish", "accepted"):
        r[k] = y
        y += P
    loop_top = r["accepted"] + 0.08
    y = loop_top + 0.32
    for k in ("llm", "step", "insert"):
        r[k] = y
        y += P
    loop_bottom = r["insert"] + 0.1
    y = loop_bottom + 0.1                      # its words are left of the loop frame
    for k in ("get", "route", "answer"):
        r[k] = y
        y += P

    # (key, from, to, label, return?)
    MSG = [("ask", A, B, "POST /api/v1/questions", False),
           ("forward", B, C, "forward", False),
           ("guard", C, C, "key guard check", False),
           ("start", C, D, "POST /internal/directory/start", False),
           ("publish", D, F, "publish lumen.turns.0", False),
           ("accepted", C, A, "201 {sessionId}", True),
           ("consume", F, G, "consume", False),
           ("llm", G, H, "chat completion", False),
           ("step", G, D, "POST /internal/turns/:id/step", False),
           ("insert", D, E, "INSERT steps", False),
           ("get", A, B, "GET /api/v1/questions/:id", False),
           ("route", B, D, "forward", False),
           ("answer", D, A, "200 {status, answer, findings, cost}", True)]
    ROWS = dict(r, consume=r["accepted"])
    # activation bars: (lifeline, from, to, nested)
    BARS = [(A, r["ask"], r["accepted"], 0), (B, r["ask"], r["forward"] + 0.1, 0),
            (C, r["forward"], r["accepted"], 0), (C, r["guard"] + 0.14, r["guard"] + 0.24, 1),
            (D, r["start"], r["publish"] + 0.12, 0), (F, r["publish"], r["accepted"], 0),
            (G, r["accepted"], r["insert"] + 0.12, 0), (H, r["llm"], r["llm"] + 0.12, 0),
            (D, r["step"], r["insert"] + 0.12, 0), (E, r["insert"], r["insert"] + 0.12, 0),
            (A, r["get"], r["answer"], 0), (B, r["get"], r["route"] + 0.1, 0), (D, r["route"], r["answer"], 0)]

    def ends(fr, to):
        """The x where a message leaves its sender's bar and meets its receiver's bar."""
        d = 1 if X[to] > X[fr] else -1
        return X[fr] + d * BAR, X[to] - d * BAR

    def paint(c, st):
        clock = st["clock"]                    # how far down the diagram time has run
        for i, n in enumerate(NAMES):
            w = max(width_of(line, 14, "Semibold") for line in n.split("\n")) + 0.18
            lit = i in st["on"]
            c.d.rectangle([c._p(X[i] - w / 2), c._p(HY), c._p(X[i] + w / 2), c._p(HY + HH)],
                          fill=RAISED if lit else BLACK, outline=INK if lit else INK2, width=c._lw(1.5))
            c.text(X[i] - w / 2, HY, w, HH, n, 14, "Semibold", INK)
            dashed(c, [(X[i], HY + HH), (X[i], LIFE_END)], RULE, 1, 0.06, 0.05)
        if st["loop"]:
            lx0, lx1 = X[D] - 0.42, min(X[H] + 0.42, 12.13 - 0.06)
            c.d.rectangle([c._p(lx0), c._p(loop_top), c._p(lx1), c._p(loop_bottom)], outline=INK2,
                          width=c._lw(1))
            tw = width_of("loop", 13, "Semibold") + 0.2
            c.d.polygon([(c._p(lx0), c._p(loop_top)), (c._p(lx0 + tw + 0.08), c._p(loop_top)),
                         (c._p(lx0 + tw + 0.08), c._p(loop_top + 0.17)), (c._p(lx0 + tw), c._p(loop_top + 0.26)),
                         (c._p(lx0), c._p(loop_top + 0.26))], outline=INK2, fill=BLACK)
            c.d.line([(c._p(lx0 + tw + 0.08), c._p(loop_top)), (c._p(lx0 + tw + 0.08), c._p(loop_top + 0.17)),
                      (c._p(lx0 + tw), c._p(loop_top + 0.26)), (c._p(lx0), c._p(loop_top + 0.26))],
                     fill=INK2, width=c._lw(1))
            c.text(lx0 + 0.08, loop_top + 0.01, tw, 0.24, "loop", 13, "Semibold", INK, "left")
            c.text(lx0 + tw + 0.18, loop_top + 0.01, 2, 0.24, "[each step]", 13, "Regular", INK2, "left")
        for i, y0, y1, nest in BARS:
            if y0 > clock:
                continue
            y1 = min(y1, clock)
            x = X[i] + nest * 0.07
            c.d.rectangle([c._p(x - BAR), c._p(y0), c._p(x + BAR), c._p(max(y1, y0 + 0.02))], fill=RAISED,
                          outline=INK2, width=c._lw(1))
        for key, fr, to, label, ret in MSG:
            if key not in st["shown"]:
                continue
            u = st["shown"][key]
            now = key in st["now"]
            col = INK if now else INK2
            y = ROWS[key]
            if fr == to:                       # a call to itself
                x0 = X[fr] + BAR
                pts = [(x0, y), (x0 + 0.32, y), (x0 + 0.32, y + 0.14), (x0 + 0.07 + 0.01, y + 0.14)]
                part = [pts[0]]
                for k in range(1, 4):
                    if u * 3 >= k:
                        part.append(pts[k])
                    else:
                        a, b = pts[k - 1], pts[k]
                        f = u * 3 - (k - 1)
                        part.append((a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f))
                        break
                c.line(part, color=col)
                if u >= 1:
                    c.arrow(pts[-2:], color=col)
                    c.text(x0 + 0.42, y - 0.11, 2, 0.22, label, 13, "Regular", col, "left")
                continue
            x0, x1 = ends(fr, to)
            xe = x0 + (x1 - x0) * u
            if ret:
                dashed(c, [(x0, y), (xe, y)], col)
                if u >= 1:
                    head(c, x1, y, -1 if x1 < x0 else 1, 0, col)
            else:
                c.line([(x0, y), (xe, y)], color=col)
                if u >= 1:
                    c.arrow([(x0, y), (x1, y)], color=col)
            if u >= 1:
                tw = width_of(label)
                lx = max(min(x0, x1) + 0.08, (x0 + x1) / 2 - tw / 2)
                # a black ground under the words, so a lifeline it crosses stops short of them
                c.d.rectangle([c._p(lx - 0.05), c._p(y - 0.235), c._p(lx + tw + 0.05), c._p(y - 0.04)], fill=BLACK)
                c.text(lx, y - 0.25, tw, 0.22, label, 13, "Regular", col, "left")

    st = dict(clock=0.0, shown={}, now=set(), on=set(), loop=False)
    sc = Scene("sequence.gif", paint, st)

    def send(*keys, seconds=0.55, hold=0.5):
        rows = {k: dict((m[0], m) for m in MSG)[k] for k in keys}
        st["now"] = set(keys)
        st["on"] = {i for k in keys for i in rows[k][1:3]}
        start = st["clock"]
        target = max(ROWS[k] for k in keys) + (0.24 if "guard" in keys else 0.0)
        sc.tween(seconds, lambda u: st.update(clock=start + (max(start, target) - start) * u,
                                              shown=dict(st["shown"], **{k: u for k in keys})))
        sc.hold(hold)

    sc.step("Use case A: ask a question with a chosen agent", 2.0)
    sc.step("1. The watch app sends the question with its API key", 0.3)
    send("ask")
    send("forward")
    sc.title = "2. Project checks the key, then opens a session"
    send("guard", seconds=0.7)
    send("start", hold=0.7)
    sc.title = "3. Session puts the root turn on lumen.turns.0"
    send("publish", hold=0.9)
    sc.title = "4. The app gets 201, and a worker takes the turn"
    send("accepted", "consume", hold=1.2)
    sc.title = "5. For each step, the worker calls the model and reports the step"
    sc.set(loop=True)
    sc.hold(0.4)
    send("llm")
    send("step", seconds=0.7)
    send("insert", hold=0.9)
    sc.title = "6. The app reads the answer"
    send("get")
    send("route")
    send("answer", seconds=0.8, hold=1.0)
    sc.step("On the public host: the answer in 4.9 s, for USD 0.01", 3.5, now=set(), on=set(), clock=LIFE_END)
    sc.save()


# ---------------------------------------------------------------- slide 3a: one queue per level (AD-03)
def queues():
    CELL, QH, N = 0.88, 0.42, 6
    TQX, TY = 0.3, 1.83                        # the shared queue: left edge, middle of its row
    TQR = TQX + N * CELL
    BQX, BY = 1.62, [3.62, 4.12, 4.62]         # the three queues of the lower half
    BQR = BQX + N * CELL
    GX, COLW, COLGAP = 7.3, 1.85, 0.3          # the two workers, one column each
    SLOTW = 0.95
    BLOCKX = 2.75
    TOPBOX, BOTBOX = (1.28, 2.1), (3.1, 4.9)

    def col(j):
        return GX + j * (COLW + COLGAP)

    def slot(j, y):
        return col(j) + COLW / 2, y

    def cell(right, i, y):
        """The middle of the i-th cell from the queue's head (its right end)."""
        return right - (i + 0.5) * CELL, y

    def draw_queue(c, x, y, items):
        c.d.rectangle([c._p(x), c._p(y - QH / 2), c._p(x + N * CELL), c._p(y + QH / 2)], outline=INK2,
                      width=c._lw(1.5))
        for k in range(1, N):
            xx = x + k * CELL
            c.d.line([(c._p(xx), c._p(y - QH / 2)), (c._p(xx), c._p(y + QH / 2))], fill=RULE, width=c._lw(1))
        for i, word in enumerate(items):
            if word:
                tag(c, *cell(x + N * CELL, i, y), word)

    def draw_workers(c, top, bottom, rows, slots):
        for j in range(2):
            x = col(j)
            c.d.rectangle([c._p(x), c._p(top), c._p(x + COLW), c._p(bottom)], outline=INK2, width=c._lw(1.5))
            c.text(x, top + 0.03, COLW, 0.26, "worker %d" % (j + 1), 14, "Semibold", INK)
            for r, y in enumerate(rows):
                sx = x + (COLW - SLOTW) / 2
                c.d.rectangle([c._p(sx), c._p(y - QH / 2), c._p(sx + SLOTW), c._p(y + QH / 2)], outline=RULE,
                              width=c._lw(1))
                if slots[j][r]:
                    tag(c, *slot(j, y), slots[j][r])

    def paint(c, st):
        # the upper half: one shared queue
        c.text(0.3, 0.9, 3, 0.36, "one shared queue", 15, "Semibold", INK, "left")
        if st["deadlock"]:
            c.invert(BLOCKX, 0.88, "deadlock", 16, h=0.4)
        draw_queue(c, TQX, TY, st["tq"])
        c.arrow([(TQR, TY), (GX, TY)], color=INK2)
        draw_workers(c, *TOPBOX, [TY], st["tslots"])
        if st["nofree"]:
            c.text(TQX, TY + QH / 2 + 0.08, TQR - TQX, 0.26, "no free worker", 13, "Regular", INK, "right")
        for j in range(2):
            if st["waiting"][j]:
                c.text(col(j), TOPBOX[1] + 0.06, COLW, 0.26, "waiting for its readers", 13, "Regular", INK)
        c.line([(0.3, 2.6), (11.83, 2.6)], color=RULE2, pt=1)
        # the lower half: a queue for each level
        c.text(0.3, 2.72, 3, 0.36, "a queue for each level", 15, "Semibold", INK, "left")
        if st["finish"]:
            c.invert(BLOCKX, 2.7, "all questions finish", 16, h=0.4)
        for r, y in enumerate(BY):
            c.text(0.3, y - 0.13, BQX - 0.42, 0.26, "lumen.turns.%d" % r, 13, "Regular", INK2, "right")
            draw_queue(c, BQX, y, st["bq"][r])
            c.arrow([(BQR, y), (GX, y)], color=INK2)
        draw_workers(c, *BOTBOX, BY, st["bslots"])
        for x, y, word in st["moving"]:
            tag(c, x, y, word)

    st = dict(tq=[], tslots=[[None], [None]], bq=[[], [], []], bslots=[[None] * 3, [None] * 3], moving=[],
              deadlock=False, nofree=False, waiting=[False, False], finish=False)
    sc = Scene("queues.gif", paint, st)

    def glide(moves, seconds=0.7):
        """Tags move in straight lines: moves are (word, (x0, y0), (x1, y1))."""
        sc.tween(seconds, lambda u: st.update(moving=[(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, w)
                                                     for w, a, b in moves]))
        st["moving"] = []

    def arrive(q, right, y, words, seconds=0.9):
        """New turns enter a queue from its left end and run to the free cells nearest the head."""
        start = len(q)
        moves = [(w, (right - N * CELL - 0.5, y), cell(right, start + k, y)) for k, w in enumerate(words)]
        glide(moves, seconds)
        q.extend(words)

    def shift(q, right, y, seconds=0.35):
        """The queue moves up by one cell after its head is taken."""
        moves = [(w, cell(right, i + 1, y), cell(right, i, y)) for i, w in enumerate(q)]
        q[:] = []
        glide(moves, seconds)
        q.extend(w for w, _, _ in moves)

    def take(q, right, y, slots, j, r, sy):
        word = q.pop(0)
        glide([(word, cell(right, 0, y), slot(j, sy))], 0.6)
        slots[j][r] = word
        if q:
            shift(q, right, y)

    sc.step("AD-03: why each level of the task tree has its own queue", 2.0)
    # the upper half
    sc.step("One shared queue: two questions put two lead turns on it", 0.2)
    arrive(st["tq"], TQR, TY, ["lead", "lead"])
    sc.hold(0.6)
    sc.title = "Each worker has one slot, and each takes a lead"
    take(st["tq"], TQR, TY, st["tslots"], 1, 0, TY)
    take(st["tq"], TQR, TY, st["tslots"], 0, 0, TY)
    sc.hold(0.8)
    sc.title = "Each lead delegates three readers, and keeps its slot while it waits"
    sc.set(waiting=[True, True])
    arrive(st["tq"], TQR, TY, ["reader"] * 6, 1.2)
    sc.hold(1.4)
    sc.title = "The readers wait for a slot that never frees"
    sc.set(nofree=True)
    sc.hold(1.2)
    sc.set(deadlock=True)
    sc.hold(1.8)
    # the lower half
    sc.step("A queue for each level: each worker has a slot per level", 0.2)
    arrive(st["bq"][0], BQR, BY[0], ["lead", "lead"])
    take(st["bq"][0], BQR, BY[0], st["bslots"], 1, 0, BY[0])
    take(st["bq"][0], BQR, BY[0], st["bslots"], 0, 0, BY[0])
    sc.hold(0.5)
    sc.title = "The leads wait in their slots; the readers go on lumen.turns.1"
    arrive(st["bq"][1], BQR, BY[1], ["reader"] * 6, 1.2)
    sc.hold(0.8)
    for k in range(3):
        sc.title = "The readers run in the reader slots: %d of 6 done" % (2 * k)
        take(st["bq"][1], BQR, BY[1], st["bslots"], 1, 1, BY[1])
        take(st["bq"][1], BQR, BY[1], st["bslots"], 0, 1, BY[1])
        sc.hold(0.6)
        st["bslots"][0][1] = st["bslots"][1][1] = None
    sc.title = "The readers run in the reader slots: 6 of 6 done"
    sc.hold(0.8)
    sc.title = "The leads write their answers, and every question finishes"
    sc.hold(0.6)
    st["bslots"][0][0] = st["bslots"][1][0] = None
    sc.set(finish=True)
    sc.hold(1.6)
    sc.step("lumen.turns.2 stays empty: readers do not delegate", 2.6)
    sc.save()


SCENES = dict(queues=queues, er=er, sequence=sequence)
