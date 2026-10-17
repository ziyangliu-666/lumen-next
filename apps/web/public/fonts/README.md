# Fonts

Served from this origin, so the page loads nothing from a third party.

| File | Family | Licence | Source |
|---|---|---|---|
| `switzer.woff2` | Switzer, variable weight 100 to 900, the sans for every page | ITF Free Font License (FFL), which allows self-hosting on the web | https://www.fontshare.com/fonts/switzer (the variable file from `api.fontshare.com/v2/css?f[]=switzer@1`) |
| `jetbrains-mono.woff2` | JetBrains Mono, variable weight | SIL Open Font License 1.1 | https://fonts.google.com/specimen/JetBrains+Mono |
| `archivo.woff2` | Archivo, variable weight | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Archivo |

Archivo was the sans before the Raster design. No `@font-face` loads it now.
It stays here so that a page can fall back to it in one line if Switzer must
go; delete it once the Raster port is settled.

The `@font-face` rules are in `src/styles/theme.css`.
