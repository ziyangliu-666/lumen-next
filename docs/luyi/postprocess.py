# -*- coding: utf-8 -*-
"""Two fixes pandoc cannot make on its own, applied to word/document.xml.

  1. The U+23CE sentinel becomes a real Word line break, inside the run that
     carried it, so the run's formatting survives. Markdown pipe tables have no
     way to put two lines in one cell, and raw <br> is dropped by the docx
     writer, so design.md writes the sentinel instead.
  2. The API tables of section 3 pack four dense columns into one text width, so
     they run a step smaller than body text: 10pt prose, 9pt code. Word breaks a
     long identifier mid-token otherwise.

Usage: python postprocess.py <path to word/document.xml>
"""
import io
import re
import sys

S = "⏎"

# a table is one of section 3's if its header row starts with one of these
WIDE_TABLE_HEADERS = ("Method and path", "Code")

# a run is code if it carries the Verbatim Char character style, which the
# reference document numbers 48
CODE_RUN = re.compile(r'<w:rStyle w:val="48"/>')

RUN_TEXT = re.compile(r'<w:t(?P<attrs>[^>]*)>(?P<body>[^<]*' + S + r'[^<]*)</w:t>')
TABLE = re.compile(r"<w:tbl>.*?</w:tbl>", re.S)
FIRST_TEXT = re.compile(r"<w:t[^>]*>([^<]*)</w:t>")


def split_on_sentinel(m):
    out = []
    for i, part in enumerate(m.group("body").split(S)):
        if i:
            out.append("<w:br/>")
        if part:
            sp = ' xml:space="preserve"' if part != part.strip() else ""
            out.append("<w:t%s>%s</w:t>" % (sp, part))
    return "".join(out)


def shrink(match, counter):
    body = match.group(0)
    first = FIRST_TEXT.search(body)
    if not first or first.group(1).strip() not in WIDE_TABLE_HEADERS:
        return body
    counter[0] += 1

    def size_run(rm):
        run = rm.group(0)
        if "<w:sz " in run:
            return run
        sz = 18 if CODE_RUN.search(run) else 20
        tag = '<w:sz w:val="%d"/><w:szCs w:val="%d"/>' % (sz, sz)
        if "<w:rPr>" in run:
            return run.replace("</w:rPr>", tag + "</w:rPr>", 1)
        return run.replace("<w:r>", "<w:r><w:rPr>" + tag + "</w:rPr>", 1)

    return re.sub(r"<w:r>.*?</w:r>", size_run, body, flags=re.S)


def main(path):
    doc = io.open(path, encoding="utf-8").read()

    n_breaks = doc.count(S)
    doc = RUN_TEXT.sub(split_on_sentinel, doc)
    assert S not in doc, "sentinel left behind"

    counter = [0]
    doc = TABLE.sub(lambda m: shrink(m, counter), doc)

    io.open(path, "w", encoding="utf-8").write(doc)
    print("line breaks: %d   tables shrunk: %d" % (n_breaks, counter[0]))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: postprocess.py <path to word/document.xml>")
    main(sys.argv[1])
