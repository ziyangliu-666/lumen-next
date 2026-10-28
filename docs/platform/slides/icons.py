"""Icons for the deck: a shape that says what a thing is, so a box of words is not needed.

Every icon is a crisp line drawing, like the icons of lumen's web app: one stroke width,
no fill except a mark that matters, square corners. It is centred on (cx, cy), and s is
its height in inches. An icon has two states: lit (white, 2 pt) when it acts now, and
quiet (grey) otherwise. A label goes under it, one or two short words.

    from icons import icon
    icon(c, "database", 3.0, 2.0, 0.7, lit=True, label="PostgreSQL")

`python3 icons.py` draws every icon into out/icons.png, to check them by eye.
"""
import math

import draw
from draw import BLACK, INK, INK2, INK3, RAISED, Canvas

KINDS = []


def _kind(fn):
    KINDS.append(fn.__name__[1:])
    return fn


class _Pen:
    """Draws in a unit box (0..1 on both axes) mapped onto the icon's square."""

    def __init__(self, c, cx, cy, s, color, pt, lit=False):
        self.c, self.x0, self.y0, self.s, self.col = c, cx - s / 2, cy - s / 2, s, color
        self.w = c._lw(pt)
        self.lit = lit
        self.t = draw.NOW + (cx * 0.37 + cy * 0.61)  # each icon on its own phase

    def wave(self, period, lo=0.0, hi=1.0):
        """A value that swings between lo and hi once a period (shorter when lit)."""
        if self.lit:
            period *= 0.5
        return lo + (hi - lo) * (0.5 - 0.5 * math.cos(2 * math.pi * self.t / period))

    def phase(self, period):
        """How far through its period the motion is, 0 to 1 (faster when lit)."""
        if self.lit:
            period *= 0.5
        return (self.t / period) % 1.0

    def erase(self, u0, v0, u1, v1):
        self.c.d.rectangle([*self.p(u0, v0), *self.p(u1, v1)], fill=BLACK)

    def p(self, u, v):
        return self.c._p(self.x0 + u * self.s), self.c._p(self.y0 + v * self.s)

    def line(self, *pts, fill=None):
        self.c.d.line([self.p(*q) for q in pts], fill=fill or self.col, width=self.w, joint="curve")

    def rect(self, u0, v0, u1, v1, fill=None):
        self.c.d.rectangle([*self.p(u0, v0), *self.p(u1, v1)], outline=self.col, width=self.w, fill=fill)

    def ellipse(self, u0, v0, u1, v1, fill=None, outline=True):
        self.c.d.ellipse([*self.p(u0, v0), *self.p(u1, v1)], outline=self.col if outline else None,
                         width=self.w if outline else 0, fill=fill)

    def arc(self, u0, v0, u1, v1, a0, a1):
        self.c.d.arc([*self.p(u0, v0), *self.p(u1, v1)], a0, a1, fill=self.col, width=self.w)

    def dot(self, u, v, r):
        self.ellipse(u - r, v - r, u + r, v + r, fill=self.col, outline=False)

    def poly(self, *pts, fill=None):
        self.c.d.polygon([self.p(*q) for q in pts], outline=self.col, fill=fill, width=self.w)

    def text(self, u, v, s, size, weight="Semibold", color=None):
        self.c.text(self.x0 + (u - 0.5) * self.s, self.y0 + (v - 0.5) * self.s, self.s, self.s, s, size, weight,
                    color or self.col)


# ---- people and clients
@_kind
def _person(p):
    p.ellipse(0.34, 0.08, 0.66, 0.4)
    p.arc(0.14, 0.5, 0.86, 1.22, 180, 360)
    p.line((0.14, 0.86), (0.86, 0.86))


@_kind
def _team(p):
    for dx in (-0.22, 0.22):
        p.ellipse(0.38 + dx, 0.14, 0.62 + dx, 0.38)
        p.arc(0.24 + dx, 0.5, 0.76 + dx, 1.06, 180, 360)
    p.line((0.02, 0.78), (0.98, 0.78))


@_kind
def _browser(p):
    p.rect(0.04, 0.14, 0.96, 0.86)
    p.line((0.04, 0.32), (0.96, 0.32))
    for u in (0.12, 0.2, 0.28):
        p.dot(u, 0.23, 0.025)


@_kind
def _app(p):
    """A program that uses the platform: a window with code brackets."""
    p.rect(0.08, 0.14, 0.92, 0.86)
    p.line((0.38, 0.36), (0.24, 0.5), (0.38, 0.64))
    p.line((0.62, 0.36), (0.76, 0.5), (0.62, 0.64))


# ---- the platform's parts
@_kind
def _gateway(p):
    """A gate: two posts and a lintel, a path through it."""
    p.rect(0.1, 0.12, 0.9, 0.24)
    p.line((0.2, 0.24), (0.2, 0.9))
    p.line((0.8, 0.24), (0.8, 0.9))
    p.line((0.36, 0.58), (0.64, 0.58))
    p.line((0.54, 0.48), (0.64, 0.58), (0.54, 0.68))


@_kind
def _server(p):
    for v in (0.1, 0.4, 0.7):
        p.rect(0.1, v, 0.9, v + 0.22)
        p.dot(0.22, v + 0.11, 0.03)
        p.line((0.5, v + 0.11), (0.78, v + 0.11))


@_kind
def _database(p):
    p.ellipse(0.12, 0.06, 0.88, 0.26)
    p.line((0.12, 0.16), (0.12, 0.84))
    p.line((0.88, 0.16), (0.88, 0.84))
    p.arc(0.12, 0.74, 0.88, 0.94, 0, 180)
    p.arc(0.12, 0.4, 0.88, 0.6, 0, 180)


@_kind
def _gear(p, turn=0.0):
    """A worker: a gear, because it does the work. turn: how far it has turned, in teeth."""
    n, r0, r1 = 8, 0.3, 0.42
    pts = []
    for k in range(n * 2):
        a = math.pi * (k + 2 * turn) / n
        r = r1 if k % 2 == 0 else r0
        for da in (-0.17, 0.17):
            pts.append((0.5 + r * math.cos(a + da), 0.5 + r * math.sin(a + da)))
    # A closed line with round joints: a polygon outline notches the corners of its teeth.
    p.line(*pts, pts[0], pts[1])
    p.ellipse(0.38, 0.38, 0.62, 0.62)


@_kind
def _key(p):
    p.ellipse(0.06, 0.32, 0.42, 0.68)
    p.line((0.42, 0.5), (0.94, 0.5))
    p.line((0.8, 0.5), (0.8, 0.66))
    p.line((0.66, 0.5), (0.66, 0.62))


@_kind
def _folder(p):
    """Projects."""
    p.poly((0.06, 0.2), (0.38, 0.2), (0.46, 0.3), (0.94, 0.3), (0.94, 0.84), (0.06, 0.84))
    p.line((0.06, 0.4), (0.94, 0.4))


@_kind
def _stream(p):
    """A session: steps arriving one under another, the newest lit."""
    for k, v in enumerate((0.18, 0.4, 0.62)):
        p.dot(0.16, v, 0.05)
        p.line((0.3, v), (0.9 - k * 0.12, v))
    p.dot(0.16, 0.84, 0.05)
    p.line((0.3, 0.84), (0.5, 0.84))


@_kind
def _wallet(p):
    """Billing: a wallet with a coin slot."""
    p.rect(0.06, 0.22, 0.94, 0.86)
    p.line((0.06, 0.22), (0.76, 0.08), (0.8, 0.22))
    p.rect(0.62, 0.44, 0.94, 0.64)
    p.dot(0.72, 0.54, 0.035)


@_kind
def _model(p):
    """The language model: a four-point spark."""
    p.poly((0.5, 0.04), (0.6, 0.4), (0.96, 0.5), (0.6, 0.6), (0.5, 0.96), (0.4, 0.6), (0.04, 0.5), (0.4, 0.4))


@_kind
def _registry(p):
    """The agent registry: a shelf of three cards."""
    for k in range(3):
        u = 0.08 + k * 0.3
        p.rect(u, 0.2, u + 0.24, 0.72)
        p.line((u + 0.05, 0.34), (u + 0.19, 0.34))
    p.line((0.02, 0.84), (0.98, 0.84))


# ---- things that move through it
@_kind
def _question(p):
    p.poly((0.06, 0.1), (0.94, 0.1), (0.94, 0.7), (0.42, 0.7), (0.24, 0.9), (0.24, 0.7), (0.06, 0.7))
    p.text(0.5, 0.4, "?", 22)


@_kind
def _paper(p):
    """A finding, or an answer: a page with its corner folded."""
    p.poly((0.18, 0.06), (0.62, 0.06), (0.82, 0.26), (0.82, 0.94), (0.18, 0.94))
    p.line((0.62, 0.06), (0.62, 0.26), (0.82, 0.26))
    for v in (0.46, 0.6, 0.74):
        p.line((0.3, v), (0.7, v))


@_kind
def _coin(p):
    """A coin that spins on its axis."""
    k = abs(math.cos(math.pi * p.phase(2.0)))
    r = 0.4 * max(0.12, k)
    p.ellipse(0.5 - r, 0.1, 0.5 + r, 0.9)
    if k > 0.5:
        p.text(0.5, 0.5, "$", 15)


@_kind
def _image(p):
    """A container image: a box."""
    p.poly((0.5, 0.06), (0.92, 0.26), (0.92, 0.74), (0.5, 0.94), (0.08, 0.74), (0.08, 0.26))
    p.line((0.08, 0.26), (0.5, 0.46), (0.92, 0.26))
    p.line((0.5, 0.46), (0.5, 0.94))


# ---- hosting and delivery
@_kind
def _cloud(p):
    """Three bumps on a flat base, drawn as a filled shape and then hollowed by the stroke."""
    parts = [(0.26, 0.6, 0.2), (0.5, 0.44, 0.26), (0.75, 0.6, 0.2)]
    inset = p.w / (p.c._p(1) * p.s)          # the stroke, in the unit box
    for fill, d in ((p.col, 0.0), (BLACK, inset)):
        for u, v, r in parts:
            p.ellipse(u - r + d, v - r + d, u + r - d, v + r - d, fill=fill, outline=False)
        p.c.d.rectangle([*p.p(0.26, 0.6 + d), *p.p(0.75, 0.8 - d)], fill=fill)


@_kind
def _helm(p):
    """Kubernetes and Helm: a ship's wheel. It turns, slowly."""
    p.ellipse(0.2, 0.2, 0.8, 0.8)
    p.ellipse(0.4, 0.4, 0.6, 0.6)
    spin = p.phase(9.0) * 2 * math.pi
    for k in range(7):
        a = 2 * math.pi * k / 7 - math.pi / 2 + spin
        p.line((0.5 + 0.1 * math.cos(a), 0.5 + 0.1 * math.sin(a)), (0.5 + 0.44 * math.cos(a),
                                                                       0.5 + 0.44 * math.sin(a)))


@_kind
def _branch(p):
    """Source control: a branch that leaves a line and comes back."""
    p.line((0.26, 0.1), (0.26, 0.9))
    p.ellipse(0.16, 0.06, 0.36, 0.26, fill=BLACK)
    p.ellipse(0.16, 0.74, 0.36, 0.94, fill=BLACK)
    p.ellipse(0.64, 0.24, 0.84, 0.44, fill=BLACK)
    p.line((0.74, 0.44), (0.74, 0.56), (0.3, 0.76))


@_kind
def _shield(p):
    """A security check."""
    p.poly((0.5, 0.04), (0.9, 0.18), (0.86, 0.56), (0.5, 0.96), (0.14, 0.56), (0.1, 0.18))
    p.line((0.32, 0.5), (0.46, 0.64), (0.7, 0.36))


@_kind
def _lock(p):
    p.rect(0.18, 0.44, 0.82, 0.92)
    p.arc(0.3, 0.08, 0.7, 0.66, 180, 360)
    p.line((0.3, 0.37), (0.3, 0.44))
    p.line((0.7, 0.37), (0.7, 0.44))
    p.dot(0.5, 0.66, 0.05)


@_kind
def _test(p):
    """Tests: a flask."""
    p.line((0.36, 0.08), (0.64, 0.08))
    p.poly((0.4, 0.08), (0.4, 0.4), (0.12, 0.9), (0.88, 0.9), (0.6, 0.4), (0.6, 0.08))
    p.line((0.26, 0.64), (0.74, 0.64))


@_kind
def _gauge(p):
    """A load test: a speed gauge whose needle swings."""
    p.arc(0.06, 0.16, 0.94, 1.04, 180, 360)
    p.line((0.06, 0.6), (0.94, 0.6))
    a = math.pi * p.wave(3.0, 0.2, 0.85)
    p.line((0.5, 0.6), (0.5 - 0.36 * math.cos(a), 0.6 - 0.36 * math.sin(a)))
    p.dot(0.5, 0.6, 0.05)


@_kind
def _ask(p):
    """A question that travels small: the bubble of `question` with the "?" drawn as a stroke,
    because the font's "?" keeps its size and covers the bubble below about 0.35 in."""
    p.poly((0.06, 0.1), (0.94, 0.1), (0.94, 0.7), (0.42, 0.7), (0.24, 0.9), (0.24, 0.7), (0.06, 0.7))
    p.arc(0.38, 0.18, 0.62, 0.42, 180, 400)
    p.line((0.58, 0.39), (0.5, 0.46), (0.5, 0.5))
    p.dot(0.5, 0.6, 0.035)


# ---- motion: drawn over the still shape, from the scene's clock. Quiet icons move slowly;
# a lit icon, which acts now, moves twice as fast. Nothing changes its place.
def _alive_person(p):
    if p.lit:                                   # typing: three dots beside the head
        n = int(p.phase(1.2) * 4)
        for k in range(min(n, 3)):
            p.dot(0.78 + k * 0.08, 0.16, 0.025)


def _alive_team(p):
    _alive_person(p)


def _alive_browser(p):
    # a page loading: a bar runs under the top bar
    f = p.phase(2.4)
    p.line((0.1, 0.42), (0.1 + 0.8 * f, 0.42))


def _alive_app(p):
    if p.phase(1.0) < 0.55:                     # a blinking cursor between the brackets
        p.line((0.5, 0.4), (0.5, 0.6))


def _alive_gateway(p):
    # requests pass through the gate: the arrow slides from post to post
    p.erase(0.26, 0.44, 0.74, 0.72)
    dx = 0.28 * p.phase(1.6) - 0.14
    p.line((0.36 + dx, 0.58), (0.64 + dx, 0.58))
    p.line((0.54 + dx, 0.48), (0.64 + dx, 0.58), (0.54 + dx, 0.68))


def _alive_server(p):
    for k, v in enumerate((0.1, 0.4, 0.7)):     # status lights that blink out of step
        on = math.sin(2 * math.pi * p.phase(1.3) + k * 2.1) > -0.2
        if not on:
            p.erase(0.17, v + 0.06, 0.27, v + 0.16)


def _alive_database(p):
    # a read or a write: a band runs down the cylinder
    v = 0.3 + 0.5 * p.phase(2.0)
    p.arc(0.12, v - 0.1, 0.88, v + 0.1, 0, 180)


def _alive_key(p):
    u = 0.46 + 0.42 * p.phase(2.2)              # a glint runs along the shaft
    p.dot(u, 0.5, 0.045)


def _alive_folder(p):
    # a sheet goes in and out of the folder
    h = p.wave(2.4, 0.0, 0.14)
    if h > 0.02:
        p.rect(0.3, 0.3 - h, 0.7, 0.3, fill=BLACK)


def _alive_stream(p):
    # the newest step is being written
    p.erase(0.28, 0.79, 0.94, 0.89)
    p.line((0.3, 0.84), (0.3 + 0.55 * p.phase(1.8), 0.84))


def _alive_wallet(p):
    # a coin drops into the slot
    f = p.phase(2.0)
    if f < 0.6:
        v = 0.0 + 0.4 * (f / 0.6)
        p.ellipse(0.68, v - 0.06, 0.8, v + 0.06, fill=BLACK)


def _alive_model(p):
    # it thinks: two small sparks twinkle at its corners
    for k, (u, v) in enumerate(((0.84, 0.16), (0.16, 0.84))):
        r = 0.09 * abs(math.sin(math.pi * p.phase(1.4) + k * 1.3))
        if r > 0.015:
            p.line((u - r, v), (u + r, v))
            p.line((u, v - r), (u, v + r))


def _alive_registry(p):
    k = int(p.phase(2.4) * 3)                   # one card is read at a time
    u = 0.08 + k * 0.3
    p.line((u + 0.05, 0.46), (u + 0.19, 0.46))
    p.line((u + 0.05, 0.56), (u + 0.15, 0.56))


def _alive_paper(p):
    # the page is being written, line by line
    f = p.phase(2.4) * 3
    p.erase(0.26, 0.4, 0.74, 0.8)
    for k, v in enumerate((0.46, 0.6, 0.74)):
        part = max(0.0, min(1.0, f - k))
        if part > 0:
            p.line((0.3, v), (0.3 + 0.4 * part, v))


def _alive_image(p):
    f = p.phase(2.4)                            # a glint runs round the top edge
    pts = [(0.5, 0.06), (0.92, 0.26), (0.5, 0.46), (0.08, 0.26), (0.5, 0.06)]
    seg = int(f * 4)
    a, b = pts[seg], pts[seg + 1]
    g = f * 4 - seg
    p.dot(a[0] + (b[0] - a[0]) * g, a[1] + (b[1] - a[1]) * g, 0.045)


def _alive_cloud(p):
    # uploads rise from the cloud
    for k in range(2):
        f = (p.phase(2.0) + k * 0.5) % 1.0
        p.dot(0.4 + k * 0.2, 0.36 - 0.3 * f, 0.03)


def _alive_branch(p):
    f = p.phase(2.0)                            # a commit travels along the branch
    u, v = (0.74, 0.44 + 0.12 * f / 0.3) if f < 0.3 else (0.74 - 0.44 * (f - 0.3) / 0.7,
                                                         0.56 + 0.2 * (f - 0.3) / 0.7)
    p.dot(u, v, 0.04)


def _alive_shield(p):
    # the check is drawn again and again: the scan runs
    f = p.phase(2.0)
    p.erase(0.28, 0.32, 0.74, 0.68)
    a, b, c = (0.32, 0.5), (0.46, 0.64), (0.7, 0.36)
    if f < 0.35:
        g = f / 0.35
        p.line(a, (a[0] + (b[0] - a[0]) * g, a[1] + (b[1] - a[1]) * g))
    else:
        g = min(1.0, (f - 0.35) / 0.4)
        p.line(a, b, (b[0] + (c[0] - b[0]) * g, b[1] + (c[1] - b[1]) * g))


def _alive_lock(p):
    if p.phase(1.6) < 0.5:                      # the keyhole blinks: it is checked
        p.dot(0.5, 0.66, 0.08)


def _alive_test(p):
    for k in range(3):                          # bubbles rise in the flask
        f = (p.phase(1.8) + k / 3) % 1.0
        p.dot(0.38 + k * 0.12, 0.84 - 0.3 * f, 0.03)


def _alive_question(p):
    if p.lit:
        return
    if p.phase(1.6) < 0.5:
        p.dot(0.84, 0.16, 0.04)


def icon(c, kind, cx, cy, s=0.6, lit=False, label=None, size=14, faint=False, back=True, **opts):
    """One icon, centred on (cx, cy), s inches high, with an optional label under it.
    back: clear the square behind it first, so a connector stops at the icon.
    opts go to the icon: turn= for a gear that turns while it works."""
    color = INK if lit else (INK3 if faint else INK2)
    if back:
        r = s / 2
        c.d.rectangle([c._p(cx - r), c._p(cy - r), c._p(cx + r), c._p(cy + r)], fill=BLACK)
    pen = _Pen(c, cx, cy, s, color, 2 if lit else 1.6, lit)
    still = opts.pop("still", False) or faint
    if kind == "gear" and not still and not opts.get("turn"):
        # A gear always turns a little; a lit one turns at work speed.
        opts["turn"] = pen.t * (0.9 if lit else 0.12)
    globals()["_" + kind](pen, **opts)
    alive = globals().get("_alive_" + kind)
    if alive and not still:
        alive(pen)
    if label:
        c.text(cx - 1.2, cy + s / 2 + 0.06, 2.4, 0.3, label, size, "Medium", INK if lit else INK2)


def lit_ground(c, cx, cy, s):
    """A raised square behind an icon that acts now (optional emphasis)."""
    r = s / 2 + 0.1
    c.d.rectangle([c._p(cx - r), c._p(cy - r), c._p(cx + r), c._p(cy + r)], fill=RAISED)


if __name__ == "__main__":
    import os

    from draw import OUT

    c = Canvas()
    per = 9
    for k, kind in enumerate(KINDS):
        x = 0.8 + (k % per) * 1.3
        y = 0.9 + (k // per) * 1.5
        icon(c, kind, x, y, 0.62, lit=k % 2 == 0, label=kind)
    c.frame().save(os.path.join(OUT, "icons.png"))
    print(len(KINDS), "icons")
