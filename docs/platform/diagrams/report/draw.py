"""Draws the report diagrams as HTML (inline SVG) and renders each to PNG.

    python3 docs/platform/diagrams/report/draw.py            # all
    python3 docs/platform/diagrams/report/draw.py logical    # some

Each diagram is a function that returns a kit.Diagram. The names in the
diagrams are the names in the code: services, queues, tables and routes.
PNG export: node /tmp/rpt/tools/svg2png.js <html> <png> 3 (Playwright).
"""
import os
import subprocess
import sys

import kit
from kit import (ACCENT, INK, LINK, MONO, MUTED, SANS, SOFT, Diagram, acc, ink, mono_w)

HERE = os.path.dirname(os.path.abspath(__file__))
SVG2PNG = os.environ.get("SVG2PNG", "/tmp/rpt/tools/svg2png.js")


# ---------------------------------------------------------------- 3.1 logical
def logical():
    kit.use(13)
    d = Diagram("logical", "Logical architecture of the Lumen platform",
                "Traefik routes requests to five services; session puts turns on RabbitMQ, workers take them, "
                "report each step back to session, and every service keeps its tables in one PostgreSQL database.",
                720, 560)
    # entry
    d.route([(360, 14), (360, 56)], LINK)
    d.label(372, 30, "HTTPS 443 from clients", LINK, anchor="start")
    d.node(20, 56, 680, 48, "Traefik ingress", "TLS · HTTP to HTTPS · path routing · /api/auth rate limit", "edge")
    xs = [20, 162, 304, 446, 588]
    names = [("identity", "HPA 1–3"), ("project", "HPA 1–3"), ("session", "1 replica"),
             ("worker", "KEDA 1–4"), ("billing", "HPA 1–3")]
    for x, (n, s) in zip(xs, names):
        cx = x + 56 + (0 if n != "worker" else 0)
        port = cx if n not in ("session", "worker") else cx
        d.route([(port, 104), (port, 160)])
    # worker reports each step to session (the only writer)
    d.route([(470, 160), (470, 136), (392, 136), (392, 160)], ACCENT, width=1.4)
    d.label(431, 124, "report step", ACCENT)
    # queues
    d.route([(384, 220), (384, 300)])
    d.label(392, 252, "publish", anchor="start")
    d.route([(468, 300), (468, 220)])
    d.label(432, 282, "consume")
    # model calls
    d.route([(534, 220), (534, 340), (548, 340)], LINK)
    d.label(566, 268, "https", LINK)
    # database
    for x in (76, 218, 326, 500, 686):
        d.route([(x, 220), (x, 420)], MUTED, dashed=True)
    d.label(272, 392, "own tables")
    for x, (n, s) in zip(xs, names):
        d.node(x, 160, 112, 60, n, s, "svc", "focal" if n == "session" else "backend")
    d.node(328, 300, 164, 72, "RabbitMQ", "lumen.turns.0, 1, 2\nlumen.steers", "queue", "store")
    d.node(548, 312, 136, 60, "OpenAI API", "gpt-4.1-mini", "ext", "external")
    d.node(20, 420, 680, 48, "PostgreSQL 16", "one database · tables grouped by module", "store", "store")
    d.legend(500, [("muted", "internal call"), ("dashed", "SQL"), ("link", "HTTPS"), ("accent", "step report to session")])
    return d


# ---------------------------------------------------------------- 3.1.4 context map
def contextmap():
    kit.use(13)
    d = Diagram("contextmap", "Bounded contexts and domain events",
                "Five bounded contexts with session as the core domain; the arrows are the domain events "
                "that pass between the contexts.", 720, 420)
    # Project <-> Session
    d.route([(160, 96), (300, 96), (300, 148)])
    d.label(228, 84, "question asked")
    d.route([(282, 148), (282, 124), (160, 124)])
    d.label(214, 138, "finding")
    # Identity -> Session (upstream)
    d.route([(160, 300), (300, 300), (300, 236)], MUTED, dashed=True)
    d.label(222, 314, "principal")
    # Session <-> Worker
    d.route([(420, 148), (420, 90), (560, 90)])
    d.label(492, 78, "turn queued")
    d.route([(560, 130), (438, 130), (438, 148)], ACCENT, width=1.4)
    d.label(500, 111, "step recorded", ACCENT)
    # Session <-> Billing
    d.route([(420, 236), (420, 300), (560, 300)])
    d.label(492, 314, "spend recorded")
    d.route([(560, 272), (438, 272), (438, 236)])
    d.label(500, 258, "approval")
    d.node(4, 68, 156, 72, "Project", "projects, findings\nagent registry", "context")
    d.node(4, 268, 156, 60, "Identity", "accounts, API keys", "context")
    d.node(250, 148, 220, 88, "Session", "call tree of tasks\nsteps, never changed", "core domain", "focal")
    d.node(560, 68, 156, 72, "Worker", "agent loop\nno saved state", "context")
    d.node(560, 252, 156, 76, "Billing", "budget cap, ledger\napprovals", "context")
    d.legend(356, [("muted", "domain event"), ("dashed", "upstream"), ("accent", "the step record"),
                   ("focal", "core domain")])
    return d


# ---------------------------------------------------------------- 3.2 deployment
def deployment():
    kit.use(11)
    d = Diagram("deployment", "Deployment of the Lumen platform on one node",
                "One Vultr VM in Singapore runs k3s; the namespace lumen holds the five service Deployments and the "
                "PostgreSQL and RabbitMQ StatefulSets; clients reach Traefik on 443 and GitHub Actions deploys over SSH.",
                800, 520)
    d.zone(180, 36, 540, 408, "«device» Vultr vc2-2c-4gb · Singapore · 2 vCPU · 4 GB", ACCENT, acc(0.03))
    d.zone(380, 64, 320, 244, "namespace lumen")
    # paths
    d.route([(156, 112), (220, 112)], LINK)
    d.label(184, 98, "443", LINK)
    d.route([(348, 112), (400, 112)])
    d.route([(156, 372), (300, 372), (300, 264), (400, 264)], LINK)
    d.label(222, 360, "ssh 22 · helm", LINK)
    d.route([(470, 296), (470, 336)])
    d.label(516, 316, "sql · amqp")
    d.route([(640, 336), (640, 296)])
    d.label(674, 324, "scales")
    d.route([(688, 182), (790, 182)], LINK)
    d.label(740, 170, "openai api", LINK)
    # nodes
    d.node(8, 80, 148, 64, "Clients", "browser, watch app\nAPI clients", "user", "input")
    d.node(8, 340, 148, 64, "GitHub Actions", "platform-deploy.yml", "ci", "external")
    d.node(220, 80, 128, 64, "Traefik", "ingress · TLS\nLet's Encrypt", "k3s")
    d.node(400, 80, 288, 216, "Deployments", "", "pod", name_y=110, align="start")
    rows = [("identity", "x1–3 HPA"), ("project", "x1–3 HPA"), ("session", "x1"), ("worker", "x1–4 KEDA"), ("billing", "x1–3 HPA")]
    for i, (n, t) in enumerate(rows):
        d.chip(412, 124 + i * 32, 264, n, t)
    d.node(400, 336, 160, 96, "StatefulSets", "", "pod", name_y=366, align="start")
    d.chip(412, 376, 136, "postgres-0", "2 Gi")
    d.chip(412, 404, 136, "rabbitmq-0", "1 Gi")
    d.node(576, 336, 112, 96, "Add-ons", "", "k3s", name_y=366, align="start")
    d.chip(588, 376, 88, "KEDA")
    d.chip(588, 404, 88, "cert-mgr")
    d.legend(464, [("link", "crosses the VM boundary"), ("muted", "inside the cluster"), ("focal", "the one node")])
    return d


# ---------------------------------------------------------------- 3.2.1 cost chart
def cost():
    kit.use(11.5)
    d = Diagram("cost", "Hosting cost per day: one node against a minimal EKS cluster",
                "Horizontal bar chart: one Vultr VM costs USD 0.65 a day, one EC2 t3.medium USD 1.45 and a "
                "three-node EKS cluster USD 7.36, at list prices in Singapore.", 640, 250)
    rows = [("Vultr vc2-2c-4gb, one VM", "since 25 Oct", 0.65, True),
            ("EC2 t3.medium, one VM", "20 to 24 Oct", 1.45, False),
            ("EKS, 3 × t3.medium + NLB", "not built", 7.36, False)]
    x0, x1 = 236, 420
    vmax = 8.0
    for v in (0, 2, 4, 6, 8):
        x = x0 + (x1 - x0) * v / vmax
        d.raw("bg", '<line x1="%s" y1="28" x2="%s" y2="178" stroke="%s" stroke-width="0.8"/>' % (x, x, ink(0.08) if v else ink(0.25)))
        d.text(x, 196, "%d" % v, kit.SUB, MUTED, MONO, "middle")
    d.text((x0 + x1) / 2, 216, "US DOLLARS A DAY, LIST PRICE", kit.TAG, MUTED, MONO, "middle", track=0.14)
    for i, (n, s, v, focal) in enumerate(rows):
        y = 40 + i * 48
        w = (x1 - x0) * v / vmax
        d.raw("nodes", '<rect x="%s" y="%s" width="%.1f" height="28" fill="%s" stroke="%s" stroke-width="1"/>'
              % (x0, y, w, acc(0.12) if focal else "rgba(79,93,117,0.15)", ACCENT if focal else MUTED))
        d.text(x0 - 12, y + 13, n, kit.NAME, INK, SANS, "end", 600)
        d.text(x0 - 12, y + 28, s, kit.SUB, MUTED, MONO, "end")
        d.text(x0 + w + 8, y + 18, "%.2f  ·  about %d a month" % (v, round(v * 30.4)), kit.SUB, ACCENT if focal else MUTED, MONO)
    return d


# ---------------------------------------------------------------- 3.2.3 ER
def er():
    kit.use(13.5)
    d = Diagram("er", "Logical data model: the main tables",
                "Entity-relationship diagram of the main PostgreSQL tables: accounts own projects and agents, a project "
                "has sessions, a session has a tree of tasks, and a task has steps, ledger entries and approvals.",
                740, 540)

    def ent(x, y, w, name, owner, fields, focal=False):
        h = 30 + len(fields) * 19 + 6
        n = d.layers["nodes"]
        n.append('<rect x="%s" y="%s" width="%s" height="%s" rx="6" fill="#ffffff"/>' % (x, y, w, h))
        n.append('<rect x="%s" y="%s" width="%s" height="%s" rx="6" fill="%s" stroke="%s" stroke-width="1"/>'
                 % (x, y, w, h, acc(0.08) if focal else "#ffffff", ACCENT if focal else INK))
        n.append('<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="0.8"/>' % (x, y + 26, x + w, y + 26, acc(0.4) if focal else ink(0.2)))
        n.append('<text x="%s" y="%s" fill="%s" font-size="%s" font-weight="600" font-family="%s">%s</text>' % (x + 10, y + 18, INK, kit.NAME, SANS, name))
        n.append('<text x="%s" y="%s" fill="%s" font-size="%s" font-family="%s" text-anchor="end" letter-spacing="0.04em">%s</text>'
                 % (x + w - 8, y + 47, ACCENT if focal else SOFT, kit.TAG, MONO, owner.upper()))
        for i, f in enumerate(fields):
            n.append('<text x="%s" y="%s" fill="%s" font-size="%s" font-family="%s">%s</text>' % (x + 10, y + 47 + i * 19, MUTED, kit.SUB, MONO, f))
        return h

    def card(x, y, t):
        d.text(x, y, t, kit.LABEL, SOFT, MONO, "middle", layer="top")

    # relationships first
    d.route([(190, 70), (250, 70)], MUTED, marker=None)
    card(200, 64, "1"); card(240, 64, "N")
    d.route([(105, 124), (105, 220)], MUTED, marker=None)
    card(97, 152, "1"); card(97, 212, "N")
    d.route([(335, 124), (335, 220)], MUTED, marker=None)
    card(327, 152, "1"); card(327, 212, "N")
    d.route([(420, 250), (480, 250)], MUTED, marker=None)
    card(430, 244, "1"); card(470, 244, "N")
    d.route([(565, 124), (565, 220)], MUTED, marker=None)
    card(557, 212, "1"); card(557, 152, "N")
    d.route([(650, 244), (672, 244), (672, 292), (650, 292)], MUTED, marker=None)
    d.text(680, 272, "parent", kit.LABEL, SOFT, MONO, "start")
    d.route([(480, 344), (335, 344), (335, 412)], MUTED, marker=None)
    card(470, 338, "1"); card(327, 404, "N")
    d.route([(600, 370), (600, 412)], MUTED, marker=None)
    card(592, 388, "1"); card(592, 406, "N")
    ent(20, 40, 170, "accounts", "identity", ["# id", "email", "role"])
    ent(20, 220, 170, "platform_agents", "project", ["# id", "→ owner_account_id", "slug", "instructions"])
    ent(250, 40, 170, "projects", "project", ["# id", "→ account_id", "title"])
    ent(250, 220, 170, "sessions", "session", ["# id", "→ project_id", "→ account_id"])
    ent(480, 40, 170, "steps", "session", ["# id", "→ task_id", "kind, text"])
    ent(480, 220, 170, "tasks", "session", ["# id", "→ session_id", "→ parent_id", "depth, status", "own_cost", "pending (jsonb)"], True)
    ent(250, 412, 196, "ledger_entries", "billing", ["# id", "→ task_id", "amount numeric(12,6)"])
    ent(480, 412, 200, "billing_approvals", "billing", ["# id", "→ task_id, attempt_id", "status, resume_pending"])
    return d


# ---------------------------------------------------------------- sequences
class Seq:
    def __init__(self, d, xs, top, bottom):
        self.d, self.xs, self.top, self.bottom = d, xs, top, bottom

    def lifelines(self):
        for x in self.xs:
            self.d.raw("zones", '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="1" stroke-dasharray="3,3"/>'
                       % (x, self.top, x, self.bottom, ink(0.22)))

    def actors(self, names, focal=None, y=20):
        for i, (x, (n, s)) in enumerate(zip(self.xs, names)):
            w = max(112, int(len(n) * kit.NAME * 0.62 + 24) // 4 * 4)
            self.d.node(x - w / 2, y, w, 48, n, s, kind="focal" if i == focal else ("external" if s == "client" else "backend"))

    def act(self, i, y0, y1):
        x = self.xs[i]
        self.d.raw("arrows", '<rect x="%s" y="%s" width="8" height="%s" fill="%s" stroke="%s" stroke-width="0.8"/>'
                   % (x - 4, y0, y1 - y0, ink(0.06), MUTED))

    def msg(self, a, b, y, text, color=MUTED, dashed=False, open_=False, num=None, lx=None):
        xa, xb = self.xs[a], self.xs[b]
        off = 4 if b > a else -4
        xa2 = xa + (4 if b > a else -4)
        self.d.route([(xa2, y), (xb - off, y)], color, dashed, open_=open_)
        t = ("%d  %s" % (num, text)) if num else text
        cx = lx if lx is not None else (xa + xb) / 2
        self.d.label(cx, y - 11, t, SOFT if color == MUTED else color, upper=False)

    def self_(self, i, y, text, num=None, color=MUTED):
        x = self.xs[i] + 4
        self.d.route([(x, y), (x + 28, y), (x + 28, y + 18), (x + 4, y + 18)], color, r=4)
        t = ("%d  %s" % (num, text)) if num else text
        self.d.label(x + 36, y + 9, t, SOFT if color == MUTED else color, anchor="start", upper=False)

    def frame(self, x, y, w, h, op, guard):
        self.d.raw("zones", '<rect x="%s" y="%s" width="%s" height="%s" rx="4" fill="%s" stroke="%s" stroke-width="1"/>'
                   % (x, y, w, h, ink(0.02), ink(0.22)))
        self.d.raw("zones", '<rect x="%s" y="%s" width="44" height="16" rx="2" fill="#ffffff" stroke="%s" stroke-width="1"/>' % (x, y, ink(0.22)))
        self.d.text(x + 22, y + 12, op, kit.TAG, MUTED, MONO, "middle", layer="zones", track=0.12)
        self.d.text(x + 52, y + 12, guard, kit.LABEL, MUTED, MONO, layer="zones")


def seq_ask():
    kit.use(13)
    d = Diagram("seq-ask", "Ask a question with a chosen agent through the API",
                "Sequence diagram: the literature watch posts a question to project, project starts the session, "
                "session queues the root turn, a worker runs it and reports each step, and the app reads the answer.",
                700, 600)
    s = Seq(d, [70, 215, 360, 505, 640], 68, 560)
    s.lifelines()
    s.act(1, 100, 300)
    s.act(2, 160, 280)
    s.act(4, 324, 440)
    s.act(2, 340, 440)
    s.act(2, 480, 540)
    s.msg(0, 1, 100, "POST /api/v1/questions", LINK, num=1)
    s.self_(1, 116, "key guard · intent row", num=2)
    s.msg(1, 2, 160, "directory/start", num=3)
    s.self_(2, 176, "budget check: allow", num=4)
    s.msg(2, 3, 224, "lumen.turns.0", num=5)
    s.msg(2, 1, 280, "sessionId", dashed=True, num=6)
    s.msg(1, 0, 300, "201 {sessionId}", dashed=True, num=7)
    s.msg(3, 4, 324, "deliver turn", num=8)
    s.msg(4, 2, 360, "step · delegate · finding", num=9, lx=500)
    s.msg(4, 2, 420, "done", num=10, lx=500)
    s.msg(0, 2, 480, "GET /api/v1/questions/:id", LINK, num=11, lx=190)
    s.msg(2, 0, 540, "200 {answer, findings, cost}", ACCENT, dashed=True, num=12, lx=190)
    s.actors([("watch app", "client"), ("project", "service"), ("session", "kernel"), ("RabbitMQ", "broker"), ("worker", "agent loop")], focal=2)
    return d


def seq_approval():
    kit.use(13)
    d = Diagram("seq-approval", "A fan-out over the budget cap waits for the owner's approval",
                "Sequence diagram: the guard escalates a fan-out, the task waits, the owner grants the approval in "
                "billing, and the billing outbox resumes the task in session with the same attempt id.",
                700, 600)
    s = Seq(d, [80, 250, 440, 620], 68, 560)
    s.lifelines()
    s.act(2, 100, 196)
    s.act(1, 268, 316)
    s.act(2, 384, 520)
    s.msg(3, 2, 100, "delegate [readers]", num=1)
    s.self_(2, 116, "guard escalates", num=2)
    s.msg(2, 0, 168, "task waiting · /ws", dashed=True, open_=True, num=3, lx=165)
    s.msg(2, 3, 196, "WaitingForApproval", dashed=True, num=4)
    s.msg(3, 2, 228, "done (waiting) · ack", num=5)
    s.msg(0, 1, 268, "grant approval", num=6)
    s.self_(1, 280, "consumed · resume_pending", num=7)
    s.msg(1, 0, 316, "200", dashed=True, num=8)
    s.frame(200, 344, 290, 72, "LOOP", "[outbox · 30 s lease]")
    s.msg(1, 2, 384, "approvals/resume", num=9)
    s.self_(2, 432, "allow, same attempt", num=10)
    s.msg(2, 3, 484, "child turns", dashed=True, open_=True, num=11)
    s.msg(2, 1, 520, "200 resumed", ACCENT, dashed=True, num=12)
    s.actors([("Browser", "client"), ("billing", "service"), ("session", "kernel"), ("worker", "agent loop")], focal=2)
    return d


# ---------------------------------------------------------------- 4.1 load test
def loadtest():
    kit.use(13)
    d = Diagram("loadtest", "Load test of 20 October: queued turns and worker pods",
                "Two line charts on one time axis: the turns in the queues rose to 55 and fell to 0, and KEDA moved "
                "the worker pods from 1 to 4 and back to 1.", 700, 420)
    t = [0, 23, 35, 49, 61, 73, 121, 168, 179]
    q = [0, 20, 40, 49, 44, 55, 0, 0, 0]
    wk = [1, 1, 2, 3, 4, 4, 4, 2, 1]
    x0, x1 = 80, 660
    X = lambda s: x0 + (x1 - x0) * s / 180

    def axes(y0, y1, vmax, step, unit):
        for v in range(0, vmax + 1, step):
            y = y1 - (y1 - y0) * v / vmax
            d.raw("bg", '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="0.8"/>' % (x0, y, x1, y, ink(0.25) if v == 0 else ink(0.08)))
            d.text(x0 - 8, y + 3.5, str(v), kit.SUB, MUTED, MONO, "end")
        d.text(x0 - 8, y0 - 14, unit, kit.TAG, MUTED, MONO, "start", track=0.14)

    # top: turns in queues
    ya0, ya1 = 40, 190
    axes(ya0, ya1, 60, 20, "TURNS IN THE QUEUES (READY + UNACKED)")
    pts = " ".join("%.1f,%.1f" % (X(a), ya1 - (ya1 - ya0) * b / 60) for a, b in zip(t, q))
    d.raw("nodes", '<polyline points="%s" fill="none" stroke="%s" stroke-width="1.6"/>' % (pts, MUTED))
    for a, b in zip(t, q):
        d.raw("nodes", '<circle cx="%.1f" cy="%.1f" r="2.5" fill="%s"/>' % (X(a), ya1 - (ya1 - ya0) * b / 60, MUTED))
    # KEDA target
    d.text(X(73) + 8, ya1 - (ya1 - ya0) * 55 / 60 + 4, "55", kit.SUB, MUTED, MONO)
    # bottom: workers (step line)
    yb0, yb1 = 250, 340
    axes(yb0, yb1, 4, 1, "WORKER PODS")
    path = []
    for i, (a, b) in enumerate(zip(t, wk)):
        y = yb1 - (yb1 - yb0) * b / 4
        if i:
            path.append("%.1f,%.1f" % (X(a), path_y))
        path.append("%.1f,%.1f" % (X(a), y))
        path_y = y
    d.raw("nodes", '<polyline points="%s" fill="none" stroke="%s" stroke-width="2"/>' % (" ".join(path), ACCENT))
    d.text(X(61), yb0 - 6, "4 pods at 61 s", kit.SUB, ACCENT, MONO, "middle")
    d.text(X(179) - 8, yb1 - (yb1 - yb0) / 4 + 17, "1 pod", kit.SUB, ACCENT, MONO, "end")
    for s_ in (0, 30, 60, 90, 120, 150, 180):
        d.text(X(s_), 362, "%d" % s_, kit.SUB, MUTED, MONO, "middle")
    d.text((x0 + x1) / 2, 384, "SECONDS FROM 14:19:25 UTC", kit.TAG, MUTED, MONO, "middle", track=0.14)
    return d


# ---------------------------------------------------------------- 5.2 pipeline
def pipeline():
    kit.use(10)
    d = Diagram("pipeline", "The deploy pipeline, platform-deploy.yml",
                "Flow of the pipeline: a push starts verify, SCA and SAST in parallel; deploy builds, scans, copies and "
                "installs the image; DAST and the smoke load test the live host; summary reports every stage.",
                836, 330)
    d.route([(132, 124), (144, 124), (144, 60), (180, 60)], r=6)
    d.route([(132, 140), (180, 140)])
    d.route([(132, 156), (156, 156), (156, 220), (180, 220)], r=6)
    d.route([(308, 60), (320, 60), (320, 124), (344, 124)], r=6)
    d.route([(308, 140), (344, 140)])
    d.route([(308, 220), (332, 220), (332, 156), (344, 156)], r=6)
    d.route([(544, 124), (556, 124), (556, 92), (580, 92)], r=6)
    d.route([(544, 156), (568, 156), (568, 188), (580, 188)], r=6)
    d.route([(704, 92), (716, 92), (716, 132), (736, 132)], r=6)
    d.route([(704, 188), (716, 188), (716, 148), (736, 148)], r=6)
    d.node(20, 102, 112, 76, "push", "branch push\nor manual run", "trigger", "input")
    d.node(180, 26, 128, 68, "verify", "lint, types, tests\n5 min 05 s", "ci")
    d.node(180, 106, 128, 68, "SCA", "npm audit\n33 s", "ci")
    d.node(180, 186, 128, 68, "SAST", "CodeQL\n2 min 54 s", "ci")
    d.node(344, 72, 200, 140, "deploy", "docker build  2 min 50 s\nTrivy gate  25 s\nscp + k3s import  1 min 04 s\nhelm upgrade --wait  22 s\nhealth check", "cd", "focal")
    d.node(580, 58, 124, 68, "DAST", "OWASP ZAP\n1 min 40 s", "cd")
    d.node(580, 154, 124, 68, "smoke load", "k6, demo worker\n1 min 15 s", "cd", "optional")
    d.node(736, 112, 80, 56, "summary", "4 s")
    d.legend(272, [("muted", "needs"), ("focal", "the gate: a CRITICAL CVE with a fix stops the deploy"), ("external", "skipped in steering mode")])
    return d


# ---------------------------------------------------------------- 2.1 gantt
def gantt():
    kit.use(13)
    d = Diagram("gantt", "Schedule of the proposal, 8 to 21 October 2026",
                "Gantt chart of the eleven tasks of the work breakdown over ten working days, one owner for each task.",
                720, 520)
    days = ["8", "9", "12", "13", "14", "15", "16", "19", "20", "21"]
    tasks = [("1 Architecture, contracts", "LIU ZIYANG", 0, 3), ("2 Session and stream", "LIU ZIYANG", 3, 7),
             ("3 Identity, gateway auth", "LU YI", 0, 7), ("4 Public API, OpenAPI", "LU YI", 7, 3),
             ("5 Project, agent registry", "PENG XUJIAN", 0, 4), ("6 Literature watch, usage", "PENG XUJIAN", 4, 6),
             ("7 Worker, job queue", "LI ZHUOYANG", 0, 5), ("8 Model gateway, KEDA", "LI ZHUOYANG", 5, 5),
             ("9 Billing", "HE RONG", 0, 4), ("10 Kubernetes, Helm, pipeline", "HE RONG", 4, 3),
             ("11 Load tests", "HE RONG", 7, 3)]
    x0, x1 = 268, 704
    cw = (x1 - x0) / 10
    for i, dd in enumerate(days):
        x = x0 + i * cw
        d.raw("bg", '<line x1="%s" y1="36" x2="%s" y2="474" stroke="%s" stroke-width="0.8"/>' % (x, x, ink(0.08)))
        d.text(x + cw / 2, 28, dd, kit.SUB, MUTED, MONO, "middle")
    d.raw("bg", '<line x1="%s" y1="36" x2="%s" y2="474" stroke="%s" stroke-width="0.8"/>' % (x1, x1, ink(0.08)))
    d.text(x0 - 12, 28, "OCTOBER 2026", kit.TAG, MUTED, MONO, "end", track=0.14)
    for i, (n, o, s, l) in enumerate(tasks):
        y = 44 + i * 39
        focal = n.startswith("2 ")
        d.text(x0 - 12, y + 13, n, kit.NAME, INK, SANS, "end", 600)
        d.text(x0 - 12, y + 30, o, kit.SUB, MUTED, MONO, "end")
        d.raw("nodes", '<rect x="%.1f" y="%s" width="%.1f" height="24" rx="3" fill="%s" stroke="%s" stroke-width="1"/>'
              % (x0 + s * cw + 2, y + 4, l * cw - 4, acc(0.12) if focal else "rgba(79,93,117,0.15)", ACCENT if focal else MUTED))
        d.text(x0 + (s + l) * cw - 8, y + 21, "%d d" % l, kit.SUB, ACCENT if focal else MUTED, MONO, "end")
    d.text(x0, 500, "50 person-days in total; the session service is the longest task.", kit.SUB, MUTED, SANS)
    return d


ALL = dict(logical=logical, contextmap=contextmap, deployment=deployment, cost=cost, er=er, seq_ask=seq_ask,
           seq_approval=seq_approval, loadtest=loadtest, pipeline=pipeline, gantt=gantt)

if __name__ == "__main__":
    out = os.path.join(HERE, "..", "..", "report", "figures")
    os.makedirs(out, exist_ok=True)
    for key in sys.argv[1:] or ALL:
        dia = ALL[key]()
        path = os.path.join(HERE, key + ".html")
        with open(path, "w") as f:
            f.write(dia.html())
        png = os.path.join(out, "d-" + key + ".png")
        subprocess.run(["node", SVG2PNG, path, png, "3"], check=True)
        print("drew", key)
