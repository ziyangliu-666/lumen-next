# Direction A: Raster

The grid is the interface. Black rules divide each screen into fields, like a
poster. Type size carries the hierarchy. Colour marks only the moment that
needs a person.

## Colour

- paper `#FFFFFF`, well `#F2F3F4` (terminal output and hover only)
- ink `#000000`, ink-2 `#5E6166`
- rule `#000000` (between fields), rule-minor `#D6D8DB` (between entries)
- signal `#E30613`: the decide state and the send button on focus or press, nothing else

State marks: keep is a solid square, open is an outline square, dropped is
grey and struck through, gap is a red outline, decide is solid red.

## Type

Switzer 400 to 700. IBM Plex Mono is for code, paths and terminal output only.
The scale is 12, 14, 16, 20, 28, 40, 64, 136. Display text is 600 weight, with
-0.04em tracking and 0.9 line height. Body text is 16/24. All money, times and
counts use tabular numerals.

## Grid

The grid has 12 columns, a 24px gutter and a 40px margin. At 720px and below it
has 4 columns, a 16px gutter and a 20px margin. Text is flush-left, radius is 0,
spacing sits on a 4px baseline. Press G to show the columns.

## One screen

No page scrolls. The bar stays fixed, and only a content region scrolls
inside the screen: the project list on home, and the transcript and the rail
on session. The session opens at its newest entry. Below 1080px the rail is
a sheet that opens from the session header.

## The landing image

A lumen is the unit of luminous flux, so the landing page is a halftone print
of a lit sphere, and the cursor is the light (`light.js`). When the cursor
moves, the terminator turns round the sphere and the shadow slides along the
floor. With no pointer, the light circles once every 20 seconds. With reduced
motion, the page shows one still frame, lit from the upper left. The type
steps back so that the sphere is the image: the headline is 64px, the corners
use 14px type, and the field is one hairline.

## Dark theme

The dark theme is the same token set printed in light on black: paper
`#000000`, ink `#FFFFFF`, ink-2 `#8D9096`, rule-minor `#2E3033`, well
`#151618`, signal `#FF3B30` (the print red is too dark on black). It follows
the OS setting; `D` toggles it for review and the choice holds across pages
(`theme.js`). On the landing the screen prints light instead of ink, so dot
area is the light a point returns, and the sphere floats without a shadow.

## Second pass: what was cut

- Home: no column heads, no 64px "Projects" title, no 64px spend figures.
  Each project is one row: name and state, a two-line summary, spend and
  age on the right edge at body size. The project that waits on you is first.
- Session: the 40px crumb is a 16px line; state, spend and time sit on it.
  The rail loses "This project", which repeated the page.
- Copy: no middle-dot meta strings and no dashes in prose. The placeholder
  says what to type, not a slogan.
- One input field on every page: 14px modes, 20px text, a hairline, a 40px
  send square.
