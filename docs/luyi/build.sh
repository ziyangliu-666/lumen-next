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

PY="${PYTHON:-python}"                       # needs 3.9+ for the docx skill scripts
SKILL="${DOCX_SKILL:-$HOME/.claude/skills/docx/scripts/office}"
REF="$LUYI/Design-Format-Review.docx"        # supplies the styles, not the content
SOFFICE="${SOFFICE:-C:\\Program Files\\LibreOffice\\program\\soffice.com}"
export PYTHONUTF8=1

cd "$LUYI"
pandoc design.md -f markdown -t docx --reference-doc="$REF" -o "$WORK/built.docx"

"$PY" "$SKILL/unpack.py" "$WORK/built.docx" "$WORK/unpacked" >/dev/null
"$PY" "$LUYI/postprocess.py" "$WORK/unpacked/word/document.xml"

# pandoc declares each image with an Override; the validator wants a Default too
sed -i 's|<Default Extension="xml"|<Default Extension="png" ContentType="image/png"/><Default Extension="xml"|' \
    "$WORK/unpacked/[Content_Types].xml"

"$PY" "$SKILL/pack.py" "$WORK/unpacked" "$LUYI/design.docx" --original "$WORK/built.docx"

# PDF preview, best effort — the docx is the deliverable either way. Invoked
# through powershell.exe because a sandboxed Git Bash may not see Program Files
# at all, while the Windows shell still runs it fine.
WINWORK=$(cygpath -w "$WORK" 2>/dev/null || echo "$WORK")
powershell.exe -NoProfile -Command \
    "& '$SOFFICE' --headless --norestore --convert-to pdf --outdir '$WINWORK' '$(cygpath -w "$LUYI/design.docx" 2>/dev/null || echo "$LUYI/design.docx")'" \
    >/dev/null 2>&1 || true
if [ -f "$WORK/design.pdf" ]; then
    mv "$WORK/design.pdf" "$LUYI/UC1-Identity-Design-LU-YI.pdf"
    echo "built $LUYI/UC1-Identity-Design-LU-YI.pdf"
else
    echo "no PDF preview (LibreOffice not found at \$SOFFICE) — docx is unaffected"
fi

echo "built $LUYI/design.docx"
