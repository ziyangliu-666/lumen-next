# B. Instrument

The idea: lumen is the front panel of a laboratory instrument. The page is monochrome, and colour means a run state. On landing, a call tree plays once and ends in "3 findings · $0.94".

## Colour

- Surfaces: well `#111316`, ground `#16181B`, panel `#1C1F23`.
- Text: ink `#F2F3F5`, body `#C9CDD2`, secondary `#8A9098`.
- Faint `#5D636B` is for marks only, because it is 2.9:1. Text never goes below secondary (5.5:1).
- Rules: rule `#2A2E33`, strong rule `#3A3F46`.
- States: decide `#E0A93B`, gap `#E5675A`, keep `#6CC497`. Open is an ink outline. Dropped is a faint square with line-through text.
- No accent colour. The primary action is an inverted key.

## Type

- Archivo, one family on its width axis: 118% for display, 100% for UI, 87% for labels.
- Scale: display 40 to 96 px, h1 28 to 44 px, h2 22, lede 18, body 15, UI 14, label 13.
- JetBrains Mono for IDs, paths and terminal output.

## Grid

12 columns in a 1440 px frame, 1 px rules, square corners. Wordmark and label cells span 3 columns. Press G to show the grid.

Adoption: the self-hosted `archivo.woff2` has a weight axis only. Replace it with a file that has the width axis too.
