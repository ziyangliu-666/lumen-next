"""Draws every slide of the deck from out/slides.json into out/preview/, without PowerPoint.

Text is laid out with Arial at its real size and wrapped at word boundaries, as PowerPoint
does. A text that does not fit its box is drawn with a red outline and listed on stdout, so
overflow is found before anyone opens the deck. A GIF is drawn as its first frame.

    python3 docs/platform/slides/preview.py
"""
import json
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
DPI = 110
SWITZER = os.path.join(HERE, "..", "..", "..", "apps", "web", "public", "fonts", "switzer.woff2")
MONO = os.path.join(HERE, "..", "..", "..", "apps", "web", "public", "fonts", "jetbrains-mono.woff2")
WEIGHT = {"Switzer": "Regular", "Switzer Medium": "Medium", "Switzer Semibold": "Semibold"}
_fonts = {}


def face(name, pt):
    """The face the deck names, at its size on the slide."""
    key = (name, pt)
    if key not in _fonts:
        f = ImageFont.truetype(MONO if name == "JetBrains Mono" else SWITZER, round(pt / 72 * DPI))
        if name != "JetBrains Mono":
            f.set_variation_by_name(WEIGHT.get(name, "Regular"))
        _fonts[key] = f
    return _fonts[key]


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def wrap(draw, text, f, width):
    lines = []
    for para in text.split("\n"):
        words, line = para.split(" "), ""
        for w in words:
            trial = (line + " " + w).strip()
            if draw.textlength(trial, font=f) <= width or not line:
                line = trial
            else:
                lines.append(line)
                line = w
        lines.append(line)
    return lines


def main():
    spec = json.load(open(os.path.join(OUT, "slides.json")))
    os.makedirs(os.path.join(OUT, "preview"), exist_ok=True)
    problems = []
    for n, slide in enumerate(spec, 1):
        size = (round(13.333 * DPI), round(7.5 * DPI))
        im = Image.new("RGB", size, rgb(slide["bg"]))
        if slide.get("backdrop"):
            im.paste(Image.open(slide["backdrop"]).convert("RGB").resize(size), (0, 0))
        d = ImageDraw.Draw(im)
        for it in slide["items"]:
            box = [it["x"] * DPI, it["y"] * DPI, (it["x"] + it["w"]) * DPI, (it["y"] + it["h"]) * DPI]
            if it["kind"] == "rect":
                d.rectangle(box, fill=rgb(it["fill"]) if it.get("fill") else None,
                            outline=rgb(it["line"]) if it.get("line") else None)
            elif it["kind"] == "image":
                pic = Image.open(it["file"]).convert("RGB").resize((round(it["w"] * DPI), round(it["h"] * DPI)))
                im.paste(pic, (round(box[0]), round(box[1])))
            else:
                f = face(it.get("fontFace", "Switzer"), it["fontSize"])
                lines = wrap(d, it["text"], f, box[2] - box[0])
                asc, desc = f.getmetrics()
                lh = (asc + desc) * 1.05
                total = lh * len(lines)
                top = box[1] if it.get("valign", "top") == "top" else box[1] + (box[3] - box[1] - total) / 2
                for i, line in enumerate(lines):
                    tw = d.textlength(line, font=f)
                    al = it.get("align", "left")
                    x = box[0] if al == "left" else (box[2] - tw if al == "right" else (box[0] + box[2] - tw) / 2)
                    d.text((x, top + i * lh), line, font=f, fill=rgb(it.get("color", "1A1D23")))
                if total > (box[3] - box[1]) + 2:
                    d.rectangle(box, outline=(255, 0, 0), width=3)
                    problems.append("slide %d: '%s' needs %d lines" % (n, it["text"][:40], len(lines)))
        im.save(os.path.join(OUT, "preview", "slide-%02d.png" % n))
    print(len(spec), "slides drawn")
    for p in problems:
        print("OVERFLOW", p)


if __name__ == "__main__":
    main()
