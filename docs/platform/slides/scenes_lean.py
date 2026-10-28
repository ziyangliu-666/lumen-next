"""Three scenes for the lean deck: how the contexts were found, the schema, and the
project's milestones. Each one replaces a slide of words or a table with a picture."""
import os
import random

import draw
from draw import INK, INK2, INK3, RULE2, W, Scene, lerp
from icons import icon

COLS = [0.15 + i * 2.4 for i in range(5)]      # five columns, 2.2 wide, 0.2 apart
CW = 2.2


# ============================================================ how the contexts were found
def derive():
    CTX = [  # name, the words its users say, the aggregate, the service it became, its icon
        ("Identity", ["account", "key", "scope"], "Account", "identity", "key"),
        ("Projects", ["project", "agent", "finding"], "Project", "project", "folder"),
        ("Session", ["session", "task", "step"], "Task tree", "session", "stream"),
        ("Execution", ["reader", "tool", "sandbox"], "no state", "worker", "gear"),
        ("Billing", ["cap", "spend", "approval"], "Wallet", "billing", "wallet"),
    ]
    BY, BH = 1.3, 2.4                           # the context frames
    IY = 4.22                                   # the service icons, under the frames
    rnd = random.Random(4)
    spots = [(0.5 + (k % 5) * 2.3 + rnd.uniform(0, 0.5), 1.4 + (k // 5) * 0.95 + rnd.uniform(0, 0.3))
             for k in range(15)]
    rnd.shuffle(spots)
    words = []                                  # (word, scattered position, place in its group)
    for i, (_, ws, _, _, _) in enumerate(CTX):
        for j, w in enumerate(ws):
            words.append((w, spots.pop(), (COLS[i], BY + 0.5 + j * 0.36)))

    def paint(c, st):
        u = st["u"]
        for i, (name, _, agg, svc, kind) in enumerate(CTX):
            x = COLS[i]
            if st["boxes"]:
                c.box(x, BY, CW, BH, "", "idle")
                c.text(x, BY + 0.08, CW, 0.38, name, 17, "Medium", INK)
            if st["agg"]:
                if agg == "no state":
                    c.text(x, BY + 1.72, CW, 0.46, agg, 15, "Regular", INK3)
                else:
                    c.invert(x + CW / 2, BY + 1.72, agg, 15, h=0.46, align="center")
            if st["svc"]:
                # The context became a service: its icon, and the service's name under it.
                c.arrow([(x + CW / 2, BY + BH), (x + CW / 2, IY - 0.3)], True)
                icon(c, kind, x + CW / 2, IY, 0.5, lit=True)
                c.text(x, IY + 0.31, CW, 0.32, svc, 14, "Regular", INK, mono=True)
        for w, (sx, sy), (gx, gy) in words:
            x, y = lerp(sx, gx, u), lerp(sy, gy, u)
            c.text(x, y, CW, 0.34, w, 15, "Regular", INK if u < 1 else INK2)

    st = dict(u=0.0, boxes=False, agg=False, svc=False)
    sc = Scene("derive.gif", paint, st)
    sc.step("1. The words our users say, from the six use cases", 2.8)
    sc.title = "2. Words that belong together form a group"
    sc.tween(1.4, lambda u: st.update(u=u))
    sc.hold(1.6)
    sc.step("3. Each group is a bounded context", 2.6, boxes=True)
    sc.step("4. What one transaction keeps consistent is its aggregate", 2.8, agg=True)
    sc.step("5. Each context became one service", 3.0, svc=True)
    sc.save()


# ============================================================ the schema, by context
def schema():
    ROW, HEAD = 0.25, 0.36
    X = [0.15, 3.15, 6.35, 9.35]
    WD = [2.5, 2.7, 2.5, 2.6]
    NAME = ["Identity", "Projects", "Session", "Billing"]
    T = {  # table: (column, y, columns)
        "accounts": (0, 1.35, ["id", "email", "role"]),
        "platform_api_keys": (0, 2.75, ["account_id", "key_hash", "scopes"]),
        "projects": (1, 1.35, ["account_id", "title"]),
        "findings": (1, 2.5, ["session_id", "title"]),
        "platform_agents": (1, 3.9, ["slug", "instructions"]),
        "sessions": (2, 1.35, ["project_id", "account_id"]),
        "tasks": (2, 2.5, ["parent_id", "depth", "own_cost"]),
        "steps": (2, 3.9, ["task_id", "kind"]),
        "billing_wallets": (3, 1.35, ["account_id", "cap"]),
        "ledger_entries": (3, 2.5, ["task_id", "amount"]),
        "billing_approvals": (3, 3.65, ["task_id", "attempt_id", "status"]),
    }

    def hgt(t):
        return HEAD + ROW * len(T[t][2]) + 0.06

    LINKS = [  # (from table, to table, points)
        ("platform_api_keys", "accounts", [(1.4, 2.75), (1.4, 1.35 + hgt("accounts"))]),
        ("sessions", "projects", [(6.35, 1.81), (5.85, 1.81)]),
        ("findings", "sessions", [(5.85, 2.96), (6.1, 2.96), (6.1, 2.1), (6.35, 2.1)]),
        ("tasks", "sessions", [(7.6, 2.5), (7.6, 1.35 + hgt("sessions"))]),
        ("steps", "tasks", [(7.6, 3.9), (7.6, 2.5 + hgt("tasks"))]),
        ("ledger_entries", "tasks", [(9.35, 2.96), (8.85, 2.96)]),
        ("billing_approvals", "tasks", [(9.35, 4.2), (9.1, 4.2), (9.1, 3.4), (8.85, 3.4)]),
    ]

    def paint(c, st):
        shown, on, hot = st["shown"], st["on"], st["hot"]
        for i in range(4):
            if i in shown:
                c.text(X[i], 0.98, WD[i], 0.32, NAME[i], 15, "Medium", INK if i == on else INK2, "left")
        for a, b, pts in LINKS:
            if T[a][0] in shown and T[b][0] in shown:
                c.arrow(pts, on in (T[a][0], T[b][0]))
        for t, (col, y, cols) in T.items():
            if col not in shown:
                continue
            x, w, h = X[col], WD[col], hgt(t)
            c.box(x, y, w, h, "", "active" if col == on else "idle")
            c.text(x + 0.12, y + 0.04, w, 0.3, t, 13, "Regular", INK if col == on else INK2, "left", mono=True)
            c.line([(x, y + HEAD), (x + w, y + HEAD)], color=RULE2)
            for j, name in enumerate(cols):
                color = INK if name in hot else (INK2 if col == on else INK3)
                c.text(x + 0.12, y + HEAD + j * ROW, w, ROW, name, 13, "Regular", color, "left")

    st = dict(shown=set(), on=None, hot=set())
    sc = Scene("schema.gif", paint, st)
    sc.step("1. Identity: accounts, and API keys kept only as a hash", 2.6, shown={0}, on=0, hot={"key_hash"})
    sc.step("2. Projects: projects, findings and published agents", 2.6, shown={0, 1}, on=1, hot=set())
    sc.step("3. Session: every task points to its parent, so the tree is SQL", 3.0, shown={0, 1, 2}, on=2,
            hot={"parent_id", "own_cost"})
    sc.step("4. Billing: money is numeric(12,6), and every total is a SUM in SQL", 3.0, shown={0, 1, 2, 3},
            on=3, hot={"amount", "cap"})
    sc.step("5. One PostgreSQL database; each context owns its tables", 3.0, on=None, hot=set())
    sc.save()


# ============================================================ the plan of the proposal, kept
def milestones():
    DAYS = [8, 9, 12, 13, 14, 15, 16, 19, 20, 21]  # the ten working days of the proposal
    PLAN = [  # member, then (task, first day, last day) as indexes into DAYS, from the proposal
        ("Liu Ziyang", [("architecture", 0, 2), ("session service", 3, 9)]),
        ("Lu Yi", [("identity, gateway", 0, 6), ("public API", 7, 9)]),
        ("Peng Xujian", [("projects", 0, 3), ("watch app, usage", 4, 9)]),
        ("Li Zhuoyang", [("worker, queue", 0, 4), ("worker autoscaling", 5, 9)]),
        ("He Rong", [("billing", 0, 3), ("Kubernetes, pipeline", 4, 6), ("load tests", 7, 9)]),
    ]
    LX, X0, X1, Y0, RH, BH = 0.3, 2.3, W - 0.3, 1.1, 0.58, 0.44
    DW = (X1 - X0) / len(DAYS)

    def paint(c, st):
        t = st["t"]                             # how far the plan has run, in days
        if 0 < t < len(DAYS):
            # The sweep is drawn first, so a lit bar covers it: it never runs over a label.
            x = X0 + t * DW
            c.line([(x, Y0 - 0.15), (x, Y0 + 5 * RH - 0.1)], True)
        for i, d in enumerate(DAYS):
            c.text(X0 + i * DW, Y0 + 5 * RH + 0.05, DW, 0.3, str(d), 13, "Regular", INK2 if i < t else INK3)
        c.text(LX, Y0 + 5 * RH + 0.05, X0 - LX - 0.15, 0.3, "October 2026", 13, "Regular", INK3, "right")
        c.text(LX, Y0 - 0.38, X0 - LX - 0.15, 0.3, "effort", 13, "Regular", INK3, "right")
        for r, (who, tasks) in enumerate(PLAN):
            y = Y0 + r * RH
            c.text(LX, y, X0 - LX - 0.1, BH, who, 15, "Medium", INK, "left")
            c.text(LX, y, X0 - LX - 0.15, BH, "80 h", 14, "Regular", INK2, "right")
            for task, a, b in tasks:
                x, w = X0 + a * DW + 0.04, (b - a + 1) * DW - 0.08
                state = "done" if t > b + 0.999 else ("active" if t > a else "faint")
                c.box(x, y, w, BH, "", "active" if state == "active" else "idle")
                c.text(x + 0.12, y, w - 0.45, BH, task, 13, "Medium",
                       INK if state != "faint" else INK3, "left")
                if state == "done":
                    c.check(x + w - 0.3, y + 0.1, 0.22)

    st = dict(t=0.0)
    sc = Scene("milestones.gif", paint, st)
    sc.step("The proposal's plan: ten days for each member, 8 to 21 October", 7.5)
    sc.title = "The sweep: contracts, then the services, then scale and the pipeline"
    # The sweep moves at one constant speed, about 400 px a second: an eased sweep
    # crawled over the labels and the check marks for a second at each end.
    n = round(14.5 * draw.FPS)
    for i in range(n + 1):
        st["t"] = i / n * len(DAYS)
        sc._add(sc._draw(), round(1000 / draw.FPS))
    sc.step("Every bar done; the platform runs on AWS", 3.0)
    sc.save()


def atwork():
    """Slide 2: the real run of 22 October (out/lumen-at-work.gif, 1310 x 540), made readable.

    The 32 px gutter at each side and the 34 px gap between the two panes are cut, and the rest
    is scaled by 1.4, so the call tree's 13 px text is about 18 px on the slide. The recording
    ends at 29.9 s, the last frame where the call tree shows all three readers: after it, the
    third finding pushes the tree below the bottom of the screenshot (checklist review)."""
    import shutil
    import subprocess
    from PIL import Image, ImageDraw
    src = Image.open(os.path.join(draw.OUT, "lumen-at-work.gif"))
    LEFT, RIGHT, LAST = (24, 728), (762, 1290), 216
    w = (LEFT[1] - LEFT[0]) + (RIGHT[1] - RIGHT[0])
    k = 1730 / w
    size = (1730, round(540 * k))
    frames, durs = [], []
    for i in range(LAST + 1):
        src.seek(i)
        f = src.convert("RGB")
        out = Image.new("RGB", (w, 540), (0, 0, 0))
        out.paste(f.crop((LEFT[0], 0, LEFT[1], 540)), (0, 0))
        out.paste(f.crop((RIGHT[0], 0, RIGHT[1], 540)), (LEFT[1] - LEFT[0], 0))
        ImageDraw.Draw(out).line([(LEFT[1] - LEFT[0], 52), (LEFT[1] - LEFT[0], 540)], fill=(69, 72, 76), width=1)
        frames.append(out.resize(size, Image.LANCZOS).convert("L"))
        durs.append(src.info.get("duration", 100))
    durs[-1] = 4000
    name = os.path.join(draw.OUT, "lumen-at-work-crop.gif")
    frames[0].save(name, save_all=True, append_images=frames[1:], duration=durs, disposal=1, optimize=False)
    if shutil.which("gifsicle"):
        subprocess.run(["gifsicle", "-b", "-O3", "--colors", "64", "--no-loopcount", name], check=True)
    print("lumen-at-work-crop.gif", len(frames), "frames", round(sum(durs) / 1000, 1), "s", size)


def _recut(name, crop, rows=None):
    """A terminal recording (out/rec-NAME.gif, agg at 22 px, 140 columns) cut for the slide.

    crop is (columns, rows) to keep from the top left: the empty right and bottom go, so the
    text is larger on the slide. rows maps a row to the column ranges kept in it, joined left
    to right: it removes columns that only carry internal names (branch, run and job ids)."""
    import shutil
    import subprocess
    from PIL import Image
    CW, RH, X0, Y0 = 13.2, 29.7, 13, 14       # agg's cell and its padding at font size 22
    src = Image.open(os.path.join(draw.OUT, "rec-%s.gif" % name))
    W_ = round(X0 + crop[0] * CW + X0)
    H_ = round(Y0 + crop[1] * RH + Y0 / 2)
    frames, durs = [], []
    for i in range(src.n_frames):
        src.seek(i)
        f = src.convert("RGB")
        out = Image.new("RGB", (W_, H_), (0, 0, 0))
        out.paste(f.crop((0, 0, W_, H_)), (0, 0))
        for r, segs in (rows or {}).items():
            y0, y1 = round(Y0 + r * RH), round(Y0 + (r + 1) * RH)
            band = Image.new("RGB", (W_, y1 - y0), (0, 0, 0))
            x = X0
            for a, b in segs:
                piece = f.crop((round(X0 + a * CW), y0, round(X0 + b * CW), y1))
                band.paste(piece, (round(x), 0))
                x += (b - a) * CW
            out.paste(band, (0, y0))
        frames.append(out)                      # RGB: the red X of a failed run stays red
        durs.append(src.info.get("duration", 100))
    path = os.path.join(draw.OUT, "rec-%s-cut.gif" % name)
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=durs, disposal=1, optimize=False)
    if shutil.which("gifsicle"):
        subprocess.run(["gifsicle", "-b", "-O3", "--colors", "32", "--no-loopcount", path], check=True)
    print("rec-%s-cut.gif" % name, len(frames), "frames", round(sum(durs) / 1000, 1), "s", (W_, H_))


def recpipeline():
    # rows 1 to 7: STATUS and TITLE, then ELAPSED (the workflow, branch, event, id and age go);
    # row 10 drops the branch name; rows 14 to 20 drop the job ids
    list_ = [(0, 49), (112, 121)]
    rows = {r: list_ for r in range(1, 8)}
    rows[10] = [(0, 2), (15, 46)]
    for r, cut in zip(range(14, 21), (25, 17, 32, 18, 31, 27, 16)):
        rows[r] = [(0, cut - 1)]
    _recut("pipeline", (64, 21), rows)


def recpods():
    _recut("pods", (110, 15))


def recscale():
    _recut("scale", (116, 14))


SCENES = dict(derive=derive, schema=schema, milestones=milestones, atwork=atwork, recpipeline=recpipeline,
              recpods=recpods, recscale=recscale)
