# -*- coding: utf-8 -*-
"""Small drawing kit for UML analysis- and design-model diagrams (sequence + class).

Notation follows `03a AM.pdf` (Analysis Modelling) and `04a DM.pdf` (Design Modelling):
  * three analysis stereotypes: <<boundary>>, <<control>>, <<entity>>
  * attributes are shown for entity classes only in the analysis model
  * relationships: association / aggregation / composition / dependency /
    inheritance / realisation

Taken from the 03a Analysis Model submission and extended for the design model
in three ways:
  * a class box or a sequence lane may pass kind="" to omit the stereotype line,
    since a concrete design class normally carries no stereotype
  * link kind "realise" draws the dashed line with a hollow triangle that a class
    uses to realise an interface
  * the "iface" palette entry colours <<interface>> boxes
"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Rectangle, Polygon, Circle
from matplotlib.textpath import TextPath
from matplotlib.font_manager import FontProperties

_FP = {}


def text_w(s, size, bold=False, scale=0.60):
    """Width of the widest line of `s`, in data units, for `scale` inches per unit."""
    fp = _FP.get(bool(bold))
    if fp is None:
        fp = FontProperties(family="DejaVu Sans", weight="bold" if bold else "normal")
        _FP[bool(bold)] = fp
    w = 0.0
    for line in str(s).split(chr(10)):
        if line:
            w = max(w, TextPath((0, 0), line, size=size, prop=fp).get_extents().width)
    # FontProperties(weight="bold") does not reach the bold face here, and TextPath
    # reports tight ink bounds rather than advance widths -- compensate for both.
    return w * (1.16 if bold else 1.07) / (72.0 * scale)


def nlines(s):
    return str(s).count(chr(10)) + 1


# ---------------------------------------------------------------- palette
STY = {
    "boundary":  dict(fc="#E4F3E6", ec="#2E7D32"),
    "control":   dict(fc="#FFF2D9", ec="#B26A00"),
    "entity":    dict(fc="#E6EFF9", ec="#1F4E79"),
    "actor":     dict(fc="#FFFFFF", ec="#12263A"),
    "interface": dict(fc="#F1E9F7", ec="#6A3D9A"),
    "module":    dict(fc="#EFEFEF", ec="#4A4A4A"),
    "":          dict(fc="#FAFAFA", ec="#3A3A3A"),
}
TXT = "#12263A"
ARR = "#2F4858"
FRAG = "#8A8A8A"
GUILL_L, GUILL_R = "«", "»"
SD_SCALE = 0.60
CD_SCALE = 0.62
NAME_FS, STER_FS, MSG_FS = 9.6, 8.6, 8.6


def _sty(kind):
    return STY.get(kind, STY["entity"])


def _draw_actor(ax, cx, cy, name, fs=NAME_FS):
    r = 0.16
    ax.add_patch(Circle((cx, cy), r, fc="white", ec=TXT, lw=1.5, zorder=5))
    ax.plot([cx, cx], [cy - r, cy - r - 0.34], color=TXT, lw=1.5, zorder=5)
    ax.plot([cx - 0.26, cx + 0.26], [cy - r - 0.12, cy - r - 0.12], color=TXT, lw=1.5, zorder=5)
    ax.plot([cx, cx - 0.20], [cy - r - 0.34, cy - r - 0.62], color=TXT, lw=1.5, zorder=5)
    ax.plot([cx, cx + 0.20], [cy - r - 0.34, cy - r - 0.62], color=TXT, lw=1.5, zorder=5)
    ax.text(cx, cy - r - 0.80, name, ha="center", va="top", linespacing=1.35,
            fontsize=fs, fontweight="bold", color=TXT, zorder=5)


# ================================================================ SEQUENCE
class SD:
    """Sequence diagram. Lanes are placed by their own width, not on a fixed grid."""

    GAP = 1.05          # clear space between two neighbouring header boxes
    MIN_W = 1.75

    def __init__(self, lanes, step=0.78, gap=None):
        self.lanes = lanes                       # [dict(key, kind, name)]
        self.idx = {l["key"]: i for i, l in enumerate(lanes)}
        self.step = step
        if gap:
            self.GAP = gap

        # header box width per lane, then centres spaced by the two half-widths
        self.wid, self.pos = {}, {}
        for l in lanes:
            if l["kind"] == "actor":
                w = text_w(l["name"], NAME_FS, True, SD_SCALE) + 0.50
            else:
                w = text_w(":" + l["name"], NAME_FS, True, SD_SCALE) + 0.62
                if l["kind"]:
                    w = max(w, text_w(GUILL_L + l["kind"] + GUILL_R, STER_FS,
                                      False, SD_SCALE) + 0.40)
            self.wid[l["key"]] = max(w, self.MIN_W)
        x = 0.0
        for i, l in enumerate(lanes):
            if i:
                x += (self.wid[lanes[i - 1]["key"]] + self.wid[l["key"]]) / 2 + self.GAP
            self.pos[l["key"]] = x

        name_lines = max(nlines(l["name"]) for l in lanes if l["kind"] != "actor")
        self.head_h = 0.52 + 0.34 * name_lines
        self.y = -self.head_h - 0.75
        self.frags = []
        self.ops = []
        self.touch = {l["key"]: [] for l in lanes}

    # ---- geometry
    def x(self, key):
        return self.pos[key]

    def w(self, key):
        return self.wid[key]

    def _adv(self, h=1.0):
        y = self.y
        self.y -= self.step * h
        return y

    def _mark(self, *keys):
        for k in keys:
            self.touch[k].append(self.y)

    # ---- messages
    def msg(self, a, b, label, h=1.0, ret=False):
        y = self._adv(h)
        self._mark(a, b)
        self.ops.append(("msg", a, b, label, y, ret))
        return y

    def ret(self, a, b, label, h=1.0):
        """Dashed return message -- use only for a genuine reply."""
        return self.msg(a, b, label, h=h, ret=True)

    def selfmsg(self, a, label, h=1.9):
        y = self._adv(h)
        self._mark(a)
        self.ops.append(("self", a, label, y))
        return y

    def gap_(self, h=0.4):
        self.y -= self.step * h

    # ---- combined fragments
    def frag(self, kind, guard, span, level=0):
        h = dict(kind=kind, guard=guard, span=span, level=level,
                 y_top=self.y + self.step * 0.55, divs=[])
        self.frags.append(h)
        self.y -= self.step * 1.12
        return h

    def frag_else(self, h, guard):
        self.y -= self.step * 0.15
        h["divs"].append((self.y, guard))
        self.y -= self.step * 1.24

    def frag_end(self, h):
        h["y_bot"] = self.y + self.step * 0.35
        self.y -= self.step * 0.90

    def _fx(self, h):
        i0, i1 = h["span"]
        ins = 0.14 * h["level"]
        return (self.x(i0) - self.w(i0) / 2 - 0.34 + ins,
                self.x(i1) + self.w(i1) / 2 + 0.34 - ins)

    # ---- render
    def draw(self, title, subtitle=None, out=None, pad=0.75):
        first, last = self.lanes[0]["key"], self.lanes[-1]["key"]
        x0 = self.x(first) - self.w(first) / 2
        x1 = self.x(last) + self.w(last) / 2
        for h in self.frags:
            fa, fb = self._fx(h)
            x0, x1 = min(x0, fa), max(x1, fb)
        y_bot = self.y - 0.55
        nsub = nlines(subtitle) if subtitle else 0
        top = 1.75 + 0.42 * max(0, nsub - 1)
        fig, ax = plt.subplots(figsize=((x1 - x0 + 2 * pad) * SD_SCALE,
                                        (top - 0.15 - y_bot + pad) * SD_SCALE))
        ax.set_xlim(x0 - pad, x1 + pad)
        ax.set_ylim(y_bot - pad, top)
        ax.set_aspect("equal"); ax.axis("off")

        # fragments
        for h in self.frags:
            fx0, fx1 = self._fx(h)
            ax.add_patch(Rectangle((fx0, h["y_bot"]), fx1 - fx0, h["y_top"] - h["y_bot"],
                                   fc="none", ec=FRAG, lw=1.1, ls=(0, (5, 3)), zorder=0.8))
            tw, th = 0.92, 0.34
            ax.add_patch(Polygon([(fx0, h["y_top"]), (fx0 + tw, h["y_top"]),
                                  (fx0 + tw, h["y_top"] - th + 0.10),
                                  (fx0 + tw - 0.16, h["y_top"] - th),
                                  (fx0, h["y_top"] - th)],
                                 closed=True, fc="#FFFFFF", ec=FRAG, lw=1.1, zorder=6.4))
            ax.text(fx0 + tw / 2, h["y_top"] - th / 2, h["kind"], ha="center", va="center",
                    fontsize=8.4, fontweight="bold", color=FRAG, zorder=6.5)
            ax.text(fx0 + tw + 0.18, h["y_top"] - th / 2, h["guard"], ha="left", va="center",
                    fontsize=8.4, color=FRAG, zorder=6.5,
                    bbox=dict(fc="white", ec="none", pad=1.0))
            for dy, g in h["divs"]:
                ax.plot([fx0, fx1], [dy, dy], color=FRAG, lw=1.0, ls=(0, (5, 3)), zorder=0.9)
                ax.text(fx0 + 0.18, dy - 0.20, g, ha="left", va="center",
                        fontsize=8.4, color=FRAG, zorder=6.5,
                        bbox=dict(fc="white", ec="none", pad=1.0))

        # lifelines + activation bars
        for l in self.lanes:
            cx = self.x(l["key"])
            ax.plot([cx, cx], [-self.head_h, y_bot], color="#7A7A7A", lw=1.0,
                    ls=(0, (4, 4)), zorder=1)
            ys = self.touch[l["key"]]
            if ys and l["kind"] != "actor":
                a_top, a_bot = max(ys) + 0.22, min(ys) - 0.22
                ax.add_patch(Rectangle((cx - 0.10, a_bot), 0.20, a_top - a_bot,
                                       fc="#FFFFFF", ec="#5A5A5A", lw=1.0, zorder=2))

        # headers
        for l in self.lanes:
            cx, bw = self.x(l["key"]), self.w(l["key"])
            if l["kind"] == "actor":
                _draw_actor(ax, cx, 0.62, l["name"])
            else:
                s = _sty(l["kind"])
                ax.add_patch(FancyBboxPatch((cx - bw / 2, -self.head_h), bw, self.head_h,
                                            boxstyle="round,pad=0,rounding_size=0.10",
                                            fc=s["fc"], ec=s["ec"], lw=1.6, zorder=4))
                if l["kind"]:
                    ax.text(cx, -0.30, GUILL_L + l["kind"] + GUILL_R, ha="center",
                            va="center", fontsize=STER_FS, color=s["ec"], zorder=5)
                ax.text(cx, -0.58 if l["kind"] else -0.44, ":" + l["name"], ha="center",
                        va="top", linespacing=1.30,
                        fontsize=NAME_FS, fontweight="bold", color=TXT, zorder=5)

        # messages
        for op in self.ops:
            if op[0] == "msg":
                _, a, b, label, y, ret = op
                xa, xb = self.x(a), self.x(b)
                d = 0.10 if xb > xa else -0.10
                ax.add_patch(FancyArrowPatch((xa + d, y), (xb - d, y),
                                             arrowstyle="->" if ret else "-|>",
                                             mutation_scale=13, lw=1.4,
                                             linestyle=(0, (5, 3)) if ret else "solid",
                                             color=ARR, shrinkA=0, shrinkB=0, zorder=3))
                ax.text((xa + xb) / 2, y + 0.16, label, ha="center", va="bottom",
                        fontsize=MSG_FS, color=TXT, zorder=6,
                        bbox=dict(fc="white", ec="none", pad=1.2))
            else:
                _, a, label, y = op
                cx = self.x(a)
                w, dh = 0.80, 0.42
                ax.plot([cx + 0.10, cx + w, cx + w], [y, y, y - dh],
                        color=ARR, lw=1.4, zorder=3)
                ax.add_patch(FancyArrowPatch((cx + w, y - dh), (cx + 0.12, y - dh),
                                             arrowstyle="-|>", mutation_scale=13, lw=1.4,
                                             color=ARR, shrinkA=0, shrinkB=0, zorder=3))
                ax.text(cx + w + 0.18, y - dh / 2, label, ha="left", va="center",
                        fontsize=MSG_FS, color=TXT, zorder=6,
                        bbox=dict(fc="white", ec="none", pad=1.2))

        ax.text(x0 - pad * 0.6, top - 0.13, title, ha="left", va="top",
                fontsize=13.5, fontweight="bold", color=TXT)
        if subtitle:
            ax.text(x0 - pad * 0.6, top - 0.57, subtitle, ha="left", va="top",
                    fontsize=9.6, color="#555555", linespacing=1.45)
        if out:
            fig.savefig(out + ".png", dpi=240, facecolor="white",
                        bbox_inches="tight", pad_inches=0.22)
            fig.savefig(out + ".svg", facecolor="white",
                        bbox_inches="tight", pad_inches=0.22)
        plt.close(fig)


# =================================================================== CLASS
LINE_H = 0.34
PAD_Y = 0.16


class Box:
    def __init__(self, cd, key, x, y_top, w, kind, name, attrs=(), methods=(), abstract=False):
        self.key, self.x, self.w = key, x, w
        self.kind, self.name = kind, name
        self.attrs, self.methods, self.abstract = list(attrs), list(methods), abstract
        self.h_head = LINE_H * (2 if kind else 1) + PAD_Y * 2
        self.h_attr = len(self.attrs) * LINE_H + PAD_Y * 2
        self.h_meth = len(self.methods) * LINE_H + PAD_Y * 2
        self.h = self.h_head + self.h_attr + self.h_meth
        self.y_top = y_top
        self.y_bot = y_top - self.h
        cd.boxes[key] = self

    def L(self, f=0.5): return (self.x, self.y_top - self.h * f)
    def R(self, f=0.5): return (self.x + self.w, self.y_top - self.h * f)
    def T(self, f=0.5): return (self.x + self.w * f, self.y_top)
    def B(self, f=0.5): return (self.x + self.w * f, self.y_bot)


class CD:
    def __init__(self):
        self.boxes, self.links, self.actors, self.notes = {}, [], [], []

    def box(self, *a, **k):
        return Box(self, *a, **k)

    def actor(self, x, y, name):
        self.actors.append((x, y, name))
        return (x, y)

    def link(self, pts, kind="assoc", ma=None, mb=None, label=None, lab_off=(0, 0.16)):
        self.links.append(dict(pts=pts, kind=kind, ma=ma, mb=mb,
                               label=label, lab_off=lab_off))

    def draw(self, title, subtitle=None, out=None, pad=0.7):
        xs = [b.x for b in self.boxes.values()] + [b.x + b.w for b in self.boxes.values()]
        ys = [b.y_bot for b in self.boxes.values()] + [b.y_top for b in self.boxes.values()]
        for x, y, nm in self.actors:
            hw = text_w(nm, NAME_FS, True, CD_SCALE) / 2 + 0.25
            xs += [x - hw, x + hw]
            ys += [y - 0.96 - 0.34 * nlines(nm), y + 0.35]
        for l in self.links:
            for px, py in l["pts"]:
                xs.append(px); ys.append(py)
        for nx, ny, nt in self.notes:
            xs += [nx, nx + text_w(nt, 8.4, False, CD_SCALE) + 0.5]
            ys += [ny, ny - 0.42 * nlines(nt) - 0.2]
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        nsub = nlines(subtitle) if subtitle else 0
        extra = 1.45 + 0.42 * max(0, nsub - 1)
        fig, ax = plt.subplots(figsize=((x1 - x0 + 2 * pad) * CD_SCALE,
                                        (y1 - y0 + 2 * pad + extra) * CD_SCALE))
        ax.set_xlim(x0 - pad, x1 + pad)
        ax.set_ylim(y0 - pad, y1 + pad + extra)
        ax.set_aspect("equal"); ax.axis("off")

        for l in self.links:
            self._link(ax, l)
        for b in self.boxes.values():
            self._box(ax, b)
        for x, y, nm in self.actors:
            _draw_actor(ax, x, y, nm)
        for x, y, t in self.notes:
            ax.text(x, y, t, ha="left", va="top", fontsize=8.4, color="#555555", zorder=8,
                    bbox=dict(fc="#FFFDF0", ec="#C9B77A", lw=0.9, boxstyle="round,pad=0.35"))

        ax.text(x0 - pad * 0.5, y1 + pad + extra - 0.15, title, ha="left", va="top",
                fontsize=13.5, fontweight="bold", color=TXT)
        if subtitle:
            ax.text(x0 - pad * 0.5, y1 + pad + extra - 0.60, subtitle, ha="left", va="top",
                    fontsize=9.6, color="#555555", linespacing=1.45)
        if out:
            fig.savefig(out + ".png", dpi=240, facecolor="white",
                        bbox_inches="tight", pad_inches=0.22)
            fig.savefig(out + ".svg", facecolor="white",
                        bbox_inches="tight", pad_inches=0.22)
        plt.close(fig)

    @staticmethod
    def _box(ax, b):
        s = _sty(b.kind)
        ax.add_patch(Rectangle((b.x, b.y_bot), b.w, b.h, fc=s["fc"], ec=s["ec"],
                               lw=1.7, zorder=4))
        y = b.y_top - PAD_Y - LINE_H * 0.5
        if b.kind:
            ax.text(b.x + b.w / 2, y, GUILL_L + b.kind + GUILL_R, ha="center", va="center",
                    fontsize=8.4, color=s["ec"], zorder=5)
            y -= LINE_H
        ax.text(b.x + b.w / 2, y, b.name, ha="center", va="center",
                fontsize=10.4, fontweight="bold", color=TXT, zorder=5,
                style="italic" if b.abstract else "normal")
        y_a = b.y_top - b.h_head
        ax.plot([b.x, b.x + b.w], [y_a, y_a], color=s["ec"], lw=1.2, zorder=5)
        yy = y_a - PAD_Y - LINE_H * 0.5
        for t in b.attrs:
            ax.text(b.x + 0.16, yy, t, ha="left", va="center", fontsize=8.6,
                    color=TXT, zorder=5)
            yy -= LINE_H
        y_m = y_a - b.h_attr
        ax.plot([b.x, b.x + b.w], [y_m, y_m], color=s["ec"], lw=1.2, zorder=5)
        yy = y_m - PAD_Y - LINE_H * 0.5
        for t in b.methods:
            ax.text(b.x + 0.16, yy, t, ha="left", va="center", fontsize=8.6,
                    color=TXT, zorder=5)
            yy -= LINE_H

    @staticmethod
    def _link(ax, l):
        pts = [np.array(p, dtype=float) for p in l["pts"]]
        kind = l["kind"]
        head = 0.34
        p_start, p_end = pts[0].copy(), pts[-1].copy()
        if kind in ("comp", "aggr"):
            d = pts[1] - pts[0]; d = d / (np.linalg.norm(d) or 1)
            pts[0] = pts[0] + d * head * 1.15
        if kind in ("inherit", "realise"):
            d = pts[-1] - pts[-2]; d = d / (np.linalg.norm(d) or 1)
            pts[-1] = pts[-1] - d * head
        ax.plot([p[0] for p in pts], [p[1] for p in pts], color=ARR, lw=1.5, zorder=3,
                ls=(0, (5, 3)) if kind in ("dep", "realise") else "solid")
        if kind == "dep":
            # draw the head over a short stub only -- a FancyArrowPatch spanning the
            # whole segment would repaint the dashed line solid
            d = pts[-1] - pts[-2]; d = d / (np.linalg.norm(d) or 1)
            ax.add_patch(FancyArrowPatch(tuple(pts[-1] - d * 0.28), tuple(pts[-1]),
                                         arrowstyle="->", mutation_scale=14, lw=1.5,
                                         color=ARR, shrinkA=0, shrinkB=0, zorder=3))
        if kind in ("comp", "aggr"):
            d = pts[1] - p_start; d = d / (np.linalg.norm(d) or 1)
            n = np.array([-d[1], d[0]])
            ax.add_patch(Polygon([p_start, p_start + d * head * 0.58 + n * head * 0.34,
                                  p_start + d * head * 1.15,
                                  p_start + d * head * 0.58 - n * head * 0.34],
                                 closed=True, fc=ARR if kind == "comp" else "white",
                                 ec=ARR, lw=1.4, zorder=4))
        if kind in ("inherit", "realise"):
            d = p_end - pts[-2]; d = d / (np.linalg.norm(d) or 1)
            n = np.array([-d[1], d[0]])
            base = p_end - d * head
            ax.add_patch(Polygon([p_end, base + n * head * 0.46, base - n * head * 0.46],
                                 closed=True, fc="white", ec=ARR, lw=1.5, zorder=4))

        def _tag(p, q, txt):
            if not txt:
                return
            d = q - p
            d = d / (np.linalg.norm(d) or 1)
            pos = p + d * 0.46
            off = (0.0, 0.22) if abs(d[1]) < 0.4 else (0.34 * (1 if d[0] >= 0 else -1), 0.0)
            ax.text(pos[0] + off[0], pos[1] + off[1], txt, ha="center", va="center",
                    fontsize=8.4, color=TXT, zorder=6,
                    bbox=dict(fc="white", ec="none", pad=0.8))

        _tag(p_start, pts[1], l["ma"])
        _tag(p_end, pts[-2], l["mb"])
        if l["label"]:
            mid = (pts[0] + pts[-1]) / 2 if len(pts) == 2 else pts[len(pts) // 2]
            ax.text(mid[0] + l["lab_off"][0], mid[1] + l["lab_off"][1], l["label"],
                    ha="center", va="bottom", fontsize=8.6, color=TXT, zorder=6,
                    style="italic", bbox=dict(fc="white", ec="none", pad=1.0))
