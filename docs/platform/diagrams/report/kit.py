"""SVG primitives in the style of the diagram-design skill (MIT), white-paper skin.

The skin is the one the team set for the printed reports on 27 October 2026:
paper #ffffff, paper-2 #f4f5f7, and the skill's light defaults for the other
roles. Type sizes are the skill's print ramp scaled up by about 1.1, because a
640 to 760 px wide viewBox is printed at 16 cm on A4.
"""
import html

PAPER = "#ffffff"
PAPER2 = "#f4f5f7"
INK = "#2d3142"
MUTED = "#4f5d75"
SOFT = "#5a6580"
ACCENT = "#bf4520"
LINK = "#2e5aa8"
RULE_SOLID = "#bfc0c0"


def ink(a):
    return "rgba(45,49,66,%s)" % a


def acc(a):
    return "rgba(191,69,32,%s)" % a


def mut(a):
    return "rgba(79,93,117,%s)" % a


SANS = "'Geist', system-ui, sans-serif"
MONO = "'Geist Mono', ui-monospace, monospace"
SERIF = "'Instrument Serif', serif"

NAME = 13       # node-name role
SUB = 10        # sublabel role
LABEL = 9       # arrow-label role
TAG = 8         # eyebrow / type tag role

FONTS = ("https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1"
         "&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500;600&display=swap")


def esc(s):
    return html.escape(str(s), quote=True)


def mono_w(text, size=LABEL, track=0.06):
    return len(text) * size * (0.62 + track)


def sans_w(text, size=NAME):
    return len(text) * size * 0.60


class Diagram:
    def __init__(self, slug, title, desc, w, h):
        self.slug, self.title, self.desc, self.w, self.h = slug, title, desc, w, h
        self.layers = {"bg": [], "zones": [], "arrows": [], "labels": [], "nodes": [], "top": []}

    def add(self, layer, s):
        self.layers[layer].append(s)

    # ------------------------------------------------------------ connectors
    def route(self, pts, color=MUTED, dashed=False, marker="arrow", width=1.2, r=8, open_=False):
        """An orthogonal path through pts with rounded elbows of radius r."""
        d = "M %s,%s" % pts[0]
        for i in range(1, len(pts) - 1):
            (x0, y0), (x1, y1), (x2, y2) = pts[i - 1], pts[i], pts[i + 1]
            dx0 = (x1 > x0) - (x1 < x0)
            dy0 = (y1 > y0) - (y1 < y0)
            dx1 = (x2 > x1) - (x2 < x1)
            dy1 = (y2 > y1) - (y2 < y1)
            rr = min(r, abs(x1 - x0) / 2 + abs(y1 - y0) / 2, abs(x2 - x1) / 2 + abs(y2 - y1) / 2)
            a = (x1 - dx0 * rr, y1 - dy0 * rr)
            b = (x1 + dx1 * rr, y1 + dy1 * rr)
            d += " L %g,%g Q %g,%g %g,%g" % (a[0], a[1], x1, y1, b[0], b[1])
        d += " L %s,%s" % pts[-1]
        m = ""
        if marker:
            name = {MUTED: "arrow", ACCENT: "arrow-accent", LINK: "arrow-link"}.get(color, "arrow")
            if open_:
                name = "arrow-open"
            m = ' marker-end="url(#%s)"' % name
        dash = ' stroke-dasharray="5,4"' if dashed else ""
        self.add("arrows", '<path d="%s" fill="none" stroke="%s" stroke-width="%s"%s%s/>' % (d, color, width, dash, m))

    def label(self, cx, cy, text, color=SOFT, size=LABEL, anchor="middle", upper=True):
        """A masked arrow label; (cx, cy) is the centre of the text. Code names keep their case."""
        if upper:
            text = text.upper()
        w = mono_w(text, size) + 8
        h = size + 5
        x = cx - w / 2 if anchor == "middle" else (cx if anchor == "start" else cx - w)
        self.add("labels", '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="2" fill="%s"/>' % (x, cy - h / 2, w, h, PAPER))
        tx = x + w / 2
        self.add("labels", '<text x="%.1f" y="%.1f" fill="%s" font-size="%s" font-family="%s" text-anchor="middle" '
                 'letter-spacing="0.06em">%s</text>' % (tx, cy + size * 0.35, color, size, MONO, esc(text)))

    # ------------------------------------------------------------ boxes
    def zone(self, x, y, w, h, text, color=None, fill=None):
        stroke = color or ink(0.25)
        self.add("zones", '<rect x="%s" y="%s" width="%s" height="%s" rx="8" fill="%s" stroke="%s" stroke-width="1" '
                 'stroke-dasharray="4,4"/>' % (x, y, w, h, fill or ink(0.02), stroke))
        t = text.upper()
        tw = mono_w(t, TAG, 0.16) + 10
        self.add("zones", '<rect x="%s" y="%s" width="%.1f" height="12" fill="%s"/>' % (x + 10, y - 6, tw, PAPER))
        self.add("zones", '<text x="%s" y="%s" fill="%s" font-size="%s" font-family="%s" letter-spacing="0.16em">%s</text>'
                 % (x + 15, y + 3, color or MUTED, TAG, MONO, esc(t)))

    def node(self, x, y, w, h, name, sub="", tag="", kind="backend", name_y=None, align="middle"):
        fill, stroke, dash = {
            "focal": (acc(0.08), ACCENT, ""),
            "backend": ("#ffffff", INK, ""),
            "store": (ink(0.05), MUTED, ""),
            "external": (ink(0.03), ink(0.30), ""),
            "input": (mut(0.10), SOFT, ""),
            "optional": (ink(0.02), ink(0.20), ' stroke-dasharray="4,3"'),
        }[kind]
        n = self.layers["nodes"]
        n.append('<rect x="%s" y="%s" width="%s" height="%s" rx="6" fill="%s"/>' % (x, y, w, h, PAPER))
        n.append('<rect x="%s" y="%s" width="%s" height="%s" rx="6" fill="%s" stroke="%s" stroke-width="1"%s/>'
                 % (x, y, w, h, fill, stroke, dash))
        top = y
        if tag:
            tg = tag.upper()
            tw = mono_w(tg, TAG - 1, 0.08) + 8
            tcol = ACCENT if kind == "focal" else SOFT
            n.append('<rect x="%s" y="%s" width="%.1f" height="12" rx="2" fill="transparent" stroke="%s" stroke-width="0.8"/>'
                     % (x + 8, y + 6, tw, acc(0.5) if kind == "focal" else ink(0.25)))
            n.append('<text x="%.1f" y="%s" fill="%s" font-size="%s" font-family="%s" text-anchor="middle" '
                     'letter-spacing="0.08em">%s</text>' % (x + 8 + tw / 2, y + 15, tcol, TAG - 1, MONO, esc(tg)))
            top = y + 12
        cx = x + w / 2 if align == "middle" else x + 12
        lines = sub.split("\n") if sub else []
        if name_y is None:
            block = NAME + len(lines) * (SUB + 4)
            name_y = top + (y + h - top) / 2 - block / 2 + NAME * 0.8
        n.append('<text x="%.1f" y="%.1f" fill="%s" font-size="%s" font-weight="600" font-family="%s" text-anchor="%s">%s</text>'
                 % (cx, name_y, INK, NAME, SANS, "middle" if align == "middle" else "start", esc(name)))
        for i, line in enumerate(lines):
            n.append('<text x="%.1f" y="%.1f" fill="%s" font-size="%s" font-family="%s" text-anchor="%s">%s</text>'
                     % (cx, name_y + (i + 1) * (SUB + 4), MUTED, SUB, MONO, "middle" if align == "middle" else "start", esc(line)))

    def chip(self, x, y, w, name, tag_right="", h=22):
        n = self.layers["nodes"]
        n.append('<rect x="%s" y="%s" width="%s" height="%s" rx="4" fill="%s" stroke="%s" stroke-width="0.8"/>'
                 % (x, y, w, h, ink(0.05), MUTED))
        n.append('<text x="%s" y="%.1f" fill="%s" font-size="%s" font-weight="500" font-family="%s">%s</text>'
                 % (x + 8, y + h / 2 + 4, INK, NAME - 1, SANS, esc(name)))
        if tag_right:
            n.append('<text x="%s" y="%.1f" fill="%s" font-size="%s" font-family="%s" text-anchor="end">%s</text>'
                     % (x + w - 8, y + h / 2 + 3.5, MUTED, SUB - 0.5, MONO, esc(tag_right)))

    def text(self, x, y, s, size=SUB, color=MUTED, family=MONO, anchor="start", weight=400, layer="top", track=0):
        self.add(layer, '<text x="%s" y="%s" fill="%s" font-size="%s" font-weight="%s" font-family="%s" text-anchor="%s" '
                 'letter-spacing="%sem">%s</text>' % (x, y, color, size, weight, family, anchor, track, esc(s)))

    def raw(self, layer, s):
        self.add(layer, s)

    def legend(self, y, items):
        """items: list of (kind, text); kind is 'muted', 'link', 'accent', 'dashed', 'focal', 'store', 'external'."""
        self.add("top", '<line x1="20" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="0.8"/>' % (y, self.w - 20, y, ink(0.12)))
        self.text(20, y + 22, "LEGEND", TAG, MUTED, MONO, track=0.18)
        x = 88
        for kind, t in items:
            if kind in ("muted", "link", "accent", "dashed"):
                col = {"muted": MUTED, "link": LINK, "accent": ACCENT, "dashed": MUTED}[kind]
                dash = ' stroke-dasharray="5,4"' if kind == "dashed" else ""
                mk = {"muted": "arrow", "link": "arrow-link", "accent": "arrow-accent", "dashed": "arrow"}[kind]
                self.add("top", '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="1.2"%s marker-end="url(#%s)"/>'
                         % (x, y + 19, x + 26, y + 19, col, dash, mk))
                x += 34
            else:
                fill, stroke = {"focal": (acc(0.08), ACCENT), "store": (ink(0.05), MUTED),
                                "external": (ink(0.03), ink(0.30)), "backend": ("#ffffff", INK)}[kind]
                self.add("top", '<rect x="%s" y="%s" width="16" height="11" rx="2" fill="%s" stroke="%s"/>' % (x, y + 13, fill, stroke))
                x += 24
            self.text(x, y + 23, t, SUB, MUTED, SANS)
            x += sans_w(t, SUB) + 26

    # ------------------------------------------------------------ output
    def html(self):
        defs = (
            '<marker id="arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="%s"/></marker>'
            '<marker id="arrow-accent" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="%s"/></marker>'
            '<marker id="arrow-link" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="%s"/></marker>'
            '<marker id="arrow-open" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polyline points="0 0, 8 3, 0 6" fill="none" stroke="%s" stroke-width="1.2"/></marker>'
        ) % (MUTED, ACCENT, LINK, MUTED)
        body = "\n".join(s for k in ("bg", "zones", "arrows", "labels", "nodes", "top") for s in self.layers[k])
        return """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>%(title)s</title>
<link href="%(fonts)s" rel="stylesheet">
<style>
  body { margin: 0; background: %(paper)s; }
  .diagram-container { width: 100%%; overflow-x: auto; }
  svg { width: 100%%; min-width: %(w)spx; display: block; }
  @media print { .diagram-container { overflow-x: visible; } svg { min-width: 0; } }
</style>
</head>
<body>
<div class="diagram-container">
<svg viewBox="0 0 %(w)s %(h)s" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="%(slug)s-title %(slug)s-desc">
<title id="%(slug)s-title">%(title)s</title>
<desc id="%(slug)s-desc">%(desc)s</desc>
<defs>%(defs)s</defs>
<rect width="100%%" height="100%%" fill="%(paper)s"/>
%(body)s
</svg>
</div>
</body>
</html>
""" % dict(title=esc(self.title), fonts=FONTS, paper=PAPER, w=self.w, h=self.h, slug=self.slug,
           desc=esc(self.desc), defs=defs, body=body)
