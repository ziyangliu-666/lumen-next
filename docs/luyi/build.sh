#!/usr/bin/env bash
# Build design.docx from design.md.
#   markdown -> pandoc -> unpack -> post-process XML -> repack -> PDF preview
#
# Run it from this directory: bash build.sh
# Figures are resolved relative to here, so the working directory matters.
set -euo pipefail

LUYI="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

SKILL="${DOCX_SKILL:-$HOME/.claude/skills/docx/scripts/office}"
REF="$LUYI/Design-Format-Review.docx"        # supplies the styles, not the content
export PYTHONUTF8=1

# The docx skill scripts annotate with builtin generics, so they need 3.9+, and
# say so only as a TypeError deep inside an import. `python` on Windows is often
# older than that while the `py` launcher reaches a newer one, so pick an
# interpreter that can actually run them instead of assuming the first one can.
py_ok() { "$1" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)' >/dev/null 2>&1; }
if [ -n "${PYTHON:-}" ]; then
    PY="$PYTHON"
    py_ok "$PY" || { echo "PYTHON=$PY is older than the 3.9 the docx scripts need" >&2; exit 1; }
else
    PY=""
    for c in python3 python py; do
        if command -v "$c" >/dev/null 2>&1 && py_ok "$c"; then PY="$c"; break; fi
    done
    [ -n "$PY" ] || { echo "no Python 3.9+ on PATH (tried python3, python, py); set PYTHON=" >&2; exit 1; }
fi

cd "$LUYI"
pandoc design.md -f markdown -t docx --reference-doc="$REF" -o "$WORK/built.docx"

"$PY" "$SKILL/unpack.py" "$WORK/built.docx" "$WORK/unpacked" >/dev/null
"$PY" "$LUYI/postprocess.py" "$WORK/unpacked/word/document.xml"

# pandoc declares each image with an Override; the validator wants a Default too
sed -i 's|<Default Extension="xml"|<Default Extension="png" ContentType="image/png"/><Default Extension="xml"|' \
    "$WORK/unpacked/[Content_Types].xml"

"$PY" "$SKILL/pack.py" "$WORK/unpacked" "$LUYI/design.docx" --original "$WORK/built.docx"

# PDF preview, best effort — the docx above is the deliverable either way. Two
# converters are tried in turn, because neither is guaranteed to be installed:
# LibreOffice where it exists, then Word, which on a Windows box usually does.
# Both run through powershell.exe, because a sandboxed Git Bash may not see
# C:\Program Files at all while the Windows shell still runs from it fine.
#
# Failure here used to be a one-line note that was easy to scroll past, which is
# how a stale PDF once got committed beside a rebuilt docx. It is now loud.
PDF="$LUYI/UC1-Identity-Design-LU-YI.pdf"
win() { cygpath -w "$1" 2>/dev/null || printf '%s\n' "$1"; }

# $SOFFICE wins if it points at something real; otherwise look where LibreOffice
# installs itself, then let the PATH answer. A hardcoded path that silently stops
# existing is the failure this replaces.
soffice_path() {
    local c u
    for c in ${SOFFICE:+"$SOFFICE"} \
             "C:/Program Files/LibreOffice/program/soffice.com" \
             "C:/Program Files (x86)/LibreOffice/program/soffice.com"; do
        u=$(cygpath -u "$c" 2>/dev/null || printf '%s\n' "$c")
        if [ -f "$u" ]; then printf '%s\n' "$u"; return 0; fi
    done
    command -v soffice 2>/dev/null
}

# Word's own export of the same docx. 17 is wdExportFormatPDF.
word_to_pdf() {
    powershell.exe -NoProfile -NonInteractive -Command "
        \$ErrorActionPreference = 'Stop'
        \$word = \$null; \$doc = \$null
        try {
            \$word = New-Object -ComObject Word.Application
            \$word.Visible = \$false
            \$word.DisplayAlerts = 0
            \$doc = \$word.Documents.Open('$1', \$false, \$true, \$false)
            \$doc.ExportAsFixedFormat('$2', 17, \$false)
        } finally {
            if (\$null -ne \$doc)  { \$doc.Close(\$false) }
            if (\$null -ne \$word) { \$word.Quit() }
        }" 2>&1
}

built_by=""
why=""
if SOFF=$(soffice_path); then
    if powershell.exe -NoProfile -NonInteractive -Command \
           "& '$(win "$SOFF")' --headless --norestore --convert-to pdf --outdir '$(win "$WORK")' '$(win "$LUYI/design.docx")'" \
           >/dev/null 2>&1 && [ -f "$WORK/design.pdf" ]; then
        built_by="LibreOffice"
    else
        why="LibreOffice at $SOFF ran but wrote no PDF"
    fi
else
    why="LibreOffice is not installed"
fi

if [ -z "$built_by" ]; then
    word_err=$(word_to_pdf "$(win "$LUYI/design.docx")" "$(win "$WORK/design.pdf")") || true
    if [ -f "$WORK/design.pdf" ]; then
        built_by="Word"
    else
        why="$why; Word: ${word_err:-no Word.Application COM object}"
    fi
fi

if [ -n "$built_by" ]; then
    mv "$WORK/design.pdf" "$PDF"
    echo "built $PDF (via $built_by)"
else
    {
        echo
        echo "!! NO PDF BUILT. design.docx is fine and is what gets submitted, but"
        echo "!! $(basename "$PDF") is now STALE — do not commit it as current."
        echo "!! $why"
        echo "!! Fix: install LibreOffice, or SOFFICE=/path/to/soffice.com bash build.sh,"
        echo "!!      or open design.docx in Word and save a PDF over that filename."
        echo
    } >&2
fi

echo "built $LUYI/design.docx"
